# Policy and Audit Example

Demonstrates deny policy enforcement and audit log inspection.

```bash
# 1. Register server
gatelane servers add demo --type mock
gatelane tools discover

# 2. Allow safe tool, deny destructive tool
gatelane policy allow demo.demo_query
gatelane policy deny demo.demo_echo --reason "Not needed"

# 3. Call allowed tool (succeeds)
gatelane call demo.demo_query --input '{"message":"This should work"}'

# 4. Call denied tool (fails)
gatelane call demo.demo_echo --input '{"message":"This should be denied"}'

# 5. Inspect audit log
gatelane logs list
```

Expected output for step 4:
```
Tool call failed: demo.demo_echo
  Status: denied
  Error: Tool 'demo.demo_echo' is denied by policy: Not needed
```
