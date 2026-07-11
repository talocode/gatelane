import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GateLaneConfig, GateLaneServer, GateLanePolicy, GateLaneRateLimit, GateLaneAuditEvent, GateLaneUsageEvent } from "./schema.js";

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
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function appendJSONL(name: string, event: Record<string, unknown>): void {
  ensureDir();
  appendFileSync(filePath(name), JSON.stringify(event) + "\n");
}

// Config
export function loadConfig(): GateLaneConfig {
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

export function saveConfig(config: GateLaneConfig): void {
  config.updatedAt = new Date().toISOString();
  writeJSON("config.json", config);
}

// Servers
export function loadServers(): GateLaneServer[] {
  return readJSON<GateLaneServer[]>("servers.json", []);
}

export function saveServers(servers: GateLaneServer[]): void {
  writeJSON("servers.json", servers);
}

// Policies
export function loadPolicies(): GateLanePolicy[] {
  return readJSON<GateLanePolicy[]>("policies.json", []);
}

export function savePolicies(policies: GateLanePolicy[]): void {
  writeJSON("policies.json", policies);
}

// Rate limits
export function loadRateLimits(): GateLaneRateLimit[] {
  return readJSON<GateLaneRateLimit[]>("rate-limits.json", []);
}

export function saveRateLimits(limits: GateLaneRateLimit[]): void {
  writeJSON("rate-limits.json", limits);
}

// Audit logs
export function appendAuditLog(event: GateLaneAuditEvent): void {
  appendJSONL("audit.jsonl", event as unknown as Record<string, unknown>);
}

export function loadAuditLogs(): GateLaneAuditEvent[] {
  return readJSONL("audit.jsonl") as unknown as GateLaneAuditEvent[];
}

// Usage
export function appendUsageEvent(event: GateLaneUsageEvent): void {
  appendJSONL("usage.jsonl", event as unknown as Record<string, unknown>);
}

export function loadUsageEvents(): GateLaneUsageEvent[] {
  return readJSONL("usage.jsonl") as unknown as GateLaneUsageEvent[];
}
