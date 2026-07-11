# Changelog

## v0.3.0 (2026-07-11)

GateLane v0.3.0 adds MemoryLane MCP protocol compatibility, production-ready policy defaults, real-time SSE events, and a web dashboard.

### Added

- MemoryLane MCP protocol adapter — auto-fallback from `tools/list` to `mcp.listTools` and from `tools/call` to `mcp.callTool`
- `gatelane policy set-default <allow|deny>` command for production mode
- `GET/PUT /v1/gatelane/policies/default` API endpoint for policy default
- HTTP Server-Sent Events (SSE) transport via `GET /v1/gatelane/events`
- Web dashboard UI at `/` with live event stream, servers, tools, policies, audit log
- Broadcast events: `tool_call_started`, `tool_call_completed`, `tool_call_errored`
- `"sse-events"` and `"dashboard"` capability announcements

### Changed

- Version bumped from 0.2.0 to 0.3.0
- Policy engine respects `policyDefault` config (`allow` or `deny`) when no policies match
- ToolProxy tries standard MCP methods first, then legacy MemoryLane methods on `-32601`
- `build-binaries.mjs` now uses `statSync` import instead of `require("fs")` in ESM context

### Fixed

- Binary build script no longer crashes with `require is not defined` in ESM context

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
