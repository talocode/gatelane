# Policies

GateLane's policy engine controls which tools agents can access.

## Policy Types

- **Allow** — explicitly permit access to a tool/server
- **Deny** — explicitly block access to a tool/server

Without any allow policies, all tools are accessible. Once an allow policy is created, only tools matching an allow policy are accessible (unless overridden by a deny).

## Scope

Policies can target:
- A specific tool: `memorylane.memorylane_recall`
- A server: `memorylane`
- An actor: `my-agent`

Deny policies always take priority over allow policies.

## CLI

```bash
gatelane policy allow memorylane.memorylane_recall
gatelane policy deny memorylane.memorylane_forget --reason "Prevent data loss"
gatelane policy list
gatelane policy remove <id>
```

## API

```bash
curl -X POST http://localhost:3050/v1/gatelane/policies \
  -H "Content-Type: application/json" \
  -d '{"effect":"allow","tool":"memorylane.memorylane_recall"}'
```
