# WoWAnalyzerCN MCP Server

MCP (Model Context Protocol) server for the WoWAnalyzerCN project.

Provides AI agents (Claude Desktop, Cursor, etc.) with the ability to fetch and analyze Warcraft Logs (WCL) combat reports from the CN region.

## Prerequisites

- Node.js 22+ (tested with v25.6.1)
- pnpm (package manager)
- The `wcl-proxy-server` running on `http://localhost:9528` (handles WCL CN API authentication)

## Quick Start

```bash
cd mcp-server

# Install dependencies
pnpm install

# Copy .env.example and configure
cp .env.example .env
# Edit .env: set WCL_API_BASE=http://localhost:9528/v1

# Development mode (watches for changes)
pnpm dev

# Production build + run
pnpm build
pnpm start
```

The server starts on **http://localhost:3001**:

- MCP endpoint: `POST http://localhost:3001/mcp`
- Health check: `GET http://localhost:3001/health`

## Verifying the Server

```bash
# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok","wcl":"reachable"} (or "unreachable" if proxy is down)

# Build verification
pnpm build
# Should print: [copy], [esbuild], [verify] steps with no errors
```

## MCP Tool: `analyze_report`

**M1 capability**: Fetches report metadata only (fight list + player list). Combat analysis coming in M2.

Accepts a WCL report URL or report code:

- Full URL: `https://cn.warcraftlogs.com/reports/aBcD1234EfGh5678`
- Report code: `aBcD1234EfGh5678`

Returns:

```json
{
  "reportTitle": "Mythic Castle Nathria",
  "reportCode": "aBcD1234EfGh5678",
  "startTime": 1609459200000,
  "fights": [{ "id": 1, "name": "Shriekwing", "kill": true, ... }],
  "players": [{ "id": 1, "name": "PlayerName", "server": "ServerName", ... }],
  "meta": { "wclApiBase": "http://localhost:9528/v1", "fetchedAt": "..." }
}
```

## Loading in AI Agents

This server uses **Streamable HTTP** transport (not stdio). Run `pnpm start` first, then point your agent at `http://localhost:3001/mcp`.

For complete agent setup (Claude Desktop via `mcp-remote` bridge, Cursor, Continue, Windsurf, OpenCode), see **[docs/MCP_SETUP.md](../docs/MCP_SETUP.md)**.

Quick example — Cursor (`.cursor/mcp.json` or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "wowanalyzer": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

## Architecture

```
src/
├── server.ts              # Express + StreamableHTTP MCP server
├── wcl-client.ts          # Re-exports from copied SPA fetchWclApi
├── tools/
│   └── analyze-report.ts  # analyze_report tool implementation
└── stubs/                 # Node.js stubs for browser-only SPA deps
    ├── errorLogger.ts     # Console logger (replaces Sentry)
    ├── sentry.ts          # No-op Sentry
    ├── events.ts          # Minimal parser/core/Events types
    ├── report.ts          # Minimal WCLReport type
    ├── fight.ts           # Minimal WCLFight type
    ├── player.ts          # Minimal PlayerInfo type
    └── ...
```

The build step (`build.mjs`):

1. Copies select SPA source files from `src/common/` into `.copied/common/`
2. Bundles everything via esbuild with `import.meta.env.*` → `process.env.*` transform
3. Redirects browser-only imports (`@sentry/react`, `parser/core/*`) to Node.js stubs

## Security

M1 runs **without authentication** (local development only). A TODO marker in `src/server.ts` shows where Bearer/JWT auth should be added in M3.

## Environment Variables

| Variable       | Default                    | Description                       |
| -------------- | -------------------------- | --------------------------------- |
| `WCL_API_BASE` | `http://localhost:9528/v1` | Base URL for the WCL proxy server |
| `NODE_ENV`     | `development`              | Set to `production` for prod mode |

## Roadmap

- **M1** (current): Metadata fetching + MCP server scaffolding
- **M2** (planned): Combat analysis via `src/parser/` engine
- **M3** (planned): Authentication, caching, production deployment
