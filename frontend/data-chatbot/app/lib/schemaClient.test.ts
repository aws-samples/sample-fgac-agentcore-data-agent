import { SchemaClient } from "@/app/lib/schemaClient";
import { SchemaFetchError } from "@/app/lib/errors";

// Mock aws-amplify/auth
const mockFetchAuthSession = jest.fn();
jest.mock("aws-amplify/auth", () => ({
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
}));

// Mock @aws-sdk/client-lambda
const mockSend = jest.fn();
jest.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeCommand: jest.fn().mockImplementation((input) => input),
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    credentials: {
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
      sessionToken: "SESSION",
    },
    tokens: {
      idToken: { toString: () => "mock-id-token" },
    },
    ...overrides,
  };
}

function makeLambdaResponse(body: object, functionError?: string) {
  return {
    Payload: new TextEncoder().encode(JSON.stringify(body)),
    FunctionError: functionError,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SchemaClient", () => {
  const client = new SchemaClient("schema-discovery-fn");

  it("returns DatabaseNode[] on successful invocation", async () => {
    const databases = [
      { name: "tickit2", tables: ["users", "venue", "sales"] },
      { name: "analytics", tables: ["events"] },
    ];
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(makeLambdaResponse({ databases }));

    const result = await client.fetchSchema();

    expect(result).toEqual(databases);
  });

  it("passes the ID token in the Lambda payload", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse({ databases: [] })
    );

    await client.fetchSchema();

    // InvokeCommand is called with the payload containing the idToken
    const { InvokeCommand } = require("@aws-sdk/client-lambda");
    const callArgs = InvokeCommand.mock.calls[0][0];
    const payloadStr = new TextDecoder().decode(callArgs.Payload);
    expect(JSON.parse(payloadStr)).toEqual({ idToken: "mock-id-token" });
  });

  it("passes the correct function name to InvokeCommand", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse({ databases: [] })
    );

    await client.fetchSchema();

    const { InvokeCommand } = require("@aws-sdk/client-lambda");
    expect(InvokeCommand.mock.calls[0][0].FunctionName).toBe(
      "schema-discovery-fn"
    );
  });

  it("uses IAM credentials from the auth session", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse({ databases: [] })
    );

    await client.fetchSchema();

    const { LambdaClient } = require("@aws-sdk/client-lambda");
    const constructorArgs = LambdaClient.mock.calls[0][0];
    expect(constructorArgs.credentials).toEqual({
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
      sessionToken: "SESSION",
    });
  });

  it("throws SchemaFetchError when fetchAuthSession fails", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("Session expired"));

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow("Auth session error");
  });

  it("throws SchemaFetchError when no IAM credentials", async () => {
    mockFetchAuthSession.mockResolvedValue(
      makeSession({ credentials: undefined })
    );

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow(
      "No IAM credentials available"
    );
  });

  it("throws SchemaFetchError when no ID token", async () => {
    mockFetchAuthSession.mockResolvedValue(
      makeSession({ tokens: undefined })
    );

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow(
      "No ID token available"
    );
  });

  it("throws SchemaFetchError on Lambda invocation failure", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockRejectedValue(new Error("Access denied"));

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow("Lambda invoke error");
  });

  it("throws SchemaFetchError when Lambda returns FunctionError", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse(
        { errorMessage: "Handler timeout" },
        "Unhandled"
      )
    );

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow("Lambda function error");
  });

  it("throws SchemaFetchError when response has error field", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse({ error: "Athena query failed", statusCode: 400 })
    );

    try {
      await client.fetchSchema();
      fail("Expected SchemaFetchError");
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaFetchError);
      expect((e as SchemaFetchError).message).toBe("Athena query failed");
      expect((e as SchemaFetchError).statusCode).toBe(400);
    }
  });

  it("throws SchemaFetchError when Payload is empty", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue({ Payload: undefined });

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow("Empty response");
  });

  it("throws SchemaFetchError when response is not valid JSON", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue({
      Payload: new TextEncoder().encode("not json"),
    });

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow("Failed to parse");
  });

  it("throws SchemaFetchError when databases field is missing", async () => {
    mockFetchAuthSession.mockResolvedValue(makeSession());
    mockSend.mockResolvedValue(
      makeLambdaResponse({ result: "something else" })
    );

    await expect(client.fetchSchema()).rejects.toThrow(SchemaFetchError);
    await expect(client.fetchSchema()).rejects.toThrow(
      "missing databases array"
    );
  });
});
