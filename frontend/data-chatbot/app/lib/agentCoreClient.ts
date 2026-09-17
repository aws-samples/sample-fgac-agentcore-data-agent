import { AgentCoreError } from "@/app/lib/errors";

export interface InvokeParams {
  prompt: string;
  sessionId: string;
  accessToken: string;
  idToken: string;
}

export interface BackendError {
  __error__: true;
  message: string;
  type: string;
  stacktrace?: string;
}

function tryParseBackendError(text: string): BackendError | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.__error__ === true) {
      return parsed as BackendError;
    }
  } catch {
    // Not JSON
  }
  return null;
}

/**
 * SSE chunks from AgentCore Runtime arrive as JSON-encoded strings (e.g., "\"hello\\n\"").
 * This unwraps the JSON string encoding and unescapes \n, \", etc.
 */
function unescapeChunk(text: string): string {
  const trimmed = text.trim();

  // Try JSON.parse first — handles "quoted strings" with escaped chars
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      // Fall through
    }
  }

  // Fallback: manually unescape common escape sequences
  // This handles cases where the chunk has \n, \t, \" but isn't valid JSON
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export class AgentCoreClient {
  private region: string;
  private agentARN: string;

  constructor(region: string, agentARN: string) {
    this.region = region;
    this.agentARN = agentARN;
  }

  async *invoke(params: InvokeParams): AsyncGenerator<string> {
    const { prompt, sessionId, accessToken, idToken } = params;

    const encodedARN = encodeURIComponent(this.agentARN);
    const url = `https://bedrock-agentcore.${this.region}.amazonaws.com/runtimes/${encodedARN}/invocations`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-Token": idToken,
        },
        body: JSON.stringify({ prompt, sessionId }),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new AgentCoreError(0, `Network error: ${message}`);
    }

    if (!response.ok) {
      let errorMessage: string;
      try {
        errorMessage = await response.text();
      } catch {
        errorMessage = response.statusText || "Unknown error";
      }
      throw new AgentCoreError(response.status, errorMessage);
    }

    const body = response.body;
    if (!body) {
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Accumulate all raw content to detect error JSON that may not be SSE-formatted
    let fullRawContent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        fullRawContent += chunk;

        const lines = buffer.split("\n");
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice("data:".length);
            const text = data.startsWith(" ") ? data.slice(1) : data;

            console.log("[SSE RAW]", JSON.stringify(text));
            const unescaped = unescapeChunk(text);
            console.log("[SSE UNESCAPED]", JSON.stringify(unescaped));

            // Check if this SSE data line is a backend error JSON
            const backendError = tryParseBackendError(text);
            if (backendError) {
              const err = new AgentCoreError(500, backendError.message);
              err.errorType = backendError.type;
              err.stacktrace = backendError.stacktrace;
              throw err;
            }

            yield unescapeChunk(text);
          } else if (line.trim().length > 0) {
            // Non-SSE line — check if it's a raw error JSON (runtime may not wrap it)
            const backendError = tryParseBackendError(line.trim());
            if (backendError) {
              const err = new AgentCoreError(500, backendError.message);
              err.errorType = backendError.type;
              err.stacktrace = backendError.stacktrace;
              throw err;
            }
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim().length > 0) {
        if (buffer.startsWith("data:")) {
          const data = buffer.slice("data:".length);
          const text = data.startsWith(" ") ? data.slice(1) : data;
          const backendError = tryParseBackendError(text);
          if (backendError) {
            const err = new AgentCoreError(500, backendError.message);
            err.errorType = backendError.type;
            err.stacktrace = backendError.stacktrace;
            throw err;
          }
          yield unescapeChunk(text);
        } else {
          // Check remaining buffer for raw error JSON
          const backendError = tryParseBackendError(buffer.trim());
          if (backendError) {
            const err = new AgentCoreError(500, backendError.message);
            err.errorType = backendError.type;
            err.stacktrace = backendError.stacktrace;
            throw err;
          }
        }
      }

      // Final check: the entire raw content might be the error JSON
      // (e.g., if the runtime sent it as a single non-SSE response body)
      const fullError = tryParseBackendError(fullRawContent.trim());
      if (fullError) {
        const err = new AgentCoreError(500, fullError.message);
        err.errorType = fullError.type;
        err.stacktrace = fullError.stacktrace;
        throw err;
      }
    } catch (error: unknown) {
      if (error instanceof AgentCoreError) {
        throw error;
      }
      // Stream interrupted — yield marker and stop
      yield "[stream interrupted]";
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors
      }
    }
  }
}
