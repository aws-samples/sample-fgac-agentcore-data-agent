"""
Cognito Stack — User Pool, App Client, Identity Pool with rules-based role mapping.
"""
from typing import TypedDict

import aws_cdk as cdk
from aws_cdk import (
    aws_cognito as cognito,
    aws_iam as iam,
    aws_s3 as s3,
    custom_resources as cr,
)
from constructs import Construct

class CognitoUser(TypedDict):
    username: str
    email: str
    team: str
    password: str


class CognitoStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        data_bucket: s3.IBucket,
        data_lake_region: str,
        cognito_users: list[CognitoUser],
        athena_output_bucket: s3.IBucket,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # ── User Pool ──
        self.user_pool = cognito.UserPool(
            self, "FgacUserPool",
            user_pool_name="fgac-user-pool",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(username=True, email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            custom_attributes={
                "team": cognito.StringAttribute(min_len=1, max_len=50, mutable=True),
            },
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # Hosted UI domain
        self.user_pool.add_domain(
            "FgacDomain",
            cognito_domain=cognito.CognitoDomainOptions(domain_prefix=f"fgac-user-pool-{cdk.Aws.ACCOUNT_ID}"),
        )

        # App client
        self.app_client = self.user_pool.add_client(
            "FgacAppClient",
            user_pool_client_name="fgac-app-client",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
            ),
            read_attributes=cognito.ClientAttributes().with_custom_attributes("team"),
        )

        # ── Identity Pool (created first so roles can reference its ID) ──
        self.identity_pool = cognito.CfnIdentityPool(
            self, "FgacIdentityPool",
            identity_pool_name="fgac-identity-pool",
            allow_unauthenticated_identities=False,
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=self.app_client.user_pool_client_id,
                    provider_name=self.user_pool.user_pool_provider_name,
                )
            ],
        )

        # ── IAM Roles for Team A / Team B ──
        # Roles include aud condition at creation time (required by IAM)
        def _make_team_role(team_name: str) -> iam.Role:
            role = iam.Role(
                self, f"{team_name}Role",
                role_name=team_name,
                assumed_by=iam.FederatedPrincipal(
                    "cognito-identity.amazonaws.com",
                    conditions={
                        "StringEquals": {
                            "cognito-identity.amazonaws.com:aud": self.identity_pool.ref,
                        },
                        "ForAnyValue:StringLike": {
                            "cognito-identity.amazonaws.com:amr": "authenticated",
                        },
                    },
                    assume_role_action="sts:AssumeRoleWithWebIdentity",
                ),
            )
            # Athena + Glue + S3 read permissions (Lake Formation TBAC handles row/table filtering)
            role.add_to_policy(iam.PolicyStatement(
                actions=[
                    "athena:StartQueryExecution",
                    "athena:GetQueryExecution",
                    "athena:GetQueryResults",
                    "athena:StopQueryExecution",
                    "glue:GetTable",
                    "glue:GetTables",
                    "glue:GetDatabase",
                    "glue:GetDatabases",
                    "glue:GetPartitions",
                    "lakeformation:GetDataAccess",
                ],
                resources=["*"],
            ))
            role.add_to_policy(iam.PolicyStatement(
                actions=["s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:PutObject"],
                resources=[
                    f"{data_bucket.bucket_arn}/*",
                    data_bucket.bucket_arn,
                    f"{athena_output_bucket.bucket_arn}/*",
                    athena_output_bucket.bucket_arn,
                ],
            ))
            return role

        self.team_a_role = _make_team_role("TeamA")
        self.team_b_role = _make_team_role("TeamB")

        # Rules-based role mapping: custom:team → IAM role
        cognito.CfnIdentityPoolRoleAttachment(
            self, "FgacRoleAttachment",
            identity_pool_id=self.identity_pool.ref,
            roles={},  # no default roles — all via rules
            role_mappings={
                "cognito": cognito.CfnIdentityPoolRoleAttachment.RoleMappingProperty(
                    identity_provider=f"{self.user_pool.user_pool_provider_name}:{self.app_client.user_pool_client_id}",
                    type="Rules",
                    ambiguous_role_resolution="Deny",
                    rules_configuration=cognito.CfnIdentityPoolRoleAttachment.RulesConfigurationTypeProperty(
                        rules=[
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="custom:team",
                                match_type="Equals",
                                value="Team A",
                                role_arn=self.team_a_role.role_arn,
                            ),
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="custom:team",
                                match_type="Equals",
                                value="Team B",
                                role_arn=self.team_b_role.role_arn,
                            ),
                        ],
                    ),
                ),
            },
        )

        # Make users
        def _make_user(username: str, email: str, team: str, password: str):
            create_user = cr.AwsCustomResource(
                self, f"CreateUser-{username}",
                on_create=cr.AwsSdkCall(
                    service="CognitoIdentityServiceProvider",
                    action="adminCreateUser",
                    parameters={
                        "UserPoolId": self.user_pool.user_pool_id,
                        "Username": username,
                        "TemporaryPassword": password,
                        "MessageAction": "SUPPRESS",  # don't send welcome email
                        "UserAttributes": [
                            {"Name": "email", "Value": email},
                            {"Name": "email_verified", "Value": "true"},
                            {"Name": "custom:team", "Value": team},
                        ],
                    },
                    physical_resource_id=cr.PhysicalResourceId.of(f"user-{username}"),
                ),
                on_delete=cr.AwsSdkCall(
                    service="CognitoIdentityServiceProvider",
                    action="adminDeleteUser",
                    parameters={
                        "UserPoolId": self.user_pool.user_pool_id,
                        "Username": username,
                    },
                ),
                policy=cr.AwsCustomResourcePolicy.from_statements([
                    iam.PolicyStatement(
                        actions=[
                            "cognito-idp:AdminCreateUser",
                            "cognito-idp:AdminDeleteUser",
                            "cognito-idp:AdminSetUserPassword",
                        ],
                        resources=[self.user_pool.user_pool_arn],
                    )
                ]),
            )

            # Set permanent password (moves user out of FORCE_CHANGE_PASSWORD)
            set_password = cr.AwsCustomResource(
                self, f"SetPassword-{username}",
                on_create=cr.AwsSdkCall(
                    service="CognitoIdentityServiceProvider",
                    action="adminSetUserPassword",
                    parameters={
                        "UserPoolId": self.user_pool.user_pool_id,
                        "Username": username,
                        "Password": password,
                        "Permanent": True,
                    },
                    physical_resource_id=cr.PhysicalResourceId.of(f"pwd-{username}"),
                ),
                policy=cr.AwsCustomResourcePolicy.from_statements([
                    iam.PolicyStatement(
                        actions=["cognito-idp:AdminSetUserPassword"],
                        resources=[self.user_pool.user_pool_arn],
                    )
                ]),
            )
            set_password.node.add_dependency(create_user)

        # Create users
        for user in cognito_users:
            _make_user(user["username"], user["email"], user["team"], user["password"])

        # ── Outputs ──
        cdk.CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        cdk.CfnOutput(self, "UserPoolClientId", value=self.app_client.user_pool_client_id)
        cdk.CfnOutput(self, "IdentityPoolId", value=self.identity_pool.ref)
        cdk.CfnOutput(self, "TeamARoleArn", value=self.team_a_role.role_arn)
        cdk.CfnOutput(self, "TeamBRoleArn", value=self.team_b_role.role_arn)
