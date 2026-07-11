import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("audit log records and retrieves events", async () => {
  const { AuditLog } = await import("../dist/core/audit-log.js");
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
  assert.ok(entry.id);
  assert.equal(entry.status, "completed");
  
  const entries = audit.list();
  assert.ok(entries.length > 0);
  assert.equal(entries[0].toolName, "test-tool");
});

test.run();
