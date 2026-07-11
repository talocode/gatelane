import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GateLaneConfig, GateLaneServer, GateLanePolicy, GateLaneRateLimit, GateLaneAuditEvent, GateLaneUsageEvent } from "./schema.js";
import type { StorageBackend } from "./storage.js";

const HOME_VAR = process.env.GATELANE_HOME || join(homedir(), ".gatelane");

function ensureDir(): void {
  if (!existsSync(HOME_VAR)) {
    mkdirSync(HOME_VAR, { recursive: true });
  }
}

function filePath(name: string): string {
  return join(HOME_VAR, name);
}

function readJSON<T>(name: string, fallback: T): T {
  try {
    const data = readFileSync(filePath(name), "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(name: string, data: T): void {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

function readJSONL(name: string): Record<string, unknown>[] {
  try {
    const content = readFileSync(filePath(name), "utf-8");
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function appendJSONL(name: string, event: Record<string, unknown>): void {
  ensureDir();
  appendFileSync(filePath(name), JSON.stringify(event) + "\n");
}

export class JsonStorageBackend implements StorageBackend {
  loadConfig(): GateLaneConfig {
    const defaultConfig: GateLaneConfig = {
      cloudMode: process.env.GATELANE_CLOUD_MODE === "true",
      defaultPort: 3050,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const config = readJSON<GateLaneConfig>("config.json", defaultConfig);
    config.cloudMode = process.env.GATELANE_CLOUD_MODE === "true" || config.cloudMode;
    return config;
  }

  saveConfig(config: GateLaneConfig): void {
    config.updatedAt = new Date().toISOString();
    writeJSON("config.json", config);
  }

  loadServers(): GateLaneServer[] {
    return readJSON<GateLaneServer[]>("servers.json", []);
  }

  saveServers(servers: GateLaneServer[]): void {
    writeJSON("servers.json", servers);
  }

  loadPolicies(): GateLanePolicy[] {
    return readJSON<GateLanePolicy[]>("policies.json", []);
  }

  savePolicies(policies: GateLanePolicy[]): void {
    writeJSON("policies.json", policies);
  }

  loadRateLimits(): GateLaneRateLimit[] {
    return readJSON<GateLaneRateLimit[]>("rate-limits.json", []);
  }

  saveRateLimits(limits: GateLaneRateLimit[]): void {
    writeJSON("rate-limits.json", limits);
  }

  appendAuditLog(event: GateLaneAuditEvent): void {
    appendJSONL("audit.jsonl", event as unknown as Record<string, unknown>);
  }

  loadAuditLogs(): GateLaneAuditEvent[] {
    return readJSONL("audit.jsonl") as unknown as GateLaneAuditEvent[];
  }

  appendUsageEvent(event: GateLaneUsageEvent): void {
    appendJSONL("usage.jsonl", event as unknown as Record<string, unknown>);
  }

  loadUsageEvents(): GateLaneUsageEvent[] {
    return readJSONL("usage.jsonl") as unknown as GateLaneUsageEvent[];
  }
}
