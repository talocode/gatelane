export class GateLaneError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "GateLaneError";
  }
}

export class ServerNotFoundError extends GateLaneError {
  constructor(name: string) {
    super(`Server '${name}' not found`, "SERVER_NOT_FOUND", 404);
  }
}

export class ToolNotFoundError extends GateLaneError {
  constructor(name: string) {
    super(`Tool '${name}' not found`, "TOOL_NOT_FOUND", 404);
  }
}

export class ToolDeniedError extends GateLaneError {
  constructor(tool: string, reason?: string) {
    super(
      `Tool '${tool}' is denied by policy${reason ? `: ${reason}` : ""}`,
      "TOOL_DENIED",
      403,
    );
  }
}

export class RateLimitExceededError extends GateLaneError {
  constructor(target: string) {
    super(`Rate limit exceeded for '${target}'`, "RATE_LIMIT_EXCEEDED", 429);
  }
}

export class AuthError extends GateLaneError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ValidationError extends GateLaneError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}
