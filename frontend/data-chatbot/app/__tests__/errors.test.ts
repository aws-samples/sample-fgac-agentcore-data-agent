import { AgentCoreError, SchemaFetchError } from "../lib/errors";

describe("AgentCoreError", () => {
  it("sets statusCode and message", () => {
    const err = new AgentCoreError(403, "Forbidden");
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Forbidden");
    expect(err.name).toBe("AgentCoreError");
    expect(err).toBeInstanceOf(Error);
  });

  it("is catchable as Error", () => {
    try {
      throw new AgentCoreError(500, "Internal Server Error");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(AgentCoreError);
    }
  });
});

describe("SchemaFetchError", () => {
  it("sets message and optional statusCode", () => {
    const err = new SchemaFetchError("Lambda failed", 502);
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("Lambda failed");
    expect(err.name).toBe("SchemaFetchError");
    expect(err).toBeInstanceOf(Error);
  });

  it("works without statusCode", () => {
    const err = new SchemaFetchError("Network error");
    expect(err.statusCode).toBeUndefined();
    expect(err.message).toBe("Network error");
  });

  it("is catchable as Error", () => {
    try {
      throw new SchemaFetchError("timeout");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(SchemaFetchError);
    }
  });
});
