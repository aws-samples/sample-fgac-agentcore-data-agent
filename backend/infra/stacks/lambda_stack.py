"""
Lambda Stack — Gateway Target Lambda.
"""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_cognito as cognito,
    aws_s3 as s3,
)
from constructs import Construct


class LambdaStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        cognito_user_pool: cognito.IUserPool,
        identity_pool_id: str,
        athena_output_bucket: s3.IBucket,
        data_bucket: s3.IBucket,
        database_name: str,
        lf_region: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        cognito_region = self.region

        # ── Target Lambda ──
        self.target_fn = _lambda.Function(
            self, "TargetFn",
            function_name="fgac-gateway-target",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "gateway-target-lambda"),
            ),
            timeout=cdk.Duration.seconds(120),
            memory_size=512,
            architecture=_lambda.Architecture.ARM_64,
            environment={
                "ATHENA_OUTPUT": f"s3://{athena_output_bucket.bucket_name}/",
                "DATABASE": database_name,
                "ATHENA_REGION": lf_region,
                "COGNITO_REGION": cognito_region,
                "USER_POOL_ID": cognito_user_pool.user_pool_id,
                "IDENTITY_POOL_ID": identity_pool_id,
            },
        )

        # Target Lambda needs: Cognito Identity, STS, Athena, Glue, S3, LakeFormation
        self.target_fn.add_to_role_policy(iam.PolicyStatement(
            actions=[
                "cognito-identity:GetId",
                "cognito-identity:GetCredentialsForIdentity",
            ],
            resources=["*"],
        ))
        self.target_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["sts:GetCallerIdentity"],
            resources=["*"],
        ))
        self.target_fn.add_to_role_policy(iam.PolicyStatement(
            actions=[
                "athena:StartQueryExecution",
                "athena:GetQueryExecution",
                "athena:GetQueryResults",
                "athena:StopQueryExecution",
            ],
            resources=["*"],
        ))
        self.target_fn.add_to_role_policy(iam.PolicyStatement(
            actions=[
                "glue:GetTable", "glue:GetTables",
                "glue:GetDatabase", "glue:GetDatabases",
                "glue:GetPartitions",
            ],
            resources=["*"],
        ))
        self.target_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["lakeformation:GetDataAccess"],
            resources=["*"],
        ))
        athena_output_bucket.grant_read_write(self.target_fn)
        data_bucket.grant_read(self.target_fn)

        # ── Outputs ──
        cdk.CfnOutput(self, "TargetFnArn", value=self.target_fn.function_arn)
