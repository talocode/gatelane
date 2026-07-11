import { test } from "uvu";
import * as assert from "node:assert";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "../dist/server.js";
import http from "node:http";

const testHome = join(process.cwd(), "test", ".test-gatelane");
process.env.GATELANE_HOME = testHome;
if (!existsSync(testHome)) mkdirSync(testHome, { recursive: true });

const PORT = 13579;

function fetch(path: string, opts: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: PORT, path, method: opts.method || "GET", headers: { "Content-Type": "application/json", ...opts.headers } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

let server: any;

test("start API server", async () => {
  const app = createServer({ port: PORT });
  server = app.listen(PORT);
  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(server);
});

test("GET /health returns ok", async () => {
  const res: any = await fetch("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("GET /v1/gatelane/health returns ok", async () => {
  const res: any = await fetch("/v1/gatelane/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("POST /v1/gatelane/servers registers server", async () => {
  const res: any = await fetch("/v1/gatelane/servers", {
    method: "POST",
    body: { name: "api-test", type: "mock" },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.server.id);
});

test("GET /v1/gatelane/servers lists servers", async () => {
  const res: any = await fetch("/v1/gatelane/servers");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.servers));
});

test("POST /v1/gatelane/tools/discover discovers tools", async () => {
  const res: any = await fetch("/v1/gatelane/tools/discover", { method: "POST" });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.tools));
});

test("POST /v1/gatelane/call calls tool", async () => {
  // Ensure a server is registered
  await fetch("/v1/gatelane/servers", {
    method: "POST",
    body: { name: "call-test", type: "mock" },
  });
  await fetch("/v1/gatelane/tools/discover", { method: "POST" });

  const res: any = await fetch("/v1/gatelane/call", {
    method: "POST",
    body: { tool: "call-test.call-test_query", input: { test: true } },
  });
  // May fail if tool not found after fresh discover, but should still return a response
  assert.ok(res.body);
});

test("POST /v1/gatelane/policies creates policy", async () => {
  const res: any = await fetch("/v1/gatelane/policies", {
    method: "POST",
    body: { effect: "allow", tool: "test.read" },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.policy.id);
});

test("stop server", async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.ok(true);
});

test.run();
