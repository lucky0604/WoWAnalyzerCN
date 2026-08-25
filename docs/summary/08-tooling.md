# 08 · 构建 / 开发 / 测试 / 部署工具链

## 1. 包管理器与环境

- **pnpm**（`packageManager: pnpm@9.5.0`），monorepo workspace（`pnpm-workspace.yaml`，含 `packages/` 与 `patches/`）。
- Node 侧 `type: module`（ESM）。
- `.env*` 多环境：`.env`、`.env.development`、`.env.production`、`.env.test`、`.env.local`、`.env.example`（含国服变量）。

## 2. 构建：Vite 8 + Rolldown

配置 `vite.config.ts`：

- **插件**：`cnOverridesPlugin()`（国服 Guide 覆盖）、`react()`、`lingui()`、`babel({ linguiTransformerBabelPreset })`、`svgr`、GA 注入（`VITE_ENABLE_GA` 时）、`sentryVitePlugin`（生产，`SENTRY_AUTH_TOKEN` 存在时，上传 sourcemap）、`checker`（TS 类型检查，非 vitest/禁用时）。
- **resolve**：`tsconfigPaths: true`（路径别名能解析 tsconfig paths）。
- **css**：SCSS `loadPaths: ['./src']`。
- **server**：端口 3000、自动打开、`/wcl-api` 与 `/cn-armory` 代理（见 06）。
- **test**：jsdom 环境、`restoreMocks`/`unstubEnvs`/`unstubGlobals`、setup 文件 `src/vitest.setup.ts`。
- **build**：CSS 压缩、sourcemap、`[name]-[hash].js` chunk（`StatTracker` 特判为纯 hash）。

## 3. 常用脚本（`package.json`）

| 脚本 | 命令 | 用途 |
|---|---|---|
| `start` | `vite` | 开发服务器 |
| `build` | `vite build` | 生产构建 |
| `test` | `vitest` | 全部测试 |
| `test:interface` | 排除 `src/parser/**` | 界面层测试 |
| `test:parser` | 仅 `src/parser` | 解析器测试 |
| `typecheck` | `tsc` | 类型检查 |
| `lint` / `lint:fix` | `oxlint` | 代码检查（`--max-warnings 0`） |
| `extract` | `lingui extract --overwrite --clean` | 抽取 i18n |
| `format` / `format:check` | `oxfmt` | 格式化 |
| `generate-talents` / `:ptr` | `tsx scripts/talents/generate-talents.ts` | 生成天赋表 |
| `generate-enchants` / `:ptr` | `tsx scripts/enchants/generate-enchants.ts` | 生成附魔/宝石 |
| `generate-cn-server-slug` | `node scripts/cn-sn-slug/...` | 生成国服服务器 slug 表 |
| `spell-lists:create` / `:update` | `node ... scripts/spell-lists/` | 法术列表 |
| `e2e` / `e2e:setup` / `e2e:codegen` | `playwright` | 端到端测试 |
| `prepare` | `is-ci || husky` | 安装 git hooks |

## 4. 代码质量工具

- **oxlint**（`--max-warnings 0 --deny-warnings`）+ **oxfmt** + **oxc-parser**（Rust 系），配置 `.oxlintrc.json`、`.oxfmtrc.json`。
- **husky + lint-staged**：提交时对 `*.{ts,tsx,js,jsx}` 跑 `lint:fix`。⚠️ 注意：lint-staged 的自动修复会破坏某些 i18n 字符串（见项目记忆 `lint-fix-label-defineMessage-bug`），大同步时建议绕过 hooks。
- **eslint-plugin-wowanalyzer**（workspace 插件）—— 自定义规则。
- **TypeScript**（`tsconfig.json`）—— 严格类型。

## 5. 测试

- **Vitest**（`src/vitest.setup.ts`）：接口与解析器测试。快照解析用 `resolveSnapshotPath`。
- **Playwright**（`playwright.config.ts` + `e2e/`）：端到端。`e2e:setup` 用 `scripts/e2e/generate-configs.ts` 生成配置。
- 测试文件常与源码同目录（如 `fetchWclApi.test.ts`、`fetchCnArmory.test.ts`、`CombatLogParser.test.jsx`）。

## 6. 数据生成脚本（`scripts/`）

| 脚本 | 用途 | 产物 |
|---|---|---|
| `scripts/talents/generate-talents.ts` | 从 `wow-dbc` 生成天赋表 | `src/common/TALENTS/*.ts` |
| `scripts/enchants/generate-enchants.ts` | 生成附魔/宝石 | `src/common/ITEMS/**/*.ts` |
| `scripts/cn-sn-slug/generate-cn-server-slug.mjs` | 生成国服服务器 slug 表 | `src/common/CN_SERVER_SLUG.ts` |
| `scripts/spell-lists/` | 法术列表创建/更新 | 法术列表 |
| `scripts/migrate-guides-to-overrides.sh` | 把 CN Guide 迁到 overrides、恢复上游 | `src/localization/overrides/` |
| `scripts/generate-override-registry.mjs` | 生成 overrides 注册表 | `src/localization/overrides/registry.ts` |
| `scripts/sync-upstream.sh` | 同步上游 WoWAnalyzer | — |
| `scripts/post-merge-i18n-checks.sh` | 合并后 i18n 检查 | — |
| `scripts/find_untranslated.py` / `find_untranslated_summary.py` | 扫描硬编码英文 | 报告 |

## 7. 监控与埋点

- **Sentry**（`src/instrumentation.ts`）：`VITE_SENTRY_DSN` 存在时初始化，react-router v6 追踪、`release`/`environment`、`beforeSend` 剥离用户信息、忽略 `Failed to fetch`。
- **Google Analytics**：`VITE_ENABLE_GA=true` 时经 vite 插件注入 `gtag` 脚本。
- **广告**：`Ad` 组件 + `intergient` ramp 脚本。

## 8. 部署（国服）

- **Dockerfile + docker-compose.yml**：以 nginx 提供静态构建产物，并反代三个国服 API（`/wcl-api`、`/i/`、`/cn-armory`），见 [06-cn-localization.md](./06-cn-localization.md) §6。
- nginx 配置 `default.conf` / `default.conf.template`：SPA `try_files` 回退 `index.html`。
- 部署要点详见 `docs/deployment-cn.md`。

## 9. 开发环境联网拓扑

```
浏览器 ──Vite dev(3000)──┬── /wcl-api ──▶ localhost:9528 (wcl-proxy-server,带认证)
                         └── /cn-armory ──▶ webapi.rpglogs.cn (CN 网关)
                         └── 其它 ──▶ 开发服务器
```

生产环境则由 nginx 直接反代到 `wcl-live-mp.rpglogs.cn` 与 `webapi.rpglogs.cn`。

## 10. 关键注意

1. **改游戏数据表先改生成脚本**，再 `pnpm generate-*` 重新生成，别直接手改 `@generated` 文件。
2. **大同步/批量修改时绕过 husky hooks**（`HUSKY=0` 或 `.husky` 临时调整），避免 lint-staged 自动修复破坏 i18n 字符串。
3. 国服变量（`VITE_WCL_API_BASE`、`VITE_CN_ARMORY_BASE`、`VITE_WCL_DIRECT`）决定走哪条数据源，开发前确认 `.env` 配置。