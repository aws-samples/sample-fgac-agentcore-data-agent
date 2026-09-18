// Feature: chatbot-frontend, Property 12: Send triggers API call with message
// **Validates: Requirements 5.3**
// Feature: chatbot-frontend, Property 13: Request headers include both tokens
// **Validates: Requirements 5.4, 5.5**

import fc from "fast-check";
import { AgentCoreClient } from "@/app/lib/agentCoreClient";

// Helper to collect all yielded values from the async generator
async function collectStream(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

// Helper: create a mock Response with an empty SSE body
function mockEmptySSEResponse(): Response {
  const body = {
    getReader() {
      return {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: jest.fn(),
      };
    },
  };

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body,
    text: jest.fn().mockResolvedValue(""),
  } as unknown as Response;
}

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Property 12: Send triggers API call with message", () => {
  it("should call fetch with a body containing the generated prompt text for any non-empty string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (prompt) => {
          mockFetch.mockReset();
          mockFetch.mockResolvedValue(mockEmptySSEResponse());

          const client = new AgentCoreClient("us-east-1", "test-agent-arn");
          const gen = client.invoke({
            prompt,
            sessionId: "session-1",
            accessToken: "token-a",
            idToken: "token-id",
          });
          await collectStream(gen);

          expect(mockFetch).toHaveBeenCalledTimes(1);

          const callArgs = mockFetch.mock.calls[0];
          const body = JSON.parse(callArgs[1].body as string);
          expect(body.prompt).toBe(prompt);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

describe("Property 13: Request headers include both tokens", () => {
  it("should include Authorization Bearer and X-ID-Token headers for any random token pair", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (accessToken, idToken) => {
          mockFetch.mockReset();
          mockFetch.mockResolvedValue(mockEmptySSEResponse());

          const client = new AgentCoreClient("us-west-2", "some-agent-arn");
          const gen = client.invoke({
            prompt: "test message",
            sessionId: "session-1",
            accessToken,
            idToken,
          });
          await collectStream(gen);

          expect(mockFetch).toHaveBeenCalledTimes(1);

          const callArgs = mockFetch.mock.calls[0];
          const headers = callArgs[1].headers as Record<string, string>;

          expect(headers["Authorization"]).toBe(`Bearer ${accessToken}`);
          expect(
            headers[
              "X-Amzn-Bedrock-AgentCore-Runtime-Custom-X-ID-Token"
            ]
          ).toBe(idToken);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
