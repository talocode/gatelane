#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const TEST_HOME = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = TEST_HOME;

// Clean test home
if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true });
mkdirSync(TEST_HOME, { recursive: true });

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message || "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function run(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("PASS");
    passed++;
  } catch (err) {
    console.log("FAIL");
    console.log(`    ${err.message}`);
    failed++;
    failures.push(name);
  }
  // Clean config between tests
  if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true });
  mkdirSync(TEST_HOME, { recursive: true });
}

console.log("GateLane Test Suite\n");

// Import from dist
const { ServerRegistry } = await import("../dist/core/server-registry.js");
const { PolicyEngine } = await import("../dist/core/policy-engine.js");
const { RateLimiter } = await import("../dist/core/rate-limiter.js");
const { AuditLog } = await import("../dist/core/audit-log.js");
const { UsageTracker } = await import("../dist/core/usage.js");
const { RateLimitExceededError } = await import("../dist/core/errors.js");
const { loadConfig, saveConfig } = await import("../dist/core/config-store.js");

// === Config Store ===
await run("config store loads", async () => {
  const config = loadConfig();
  assert(config, "config should load");
  assertEqual(config.cloudMode, false);
  assertEqual(config.defaultPort, 3050);
});

// === Server Registry ===
await run("add server", async () => {
  const registry = new ServerRegistry();
  const server = registry.add({ name: "test-server", type: "mock", enabled: true });
  assert(server.id, "server should have id");
  assertEqual(server.name, "test-server");
});

await run("list servers", async () => {
  const registry = new ServerRegistry();
  const servers = registry.list();
  assert(Array.isArray(servers), "servers should be array");
});

await run("get server by name", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "get-test", type: "mock" });
  const server = registry.get("get-test");
  assertEqual(server.name, "get-test");
});

await run("remove server", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "remove-test", type: "mock" });
  registry.remove("remove-test");
  try {
    registry.get("remove-test");
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e.message.includes("not found"), "Should say not found");
  }
});

// === Policy Engine ===
await run("allow policy passes", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "allow", tool: "memorylane.memorylane_recall" });
  const result = engine.check("memorylane.memorylane_recall");
  assertEqual(result.allowed, true);
});

await run("deny policy blocks", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", tool: "memorylane.memorylane_forget" });
  const result = engine.check("memorylane.memorylane_forget");
  assertEqual(result.allowed, false);
});

await run("no matching allow policy denies", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "allow", tool: "searchlane.searchlane_search" });
  const result = engine.check("memorylane.memorylane_recall");
  assertEqual(result.allowed, false);
});

await run("no policies = allow", async () => {
  const engine = new PolicyEngine();
  const result = engine.check("anything.any_tool");
  assertEqual(result.allowed, true);
});

await run("server-scoped deny", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", server: "dangerous" });
  const result = engine.check("dangerous.something");
  assertEqual(result.allowed, false);
});

// === Rate Limiter ===
await run("rate limiter allows within limit", async () => {
  const limiter = new RateLimiter();
  limiter.add("global", "__global__", 100, 60);
  limiter.check("server", "tool", "actor1");
  // Should not throw
  assert(true, "rate limit check should pass");
});

await run("rate limiter blocks after limit", async () => {
  const limiter = new RateLimiter();
  limiter.add("global", "__global__", 1, 60);
  limiter.check("server", "tool", "actor1");
  try {
    limiter.check("server", "tool", "actor1");
    assert(false, "Should have thrown");
  } catch (err) {
    assert(err instanceof RateLimitExceededError, "Should throw RateLimitExceededError");
  }
});

// === Audit Log ===
await run("audit log records and retrieves events", async () => {
  const audit = new AuditLog();
  const entry = audit.record({
    actor: "test",
    serverId: "srv_test",
    serverName: "test-server",
    toolName: "test-tool",
    requestId: "req_test",
    status: "completed",
    durationMs: 42,
  });
  assert(entry.id, "entry should have id");
  assertEqual(entry.status, "completed");
  const entries = audit.list();
  assert(entries.length > 0, "should have entries");
  assertEqual(entries[0].toolName, "test-tool");
});

// === Auth ===
await run("local mode does not require auth", async () => {
  saveConfig({ cloudMode: false, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const { checkAuth } = await import("../dist/core/auth.js");
  checkAuth({ headers: {} });
  assert(true, "should not throw");
});

await run("cloud mode rejects missing key", async () => {
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const { checkAuth } = await import("../dist/core/auth.js");
  try {
    checkAuth({ headers: {} });
    assert(false, "Should have thrown");
  } catch (err) {
    assert(err.message.includes("Cloud mode requires"), "Should say cloud mode requires");
  }
});

await run("cloud mode rejects wrong key", async () => {
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  try {
    checkAuth({ headers: { authorization: "Bearer wrong-key" } });
    assert(false, "Should have thrown");
  } catch (err) {
    assert(err.message.includes("Invalid"), "Should say invalid key");
  }
  delete process.env.TALOCODE_API_KEY;
});

await run("cloud mode accepts valid key", async () => {
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  checkAuth({ headers: { authorization: "Bearer test-key-valid" } });
  assert(true, "should not throw");
  delete process.env.TALOCODE_API_KEY;
});

// === API Tests ===
import http from "node:http";

const PORT = 13579;
let server;

await run("start API server", async () => {
  const { createServer } = await import("../dist/server.js");
  const app = createServer({ port: PORT });
  server = app.listen(PORT);
  await new Promise((r) => setTimeout(r, 200));
  assert(server, "server should start");
});

function apiFetch(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: PORT, path, method: opts.method || "GET", headers: { "Content-Type": "application/json", ...opts.headers } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

await run("GET /health returns ok", async () => {
  const res = await apiFetch("/health");
  assertEqual(res.status, 200);
  assertEqual(res.body.status, "ok");
});

await run("GET /v1/gatelane/health returns ok", async () => {
  const res = await apiFetch("/v1/gatelane/health");
  assertEqual(res.status, 200);
  assertEqual(res.body.status, "ok");
});

await run("POST /v1/gatelane/servers registers server", async () => {
  const res = await apiFetch("/v1/gatelane/servers", { method: "POST", body: { name: "api-test", type: "mock" } });
  assertEqual(res.status, 201);
  assert(res.body.server?.id || res.body.id, "should have id");
});

await run("POST /v1/gatelane/tools/discover discovers tools", async () => {
  await apiFetch("/v1/gatelane/servers", { method: "POST", body: { name: "disc-test", type: "mock" } });
  const res = await apiFetch("/v1/gatelane/tools/discover", { method: "POST" });
  assertEqual(res.status, 200);
  assert(Array.isArray(res.body.tools), "tools should be array");
});

await run("POST /v1/gatelane/policies creates policy", async () => {
  const res = await apiFetch("/v1/gatelane/policies", { method: "POST", body: { effect: "allow", tool: "test.read" } });
  assertEqual(res.status, 201);
  assert(res.body.policy?.id || res.body.id, "should have id");
});

await run("stop API server", async () => {
  if (server) await new Promise((r) => server.close(r));
  assert(true, "server stopped");
});

// === SDK Tests ===
await run("SDK exports GateLaneClient", async () => {
  const mod = await import("../dist/sdk.js");
  assert(mod.GateLaneClient, "should export GateLaneClient");
  assert(typeof mod.GateLaneClient, "function");
});

await run("SDK client has all methods", async () => {
  const { GateLaneClient } = await import("../dist/sdk.js");
  const client = new GateLaneClient({ baseUrl: "http://localhost:3050" });
  const methods = ["health", "listServers", "addServer", "callTool", "allowTool", "denyTool", "listPolicies", "listAuditLogs", "getUsage"];
  for (const m of methods) {
    assert(typeof client[m] === "function", `${m} should be a function`);
  }
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`Failed: ${failures.join(", ")}`);
}

// Reset config
saveConfig({ cloudMode: false, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

process.exit(failed > 0 ? 1 : 0);
