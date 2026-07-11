# GateLane API Reference

Base URL: `http://localhost:3050`

## Health

```
GET /health
GET /v1/gatelane/health
GET /v1/gatelane/capabilities
GET /v1/gatelane/pricing
```

## Servers

```
POST /v1/gatelane/servers   -- Register a server
GET /v1/gatelane/servers    -- List servers
GET /v1/gatelane/servers/:id -- Get server
DELETE /v1/gatelane/servers/:id -- Remove server
```

## Tools

```
POST /v1/gatelane/tools/discover -- Discover tools
GET /v1/gatelane/tools           -- List tools
GET /v1/gatelane/tools/:id       -- Get tool
```

## Tool Call

```
POST /v1/gatelane/call
```

Body:
```json
{
  "tool": "memorylane.memorylane_recall",
  "input": { "query": "hello" },
  "actor": "my-agent"
}
```

## Policies

```
POST /v1/gatelane/policies   -- Create policy
GET /v1/gatelane/policies    -- List policies
DELETE /v1/gatelane/policies/:id -- Remove policy
```

## Rate Limits

```
POST /v1/gatelane/rate-limits   -- Create rate limit
GET /v1/gatelane/rate-limits    -- List rate limits
DELETE /v1/gatelane/rate-limits/:id -- Remove rate limit
```

## Audit Logs

```
GET /v1/gatelane/audit
GET /v1/gatelane/audit/tail?n=10
```

## Usage

```
GET /v1/gatelane/usage
```

## Cloud Auth

Cloud mode requires `Authorization: Bearer <key>` or `X-Api-Key: <key>` header on protected endpoints. Health/capabilities/pricing remain public.
