import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("allow policy passes", async () => {
  const { PolicyEngine } = await import("../dist/core/policy-engine.js");
  const engine = new PolicyEngine();
  engine.add({ effect: "allow", tool: "memorylane.memorylane_recall" });
  const result = engine.check("memorylane.memorylane_recall");
  assert.equal(result.allowed, true);
});

test("deny policy blocks", async () => {
  const { PolicyEngine } = await import("../dist/core/policy-engine.js");
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", tool: "memorylane.memorylane_forget" });
  const result = engine.check("memorylane.memorylane_forget");
  assert.equal(result.allowed, false);
});

test("no matching allow policy denies", async () => {
  const { PolicyEngine } = await import("../dist/core/policy-engine.js");
  const engine = new PolicyEngine();
  // Add allow for one tool only
  engine.add({ effect: "allow", tool: "memorylane.memorylane_recall" });
  const result = engine.check("memorylane.memorylane_forget");
  assert.equal(result.allowed, false);
  assert.ok(result.reason);
});

test("no policies = allow", async () => {
  const { PolicyEngine } = await import("../dist/core/policy-engine.js");
  const engine = new PolicyEngine();
  const result = engine.check("anything.any_tool");
  assert.equal(result.allowed, true);
});

test("server-scoped deny", async () => {
  const { PolicyEngine } = await import("../dist/core/policy-engine.js");
  const engine = new PolicyEngine();
  engine.add({ effect: "deny", server: "dangerous" });
  const result = engine.check("dangerous.something");
  assert.equal(result.allowed, false);
});

test.run();
