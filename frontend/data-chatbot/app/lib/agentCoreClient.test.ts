import { AgentCoreClient, InvokeParams } from "@/app/lib/agentCoreClient";
import { AgentCoreError } from "@/app/lib/errors";

// Helper to collect all yielded values from the async generator
async function collectStream(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

const defaultParams: InvokeParams = {
  prompt: "show me all venues",
  sessionId: "session-123",
  accessToken: "test-access-token",
  idToken: "test-id-token",
};

// Mock fetch at module scope
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Helper: create a mock Response with a readable body from SSE text chunks
function mockSSEResponse(chunks: string[], status = 200): Response {
  let chunkIndex = 0;

  const body = {
    getReader() {
      return {
        read: jest.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const value = Buffer.from(chunks[chunkIndex]);
            chunkIndex++;
            return Promise.resolve({ done: false, value });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: jest.fn(),
      };
    },
  };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : status === 500 ? "Internal Server Error" : "OK",
    body,
    text: jest.fn().mockResolvedValue(""),
  } as unknown as Response;
}

function mockErrorResponse(status: number, bodyText: string): Response {
  return {
    ok: false,
    status,
    statusText: bodyText,
    body: null,
    text: jest.fn().mockResolvedValue(bodyText),
  } as unknown as Response;
}

function mockNullBodyResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: null,
  } as unknown as Response;
}

describe("AgentCoreClient", () => {
  const client = new AgentCoreClient(
    "us-east-1",
    "arn:aws:bedrock:us-east-1:123456789:agent/my-agent"
  );

  it("sends POST to the correct AgentCore Runtime URL", async () => {
    mockFetch.mockResolvedValue(mockSSEResponse([]));

    const gen = client.invoke(defaultParams);
    await collectStream(gen);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/arn:aws:bedrock:us-east-1:123456789:agent/my-agent/invocations",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sets Authorization and X-ID-Token headers", async () => {
    mockFetch.mockResolvedValue(mockSSEResponse([]));

    const gen = client.invoke(defaultParams);
    await collectStream(gen);

    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
    expect(headers["X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-Token"]).toBe(
      "test-id-token"
    );
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends prompt and sessionId in the request body", async () => {
    mockFetch.mockResolvedValue(mockSSEResponse([]));

    const gen = client.invoke(defaultParams);
    await collectStream(gen);

    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(callArgs.body as string)).toEqual({
      prompt: "show me all venues",
      sessionId: "session-123",
    });
  });

  it("parses SSE data lines from the stream", async () => {
    mockFetch.mockResolvedValue(
      mockSSEResponse([
        "data: Here are\n",
        "data: the venues\n",
        "data: for your team\n",
      ])
    );

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toEqual(["Here are", "the venues", "for your team"]);
  });

  it("handles SSE data lines without space after colon", async () => {
    mockFetch.mockResolvedValue(
      mockSSEResponse(["data:no-space\n", "data: with-space\n"])
    );

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toEqual(["no-space", "with-space"]);
  });

  it("ignores non-data SSE lines", async () => {
    mockFetch.mockResolvedValue(
      mockSSEResponse([
        ": comment line\n",
        "event: message\n",
        "data: actual data\n",
        "id: 123\n",
      ])
    );

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toEqual(["actual data"]);
  });

  it("throws AgentCoreError on 4xx response", async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401, "Unauthorized"));

    const gen = client.invoke(defaultParams);

    await expect(collectStream(gen)).rejects.toThrow(AgentCoreError);
  });

  it("includes status code and message in AgentCoreError for 4xx", async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(403, "Forbidden"));

    try {
      const gen = client.invoke(defaultParams);
      await collectStream(gen);
      fail("Expected AgentCoreError");
    } catch (e) {
      expect(e).toBeInstanceOf(AgentCoreError);
      expect((e as AgentCoreError).statusCode).toBe(403);
      expect((e as AgentCoreError).message).toBe("Forbidden");
    }
  });

  it("throws AgentCoreError on 5xx response", async () => {
    mockFetch.mockResolvedValue(
      mockErrorResponse(500, "Internal Server Error")
    );

    const gen = client.invoke(defaultParams);

    await expect(collectStream(gen)).rejects.toThrow(AgentCoreError);
  });

  it("throws AgentCoreError on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("DNS resolution failed"));

    const gen = client.invoke(defaultParams);

    await expect(collectStream(gen)).rejects.toThrow(AgentCoreError);
  });

  it("includes network error details in AgentCoreError", async () => {
    mockFetch.mockRejectedValue(new Error("DNS resolution failed"));

    try {
      const gen = client.invoke(defaultParams);
      await collectStream(gen);
      fail("Expected AgentCoreError");
    } catch (e) {
      expect(e).toBeInstanceOf(AgentCoreError);
      expect((e as AgentCoreError).statusCode).toBe(0);
      expect((e as AgentCoreError).message).toContain("Network error");
      expect((e as AgentCoreError).message).toContain("DNS resolution failed");
    }
  });

  it("yields [stream interrupted] when stream errors mid-read", async () => {
    let callCount = 0;

    const body = {
      getReader() {
        return {
          read: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                done: false,
                value: Buffer.from("data: first chunk\n"),
              });
            }
            return Promise.reject(new Error("Connection reset"));
          }),
          releaseLock: jest.fn(),
        };
      },
    };

    const response = {
      ok: true,
      status: 200,
      body,
    } as unknown as Response;

    mockFetch.mockResolvedValue(response);

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toContain("first chunk");
    expect(results).toContain("[stream interrupted]");
  });

  it("handles empty response body gracefully", async () => {
    mockFetch.mockResolvedValue(mockNullBodyResponse());

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toEqual([]);
  });

  it("handles multi-line chunks split across reads", async () => {
    mockFetch.mockResolvedValue(
      mockSSEResponse(["data: hel", "lo world\ndata: second\n"])
    );

    const gen = client.invoke(defaultParams);
    const results = await collectStream(gen);

    expect(results).toContain("hello world");
    expect(results).toContain("second");
  });
});
