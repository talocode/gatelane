# Release Notes — GateLane v0.1.0

## What's Included

- CLI with 15 commands
- HTTP API with 18+ endpoints
- TypeScript SDK with GateLaneClient
- MCP server with 11 management tools
- Policy engine (allow/deny)
- Rate limiting
- Audit logging
- Usage tracking
- Cloud auth mode
- Talocode Skill
- Install scripts
- Demo video
- Full documentation

## Known Limitations

- Tool execution is mock-only (no real MCP server proxying)
- Rate limits are in-memory (reset on restart)
- No SQLite backend yet (JSON/JSONL storage)
- No standalone binaries yet (requires Node.js)
- iOS requires iSH shell (no native app)

## Next Steps

- Real MCP stdio/HTTP tool proxying
- SQLite backend
- Standalone binaries (Node SEA)
- Talocode Cloud integration
- Web dashboard
