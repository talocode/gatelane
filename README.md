# GateLane

Open-source MCP gateway and agent tool control plane.

GateLane controls how AI agents access tools. It sits between agents and MCP servers, enforcing authentication, allow/deny policies, rate limits, and audit logging on every tool call.

## Features

- **MCP Server Registry** — register and manage MCP servers (stdio, HTTP, mock)
- **Real MCP Tool Discovery** — discover real tools from stdio and HTTP MCP servers
- **Real MCP Tool Proxying** — proxy tool calls to real MCP servers via stdio JSON-RPC 2.0 or HTTP POST
- **Allow/Deny Policies** — per-tool, per-server, per-actor access control
- **Rate Limiting** — global, per-server, per-tool, and per-actor rate limits
- **Audit Logs** — every tool call recorded with status, duration, and actor
- **Usage Tracking** — credit-based usage tracking foundation
- **Local HTTP API** — REST API with 22+ endpoints
- **TypeScript SDK** — typed client library
- **MCP Server** — GateLane exposes its own MCP server with 11 management tools
- **CLI** — full command-line interface with 15 commands
- **Cloud Auth** — local mode is keyless; Talocode Cloud mode gated by TALOCODE_API_KEY
- **Optional SQLite Backend** — persistent storage via sql.js (falls back to JSON)

## Install

```bash
npm install -g @talocode/gatelane
```

Or use npx:

```bash
npx @talocode/gatelane demo
```

## Quickstart

```bash
# Initialize GateLane config
gatelane init

# Register a mock MCP server
gatelane servers add memorylane --type mock

# Discover its tools
gatelane tools discover

# Allow a specific tool
gatelane policy allow memorylane.memorylane_recall

# Call the tool through GateLane
gatelane call memorylane.memorylane_recall --input '{"query":"Hello world"}'

# View the audit log
gatelane logs list
```

### Real MCP proxy example (with MemoryLane)

```bash
# Install MemoryLane
npm install -g @talocode/memorylane

# Register as a stdio MCP server
gatelane servers add memorylane --type mcp-stdio --command "memorylane mcp"

# Discover real MemoryLane tools
gatelane tools discover

# Allow the recall tool
gatelane policy allow memorylane.memorylane_recall

# Call the real MCP tool through GateLane
gatelane call memorylane.memorylane_recall --input '{"query":"How should I write launch posts?"}'

# View the audit log
gatelane logs list
```

## Overview

```
Agent → GateLane → MCP Servers / HTTP APIs / Local Tools

GateLane:
1. Check auth (cloud mode)
2. Check allow/deny policies
3. Check rate limits
4. Proxy the tool call
5. Record audit log
6. Record usage
7. Return result
```

## CLI

```bash
gatelane init                # Initialize config
gatelane doctor              # Check installation
gatelane demo                # Run interactive demo

gatelane servers add <name> --type mcp-stdio --command "<cmd>"
gatelane servers list
gatelane servers show <name>
gatelane servers remove <name>

gatelane tools discover
gatelane tools list
gatelane tools show <tool>

gatelane call <server.tool> --input '{}' --actor <name>

gatelane policy allow <server.tool>
gatelane policy deny <server.tool>
gatelane policy list
gatelane policy remove <id>

gatelane logs list
gatelane logs tail

gatelane serve --port 3050
gatelane proxy --port 3051
gatelane mcp --port 3052
```

## HTTP API

Default port: 3050

```
GET  /health
GET  /v1/gatelane/health
GET  /v1/gatelane/capabilities
GET  /v1/gatelane/pricing

POST /v1/gatelane/servers
GET  /v1/gatelane/servers
GET  /v1/gatelane/servers/:id
DELETE /v1/gatelane/servers/:id

POST /v1/gatelane/tools/discover
GET  /v1/gatelane/tools
GET  /v1/gatelane/tools/:id

POST /v1/gatelane/call

POST /v1/gatelane/policies
GET  /v1/gatelane/policies
DELETE /v1/gatelane/policies/:id

POST /v1/gatelane/rate-limits
GET  /v1/gatelane/rate-limits
DELETE /v1/gatelane/rate-limits/:id

GET /v1/gatelane/audit
GET /v1/gatelane/audit/tail

GET /v1/gatelane/usage
```

## SDK

```typescript
import { GateLaneClient } from "@talocode/gatelane";

const gate = new GateLaneClient({ baseUrl: "http://localhost:3050" });

// Register a server
await gate.addServer({ name: "memorylane", type: "mcp-stdio", command: "memorylane", args: ["mcp"] });

// Discover tools
await gate.discoverTools();

// Allow a tool
await gate.allowTool("memorylane.memorylane_recall");

// Call a tool
const result = await gate.callTool({
  tool: "memorylane.memorylane_recall",
  input: { query: "How should I write launch posts?" },
  actor: "my-agent",
});
```

Cloud mode:

```typescript
const gate = new GateLaneClient({
  baseUrl: "https://api.talocode.site",
  apiKey: process.env.TALOCODE_API_KEY,
});
```

## MCP Server

GateLane exposes its own MCP server on port 3052:

```
gatelane mcp --port 3052
```

Tools available: gatelane_health, gatelane_list_servers, gatelane_add_server, gatelane_discover_tools, gatelane_list_tools, gatelane_call_tool, gatelane_allow_tool, gatelane_deny_tool, gatelane_list_policies, gatelane_list_audit_logs, gatelane_get_usage

## Cloud Auth

Local mode is open-source and requires no API key.

Talocode Cloud mode:

```bash
export GATELANE_CLOUD_MODE=true
export TALOCODE_API_KEY=your_key

gatelane serve
```

Protected endpoints require either:
- `Authorization: Bearer <key>` header
- `X-Api-Key: <key>` header

## Storage Backend

Default storage is JSON files in `~/.gatelane/`. SQLite is optional:

```bash
# Use JSON (default)
export GATELANE_STORAGE_DRIVER=json

# Use SQLite (requires npm install sql.js)
export GATELANE_STORAGE_DRIVER=sqlite
```

## Installation

| Platform | Command |
|----------|---------|
| Linux / macOS | `npm install -g @talocode/gatelane` |
| Windows | `npm install -g @talocode/gatelane` |
| Android (Termux) | `pkg install nodejs && npm install -g @talocode/gatelane` |
| iOS | iSH shell: `npm install -g @talocode/gatelane` |

See [docs/INSTALL.md](docs/INSTALL.md) for full instructions.

## Examples

See [examples/](examples/) for:
- Real MemoryLane MCP proxy
- Basic MCP gateway setup
- SearchLane + MemoryLane gateway
- Local command tool (experimental)
- Policy and audit demo

## Documentation

- [API Reference](docs/API.md)
- [CLI Reference](docs/CLI.md)
- [SDK Reference](docs/SDK.md)
- [MCP Server](docs/MCP.md)
- [Installation Guide](docs/INSTALL.md)
- [Cloud Auth](docs/CLOUD_AUTH.md)
- [Policies](docs/POLICIES.md)
- [Rate Limiting](docs/RATE_LIMITING.md)
- [Audit Logs](docs/AUDIT_LOGS.md)
- [Examples](docs/EXAMPLES.md)
- [Release Notes](docs/RELEASE.md)

## Policy Behavior

GateLane v0.2.0 policy behavior:
- **Local mode**: allow unless a deny policy explicitly blocks. Warned: production use should define allow policies.
- **Cloud mode**: deny by default unless an allow policy exists.
- Deny policies are checked first (most specific wins).
- If allow policies exist, at least one must match the tool.

## License

MIT © Talocode
