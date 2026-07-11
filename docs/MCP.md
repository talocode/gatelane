# GateLane MCP Server

GateLane exposes its own MCP server that lets agents manage GateLane through MCP tools.

## Start

```bash
gatelane mcp --port 3052
```

## Endpoint

`POST http://localhost:3052/mcp`

## Tools

| Tool | Description |
|------|-------------|
| gatelane_health | Check GateLane health |
| gatelane_list_servers | List registered servers |
| gatelane_add_server | Register a new server |
| gatelane_discover_tools | Discover tools from servers |
| gatelane_list_tools | List discovered tools |
| gatelane_call_tool | Call a tool through GateLane |
| gatelane_allow_tool | Create allow policy |
| gatelane_deny_tool | Create deny policy |
| gatelane_list_policies | List policies |
| gatelane_list_audit_logs | View audit log |
| gatelane_get_usage | View usage stats |
