#!/usr/bin/env python3
import os
import aws_cdk as cdk

from stacks.cognito_stack import CognitoStack
from stacks.data_lake_stack import DataLakeStack
from stacks.lake_formation_stack import LakeFormationStack
from stacks.lambda_stack import LambdaStack
from stacks.agentcore_stack import AgentCoreStack

app = cdk.App()

# Read context from cdk.json
data_lake_config = app.node.try_get_context("dataLake")

# Resolve Cognito user passwords from environment variables at deploy time.
# Passwords are intentionally NOT stored in cdk.json — each user entry names the
# environment variable (passwordEnv) that must be exported before `cdk deploy`,
# e.g. export TEAM_A_PASSWORD='...'. This keeps credentials out of source control.
cognito_users = []
for user in app.node.try_get_context("cognitousers") or []:
    password_env = user.get("passwordEnv")
    if not password_env:
        raise ValueError(
            f"cognitousers entry '{user.get('username')}' is missing the 'passwordEnv' key in cdk.json."
        )
    password = os.environ.get(password_env)
    if not password:
        raise ValueError(
            f"Environment variable '{password_env}' is not set. "
            f"Export it before running cdk deploy, e.g. export {password_env}='<password>'."
        )
    cognito_users.append(
        {
            "username": user["username"],
            "email": user["email"],
            "team": user["team"],
            "password": password,
        }
    )

# Inherit account + region from the AWS profile used to run cdk deploy.
# CDK CLI sets these env vars automatically during synth/deploy.
# Falls back to environment-agnostic stack if not set (e.g. running app.py directly).
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION"),
)

data_lake = DataLakeStack(
    app, "FgacDataLakeStack",
    database_name=data_lake_config["databaseName"],
    data_bucket_prefix=data_lake_config["dataBucketPrefix"],
    data_prefix=data_lake_config["dataPrefix"],
    env=env,
)

cognito = CognitoStack(
    app, "FgacCognitoStack",
    data_bucket=data_lake.data_bucket,
    data_lake_region=env.region,
    cognito_users=cognito_users,
    athena_output_bucket=data_lake.athena_results_bucket,
    env=env,
)
cognito.add_dependency(data_lake)

lake_formation = LakeFormationStack(
    app, "FgacLakeFormationStack",
    database_name=data_lake_config["databaseName"],
    team_a_role=cognito.team_a_role,
    team_b_role=cognito.team_b_role,
    env=env,
)
lake_formation.add_dependency(data_lake)

lambdas = LambdaStack(
    app, "FgacLambdaStack",
    cognito_user_pool=cognito.user_pool,
    identity_pool_id=cognito.identity_pool.ref,
    athena_output_bucket=data_lake.athena_results_bucket,
    data_bucket=data_lake.data_bucket,
    database_name=data_lake.database_name,
    lf_region=env.region,
    env=env,
)

agentcore = AgentCoreStack(
    app, "FgacAgentCoreStack",
    cognito_user_pool=cognito.user_pool,
    cognito_app_client_id=cognito.app_client.user_pool_client_id,
    target_lambda_arn=lambdas.target_fn.function_arn,
    env=env,
)

app.synth()
