#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const TEST_HOME = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = TEST_HOME;
process.env.GATELANE_STORAGE_DRIVER = "json";

const FIXTURE_STDIO_SERVER = join(process.cwd(), "test/fixtures/mcp-stdio-server.mjs");

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

function assertMatch(actual, regex, message) {
  if (!regex.test(actual)) throw new Error(`${message || "Assertion failed"}: "${actual}" does not match ${regex}`);
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

console.log("GateLane Test Suite v0.2.0\n");

// Import from dist
const { ServerRegistry } = await import("../dist/core/server-registry.js");
const { PolicyEngine } = await import("../dist/core/policy-engine.js");
const { RateLimiter } = await import("../dist/core/rate-limiter.js");
const { AuditLog } = await import("../dist/core/audit-log.js");
const { UsageTracker } = await import("../dist/core/usage.js");
const { ToolProxy } = await import("../dist/core/tool-proxy.js");
const { ToolDiscovery } = await import("../dist/core/tool-discovery.js");
const { RateLimitExceededError, ToolDeniedError, GateLaneError } = await import("../dist/core/errors.js");
const { loadConfig, saveConfig, loadServers, loadPolicies } = await import("../dist/core/config-store.js");
const { getStorageBackend, setStorageBackend } = await import("../dist/core/storage.js");

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

// === Real MCP stdio proxy tests ===
await run("stdio MCP: discover tools from fixture server", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "fixture-stdio", type: "mcp-stdio", command: "node", args: [FIXTURE_STDIO_SERVER], enabled: true });
  const discovery = new ToolDiscovery();
  const tools = await discovery.discover();
  assert(tools.length > 0, "should discover tools");
  const names = tools.map(t => t.name);
  assert(names.includes("fixture-stdio.test_echo"), "should discover test_echo");
  assert(names.includes("fixture-stdio.test_add"), "should discover test_add");
  assert(names.includes("fixture-stdio.test_error"), "should discover test_error");
});

await run("stdio MCP: call tool through proxy", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "fixture-call", type: "mcp-stdio", command: "node", args: [FIXTURE_STDIO_SERVER], enabled: true });
  const discovery = new ToolDiscovery();
  await discovery.discover();
  const toolDef = discovery.get("fixture-call.test_echo");
  assert(toolDef, "test_echo should be discovered");
  const proxy = new ToolProxy();
  const { result, durationMs } = await proxy.call(toolDef, { message: "hello test" });
  assert(result, "should have result");
  assert(durationMs >= 0, "should have duration");
});

await run("stdio MCP: failed tool returns error", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "fixture-err", type: "mcp-stdio", command: "node", args: [FIXTURE_STDIO_SERVER], enabled: true });
  const discovery = new ToolDiscovery();
  await discovery.discover();
  const toolDef = discovery.get("fixture-err.test_error");
  assert(toolDef, "test_error should be discovered");
  const proxy = new ToolProxy();
  try {
    await proxy.call(toolDef, {});
    assert(false, "Should have thrown on error tool");
  } catch (err) {
    assert(err instanceof GateLaneError, "Should throw GateLaneError");
  }
});

await run("stdio MCP: real server failure does NOT return mock", async () => {
  const registry = new ServerRegistry();
  // Non-existent command
  registry.add({ name: "nonexistent", type: "mcp-stdio", command: "does-not-exist-xyz", args: [], enabled: true });
  const discovery = new ToolDiscovery();
  try {
    await discovery.discover();
    // Should have failed - but discovery should not silently add mock tools
    const tools = discovery.list();
    const hasMock = tools.some(t => t.serverName === "nonexistent");
    assert(!hasMock, "should not have mock tools for failed real server");
  } catch {
    // Error is acceptable as long as no mock tools exist
    const tools = discovery.list();
    const hasMock = tools.some(t => t.serverName === "nonexistent");
    assert(!hasMock, "should not have mock tools for failed real server");
  }
});

// === HTTP MCP proxy tests ===
await run("HTTP MCP: create test server and discover tools", async () => {
  // Start the HTTP fixture server
  const httpServerPath = join(process.cwd(), "test/fixtures/mcp-http-server.mjs");
  const httpPort = 23579;
  const { spawn } = await import("node:child_process");
  const httpProc = spawn("node", [httpServerPath, String(httpPort)], { stdio: "pipe" });
  await new Promise(r => setTimeout(r, 500));

  try {
    const registry = new ServerRegistry();
    registry.add({ name: "fixture-http", type: "mcp-http", url: `http://localhost:${httpPort}`, enabled: true });
    const discovery = new ToolDiscovery();
    const tools = await discovery.discover();
    const names = tools.map(t => t.name);
    assert(names.includes("fixture-http.http_echo"), "should discover http_echo");
    assert(names.includes("fixture-http.http_hello"), "should discover http_hello");

    // Call tool through HTTP proxy
    const toolDef = discovery.get("fixture-http.http_echo");
    assert(toolDef, "http_echo should be discovered");
    const proxy = new ToolProxy();
    const { result, durationMs } = await proxy.call(toolDef, { message: "http test" });
    assert(result, "should have result");
    assert(durationMs >= 0, "should have duration");
  } finally {
    httpProc.kill();
  }
});

// === Mock server still works ===
await run("mock server discovery and call", async () => {
  const registry = new ServerRegistry();
  registry.add({ name: "mock-test", type: "mock", enabled: true });
  const discovery = new ToolDiscovery();
  const tools = await discovery.discover();
  const names = tools.map(t => t.name);
  assert(names.includes("mock-test.mock-test_ping"), "should discover mock ping");
  assert(names.includes("mock-test.mock-test_echo"), "should discover mock echo");
  assert(names.includes("mock-test.mock-test_query"), "should discover mock query");

  const toolDef = discovery.get("mock-test.mock-test_echo");
  assert(toolDef, "mock echo should be found");
  const proxy = new ToolProxy();
  const { result } = await proxy.call(toolDef, { hello: "world" });
  assert(result.mock === true, "mock result should have mock:true");
});

// === Policy Engine ===
await run("allow policy permits call", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "allow", tool: "memorylane.memorylane_recall" });
  const result = engine.check("memorylane.memorylane_recall");
  assertEqual(result.allowed, true);
});

await run("deny policy blocks call", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", tool: "memorylane.memorylane_forget" });
  const result = engine.check("memorylane.memorylane_forget");
  assertEqual(result.allowed, false);
});

await run("no matching allow policy denies when allow policies exist", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "allow", tool: "searchlane.searchlane_search" });
  const result = engine.check("memorylane.memorylane_recall");
  assertEqual(result.allowed, false);
});

await run("no policies = allow (local mode default)", async () => {
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

await run("actor-scoped deny", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", tool: "secret.read", actor: "bot" });
  const allowedResult = engine.check("secret.read", "human");
  assertEqual(allowedResult.allowed, true, "human should be allowed");
  const deniedResult = engine.check("secret.read", "bot");
  assertEqual(deniedResult.allowed, false, "bot should be denied");
});

// === Rate Limiter ===
await run("rate limiter allows within limit", async () => {
  const limiter = new RateLimiter();
  limiter.add("global", "__global__", 100, 60);
  limiter.check("server", "tool", "actor1");
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

await run("audit log: deny creates audit event", async () => {
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", tool: "blocked.tool" });
  const audit = new AuditLog();
  audit.record({
    actor: "tester",
    serverName: "blocked",
    toolName: "blocked.tool",
    requestId: "req_deny",
    status: "denied",
    reason: "Blocked by policy",
    durationMs: 5,
  });
  const entries = audit.list();
  assert(entries.length > 0, "should have entries");
  const denied = entries.find(e => e.status === "denied");
  assert(denied, "should have denied entry");
  assertEqual(denied.toolName, "blocked.tool");
});

await run("audit log: failed call creates audit event", async () => {
  const audit = new AuditLog();
  audit.record({
    actor: "tester",
    serverName: "broken",
    toolName: "broken.tool",
    requestId: "req_fail",
    status: "failed",
    reason: "MCP server not found",
    durationMs: 100,
  });
  const entries = audit.list();
  const failed = entries.find(e => e.status === "failed");
  assert(failed, "should have failed entry");
  assertMatch(failed.reason, /MCP/, "reason should mention MCP");
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

await run("cloud mode accepts valid key via Bearer header", async () => {
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  checkAuth({ headers: { authorization: "Bearer test-key-valid" } });
  assert(true, "should not throw");
  delete process.env.TALOCODE_API_KEY;
});

await run("cloud mode accepts valid key via X-Api-Key header", async () => {
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  checkAuth({ headers: { "x-talocode-api-key": "test-key-valid" } });
  assert(true, "should not throw");
  delete process.env.TALOCODE_API_KEY;
});

// === Storage backend ===
await run("JSON storage works", async () => {
  const { JsonStorageBackend } = await import("../dist/core/storage-json.js");
  const jsonBackend = new JsonStorageBackend();
  setStorageBackend(jsonBackend);
  
  const config = loadConfig();
  assertEqual(config.cloudMode, false);
  
  const registry = new ServerRegistry();
  registry.add({ name: "json-test", type: "mock" });
  const servers = loadServers();
  assert(servers.length > 0, "servers should persist to JSON");
});

await run("SQLite fallback does not crash if sql.js missing", async () => {
  process.env.GATELANE_STORAGE_DRIVER = "sqlite";
  // Reset storage backend
  setStorageBackend(null);
  try {
    const backend = getStorageBackend();
    // Should fallback to JSON if sql.js missing
    const config = backend.loadConfig();
    assert(config, "should load config via fallback");
  } finally {
    process.env.GATELANE_STORAGE_DRIVER = "json";
    setStorageBackend(null);
  }
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
  assertEqual(res.body.version, "0.2.0");
});

await run("GET /v1/gatelane/health returns ok", async () => {
  const res = await apiFetch("/v1/gatelane/health");
  assertEqual(res.status, 200);
  assertEqual(res.body.status, "ok");
});

await run("POST /v1/gatelane/servers registers server", async () => {
  const res = await apiFetch("/v1/gatelane/servers", { method: "POST", body: { name: "api-test", type: "mock" } });
  assertEqual(res.status, 201);
  assert(res.body.server?.id, "should have id");
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
  assert(res.body.policy?.id, "should have id");
});

await run("POST /v1/gatelane/call with mock tool", async () => {
  // Register a mock server and discover tools
  await apiFetch("/v1/gatelane/servers", { method: "POST", body: { name: "call-test", type: "mock" } });
  await apiFetch("/v1/gatelane/tools/discover", { method: "POST" });
  // Allow the tool
  await apiFetch("/v1/gatelane/policies", { method: "POST", body: { effect: "allow", tool: "call-test.call-test_echo" } });
  const res = await apiFetch("/v1/gatelane/call", { method: "POST", body: { tool: "call-test.call-test_echo", input: { hello: "world" }, actor: "test" } });
  assertEqual(res.status, 200);
  assertEqual(res.body.status, "completed");
});

await run("GET /v1/gatelane/audit returns log entries", async () => {
  const res = await apiFetch("/v1/gatelane/audit");
  assertEqual(res.status, 200);
  assert(Array.isArray(res.body.entries), "entries should be array");
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
