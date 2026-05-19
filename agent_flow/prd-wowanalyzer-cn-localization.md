# PRD: WoWAnalyzer CN 中文化与第三方服务配置

## 概述

将 WoWAnalyzer 项目进行中文化，使其适合面向中国用户部署。具体包括：完善中文翻译、设置中文为默认语言、配置 Sentry 为可扩展架构、默认禁用 Google Analytics。

## 目标

1. **完善中文翻译** - 填充 `src/localization/zh/messages.json` 中所有空字符串
2. **设置默认语言** - 将应用默认语言从英文改为中文
3. **保留 Sentry 架构** - 保持 Sentry 集成代码完整，方便后续配置自己的 Sentry 服务
4. **禁用 Google Analytics** - 默认禁用 Google Analytics 脚本注入

## 用户故事

### US-001: 完善中文翻译文件

**描述**：作为中国用户，我希望所有界面文本都有完整的中文翻译，不会看到空字符串或英文回退。

**验收标准**：

- [ ] `src/localization/zh/messages.json` 中所有空字符串都已填充为合理的中文翻译
- [ ] 翻译遵循 WoW 游戏术语的惯用译法（如：德鲁伊、圣骑士、萨满祭司等）
- [ ] 运行 `pnpm typecheck` 通过
- [ ] 运行 `pnpm lint` 通过

### US-002: 设置中文为默认语言

**描述**：作为中国用户，我希望打开应用时默认显示中文界面，不需要手动切换语言。

**验收标准**：

- [ ] 找到语言选择相关的代码（interface/selectors/language）
- [ ] 修改默认语言从 'en' 改为 'zh'
- [ ] 验证首次加载页面时显示中文
- [ ] 运行 `pnpm typecheck` 通过
- [ ] 使用 dev-browser 验证界面显示

### US-003: 确认 Sentry 架构保留

**描述**：作为开发者，我希望保留 Sentry 集成架构，方便后续配置自己的 Sentry 服务。

**验收标准**：

- [ ] `src/instrumentation.ts` 文件保留
- [ ] `src/common/errorLogger.ts` 文件保留
- [ ] `vite.config.ts` 中的 Sentry 插件配置保留
- [ ] `package.json` 中的 Sentry 依赖保留
- [ ] Sentry 仍然通过环境变量 `VITE_SENTRY_DSN` 控制启用
- [ ] 运行 `pnpm typecheck` 通过

### US-004: 默认禁用 Google Analytics

**描述**：作为部署者，我希望 Google Analytics 默认不注入到页面中。

**验收标准**：

- [ ] 确认当前 GA 启用通过 `VITE_ENABLE_GA` 环境变量控制
- [ ] 如果默认值为启用，修改为默认不启用
- [ ] 保持 GA 相关代码完整（可通过环境变量重新启用）
- [ ] 验证构建后的 `index.html` 默认不包含 GA 脚本
- [ ] 运行 `pnpm typecheck` 通过
- [ ] 使用 dev-browser 验证默认加载无 GA 脚本

## 功能需求

- **FR-1**: 完善中文翻译文件，填充所有空字符串
- **FR-2**: 修改默认语言选择逻辑为中文
- **FR-3**: 保留完整的 Sentry 集成架构
- **FR-4**: 确保 Google Analytics 默认不启用

## 非目标

- 不修改 Sentry API key（留待后续部署时通过环境变量配置）
- 不移除 Sentry 或 GA 的代码（只是默认禁用 GA）
- 不添加新的分析或监控服务
- 不修改项目功能逻辑，只处理本地化和第三方服务配置

## 技术考量

### i18n 架构

项目使用 **Lingui** 作为国际化框架：

- 翻译文件位于 `src/localization/{locale}/messages.json`
- 语言选择器位于 `interface/selectors/language`
- I18nProvider 位于 `src/localization/I18nProvider.tsx`

### Sentry 集成

- 初始化：`src/instrumentation.ts`
- 错误记录：`src/common/errorLogger.ts`
- 配置：`vite.config.ts` 中的 `sentryVitePlugin`
- 环境变量：
  - `VITE_SENTRY_DSN` - Sentry DSN
  - `SENTRY_AUTH_TOKEN` - Sentry Auth Token（上传 sourcemaps）

### Google Analytics 集成

- 配置：`vite.config.ts` 中的 `vite-plugin-wowanalyzer-index-html-inject-ga`
- 环境变量：`VITE_ENABLE_GA` 控制是否启用

## 文件范围

需要检查/修改的关键文件：

1. `src/localization/zh/messages.json` - 翻译文件
2. `interface/selectors/language` - 默认语言设置（需要找到具体文件）
3. `src/instrumentation.ts` - Sentry 初始化（确认保留）
4. `src/common/errorLogger.ts` - 错误日志（确认保留）
5. `vite.config.ts` - GA 和 Sentry 配置（确认架构）
6. `package.json` - 依赖（确认保留）

## 成功指标

- 中文翻译文件无空字符串
- 首次加载应用默认显示中文
- `pnpm build` 成功构建
- `pnpm typecheck` 通过
- `pnpm lint` 通过
- 默认构建产物不含 GA 脚本
- Sentry 相关代码完整保留

## 开放问题

无。需求已明确。

---

_此 PRD 遵循 Ralph 格式规范_
