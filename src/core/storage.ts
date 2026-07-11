import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

import type {
  GateLaneConfig,
  GateLaneServer,
  GateLanePolicy,
  GateLaneRateLimit,
  GateLaneAuditEvent,
  GateLaneUsageEvent,
} from "./schema.js";

export interface StorageBackend {
  loadConfig(): GateLaneConfig;
  saveConfig(config: GateLaneConfig): void;
  loadServers(): GateLaneServer[];
  saveServers(servers: GateLaneServer[]): void;
  loadPolicies(): GateLanePolicy[];
  savePolicies(policies: GateLanePolicy[]): void;
  loadRateLimits(): GateLaneRateLimit[];
  saveRateLimits(limits: GateLaneRateLimit[]): void;
  appendAuditLog(event: GateLaneAuditEvent): void;
  loadAuditLogs(): GateLaneAuditEvent[];
  appendUsageEvent(event: GateLaneUsageEvent): void;
  loadUsageEvents(): GateLaneUsageEvent[];
  close?(): void;
}

let _backend: StorageBackend | null = null;

function getDriver(): string {
  return process.env.GATELANE_STORAGE_DRIVER || "json";
}

export function setStorageBackend(backend: StorageBackend): void {
  _backend = backend;
}

export function getStorageBackend(): StorageBackend {
  if (!_backend) {
    const driver = getDriver();
    if (driver === "sqlite") {
      try {
        const { SqliteStorageBackend } = _require("./storage-sqlite.js");
        _backend = new SqliteStorageBackend() as StorageBackend;
      } catch (err) {
        console.warn("SQLite backend requested but unavailable, falling back to JSON:", (err as Error).message);
        const { JsonStorageBackend } = _require("./storage-json.js");
        _backend = new JsonStorageBackend() as StorageBackend;
      }
    } else {
      const { JsonStorageBackend } = _require("./storage-json.js");
      _backend = new JsonStorageBackend() as StorageBackend;
    }
  }
  return _backend;
}
