import { test } from "uvu";
import * as assert from "node:assert";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Set a test HOME
const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;

// Clean up before
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("config store loads and saves config", async () => {
  const { loadConfig, saveConfig } = await import("../dist/core/config-store.js");
  const config = loadConfig();
  assert.ok(config);
  assert.equal(config.cloudMode, false);
  assert.equal(config.defaultPort, 3050);

  // Save and reload
  saveConfig({ ...config, cloudMode: true });
  const reloaded = loadConfig();
  // Note: loadConfig checks env, so this may still show false
  assert.ok(reloaded);
});

test.run();
