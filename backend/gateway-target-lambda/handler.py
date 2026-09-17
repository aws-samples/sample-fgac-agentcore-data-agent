"""
AgentCore Gateway Lambda Target - Tools

This Lambda function provides tool implementations for AgentCore Gateway.
Uses Cognito Identity Pool to get IAM credentials based on user's ID token.
"""

import json
import boto3
import time
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
ATHENA_OUTPUT = os.environ.get('ATHENA_OUTPUT', '')
DEFAULT_DATABASE = os.environ.get('DATABASE', 'tickit2')
ATHENA_REGION = os.environ.get('ATHENA_REGION', 'ap-east-1')

# Cognito Identity Pool Configuration
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'ap-southeast-1')
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
IDENTITY_POOL_ID = os.environ.get('IDENTITY_POOL_ID', '')


def get_greeting(name: str) -> dict:
    """Return a greeting message for the given name"""
    return {
        'message': f'Hello, {name}! Welcome to the FGAC Data Agent.',
        'status': 'success'
    }


def get_system_info() -> dict:
    """Return system information"""
    return {
        'service': 'FGAC Data Agent',
        'version': '1.0.0',
        'status': 'healthy',
        'available_tools': ['get_greeting', 'get_system_info', 'execute_query']
    }


def assume_role(role_arn: str):
    """Assume an IAM role and return a boto3 session"""
    sts = boto3.client('sts')
    assumed_role = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName='FGACGatewaySession'
    )
    credentials = assumed_role['Credentials']
    
    return boto3.Session(
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken']
    )


def get_identity_pool_session(id_token: str):
    """
    Exchange Cognito ID token for IAM credentials via Identity Pool.
    Role is determined by Identity Pool role mapping rules based on custom:team claim.
    """
    cognito_identity = boto3.client('cognito-identity', region_name=COGNITO_REGION)
    
    provider_name = f'cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}'
    
    # Get Identity ID
    identity_response = cognito_identity.get_id(
        IdentityPoolId=IDENTITY_POOL_ID,
        Logins={provider_name: id_token}
    )
    identity_id = identity_response['IdentityId']
    logger.info(f"Identity Pool - Identity ID: {identity_id}")
    
    # Get credentials for the identity (role determined by Identity Pool rules)
    creds_response = cognito_identity.get_credentials_for_identity(
        IdentityId=identity_id,
        Logins={provider_name: id_token}
    )
    credentials = creds_response['Credentials']
    
    return boto3.Session(
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretKey'],
        aws_session_token=credentials['SessionToken']
    )


def execute_query(session, sql: str, database: str = None) -> dict:
    """Execute an Athena SQL query and return results"""
    db = database or DEFAULT_DATABASE
    
    athena = session.client('athena', region_name=ATHENA_REGION)
    
    # Start query execution
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': db},
        ResultConfiguration={'OutputLocation': ATHENA_OUTPUT}
    )
    
    query_execution_id = response['QueryExecutionId']
    
    # Wait for query to complete
    while True:
        status = athena.get_query_execution(QueryExecutionId=query_execution_id)
        state = status['QueryExecution']['Status']['State']
        
        if state == 'SUCCEEDED':
            break
        elif state in ['FAILED', 'CANCELLED']:
            reason = status['QueryExecution']['Status'].get('StateChangeReason', 'Unknown')
            return {
                'success': False,
                'error': f'Query {state}: {reason}',
                'query_id': query_execution_id
            }
        
        time.sleep(0.5)
    
    # Get results
    results = athena.get_query_results(QueryExecutionId=query_execution_id)
    
    # Convert to list of dicts
    columns = [col['Label'] for col in results['ResultSet']['ResultSetMetadata']['ColumnInfo']]
    rows = []
    for row in results['ResultSet']['Rows'][1:]:  # Skip header
        row_data = {}
        for i, field in enumerate(row['Data']):
            row_data[columns[i]] = field.get('VarCharValue', '')
        rows.append(row_data)
    
    return {
        'success': True,
        'query_id': query_execution_id,
        'database': db,
        'columns': columns,
        'rows': rows,
        'row_count': len(rows)
    }


def lambda_handler(event, context):
    """
    Main Lambda handler for AgentCore Gateway
    
    Event: Tool input parameters
    Context: Contains bedrockAgentCore metadata including tool name
    """
    
    # Log Lambda's own identity
    sts = boto3.client('sts')
    lambda_identity = sts.get_caller_identity()
    logger.info(f"Lambda execution role identity: {json.dumps(lambda_identity, default=str)}")
    
    # Log full event for debugging
    logger.info(f"Full event: {json.dumps(event, default=str)}")
    
    # Extract and log JWT information from context
    jwt_claims = {}
    if context.client_context and context.client_context.custom:
        logger.info(f"Inbound JWT/context custom data: {json.dumps(context.client_context.custom, default=str)}")
        jwt_claims = context.client_context.custom
    else:
        logger.info("No client_context.custom data available")
    
    # Extract tool name from context
    delimiter = "___"
    original_tool_name = ''
    
    if context.client_context and context.client_context.custom:
        original_tool_name = context.client_context.custom.get('bedrockAgentCoreToolName', '')
    
    if delimiter in original_tool_name:
        tool_name = original_tool_name[original_tool_name.index(delimiter) + len(delimiter):]
    else:
        tool_name = original_tool_name or event.get('tool_name', '')
    
    logger.info(f"Tool name resolved: {tool_name}")
    
    # Get ID token from propagated headers (for Identity Pool approach)
    id_token = None
    propagated_headers = jwt_claims.get('bedrockAgentCorePropagatedHeaders', {})
    if propagated_headers:
        id_token = propagated_headers.get('X-ID-Token') or propagated_headers.get('x-id-token')
        if id_token:
            logger.info("ID token found in propagated headers")
    
    # Get session via Identity Pool if ID token is available
    session = None
    if id_token:
        logger.info("Using Identity Pool to get IAM credentials...")
        try:
            session = get_identity_pool_session(id_token)
            
            # Verify assumed role
            assumed_sts = session.client('sts')
            assumed_identity = assumed_sts.get_caller_identity()
            logger.info(f"Identity Pool assumed role: {json.dumps(assumed_identity, default=str)}")
        except Exception as e:
            logger.error(f"Failed to get Identity Pool credentials: {e}")
            return {'success': False, 'error': f'Identity Pool authentication failed: {str(e)}'}
    else:
        logger.info("No ID token provided, using Lambda execution role")
        session = boto3.Session()
    
    # Route to appropriate tool handler
    if tool_name == 'get_greeting':
        name = event.get('name', 'Guest')
        return get_greeting(name)
    
    elif tool_name == 'get_system_info':
        return get_system_info()
    
    elif tool_name == 'execute_query':
        sql = event.get('sql')
        if not sql:
            return {'success': False, 'error': 'Missing required parameter: sql'}
        database = event.get('database')
        return execute_query(session, sql, database)
    
    else:
        return {
            'error': f'Unknown tool: {tool_name}',
            'available_tools': ['get_greeting', 'get_system_info', 'execute_query']
        }
