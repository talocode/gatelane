import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
import type { GateLaneConfig, GateLaneServer, GateLanePolicy, GateLaneRateLimit, GateLaneAuditEvent, GateLaneUsageEvent } from "./schema.js";
import type { StorageBackend } from "./storage.js";

const HOME_VAR = process.env.GATELANE_HOME || join(homedir(), ".gatelane");

let _initPromise: Promise<void> | null = null;

export class SqliteStorageBackend implements StorageBackend {
  private db: any = null;
  private initialized = false;

  constructor() {
    this._init();
  }

  private async _init(): Promise<void> {
    if (_initPromise) return _initPromise;
    _initPromise = this._initDb();
    return _initPromise;
  }

  private async _initDb(): Promise<void> {
    try {
      const initSqlJs = (await import("sql.js")).default;
      const fs = await import("node:fs");
      const dbPath = join(HOME_VAR, "gatelane.db");

      let sqlDb: any;
      if (existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        sqlDb = await initSqlJs({ locateFile: () => "" });
        sqlDb = new sqlDb.Database(buffer);
      } else {
        if (!fs.existsSync(HOME_VAR)) {
          fs.mkdirSync(HOME_VAR, { recursive: true });
        }
        sqlDb = await initSqlJs({ locateFile: () => "" });
        sqlDb = new sqlDb.Database();
        this._createTables(sqlDb);
        this._saveDb(sqlDb, dbPath);
      }

      this.db = sqlDb;
      this.initialized = true;
    } catch (err) {
      console.warn("SQLite backend unavailable, falling back to JSON storage:", (err as Error).message);
      const { JsonStorageBackend } = await import("./storage-json.js");
      const jsonBackend = new JsonStorageBackend();
      this.db = jsonBackend;
      this.initialized = true;
    }
  }

  private _createTables(db: any): void {
    db.run(`CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      command TEXT,
      args TEXT,
      url TEXT,
      env TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      metadata TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      effect TEXT NOT NULL,
      server TEXT,
      tool TEXT,
      actor TEXT,
      reason TEXT,
      createdAt TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS rate_limits (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      target TEXT NOT NULL,
      limit_count INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT,
      serverId TEXT,
      serverName TEXT,
      toolName TEXT,
      requestId TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      durationMs INTEGER,
      createdAt TEXT NOT NULL,
      metadata TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      actor TEXT,
      serverId TEXT,
      toolName TEXT,
      requestId TEXT NOT NULL,
      credits INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(createdAt)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(createdAt)`);
  }

  private _saveDb(db: any, dbPath: string): void {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }

  private _ensureInit(): void {
    if (!this.initialized) {
      throw new Error("SQLite backend not initialized. Call await backend.init() first.");
    }
  }

  private _isJsonFallback(): boolean {
    return this.db?.loadConfig !== undefined;
  }

  // Delegate to JSON fallback or use SQLite
  private _getDb() {
    this._ensureInit();
    return this.db;
  }

  async init(): Promise<void> {
    await this._init();
  }

  loadConfig(): GateLaneConfig {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadConfig();

    const stmt = this.db.exec("SELECT value FROM config WHERE key = 'config'");
    const defaultConfig: GateLaneConfig = {
      cloudMode: process.env.GATELANE_CLOUD_MODE === "true",
      defaultPort: 3050,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (stmt.length > 0) {
      try {
        const config = JSON.parse(stmt[0].values[0][0]) as GateLaneConfig;
        config.cloudMode = process.env.GATELANE_CLOUD_MODE === "true" || config.cloudMode;
        return config;
      } catch {
        return defaultConfig;
      }
    }
    return defaultConfig;
  }

  saveConfig(config: GateLaneConfig): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).saveConfig(config);

    config.updatedAt = new Date().toISOString();
    this.db.run("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ["config", JSON.stringify(config)]);
    this._persist();
  }

  loadServers(): GateLaneServer[] {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadServers();

    const stmt = this.db.exec("SELECT * FROM servers ORDER BY createdAt DESC");
    return this._rowsToServers(stmt);
  }

  saveServers(servers: GateLaneServer[]): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).saveServers(servers);

    this.db.run("DELETE FROM servers");
    for (const s of servers) {
      this.db.run(
        "INSERT INTO servers (id, name, type, command, args, url, env, enabled, createdAt, updatedAt, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          s.id, s.name, s.type, s.command || null,
          s.args ? JSON.stringify(s.args) : null, s.url || null,
          s.env ? JSON.stringify(s.env) : null, s.enabled ? 1 : 0,
          s.createdAt, s.updatedAt,
          s.metadata ? JSON.stringify(s.metadata) : null,
        ],
      );
    }
    this._persist();
  }

  loadPolicies(): GateLanePolicy[] {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadPolicies();

    const stmt = this.db.exec("SELECT * FROM policies ORDER BY createdAt DESC");
    return this._rowsToPolicies(stmt);
  }

  savePolicies(policies: GateLanePolicy[]): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).savePolicies(policies);

    this.db.run("DELETE FROM policies");
    for (const p of policies) {
      this.db.run(
        "INSERT INTO policies (id, name, effect, server, tool, actor, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [p.id, p.name, p.effect, p.server || null, p.tool || null, p.actor || null, p.reason || null, p.createdAt],
      );
    }
    this._persist();
  }

  loadRateLimits(): GateLaneRateLimit[] {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadRateLimits();

    const stmt = this.db.exec("SELECT * FROM rate_limits ORDER BY createdAt DESC");
    return this._rowsToRateLimits(stmt);
  }

  saveRateLimits(limits: GateLaneRateLimit[]): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).saveRateLimits(limits);

    this.db.run("DELETE FROM rate_limits");
    for (const l of limits) {
      this.db.run(
        "INSERT INTO rate_limits (id, scope, target, limit_count, window_seconds, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        [l.id, l.scope, l.target, l.limit, l.windowSeconds, l.createdAt],
      );
    }
    this._persist();
  }

  appendAuditLog(event: GateLaneAuditEvent): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).appendAuditLog(event);

    this.db.run(
      "INSERT INTO audit_logs (id, actor, serverId, serverName, toolName, requestId, status, reason, durationMs, createdAt, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        event.id, event.actor || null, event.serverId || null, event.serverName || null,
        event.toolName || null, event.requestId, event.status, event.reason || null,
        event.durationMs || null, event.createdAt,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
    this._persist();
  }

  loadAuditLogs(): GateLaneAuditEvent[] {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadAuditLogs();

    const stmt = this.db.exec("SELECT * FROM audit_logs ORDER BY createdAt DESC");
    return this._rowsToAuditEvents(stmt);
  }

  appendUsageEvent(event: GateLaneUsageEvent): void {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).appendUsageEvent(event);

    this.db.run(
      "INSERT INTO usage_events (id, actor, serverId, toolName, requestId, credits, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [event.id, event.actor || null, event.serverId || null, event.toolName || null, event.requestId, event.credits || 1, event.createdAt],
    );
    this._persist();
  }

  loadUsageEvents(): GateLaneUsageEvent[] {
    this._ensureInit();
    if (this._isJsonFallback()) return (this.db as StorageBackend).loadUsageEvents();

    const stmt = this.db.exec("SELECT * FROM usage_events ORDER BY createdAt DESC");
    return this._rowsToUsageEvents(stmt);
  }

  close(): void {
    if (this.db && !this._isJsonFallback()) {
      this._persist();
      this.db.close();
    }
  }

  private _persist(): void {
    try {
      const dbPath = join(HOME_VAR, "gatelane.db");
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(dbPath, buffer);
    } catch {
      // Silently fail - data still in memory
    }
  }

  private _rowsToServers(stmt: any): GateLaneServer[] {
    if (!stmt.length) return [];
    const cols = stmt[0].columns;
    return stmt[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => {
        const val = row[i];
        if (c === "args" && val) obj[c] = JSON.parse(val);
        else if (c === "env" && val) obj[c] = JSON.parse(val);
        else if (c === "metadata" && val) obj[c] = JSON.parse(val);
        else if (c === "enabled") obj[c] = val === 1;
        else obj[c] = val;
      });
      return obj as GateLaneServer;
    });
  }

  private _rowsToPolicies(stmt: any): GateLanePolicy[] {
    if (!stmt.length) return [];
    const cols = stmt[0].columns;
    return stmt[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => (obj[c] = row[i]));
      return obj as GateLanePolicy;
    });
  }

  private _rowsToRateLimits(stmt: any): GateLaneRateLimit[] {
    if (!stmt.length) return [];
    const cols = stmt[0].columns;
    return stmt[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => {
        if (c === "limit_count") obj["limit"] = row[i];
        else if (c === "window_seconds") obj["windowSeconds"] = row[i];
        else obj[c] = row[i];
      });
      return obj as GateLaneRateLimit;
    });
  }

  private _rowsToAuditEvents(stmt: any): GateLaneAuditEvent[] {
    if (!stmt.length) return [];
    const cols = stmt[0].columns;
    return stmt[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => {
        let val = row[i];
        if (c === "metadata" && val) val = JSON.parse(val);
        obj[c] = val;
      });
      return obj as GateLaneAuditEvent;
    });
  }

  private _rowsToUsageEvents(stmt: any): GateLaneUsageEvent[] {
    if (!stmt.length) return [];
    const cols = stmt[0].columns;
    return stmt[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => (obj[c] = row[i]));
      return obj as GateLaneUsageEvent;
    });
  }
}
