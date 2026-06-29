# syntax=docker/dockerfile:1.6
# Multi-stage build for WoWAnalyzerCN MCP server.
# Stage 1: install full deps + build. Stage 2: prod runtime with non-root user.

# ---- builder ----
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile + manifest first for layer caching.
# The MCP server lives in mcp-server/ inside the monorepo; build context is repo root
# so we can reach src/ files referenced by build.mjs (copies SPA source).
COPY mcp-server/package.json mcp-server/pnpm-lock.yaml /app/mcp-server/
WORKDIR /app/mcp-server

# pnpm v10+ 默认禁用所有依赖的 lifecycle 脚本（如 postinstall）；esbuild 需要运行 postinstall 来下载平台特定的二进制文件。
# 由于 pnpm v11+ 不再从 .npmrc 中读取非 auth/registry 配置，且移除了 onlyBuiltDependencies 配置项，
# 在安装时直接使用 --dangerously-allow-all-builds 参数是最健壮、自包含且同时兼容 pnpm v10 和 v11 的方案。
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Bring in the rest. tsconfig path mappings reach into ../src/, so we need the
# repo's src/ tree available during build (esbuild reads .ts files at build time).
WORKDIR /app
COPY mcp-server /app/mcp-server
COPY src /app/src
COPY tsconfig.json /app/tsconfig.json

WORKDIR /app/mcp-server
RUN pnpm build

# Drop dev dependencies before copying node_modules into the runtime stage.
RUN pnpm prune --prod

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    WCL_API_BASE=http://wcl-proxy:9528/v1

RUN groupadd --system --gid 1001 mcp \
 && useradd  --system --uid 1001 --gid mcp --home /app --shell /sbin/nologin mcp \
 && mkdir -p /app && chown -R mcp:mcp /app

WORKDIR /app

COPY --from=builder --chown=mcp:mcp /app/mcp-server/dist           /app/dist
COPY --from=builder --chown=mcp:mcp /app/mcp-server/node_modules   /app/node_modules
COPY --from=builder --chown=mcp:mcp /app/mcp-server/package.json   /app/package.json

USER mcp

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
