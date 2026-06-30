# WoWAnalyzerCN MCP 服务器接入指南

> **注意**：MCP 服务器已从本仓库分离为独立项目，见 [wowanalyzer-mcp-server](https://github.com/your-org/wowanalyzer-mcp-server)（私有仓库）。以下文档保留作为接入参考，本地启动请使用独立仓库。

## 这是什么

MCP（Model Context Protocol）是 Anthropic 提出的一种开放协议，让 AI 助手（如 Claude、Cursor 等）能够调用外部工具获取实时数据。简单说，你可以在聊天框里发一句「帮我查一下这个战报」，AI 就会自动调用后端的工具去拉取数据，而不是瞎编一个答案给你。

WoWAnalyzerCN MCP 服务器（`mcp-server/`）就是这样一个工具入口。它把 WCL（Warcraft Logs）战报分析能力包装成一个 AI 可以调用的接口。当前 **M1 阶段** 只暴露一个工具：

- **`analyze_report`**：接受一个 WCL 战报链接或报告码，返回战斗列表和参战玩家元信息（服务器、职业、专精、装备等级等）。

M1 的目标是「能查到」，让 AI 至少可以准确理解一场战斗的基本构成。后续 **M2 阶段** 会加入真正的战斗分析引擎，首发专精为织雾武僧，之后按优先级逐步覆盖其他专精。

---

## 两种环境：测试 vs 生产

接入前先决定用哪个环境。

| 环境             | MCP 地址                    | 何时用                                   | 是否需要本地启动                                        |
| ---------------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| **测试（本地）** | `http://localhost:3001/mcp` | 开发调试、改完代码立即验证、想看完整日志 | 需要：自己 `pnpm dev` 启 MCP 服务 + 启 wcl-proxy-server |
| **生产（线上）** | `https://fastdata.top/mcp`  | 日常使用、不想折腾环境的普通用户         | 不需要：开箱即用                                        |

下文每个 agent 的配置都给出两套示例，**任选其一**即可。如果你两套环境都想用，建议在配置中起两个不同的名字（如 `wowanalyzer-cn-local` 和 `wowanalyzer-cn`），方便在 AI 对话中按需切换。

---

## 前置条件（仅测试环境需要）

> 如果你只用生产环境（`https://fastdata.top/mcp`），直接跳到「[在 XX 中接入](#在-claude-desktop-中接入)」章节即可，**无需本地启动任何服务**。

测试环境需要：

1. **Node.js 22+** 已安装。
2. **wcl-proxy-server** 已在本地 9528 端口启动（它负责中转 WCL API 请求）。
3. 在 `wowanalyzer-mcp-server` 独立仓库目录下执行过以下命令：

```bash
cd wowanalyzer-mcp-server
pnpm install
pnpm build
pnpm dev
```

4. 确认 MCP 服务器已运行：

```bash
curl http://localhost:3001/health
```

返回 `200 OK` 即表示服务器正常。

> 本 MCP 服务使用 Streamable HTTP 传输协议，绑定在 **`http://localhost:3001/mcp`**。开发阶段不附带认证（无 Bearer Token），请勿暴露到公网。

### 验证生产环境

```bash
curl https://fastdata.top/health
```

应返回类似 `{"status":"ok","wcl":"reachable"}`。如果连不上或返回 5xx，说明线上服务暂时不可用，可暂时切换回本地测试环境。

---

## 在 Claude Desktop 中接入

### 重要提示

截至 2026 年初，Claude Desktop 的 `claude_desktop_config.json` **尚不支持直接配置 Streamable HTTP 的 `url` 字段**。如果直接写入 `"url": "..."`，Claude Desktop 会在启动时静默删除整个 `mcpServers` 段。

解决方法是使用 **`mcp-remote`** 桥接工具：它让 Claude Desktop 以 stdio 方式启动一个本地进程，这个进程再通过 HTTP 连接你的 MCP 服务器。

### 配置步骤

1. 打开配置文件：
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. 写入以下配置（按环境二选一）：

**测试环境（localhost）：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn-local": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3001/mcp"]
    }
  }
}
```

**生产环境（fastdata.top）：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://fastdata.top/mcp"]
    }
  }
}
```

3. **完全重启** Claude Desktop（先退出再重新打开，仅关闭窗口不够）。

4. 确认加载成功：在聊天输入框旁边应该能看到一个锤子图标（MCP 工具按钮），点击后可以看到 `analyze_report` 工具出现。或者在聊天框中问「你现在能调用什么工具？」Claude 应该会列出 `analyze_report`。

> 如果之前写入过带 `url` 字段的配置导致 `mcpServers` 段被删除，请重新写入上面的配置后重启。

---

## 在 Cursor 中接入

Cursor 从 v0.48.0 起原生支持 Streamable HTTP。你只需要一个 `mcp.json` 文件。

### 配置步骤

**方式一：项目级别（推荐，可提交到仓库分享给团队）**

在项目根目录创建 `.cursor/mcp.json`：

**测试环境：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn-local": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**生产环境：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn": {
      "url": "https://fastdata.top/mcp"
    }
  }
}
```

**方式二：全局级别（所有项目可用）**

- **macOS**: `~/.cursor/mcp.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`

内容同上。

### 验证

1. 保存文件后，**完全重启 Cursor**（关闭窗口再打开）。
2. 打开 Cursor 设置 → Tools & Integrations → MCP tools，应该能看到对应名字显示绿色在线状态。
3. 在 Chat 中发送「帮我分析这个战报：[URL]」，AI 会自动调用 `analyze_report`。

---

## 在 Continue.dev 中接入

Continue 支持 Streamable HTTP，需要指定 `type: streamable-http`。

### 配置步骤

编辑 Continue 配置文件（`~/.continue/config.json` 或 `~/.continue/config.yaml`）：

**测试环境（JSON）：**

```json
{
  "mcpServers": [
    {
      "name": "wowanalyzer-cn-local",
      "type": "streamable-http",
      "url": "http://localhost:3001/mcp"
    }
  ]
}
```

**生产环境（JSON）：**

```json
{
  "mcpServers": [
    {
      "name": "wowanalyzer-cn",
      "type": "streamable-http",
      "url": "https://fastdata.top/mcp"
    }
  ]
}
```

**生产环境（YAML）：**

```yaml
mcpServers:
  - name: wowanalyzer-cn
    type: streamable-http
    url: https://fastdata.top/mcp
```

### 验证

保存配置后重启 Continue。打开 MCP 上下文提供者面板，确认对应名字已连接。在聊天中输入指令，观察是否调用了 `analyze_report` 工具。

---

## 在 Windsurf 中接入

Windsurf 的 MCP 配置使用 `mcp_config.json`，且远程服务器的 URL 字段名为 `serverUrl`（不是 `url`），请注意这个区别。

### 配置步骤

编辑配置文件：

- **macOS / Linux**: `~/.codeium/windsurf/mcp_config.json`
- **Windows**: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

**测试环境：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn-local": {
      "serverUrl": "http://localhost:3001/mcp"
    }
  }
}
```

**生产环境：**

```json
{
  "mcpServers": {
    "wowanalyzer-cn": {
      "serverUrl": "https://fastdata.top/mcp"
    }
  }
}
```

> Windsurf 仅支持全局配置，不支持项目级别配置。

### 验证

1. 保存文件。
2. 在 Windsurf 中点击 Cascade 面板的锤子图标，进入 MCP 设置页面。
3. 点击 Refresh 按钮（🔄），查看对应名字是否显示已连接。
4. 在 Cascade 中提问，观察工具调用情况。

---

## 在 OpenCode / OpenClaw 中接入

OpenCode 使用 `opencode.jsonc`（或 `opencode.json`）配置文件，远程 MCP 类型为 `"remote"`。OpenClaw 沿用相同格式。

### 配置步骤

编辑项目根目录的 `opencode.jsonc`，在 `mcp` 段加入：

**测试环境：**

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "wowanalyzer-cn-local": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "enabled": true,
    },
  },
}
```

**生产环境：**

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "wowanalyzer-cn": {
      "type": "remote",
      "url": "https://fastdata.top/mcp",
      "enabled": true,
    },
  },
}
```

**两套同时启用（推荐开发时使用）：**

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "wowanalyzer-cn-local": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "enabled": true,
    },
    "wowanalyzer-cn": {
      "type": "remote",
      "url": "https://fastdata.top/mcp",
      "enabled": true,
    },
  },
}
```

你也可以通过命令行交互式添加：

```bash
opencode mcp add
```

按照提示选择 remote 类型，输入 URL（测试用 `http://localhost:3001/mcp`，生产用 `https://fastdata.top/mcp`），工具名自定。

### 验证

```bash
opencode mcp list
```

应该能看到配置的名字显示已连接。也可以运行调试命令检查连接状态：

```bash
opencode mcp debug wowanalyzer-cn
```

---

## 第一次测试

我们用一个公开的 CN WCL 战报来验证整个链路。

### 步骤

1. 找一个公开的国服战报链接，例如：

```
https://cn.warcraftlogs.com/reports/your_report_code_here
```

（请将 `your_report_code_here` 替换为实际的战报报告码，如 `aBcDeFgH1`。）

2. 在你已配置好 MCP 的 agent 中输入：

```
帮我分析这个战报：https://cn.warcraftlogs.com/reports/your_report_code_here
```

3. 预期表现：
   - AI agent 会识别出需要调用 `analyze_report` 工具。
   - 工具会返回战报的元信息，包括：
     - 标题（raid 名/副本名）
     - 战斗列表（每个 BOSS 的名称、时长、击杀/灭团标记）
     - 玩家列表（每个玩家的角色名、服务器、职业、专精、装等）
   - AI 会根据返回值用自然语言总结给你听。

### 验证成功标志

- `analyze_report` 被实际调用了（不是 AI 编造的）
- 返回了非空数据
- AI 能准确说出战斗和玩家信息

---

## 故障排查

### 端口被占用

如果 `3001` 端口已被占用，需要同时修改两处：

1. `mcp-server/src/server.ts`（或对应的入口文件）中的端口号。
2. 所有 agent 配置文件中 `url` / `serverUrl` 对应更新（如 `http://localhost:3002/mcp`）。

### agent 看不到工具

- 检查配置文件路径是否正确（各 agent 的路径详见对应章节）。
- **完全重启** agent（仅刷新窗口可能不够）。
- 确认 JSON/YAML 语法无误（可以用 `jq` 或在线工具验证 JSON 合法性）。

### 调用工具报 fetch 错误

这通常说明 MCP 服务器没有正常启动或网络不通：

**测试环境：**

```bash
# 确认本地 MCP 服务器在运行
curl http://localhost:3001/health

# 检查本地 wcl-proxy-server 是否在运行
curl http://localhost:9528/health
```

**生产环境：**

```bash
# 确认线上 MCP 服务可达
curl https://fastdata.top/health

# 检查 DNS 与 TLS
curl -v https://fastdata.top/mcp -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

如果其中之一没有返回 200，检查终端日志或线上服务状态页看具体错误。

### 工具返回数据为空

- 确认战报不是**私有**的。私有战报需要 WCL API Token 才能访问（M1 暂不支持，M2 会加入）。
- 确认报告码（report code）正确。一个典型战报 URL 是 `https://cn.warcraftlogs.com/reports/AbCdEfGh1`，其中 `AbCdEfGh1` 就是报告码。
- 确认 WCL 服务器没有在维护。

---

## 下一步：M2

M1 只做到「能看到数据」。M2 会加入真正的**战斗分析引擎**：

- 首发专精：**织雾武僧**
- 后续优先级：按 WoWAnalyzer 官方 A 档专精列表，从使用率最高的专精开始逐步覆盖
- 分析内容包括：技能施放序列、治疗/输出占比、冷却利用率、增益覆盖、死亡分析等

M2 上线后，本指南会同步更新。届时你可以直接用自然语言问出「奶僧这场为什么治疗量低？」、「青龙下凡的覆盖率是多少？」这类问题。

如果你有兴趣参与贡献，欢迎提交 PR 到 `mcp-server/` 目录。
