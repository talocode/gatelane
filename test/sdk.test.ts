import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("SDK exports GateLaneClient", async () => {
  const mod = await import("../dist/sdk.js");
  assert.ok(mod.GateLaneClient);
  assert.equal(typeof mod.GateLaneClient, "function");
});

test("SDK creates client with baseUrl", async () => {
  const { GateLaneClient } = await import("../dist/sdk.js");
  const client = new GateLaneClient({ baseUrl: "http://localhost:3050" });
  assert.ok(client);
  assert.equal(typeof client.health, "function");
  assert.equal(typeof client.listServers, "function");
  assert.equal(typeof client.callTool, "function");
  assert.equal(typeof client.allowTool, "function");
  assert.equal(typeof client.denyTool, "function");
  assert.equal(typeof client.listPolicies, "function");
  assert.equal(typeof client.listAuditLogs, "function");
  assert.equal(typeof client.getUsage, "function");
});

test("SDK creates client with apiKey", async () => {
  const { GateLaneClient } = await import("../dist/sdk.js");
  const client = new GateLaneClient({ baseUrl: "http://localhost:3050", apiKey: "test-key" });
  assert.ok(client);
});

test.run();
