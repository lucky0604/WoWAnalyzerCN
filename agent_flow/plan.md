# WoWAnalyzer CN 中文化实施计划

## 当前状态

✅ **已完成的任务**

- 设置中文为默认语言（`src/interface/reducers/language.ts`）
- 禁用默认 Google Analytics（`.env`, `.env.development`, `.env.production`）
- 注释 Sentry DSN（`.env.production`）
- 保留 Sentry 架构完整性

⏳ **待完成的任务**

- 完善中文翻译文件，填充所有空字符串
- 验证所有修改

## 实施步骤

### 步骤 1: 分析翻译文件状态

分析 `src/localization/zh/messages.json`，识别空字符串的条目数量和类型。

### 步骤 2: 翻译空字符串

- 使用专业 WoW 术语翻译所有空字符串
- 确保翻译符合游戏习惯
- 保持原有翻译质量和一致性

### 步骤 3: 验证翻译

- 运行 `pnpm typecheck` 确保类型安全
- 运行 `pnpm lint` 确保代码符合规范

## 关键文件

- `src/localization/zh/messages.json` - 中文翻译文件
- `src/localization/en/messages.json` - 英文原文（参考）
- `agent_flow/prd-wowanalyzer-cn-localization.md` - PRD 文档

## 验收标准

- 翻译文件无空字符串
- 所有测试通过
- 默认语言为中文
- 默认不启用 Google Analytics
- Sentry 架构完整保留
