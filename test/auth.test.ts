import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("local mode does not require auth", async () => {
  // Save config with cloudMode false
  const { saveConfig, loadConfig } = await import("../dist/core/config-store.js");
  saveConfig({ cloudMode: false, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  
  const { checkAuth } = await import("../dist/core/auth.js");
  const req = { headers: {} };
  checkAuth(req); // Should not throw
  assert.ok(true);
});

test("cloud mode rejects missing API key", async () => {
  const { saveConfig } = await import("../dist/core/config-store.js");
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  
  const { checkAuth, isCloudMode } = await import("../dist/core/auth.js");
  assert.ok(isCloudMode());
  
  const req = { headers: {} };
  try {
    checkAuth(req);
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    const e = err as Error;
    assert.ok(e.message.includes("Cloud mode requires"));
  }
});

test("cloud mode rejects wrong key", async () => {
  const { saveConfig } = await import("../dist/core/config-store.js");
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  
  const req = { headers: { authorization: "Bearer wrong-key" } };
  try {
    checkAuth(req);
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    const e = err as Error;
    assert.ok(e.message.includes("Invalid"));
  }
  delete process.env.TALOCODE_API_KEY;
});

test("cloud mode accepts valid key", async () => {
  const { saveConfig } = await import("../dist/core/config-store.js");
  saveConfig({ cloudMode: true, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  
  process.env.TALOCODE_API_KEY = "test-key-valid";
  const { checkAuth } = await import("../dist/core/auth.js");
  
  const req = { headers: { authorization: "Bearer test-key-valid" } };
  checkAuth(req); // Should not throw
  assert.ok(true);
  delete process.env.TALOCODE_API_KEY;
});

// Clean up - reset config to local mode
test("reset config to local mode", async () => {
  const { saveConfig } = await import("../dist/core/config-store.js");
  saveConfig({ cloudMode: false, defaultPort: 3050, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
});

test.run();
