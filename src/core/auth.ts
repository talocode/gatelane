import { loadConfig } from "./config-store.js";
import { AuthError } from "./errors.js";

export function checkAuth(req: { headers: Record<string, string | string[] | undefined> }): void {
  const config = loadConfig();
  if (!config.cloudMode) return; // local mode: no auth

  const apiKey = process.env.TALOCODE_API_KEY;
  if (!apiKey) {
    throw new AuthError("Cloud mode requires TALOCODE_API_KEY environment variable");
  }

  const authHeader = req.headers["authorization"];
  const apiKeyHeader = req.headers["x-talocode-api-key"];

  let providedKey: string | undefined;

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  } else if (typeof apiKeyHeader === "string") {
    providedKey = apiKeyHeader;
  }

  if (!providedKey || providedKey !== apiKey) {
    throw new AuthError("Invalid or missing API key");
  }
}

export function isCloudMode(): boolean {
  return loadConfig().cloudMode;
}
