# GateLane Examples

## Register a MemoryLane Server

```bash
gatelane servers add memorylane --type mock
gatelane tools discover
gatelane policy allow memorylane.memorylane_recall
gatelane call memorylane.memorylane_recall --input '{"query":"Past decisions"}'
```

## Register SearchLane and MemoryLane Together

```bash
gatelane servers add searchlane --type mock
gatelane servers add memorylane --type mock
gatelane tools discover
gatelane policy allow searchlane.searchlane_search
gatelane policy allow memorylane.memorylane_recall
gatelane policy deny memorylane.memorylane_forget --reason "Prevent data loss"
gatelane call searchlane.searchlane_search --input '{"query":"latest AI news"}'
```

## Allow Read Tools Only, Deny Destructive Tools

```bash
gatelane policy allow memorylane.memorylane_recall
gatelane policy allow memorylane.memorylane_list
gatelane policy deny memorylane.memorylane_forget
gatelane policy deny memorylane.memorylane_store
```

## Inspect Audit Logs

```bash
gatelane logs list
gatelane logs tail
```

## Start API Server

```bash
gatelane serve --port 3050
```

## Use with Cloud Auth

```bash
export GATELANE_CLOUD_MODE=true
export TALOCODE_API_KEY=your_key_here
gatelane serve --port 3050
```

## API Example: Register and Call via HTTP

```bash
# Start server first
gatelane serve --port 3050

# In another terminal:
curl -X POST http://localhost:3050/v1/gatelane/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"memorylane","type":"mock"}'

curl -X POST http://localhost:3050/v1/gatelane/tools/discover

curl -X POST http://localhost:3050/v1/gatelane/policies \
  -H "Content-Type: application/json" \
  -d '{"effect":"allow","tool":"memorylane.memorylane_recall"}'

curl -X POST http://localhost:3050/v1/gatelane/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"memorylane.memorylane_recall","input":{"query":"hello"},"actor":"demo"}'
```
