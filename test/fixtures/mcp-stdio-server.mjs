#!/usr/bin/env node
import { createInterface } from "readline";

const tools = [
  {
    name: "test_echo",
    description: "Echo input back",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" }, number: { type: "number" } },
      required: ["message"],
    },
  },
  {
    name: "test_add",
    description: "Add two numbers",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "test_error",
    description: "Always throws an error",
    inputSchema: { type: "object", properties: {} },
  },
];

function sendJson(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function handleTool(name, args) {
  if (name === "test_echo") {
    return { message: args.message || "", number: args.number || 0, echo: true };
  }
  if (name === "test_add") {
    return { result: (args.a || 0) + (args.b || 0) };
  }
  if (name === "test_error") {
    throw new Error("Intentional tool error");
  }
  throw new Error(`Unknown tool: ${name}`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (!msg.jsonrpc || msg.jsonrpc !== "2.0") return;

  const id = msg.id ?? null;

  if (msg.method === "initialize") {
    sendJson({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "test-mcp-server", version: "1.0.0" },
      },
    });
    return;
  }

  if (msg.method === "notifications/initialized") {
    return;
  }

  if (msg.method === "tools/list") {
    sendJson({ jsonrpc: "2.0", id, result: { tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } });
    return;
  }

  if (msg.method === "tools/call") {
    try {
      const result = handleTool(msg.params.name, msg.params.arguments || {});
      sendJson({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson({ jsonrpc: "2.0", id, error: { code: -32603, message } });
    }
    return;
  }

  sendJson({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
});
