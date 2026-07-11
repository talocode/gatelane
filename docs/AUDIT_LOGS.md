# Audit Logs

Every tool call through GateLane is recorded in the audit log.

## Log Entry

```json
{
  "id": "audit_abc123",
  "actor": "my-agent",
  "serverName": "memorylane",
  "toolName": "memorylane.memorylane_recall",
  "requestId": "req_def456",
  "status": "completed",
  "durationMs": 42,
  "createdAt": "2026-07-11T00:00:00.000Z"
}
```

Status values: `allowed`, `denied`, `failed`, `completed`

## CLI

```bash
gatelane logs list
gatelane logs tail
```

## API

```bash
curl http://localhost:3050/v1/gatelane/audit
curl "http://localhost:3050/v1/gatelane/audit/tail?n=10"
```

## Storage

Audit logs are stored at `~/.gatelane/audit.jsonl` in JSONL format (one JSON object per line).
