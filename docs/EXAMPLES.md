# Examples

See [examples/](../examples/) for full example directories.

## Basic MCP Gateway

```bash
gatelane init
gatelane servers add demo --type mock
gatelane tools discover
gatelane policy allow demo.demo_query
gatelane call demo.demo_query --input '{"message":"hello"}'
gatelane logs tail
```

## SearchLane + MemoryLane Gateway

```bash
gatelane servers add searchlane --type mock
gatelane servers add memorylane --type mock
gatelane tools discover
gatelane policy allow searchlane.searchlane_search
gatelane policy allow memorylane.memorylane_recall
gatelane policy deny memorylane.memorylane_forget
gatelane call searchlane.searchlane_search --input '{"query":"AI news"}'
gatelane call memorylane.memorylane_recall --input '{"query":"past context"}'
gatelane logs list
```

## Policy and Audit

```bash
gatelane policy allow memorylane.memorylane_recall
gatelane policy deny memorylane.memorylane_forget
gatelane policy list
gatelane call memorylane.memorylane_recall --input '{"query":"test"}'
gatelane call memorylane.memorylane_forget --input '{"id":"test"}'
gatelane logs list
```

The last call will show as "denied" because the forget tool is blocked by policy.
