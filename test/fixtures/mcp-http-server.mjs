#!/usr/bin/env node
import http from "node:http";

const tools = [
  {
    name: "http_echo",
    description: "Echo input back via HTTP",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "http_hello",
    description: "Say hello",
    inputSchema: { type: "object", properties: { name: { type: "string" } } },
  },
];

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    sendJson(res, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Only POST allowed" } }, 405);
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let msg;
    try { msg = JSON.parse(body); } catch { sendJson(res, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); return; }

    if (!msg.jsonrpc || msg.jsonrpc !== "2.0") {
      sendJson(res, { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32600, message: "Not JSON-RPC 2.0" } }, 400);
      return;
    }

    const id = msg.id ?? null;

    if (msg.method === "tools/list") {
      sendJson(res, { jsonrpc: "2.0", id, result: { tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } });
      return;
    }

    if (msg.method === "tools/call") {
      if (msg.params.name === "http_echo") {
        sendJson(res, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ echo: true, message: msg.params.arguments?.message || "" }) }] } });
        return;
      }
      if (msg.params.name === "http_hello") {
        sendJson(res, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Hello, ${msg.params.arguments?.name || "world"}!` }] } });
        return;
      }
      sendJson(res, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${msg.params.name}` } });
      return;
    }

    sendJson(res, { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
  });
});

const PORT = parseInt(process.argv[2] || "13579");
server.listen(PORT, () => {
  process.stdout.write(`MCP HTTP test server running on port ${PORT}\n`);
});
