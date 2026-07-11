import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

test("rate limiter allows within limit", async () => {
  const { RateLimiter } = await import("../dist/core/rate-limiter.js");
  const limiter = new RateLimiter();
  limiter.add("global", "__global__", 100, 60);
  limiter.check("test-server", "test-tool", "actor1");
  // Should not throw
  assert.ok(true);
});

test("rate limiter blocks after limit", async () => {
  const { RateLimiter } = await import("../dist/core/rate-limiter.js");
  const { RateLimitExceededError } = await import("../dist/core/errors.js");
  const limiter = new RateLimiter();
  limiter.add("global", "__global__", 1, 60);
  limiter.check("test-server", "test-tool", "actor1");
  try {
    limiter.check("test-server", "test-tool", "actor1");
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof RateLimitExceededError);
  }
});

test.run();
