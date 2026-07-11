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

export function setStorageBackend(backend: StorageBackend): void {
  _backend = backend;
}

export function getStorageBackend(): StorageBackend {
  if (!_backend) {
    _backend = new (_require("./storage-json.js").JsonStorageBackend)() as StorageBackend;
  }
  return _backend;
}
