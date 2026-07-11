# SearchLane + MemoryLane Gateway Example

Shows how to register multiple servers and control access per tool.

```bash
# 1. Register both servers
gatelane servers add searchlane --type mock
gatelane servers add memorylane --type mock

# 2. Discover all tools
gatelane tools discover

# 3. Allow read/search tools
gatelane policy allow searchlane.searchlane_search
gatelane policy allow memorylane.memorylane_recall

# 4. Deny destructive tools
gatelane policy deny memorylane.memorylane_forget --reason "Prevent data loss"

# 5. Call tools
gatelane call searchlane.searchlane_search --input '{"query":"latest AI news"}'
gatelane call memorylane.memorylane_recall --input '{"query":"past decisions"}'

# 6. Check audit log
gatelane logs list
```
