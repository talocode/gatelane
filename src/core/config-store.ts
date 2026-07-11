import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

import { getStorageBackend, setStorageBackend } from "./storage.js";
import type { StorageBackend } from "./storage.js";
export { setStorageBackend, getStorageBackend };
export type { StorageBackend };
import type { GateLaneConfig, GateLaneServer, GateLanePolicy, GateLaneRateLimit, GateLaneAuditEvent, GateLaneUsageEvent } from "./schema.js";

export function useSqlite(): void {
  try {
    const { SqliteStorageBackend } = _require("./storage-sqlite.js");
    setStorageBackend(new SqliteStorageBackend());
  } catch {
    console.warn("SQLite backend unavailable (install sql.js for SQLite support)");
  }
}

export function useJson(): void {
  const { JsonStorageBackend } = _require("./storage-json.js");
  setStorageBackend(new JsonStorageBackend());
}

// Config
export function loadConfig(): GateLaneConfig {
  return getStorageBackend().loadConfig();
}

export function saveConfig(config: GateLaneConfig): void {
  getStorageBackend().saveConfig(config);
}

// Servers
export function loadServers(): GateLaneServer[] {
  return getStorageBackend().loadServers();
}

export function saveServers(servers: GateLaneServer[]): void {
  getStorageBackend().saveServers(servers);
}

// Policies
export function loadPolicies(): GateLanePolicy[] {
  return getStorageBackend().loadPolicies();
}

export function savePolicies(policies: GateLanePolicy[]): void {
  getStorageBackend().savePolicies(policies);
}

// Rate limits
export function loadRateLimits(): GateLaneRateLimit[] {
  return getStorageBackend().loadRateLimits();
}

export function saveRateLimits(limits: GateLaneRateLimit[]): void {
  getStorageBackend().saveRateLimits(limits);
}

// Audit logs
export function appendAuditLog(event: GateLaneAuditEvent): void {
  getStorageBackend().appendAuditLog(event);
}

export function loadAuditLogs(): GateLaneAuditEvent[] {
  return getStorageBackend().loadAuditLogs();
}

// Usage
export function appendUsageEvent(event: GateLaneUsageEvent): void {
  getStorageBackend().appendUsageEvent(event);
}

export function loadUsageEvents(): GateLaneUsageEvent[] {
  return getStorageBackend().loadUsageEvents();
}
