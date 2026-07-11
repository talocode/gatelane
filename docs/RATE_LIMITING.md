# Rate Limiting

GateLane supports per-scope rate limits to control how many tool calls an agent can make.

## Scopes

- **global** — limits all tool calls across all servers and actors
- **server** — limits calls to a specific server
- **tool** — limits calls to a specific tool
- **actor** — limits calls by a specific actor

## CLI

```bash
# Create a global rate limit (100 calls per 60 seconds)
gatelane api POST /v1/gatelane/rate-limits \
  '{"scope":"global","target":"__global__","limit":100,"windowSeconds":60}'

# Create a server rate limit (10 calls per 30 seconds)
gatelane api POST /v1/gatelane/rate-limits \
  '{"scope":"server","target":"memorylane","limit":10,"windowSeconds":30}'
```

## API

```bash
curl -X POST http://localhost:3050/v1/gatelane/rate-limits \
  -H "Content-Type: application/json" \
  -d '{"scope":"global","target":"__global__","limit":100,"windowSeconds":60}'
```

When a rate limit is exceeded, GateLane returns HTTP 429 with a RateLimitExceededError.
