import os
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

# AgentCore Gateway MCP endpoint
GATEWAY_ENDPOINT = os.environ.get(
    'AGENTCORE_GATEWAY_ENDPOINT',
    'https://fgac-gateway-ej2v26ptpt.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp'
)


def get_streamable_http_mcp_client(access_token: str, id_token: str) -> MCPClient:
    """
    Returns an MCP Client compatible with Strands that connects to AgentCore Gateway.
    
    Args:
        access_token: Cognito access token (from Authorization header)
        id_token: Cognito ID token (from X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-TOKEN header)
    
    The gateway uses JWT authentication with Cognito tokens.
    The target Lambda uses Identity Pool to map user's team claim to IAM role for TBAC.
    """
    return MCPClient(lambda: streamablehttp_client(
        GATEWAY_ENDPOINT,
        headers={
            'Authorization': f'Bearer {access_token}' if not access_token.startswith('Bearer ') else access_token,
            'X-ID-Token': id_token
        }
    ))
