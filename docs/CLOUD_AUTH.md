# Cloud Auth

GateLane local mode is open-source and keyless.

## Enabling Cloud Mode

```bash
export GATELANE_CLOUD_MODE=true
export TALOCODE_API_KEY=your_talocode_api_key
gatelane serve
```

## Protected Endpoints

All `/v1/gatelane/*` endpoints (except health/capabilities/pricing) require authentication in cloud mode.

## Authentication Methods

Bearer token header:

```
Authorization: Bearer your_talocode_api_key
```

Alternative header:

```
X-Api-Key: your_talocode_api_key
```

## Error Response

```json
{
  "error": "Invalid or missing API key",
  "code": "UNAUTHORIZED"
}
```
