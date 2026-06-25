import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { analyzeReport, analyzeReportInputSchema } from './tools/analyze-report.js';

const PORT = 3001;

const app = express();
app.use(express.json());

app.get('/health', async (_req: Request, res: Response) => {
  const wclBase = process.env.WCL_API_BASE ?? 'http://localhost:9528/v1';

  let wclStatus: 'reachable' | 'unreachable' = 'unreachable';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(wclBase, { signal: controller.signal });
    clearTimeout(timeout);
    // Any HTTP response = server reachable. 404 on root is expected (no index route).
    wclStatus = response.status < 500 ? 'reachable' : 'unreachable';
  } catch {
    wclStatus = 'unreachable';
  }

  res.json({ status: 'ok', wcl: wclStatus });
});

// TODO (M3): Add Bearer/JWT authentication middleware before /mcp handler.

function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: 'wowanalyzer-mcp',
    version: '0.1.0',
  });

  mcpServer.registerTool(
    'analyze_report',
    {
      title: '列出 WCL 战报元数据',
      description:
        '获取 WCL 战报元数据：战斗列表和玩家列表。使用此工具发现要进一步分析的 fightId 和 playerId，然后调用 analyze_fight 获取完整分析。',
      inputSchema: analyzeReportInputSchema,
    },
    async (params) => {
      const result = await analyzeReport({ reportUrlOrCode: params.reportUrlOrCode });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  return mcpServer;
}

// Stateless mode: a fresh transport + server connection per request.
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      // eslint-disable-next-line no-empty-function
      transport.close().catch(() => {});
      // eslint-disable-next-line no-empty-function
      mcpServer.close().catch(() => {});
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp-server] request error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[mcp-server] WoWAnalyzer MCP server running on http://localhost:${PORT}`);
  console.log(`[mcp-server] MCP endpoint: POST http://localhost:${PORT}/mcp`);
  console.log(`[mcp-server] Health check: GET  http://localhost:${PORT}/health`);
});
