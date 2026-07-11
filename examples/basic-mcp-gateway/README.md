# Basic MCP Gateway Example

```bash
# 1. Initialize GateLane
gatelane init

# 2. Register a mock server
gatelane servers add demo --type mock

# 3. Discover tools
gatelane tools discover

# 4. Allow a tool
gatelane policy allow demo.demo_query

# 5. Call the tool
gatelane call demo.demo_query --input '{"message":"Hello, GateLane!"}'

# 6. View the audit log
gatelane logs tail
```
