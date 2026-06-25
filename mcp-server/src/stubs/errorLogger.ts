// Stub: replaces common/errorLogger for Node.js MCP server
// Logs to console instead of Sentry

export function captureException(
  exception: unknown,
  options?: {
    extra?: Record<string, unknown>;
    contexts?: { react: { componentStack: unknown } };
  },
): void {
  console.error('[mcp-server] Exception captured:', exception);
  if (options?.extra) {
    console.error('[mcp-server] Extra context:', options.extra);
  }
}
