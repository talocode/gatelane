# gatelane

Help an AI agent configure and use GateLane as an MCP gateway and agent tool control plane.

## Purpose

GateLane sits between AI agents and MCP servers. It controls which tools an agent can call, who can call them, how often they can call them, and records every call in an audit log. Local mode is keyless. Cloud mode uses TALOCODE_API_KEY.

## When to Use

Use this skill when:
- You need to control which tools an AI agent can access
- You need to log and audit every tool call
- You need rate limiting or allow/deny policies on tool access
- You want to route agent tool calls through a central gateway
- You need to understand how an agent used tools in a session

## Safety Rules

- Never print or log TALOCODE_API_KEY or any secret
- Never bypass policy checks
- Always check audit logs before diagnosing tool issues
- Local mode needs no API key — never prompt for one
- Only suggest cloud mode when the user explicitly requests it

## CLI Quickstart

```bash
# Initialize
gatelane init

# Register a server
gatelane servers add memorylane --type mock

# Discover tools
gatelane tools discover

# List tools
gatelane tools list

# Allow a tool
gatelane policy allow memorylane.memorylane_recall

# Call a tool
gatelane call memorylane.memorylane_recall --input '{"query":"Hello"}'

# Check audit log
gatelane logs tail

# Run the full demo
gatelane demo

# Start the API server
gatelane serve --port 3050

# Start the MCP server
gatelane mcp --port 3052
```

## API Quickstart

```bash
# Start server
gatelane serve --port 3050

# Health check
curl http://localhost:3050/v1/gatelane/health

# Register server
curl -X POST http://localhost:3050/v1/gatelane/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"memorylane","type":"mock"}'

# Discover tools
curl -X POST http://localhost:3050/v1/gatelane/tools/discover

# Allow tool
curl -X POST http://localhost:3050/v1/gatelane/policies \
  -H "Content-Type: application/json" \
  -d '{"effect":"allow","tool":"memorylane.memorylane_recall"}'

# Call tool
curl -X POST http://localhost:3050/v1/gatelane/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"memorylane.memorylane_recall","input":{"query":"Hello"},"actor":"my-agent"}'

# View audit log
curl http://localhost:3050/v1/gatelane/audit
```

## MCP Quickstart

```bash
# Start GateLane MCP server
gatelane mcp --port 3052

# Connect your agent to http://localhost:3052/mcp
# Available tools: gatelane_health, gatelane_list_servers, gatelane_add_server,
#   gatelane_discover_tools, gatelane_list_tools, gatelane_call_tool,
#   gatelane_allow_tool, gatelane_deny_tool, gatelane_list_policies,
#   gatelane_list_audit_logs, gatelane_get_usage
```

## SDK Quickstart

```typescript
import { GateLaneClient } from "@talocode/gatelane";

const gate = new GateLaneClient({ baseUrl: "http://localhost:3050" });
await gate.addServer({ name: "memorylane", type: "mock" });
await gate.discoverTools();
await gate.allowTool("memorylane.memorylane_recall");
const result = await gate.callTool({
  tool: "memorylane.memorylane_recall",
  input: { query: "Hello" },
  actor: "my-agent",
});
```

## Cloud Mode

```bash
export GATELANE_CLOUD_MODE=true
export TALOCODE_API_KEY=your_key
gatelane serve
```

Cloud mode protects all /v1/gatelane/* endpoints with bearer token auth.

## Examples

See skills/gatelane/examples.md and examples/ for full examples.

## Troubleshooting

- "Server not found": Run `gatelane servers add <name> --type mock` first
- "Tool not found": Run `gatelane tools discover` to refresh tool list
- "No matching allow policy": Run `gatelane policy allow <server.tool>` to grant access
- "Cloud mode requires": Set GATELANE_CLOUD_MODE=true and TALOCODE_API_KEY
- Module not found: Ensure Node.js >= 18 is installed
