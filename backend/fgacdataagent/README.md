# FGAC Data Agent — Bedrock AgentCore Runtime

A Strands SDK agent deployed on Bedrock AgentCore that enforces team-level data access via Cognito Identity Pool and Lake Formation TBAC.

## Architecture

```
User → Cognito Auth → AgentCore Runtime → MCP Gateway → Target Lambda → Identity Pool → Athena (TBAC)
```

The interceptor Lambda has been removed. The MCP Gateway now propagates `X-ID-Token` directly to the Target Lambda via `allowedRequestHeaders` on the gateway target's `metadataConfiguration`.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.py` | Agent entrypoint — extracts tokens from `context.request_headers`, creates MCP client |
| `src/mcp_client/client.py` | MCP client — connects to AgentCore Gateway with `Authorization` + `X-ID-Token` headers |
| `src/model/load.py` | Model config — Claude Sonnet 4.5 via global inference profile |
| `.bedrock_agentcore.yaml` | AgentCore deployment config (runtime, JWT authorizer, header allowlist) |

## Header Propagation (No Interceptor)

Previously, an interceptor Lambda sat between the Gateway and Target Lambda to pass through headers. Now:

1. **AgentCore Runtime** receives `X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-Token` (lowercased to `x-amzn-bedrock-agentcore-runtime-custom-x-id-token` by runtime)
2. **Agent code** (`main.py`) extracts both tokens and passes them to the MCP client as `Authorization` + `X-ID-Token`
3. **MCP Gateway** validates JWT, then propagates `X-ID-Token` to the Target Lambda via `metadataConfiguration.allowedRequestHeaders`
4. **Target Lambda** reads `X-ID-Token` from `context.client_context.custom['bedrockAgentCorePropagatedHeaders']`

### Gateway Target Config

```json
{
  "metadataConfiguration": {
    "allowedRequestHeaders": ["X-ID-Token"],
    "allowedResponseHeaders": ["X-ID-Token"]
  }
}
```

## Developing Locally

```bash
source .venv/bin/activate
agentcore dev        # starts local server on 0.0.0.0:8080
agentcore invoke --dev "What can you do"
```

## Deployment

```bash
agentcore configure  # optional — customize settings
agentcore deploy     # deploy to AgentCore
agentcore invoke "Show me all tables"
```

Or deploy via CDK (see `backend/infra/`).
