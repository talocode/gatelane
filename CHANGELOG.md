# Changelog

## v0.1.0 (2026-07-11)

Initial release of GateLane — the open-source MCP gateway and agent tool control plane.

### Added

- MCP server registry (add, list, show, remove)
- Tool discovery from registered servers
- Controlled tool call proxying with auth, policy, and rate limit checks
- Allow/deny policy engine (per-tool, per-server, per-actor)
- Rate limit engine (global, per-server, per-tool, per-actor)
- Audit log with tail and list
- Usage tracking foundation (credit-based)
- Local HTTP API with 18+ endpoints
- TypeScript SDK with full client
- MCP server exposing 11 management tools
- CLI with 15 commands
- Cloud auth mode gated by TALOCODE_API_KEY
- Talocode Skill for agent usage
- Install scripts for Linux, macOS, Windows, Android (Termux), iOS (iSH)
- Examples: basic gateway, searchlane-memorylane, policy and audit
- Documentation: API, CLI, SDK, MCP, policies, rate limiting, audit logs
- GitHub release demo video
