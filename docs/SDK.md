# GateLane SDK Reference

## Installation

```
npm install @talocode/gatelane
```

## GateLaneClient

```typescript
import { GateLaneClient } from "@talocode/gatelane";

const client = new GateLaneClient({
  baseUrl: "http://localhost:3050",
  apiKey?: "optional-cloud-key",
});
```

## Methods

- `health()` — Check server health
- `capabilities()` — List capabilities
- `listServers()` — List registered servers
- `addServer(req)` — Register a server
- `getServer(id)` — Get server details
- `removeServer(id)` — Remove a server
- `discoverTools()` — Discover tools
- `listTools()` — List discovered tools
- `getTool(id)` — Get tool details
- `callTool(req)` — Call a tool
- `createPolicy(req)` — Create a policy
- `allowTool(tool, reason?)` — Allow a tool
- `denyTool(tool, reason?)` — Deny a tool
- `listPolicies()` — List policies
- `removePolicy(id)` — Remove a policy
- `createRateLimit(req)` — Create a rate limit
- `listRateLimits()` — List rate limits
- `listAuditLogs()` — View audit log
- `getUsage()` — View usage stats
