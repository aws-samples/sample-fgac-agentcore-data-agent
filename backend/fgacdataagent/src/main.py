import os
import json
from strands import Agent, tool
from strands_tools.code_interpreter import AgentCoreCodeInterpreter
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig, RetrievalConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
# Import AgentCore Gateway as Streamable HTTP MCP Client
from mcp_client.client import get_streamable_http_mcp_client
from model.load import load_model

app = BedrockAgentCoreApp()
log = app.logger

MEMORY_ID = os.getenv("BEDROCK_AGENTCORE_MEMORY_ID")
REGION = os.getenv("AWS_REGION")

# Define a simple function tool
@tool
def add_numbers(a: int, b: int) -> int:
    """Return the sum of two numbers"""
    return a+b

@app.entrypoint
async def invoke(payload, context):
    session_id = getattr(context, 'session_id', None) or 'default'
    
    # Configure memory
    session_manager = None
    if MEMORY_ID:
        session_manager = AgentCoreMemorySessionManager(
            AgentCoreMemoryConfig(
                memory_id=MEMORY_ID,
                session_id=session_id,
                actor_id="quickstart-user",
                retrieval_config={
                    "/users/quickstart-user/facts": RetrievalConfig(top_k=3, relevance_score=0.5),
                    "/users/quickstart-user/preferences": RetrievalConfig(top_k=3, relevance_score=0.5)
                }
            ),
            REGION
        )
    else:
        log.warning("MEMORY_ID is not set. Skipping memory session manager initialization.")

    
    # Create code interpreter
    code_interpreter = AgentCoreCodeInterpreter(
        region=REGION,
        session_name=session_id,
        auto_create=True,
        persist_sessions=True
    )

    # get all headesr
    request_headers = context.request_headers
    log.debug("Headers: %s", json.dumps(request_headers))

    access_token = request_headers.get('Authorization', None)
    id_token = request_headers.get('x-amzn-bedrock-agentcore-runtime-custom-x-id-token', None)

    # Log both tokens
    log.info(f"Access token: {access_token}")
    log.info(f"ID token: {id_token}")

    try:    

        with get_streamable_http_mcp_client(access_token, id_token) as client:
            # Get MCP Tools
            tools = client.list_tools_sync()

            # Create agent
            agent = Agent(
                model=load_model(),
                    session_manager=session_manager,
                system_prompt="""
                    You are a helpful data assistant with code execution capabilities. Use tools when appropriate.
                    
                    IMPORTANT: Whenever you execute a SQL query, always include the exact SQL in your response using this format:
                    
                    <details>
                    <summary>🔍 SQL Query</summary>
                    
                    ```sql
                    YOUR SQL HERE
                    ```
                    
                    </details>
                    
                    Place this before the query results. Always show the SQL, even for simple queries.
                """,
                tools=[code_interpreter.code_interpreter, add_numbers]  + tools
            )

            # Execute and format response
            stream = agent.stream_async(payload.get("prompt"))

            async for event in stream:
                # Handle Text parts of the response
                if "data" in event and isinstance(event["data"], str):
                    yield event["data"]

                # Implement additional handling for other events
                # if "toolUse" in event:
                #   # Process toolUse

                # Handle end of stream
                # if "result" in event:
                #    yield(format_response(event["result"]))
    except Exception as e:
        import traceback
        error_payload = json.dumps({
            "__error__": True,
            "message": str(e),
            "type": type(e).__name__,
            "stacktrace": traceback.format_exc()
        })
        log.error(f"Agent error: {traceback.format_exc()}")
        yield error_payload

def format_response(result) -> str:
    """Extract code from metrics and format with LLM response."""
    parts = []

    # Extract executed code from metrics
    try:
        tool_metrics = result.metrics.tool_metrics.get('code_interpreter')
        if tool_metrics and hasattr(tool_metrics, 'tool'):
            action = tool_metrics.tool['input']['code_interpreter_input']['action']
            if 'code' in action:
                parts.append(f"## Executed Code:\n```{action.get('language', 'python')}\n{action['code']}\n```\n---\n")
    except (AttributeError, KeyError):
        pass  # No code to extract

    # Add LLM response
    parts.append(f"## 📊 Result:\n{str(result)}")
    return "\n".join(parts)

if __name__ == "__main__":
    app.run()