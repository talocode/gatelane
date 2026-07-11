import { v4 as uuidv4 } from "uuid";

export function newId(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
}

export function newServerId(): string {
  return newId("srv");
}

export function newPolicyId(): string {
  return newId("pol");
}

export function newRateLimitId(): string {
  return newId("rl");
}

export function newAuditId(): string {
  return newId("aud");
}

export function newUsageId(): string {
  return newId("use");
}

export function newRequestId(): string {
  return newId("req");
}

export function newToolId(): string {
  return newId("tool");
}
