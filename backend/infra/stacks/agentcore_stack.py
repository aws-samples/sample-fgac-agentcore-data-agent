"""
AgentCore Stack — Runtime, MCP Gateway, Gateway Target.

Creates the full Bedrock AgentCore agent backend:
  - ECR Repository for agent container image
  - CodeBuild project to build ARM64 Docker image
  - Custom Resource to trigger the build
  - AgentCore Runtime (Strands agent with Cognito JWT authorizer)
  - MCP Gateway (JWT-authenticated)
  - Gateway Target (Lambda target with tool schema)
"""
import os
import json
import aws_cdk as cdk
from aws_cdk import (
    aws_bedrockagentcore as agentcore,
    aws_codebuild as codebuild,
    aws_ecr as ecr,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_s3_assets as s3_assets,
    aws_cognito as cognito,
    aws_ssm as ssm,
    CustomResource,
    Duration,
    RemovalPolicy,
)
from constructs import Construct


class AgentCoreStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        cognito_user_pool: cognito.IUserPool,
        cognito_app_client_id: str,
        target_lambda_arn: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        discovery_url = (
            f"https://cognito-idp.{self.region}.amazonaws.com/"
            f"{cognito_user_pool.user_pool_id}/.well-known/openid-configuration"
        )

        agent_code_path = os.path.join(os.path.dirname(__file__), "..", "..", "fgacdataagent")
        image_tag = "latest"

        # ── ECR Repository ──
        ecr_repository = ecr.Repository(
            self, "AgentECR",
            repository_name="fgac-data-agent",
            image_tag_mutability=ecr.TagMutability.MUTABLE,
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True,
        )

        # ── S3 Asset (zip of agent source code) ──
        source_asset = s3_assets.Asset(
            self, "AgentSourceAsset",
            path=agent_code_path,
            exclude=[".venv", "__pycache__", "*.pyc", ".git", "test", ".bedrock_agentcore"],
        )

        # ── CodeBuild Role ──
        codebuild_role = iam.Role(
            self, "CodeBuildRole",
            assumed_by=iam.ServicePrincipal("codebuild.amazonaws.com"),
            inline_policies={
                "CodeBuildPolicy": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "logs:CreateLogGroup",
                                "logs:CreateLogStream",
                                "logs:PutLogEvents",
                            ],
                            resources=[f"arn:aws:logs:{self.region}:{self.account}:log-group:/aws/codebuild/*"],
                        ),
                        iam.PolicyStatement(
                            actions=[
                                "ecr:BatchCheckLayerAvailability",
                                "ecr:GetDownloadUrlForLayer",
                                "ecr:BatchGetImage",
                                "ecr:GetAuthorizationToken",
                                "ecr:PutImage",
                                "ecr:InitiateLayerUpload",
                                "ecr:UploadLayerPart",
                                "ecr:CompleteLayerUpload",
                            ],
                            resources=[ecr_repository.repository_arn, "*"],
                        ),
                        iam.PolicyStatement(
                            actions=["s3:GetObject"],
                            resources=[f"{source_asset.bucket.bucket_arn}/*"],
                        ),
                    ]
                )
            },
        )

        # ── CodeBuild Project (ARM64) ──
        build_project = codebuild.Project(
            self, "AgentBuildProject",
            project_name="fgac-agent-build",
            description="Build FGAC agent Docker image (ARM64)",
            role=codebuild_role,
            environment=codebuild.BuildEnvironment(
                build_image=codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
                compute_type=codebuild.ComputeType.LARGE,
                privileged=True,
            ),
            source=codebuild.Source.s3(
                bucket=source_asset.bucket,
                path=source_asset.s3_object_key,
            ),
            build_spec=codebuild.BuildSpec.from_object({
                "version": "0.2",
                "phases": {
                    "pre_build": {
                        "commands": [
                            "echo Logging in to Amazon ECR...",
                            "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
                        ]
                    },
                    "build": {
                        "commands": [
                            "echo Building Docker image...",
                            "docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .",
                            "docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                        ]
                    },
                    "post_build": {
                        "commands": [
                            "echo Pushing Docker image...",
                            "docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                        ]
                    },
                },
            }),
            environment_variables={
                "AWS_DEFAULT_REGION": codebuild.BuildEnvironmentVariable(value=self.region),
                "AWS_ACCOUNT_ID": codebuild.BuildEnvironmentVariable(value=self.account),
                "IMAGE_REPO_NAME": codebuild.BuildEnvironmentVariable(value=ecr_repository.repository_name),
                "IMAGE_TAG": codebuild.BuildEnvironmentVariable(value=image_tag),
            },
        )

        # ── Lambda to trigger CodeBuild ──
        build_trigger_code = """
import boto3
import time
import cfnresponse

def handler(event, context):
    if event['RequestType'] == 'Delete':
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        return

    project_name = event['ResourceProperties']['ProjectName']
    client = boto3.client('codebuild')

    try:
        response = client.start_build(projectName=project_name)
        build_id = response['build']['id']

        # Poll for completion
        while True:
            builds = client.batch_get_builds(ids=[build_id])
            status = builds['builds'][0]['buildStatus']
            if status == 'SUCCEEDED':
                cfnresponse.send(event, context, cfnresponse.SUCCESS, {'BuildId': build_id})
                return
            elif status in ('FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'):
                cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': f'Build {status}'})
                return
            time.sleep(10)
    except Exception as e:
        cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
"""

        build_trigger_fn = lambda_.Function(
            self, "BuildTriggerFn",
            runtime=lambda_.Runtime.PYTHON_3_11,
            handler="index.handler",
            timeout=Duration.minutes(15),
            code=lambda_.Code.from_inline(build_trigger_code),
            initial_policy=[
                iam.PolicyStatement(
                    actions=["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
                    resources=[build_project.project_arn],
                ),
            ],
        )

        # ── Custom Resource to trigger build ──
        trigger_build = CustomResource(
            self, "TriggerImageBuild",
            service_token=build_trigger_fn.function_arn,
            properties={
                "ProjectName": build_project.project_name,
                "SourceHash": source_asset.asset_hash,  # Triggers rebuild on code change
            },
        )

        # ── AgentCore Execution Role ──
        self.runtime_role = iam.Role(
            self, "AgentCoreRuntimeRole",
            assumed_by=iam.CompositePrincipal(
                iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
                iam.ServicePrincipal("bedrock.amazonaws.com"),
            ),
        )
        self.runtime_role.add_to_policy(iam.PolicyStatement(
            actions=["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
            resources=["*"],
        ))
        self.runtime_role.add_to_policy(iam.PolicyStatement(
            actions=["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
            resources=["*"],
        ))
        # AgentCore Memory (data plane) — scoped to memory resources in this
        # account/region. Only the actions the Strands memory session manager
        # actually performs are granted.
        self.runtime_role.add_to_policy(iam.PolicyStatement(
            actions=[
                "bedrock-agentcore:CreateEvent",
                "bedrock-agentcore:GetEvent",
                "bedrock-agentcore:ListEvents",
                "bedrock-agentcore:DeleteEvent",
                "bedrock-agentcore:ListActors",
                "bedrock-agentcore:ListSessions",
                "bedrock-agentcore:RetrieveMemoryRecords",
            ],
            resources=[
                f"arn:aws:bedrock-agentcore:{self.region}:{self.account}:memory/*",
            ],
        ))
        # AgentCore Code Interpreter — scoped to code-interpreter resources.
        # Includes the AWS-owned built-in interpreter (aws.codeinterpreter.v1)
        # and any account-owned custom interpreters in this region.
        self.runtime_role.add_to_policy(iam.PolicyStatement(
            actions=[
                "bedrock-agentcore:StartCodeInterpreterSession",
                "bedrock-agentcore:InvokeCodeInterpreter",
                "bedrock-agentcore:StopCodeInterpreterSession",
                "bedrock-agentcore:GetCodeInterpreterSession",
                "bedrock-agentcore:ListCodeInterpreterSessions",
                "bedrock-agentcore:GetCodeInterpreter",
                "bedrock-agentcore:ListCodeInterpreters",
            ],
            resources=[
                f"arn:aws:bedrock-agentcore:{self.region}:{self.account}:code-interpreter/*",
                f"arn:aws:bedrock-agentcore:{self.region}:aws:code-interpreter/*",
            ],
        ))
        ecr_repository.grant_pull(self.runtime_role)

        # ── Gateway IAM Role ──
        self.gateway_role = iam.Role(
            self, "GatewayRole",
            role_name="FgacAgentCoreGatewayRole",
            assumed_by=iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
        )
        self.gateway_role.add_to_policy(iam.PolicyStatement(
            actions=["lambda:InvokeFunction"],
            resources=[target_lambda_arn],
        ))

        # ── MCP Gateway ──
        self.gateway = agentcore.CfnGateway(
            self, "FgacGateway",
            name="fgac-gateway",
            authorizer_type="CUSTOM_JWT",
            protocol_type="MCP",
            role_arn=self.gateway_role.role_arn,
            authorizer_configuration=agentcore.CfnGateway.AuthorizerConfigurationProperty(
                custom_jwt_authorizer=agentcore.CfnGateway.CustomJWTAuthorizerConfigurationProperty(
                    discovery_url=discovery_url,
                    allowed_clients=[cognito_app_client_id],
                ),
            ),
            description="FGAC MCP Gateway with JWT auth",
        )

        # ── AgentCore Runtime ──
        self.runtime = agentcore.CfnRuntime(
            self, "FgacRuntime",
            agent_runtime_name="fgacdataagent",
            agent_runtime_artifact=agentcore.CfnRuntime.AgentRuntimeArtifactProperty(
                container_configuration=agentcore.CfnRuntime.ContainerConfigurationProperty(
                    container_uri=f"{ecr_repository.repository_uri}:{image_tag}",
                ),
            ),
            role_arn=self.runtime_role.role_arn,
            network_configuration=agentcore.CfnRuntime.NetworkConfigurationProperty(
                network_mode="PUBLIC",
            ),
            protocol_configuration="HTTP",
            authorizer_configuration=agentcore.CfnRuntime.AuthorizerConfigurationProperty(
                custom_jwt_authorizer=agentcore.CfnRuntime.CustomJWTAuthorizerConfigurationProperty(
                    discovery_url=discovery_url,
                    allowed_clients=[cognito_app_client_id],
                ),
            ),
            request_header_configuration=agentcore.CfnRuntime.RequestHeaderConfigurationProperty(
                request_header_allowlist=[
                    "Authorization",
                    "X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-Token",
                ],
            ),
            environment_variables={
                "AWS_DEFAULT_REGION": self.region,
                "AGENTCORE_GATEWAY_ENDPOINT": self.gateway.attr_gateway_url,
            },
            description="FGAC Data Agent - Strands SDK with Cognito JWT auth",
        )
        self.runtime.node.add_dependency(trigger_build)

        # ── Load tool schema from tool-schema.json ──
        tool_schema_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "gateway-target-lambda", "tool-schema.json"
        )
        with open(tool_schema_path) as f:
            tool_schema = json.load(f)

        def _build_schema_def(schema: dict) -> agentcore.CfnGatewayTarget.SchemaDefinitionProperty:
            """Recursively build SchemaDefinitionProperty from JSON schema."""
            props = {}
            if "properties" in schema:
                props = {
                    k: _build_schema_def(v)
                    for k, v in schema["properties"].items()
                }
            return agentcore.CfnGatewayTarget.SchemaDefinitionProperty(
                type=schema.get("type", "object"),
                description=schema.get("description"),
                properties=props if props else None,
                required=schema.get("required"),
            )

        inline_tools = []
        for tool in tool_schema["tools"]:
            tool_def = agentcore.CfnGatewayTarget.ToolDefinitionProperty(
                name=tool["name"],
                description=tool["description"],
                input_schema=_build_schema_def(tool["inputSchema"]),
            )
            if "outputSchema" in tool:
                tool_def = agentcore.CfnGatewayTarget.ToolDefinitionProperty(
                    name=tool["name"],
                    description=tool["description"],
                    input_schema=_build_schema_def(tool["inputSchema"]),
                    output_schema=_build_schema_def(tool["outputSchema"]),
                )
            inline_tools.append(tool_def)

        # ── Gateway Target (Lambda with MCP tools) ──
        self.gateway_target = agentcore.CfnGatewayTarget(
            self, "FgacGatewayTarget",
            name="fgac-lambda-target",
            gateway_identifier=self.gateway.attr_gateway_identifier,
            target_configuration=agentcore.CfnGatewayTarget.TargetConfigurationProperty(
                mcp=agentcore.CfnGatewayTarget.McpTargetConfigurationProperty(
                    lambda_=agentcore.CfnGatewayTarget.McpLambdaTargetConfigurationProperty(
                        lambda_arn=target_lambda_arn,
                        tool_schema=agentcore.CfnGatewayTarget.ToolSchemaProperty(
                            inline_payload=inline_tools,
                        ),
                    ),
                ),
            ),
            credential_provider_configurations=[
                agentcore.CfnGatewayTarget.CredentialProviderConfigurationProperty(
                    credential_provider_type="GATEWAY_IAM_ROLE",
                ),
            ],
            metadata_configuration=agentcore.CfnGatewayTarget.MetadataConfigurationProperty(
                allowed_request_headers=["X-ID-Token"],
                allowed_response_headers=["X-ID-Token"],
            ),
            description="FGAC target Lambda with Athena query tools",
        )

        # ── Outputs ──
        cdk.CfnOutput(self, "RuntimeArn", value=self.runtime.attr_agent_runtime_arn)
        cdk.CfnOutput(self, "RuntimeId", value=self.runtime.attr_agent_runtime_id)
        cdk.CfnOutput(self, "GatewayId", value=self.gateway.attr_gateway_identifier)
        cdk.CfnOutput(self, "GatewayUrl", value=self.gateway.attr_gateway_url)

        # ── SSM Parameters (frontend config) ──
        ssm_prefix = "/fgac-data-agent"

        ssm.StringParameter(
            self, "SsmCognitoUserPoolId",
            parameter_name=f"{ssm_prefix}/cognito/user-pool-id",
            string_value=cognito_user_pool.user_pool_id,
        )
        ssm.StringParameter(
            self, "SsmCognitoClientId",
            parameter_name=f"{ssm_prefix}/cognito/user-pool-client-id",
            string_value=cognito_app_client_id,
        )
        ssm.StringParameter(
            self, "SsmCognitoRegion",
            parameter_name=f"{ssm_prefix}/cognito/region",
            string_value=self.region,
        )
        ssm.StringParameter(
            self, "SsmAgentCoreArn",
            parameter_name=f"{ssm_prefix}/agentcore/agent-arn",
            string_value=self.runtime.attr_agent_runtime_arn,
        )
        ssm.StringParameter(
            self, "SsmAgentCoreRegion",
            parameter_name=f"{ssm_prefix}/agentcore/region",
            string_value=self.region,
        )
