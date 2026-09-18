export class AgentCoreError extends Error {
  statusCode: number;
  errorType?: string;
  stacktrace?: string;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AgentCoreError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AgentCoreError.prototype);
  }
}

export class SchemaFetchError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'SchemaFetchError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, SchemaFetchError.prototype);
  }
}
