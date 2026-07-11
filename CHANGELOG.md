# Changelog

## v0.2.0 (2026-07-11)

GateLane v0.2.0 upgrades from a gateway foundation to a real MCP gateway and agent tool control plane with real MCP stdio/HTTP proxying, real tool discovery, optional SQLite storage, and CI/CD release automation.

### Added

- Real MCP stdio tool proxying with JSON-RPC 2.0 over stdin/stdout
- Real MCP HTTP tool proxying with JSON-RPC 2.0 over POST
- Real MCP tool discovery via `tools/list` (standard MCP protocol)
- Test fixture servers for stdio and HTTP MCP protocol validation
- `GATELANE_STORAGE_DRIVER` env var (`json` or `sqlite`) for backend selection
- Comprehensive test suite: 40 tests covering real proxy, policy, auth, storage, API
- CLI call command now uses ToolProxy for real tool execution
- HTTP MCP servers now supported (via `mcp-http` and `http-api` types)

### Changed

- Tool discovery no longer silently falls back to mock tools for real MCP servers
- CLI call command checks policy before rate limiter (correct ordering)
- ToolProxy stdio now uses `readline` for line-by-line JSON-RPC parsing
- ToolProxy sends `initialize` before `tools/list` (standard MCP handshake)
- Storage backend selection supports synchronous JSON init with async SQLite fallback
- Version bumped from 0.1.0 to 0.2.0 across all components

### Fixed

- CLI bundling compatibility (removed `import.meta.url` usage in build)
- Test runner import ordering with `GATELANE_HOME` isolation
- `package.json` duplicate `scripts` block removed
- npm package now excludes standalone binaries (reduced from 133MB to 45KB)

## v0.1.0 (2026-07-11)

Initial release of GateLane — the open-source MCP gateway and agent tool control plane.

### Added

- MCP server registry (add, list, show, remove)
- Tool discovery from registered servers
- Allow/deny policy engine (per-tool, per-server, per-actor)
- Rate limit engine (global, per-server, per-tool, per-actor)
- Audit log with tail and list
- Usage tracking foundation (credit-based)
- Local HTTP API with 22+ endpoints
- TypeScript SDK with full client
- MCP server exposing 11 management tools
- CLI with 15 commands
- Cloud auth mode gated by TALOCODE_API_KEY
- Talocode Skill for agent usage
- Install scripts for Linux, macOS, Windows, Android (Termux), iOS (iSH)
- Examples: basic gateway, searchlane-memorylane, policy and audit
- Documentation: API, CLI, SDK, MCP, policies, rate limiting, audit logs
- Storage abstraction layer (interface + JSON backend + SQLite backend)
- GitHub Actions CI (push/PR) and Release (tag push) workflows
- Multi-platform binary build support via Node SEA
- GitHub release demo video
