# Local Command Tool Example (Experimental)

In future releases, GateLane will support wrapping local CLI commands as tools.

For v0.1.0, use a mock server to represent a local command:

```bash
gatelane servers add local-command --type mock
gatelane tools discover
gatelane policy allow local-command.local-command_query
gatelane call local-command.local-command_query --input '{"command":"ls -la"}'
```
