import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("add server", async () => {
  const { ServerRegistry } = await import("../dist/core/server-registry.js");
  const registry = new ServerRegistry();
  const server = registry.add({
    name: "test-server",
    type: "mock",
    enabled: true,
  });
  assert.ok(server.id);
  assert.equal(server.name, "test-server");
});

test("list servers", async () => {
  const { ServerRegistry } = await import("../dist/core/server-registry.js");
  const registry = new ServerRegistry();
  const servers = registry.list();
  assert.ok(Array.isArray(servers));
});

test("get server by name", async () => {
  const { ServerRegistry } = await import("../dist/core/server-registry.js");
  const registry = new ServerRegistry();
  registry.add({ name: "get-test", type: "mock" });
  const server = registry.get("get-test");
  assert.equal(server.name, "get-test");
});

test("remove server", async () => {
  const { ServerRegistry } = await import("../dist/core/server-registry.js");
  const registry = new ServerRegistry();
  registry.add({ name: "remove-test", type: "mock" });
  registry.remove("remove-test");
  try {
    registry.get("remove-test");
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    const e = err as Error;
    assert.ok(e.message.includes("not found"));
  }
});

test.run();
