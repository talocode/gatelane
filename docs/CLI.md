# GateLane CLI Reference

## Commands

### gatelane init

Initialize GateLane configuration.

### gatelane doctor

Check GateLane installation and configuration.

### gatelane demo

Run an interactive demo showing GateLane's core workflow: register server, discover tools, create policy, call tool, view audit log.

### gatelane servers

Manage registered MCP servers.

```
gatelane servers add <name> --type mock|mcp-stdio|mcp-http|http-api
gatelane servers list
gatelane servers show <name>
gatelane servers remove <name>
```

### gatelane tools

Discover and list tools.

```
gatelane tools discover
gatelane tools list
gatelane tools show <toolName>
```

### gatelane call

Call a tool through GateLane.

```
gatelane call <server.tool> --input '{"key":"value"}' --actor <name>
```

### gatelane policy

Manage allow/deny policies.

```
gatelane policy allow <server.tool> --reason "..."
gatelane policy deny <server.tool> --reason "..."
gatelane policy list
gatelane policy remove <id>
```

### gatelane logs

View audit logs.

```
gatelane logs list
gatelane logs tail
```

### gatelane serve

Start the HTTP API server.

```
gatelane serve --port 3050
```

### gatelane proxy

Start the MCP proxy.

```
gatelane proxy --port 3051
```

### gatelane mcp

Start the MCP server exposing GateLane management tools.

```
gatelane mcp --port 3052
```
