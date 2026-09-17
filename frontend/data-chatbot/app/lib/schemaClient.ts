import { fetchAuthSession } from "aws-amplify/auth";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { SchemaFetchError } from "@/app/lib/errors";
import { DatabaseNode } from "@/app/types";

export class SchemaClient {
  private functionName: string;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  async fetchSchema(): Promise<DatabaseNode[]> {
    let session;
    try {
      session = await fetchAuthSession();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch auth session";
      throw new SchemaFetchError(`Auth session error: ${message}`);
    }

    const credentials = session.credentials;
    if (!credentials) {
      throw new SchemaFetchError("No IAM credentials available from session");
    }

    const idToken = session.tokens?.idToken;
    if (!idToken) {
      throw new SchemaFetchError("No ID token available from session");
    }

    const lambdaClient = new LambdaClient({
      region: "us-east-1",
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    let response;
    try {
      response = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: this.functionName,
          Payload: new TextEncoder().encode(
            JSON.stringify({ idToken: idToken.toString() })
          ),
        })
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Lambda invocation failed";
      throw new SchemaFetchError(`Lambda invoke error: ${message}`);
    }

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(new TextDecoder().decode(response.Payload))
        : { errorMessage: "Unknown Lambda error" };
      throw new SchemaFetchError(
        `Lambda function error: ${errorPayload.errorMessage || response.FunctionError}`,
        500
      );
    }

    if (!response.Payload) {
      throw new SchemaFetchError("Empty response from Lambda");
    }

    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder().decode(response.Payload));
    } catch {
      throw new SchemaFetchError("Failed to parse Lambda response as JSON");
    }

    if (parsed.error) {
      throw new SchemaFetchError(
        parsed.error,
        parsed.statusCode ?? 500
      );
    }

    if (!Array.isArray(parsed.databases)) {
      throw new SchemaFetchError(
        "Invalid response: missing databases array"
      );
    }

    return parsed.databases as DatabaseNode[];
  }
}
