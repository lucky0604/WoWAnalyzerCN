# 03 · 页面结构与路由

## 1. 路由树总览

路由定义在 `src/interface/App.tsx`，采用 react-router v6 `createBrowserRouter`（测试模式用 `createMemoryRouter`），每条路由 `lazy()` 懒加载。整棵树挂在根 `<Route path="/" element={<AppLayout/>} errorElement={<RouterErrorBoundary/>}>` 下。

| 路由路径                                        | 懒加载模块                                   | 布局       | 页面组件与内容                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `character/:region/:realm/:name`                | `routes/character`                           | AppLayout  | `CharacterParses`（角色解析列表），读 `?game=` 参数                                                                                    |
| `guild/:region/:realm/:name`                    | `routes/guild`                               | AppLayout  | `GuildReports`（公会战报）                                                                                                             |
| `report/:reportCode/:fightId?/:player?/:build?` | `report`（index）                            | AppLayout  | 报告加载管线（见 §3）                                                                                                                  |
| `report/...`（index）                           | `routes/report/overview`                     | (report)   | `Overview`：`parser.buildGuide()` 渲染"指南"                                                                                           |
| `report/.../overview`                           | `routes/report/overview`                     | (report)   | 同 index                                                                                                                               |
| `report/.../statistics`                         | `routes/report/statistics`                   | (report)   | `ReportStatistics`：统计框瀑布流                                                                                                       |
| `report/.../timeline`                           | `routes/report/timeline`                     | (report)   | `TimelineTab`：施法/buff/冷却时间轴                                                                                                    |
| `report/.../events`                             | `routes/report/events`                       | (report)   | `EventsTabFn`：原始事件查看                                                                                                            |
| `report/.../debug`                              | `routes/report/debug`                        | (report)   | `DebugAnnotationsTab`：模块调试标注                                                                                                    |
| `report/.../character`                          | `routes/report/character`                    | (report)   | `Character` + `EncounterStats`：装备/属性/天赋                                                                                         |
| `report/.../about`                              | `routes/report/about`                        | (report)   | `About` + `ResultsChangelogTab`                                                                                                        |
| `report/.../:resultTab`                         | `routes/report/dynamic`                      | (report)   | 查 `results.tabs`，渲染 `tab.render()`（专精自定义标签）                                                                               |
| `privacy`                                       | `routes/privacy`                             | AppLayout  | 隐私政策 + 语言切换                                                                                                                    |
| `support-stats`                                 | `routes/support-stats`                       | AppLayout  | 各专精支持状态统计表                                                                                                                   |
| `/`（index）                                    | `site/layout/SiteLayout` → `site/pages/Home` | (site)     | ARC 战斗观测台首页（site-refactor 视觉稿 v1）：六大板块 IA 导航 + Analyze 入口，样式作用域在 `.site`                                   |
| `report-demo`                                   | `site/pages/ReportDemo`                      | (site)     | 示例战报（路径常量 `site/routes.ts` 的 `REPORT_DEMO_PATH`）：Playback/CombatRoute/InstrumentStrip 演示，视觉稿虚构数据，不依赖真实 WCL |
| `news`                                          | `routes/news`                                | HomeLayout | `NewsList` + Twitter 关注（不再是 `/` 首页）                                                                                           |
| `specs`                                         | `routes/specs`                               | HomeLayout | 按正式服/经典服分组列出所有专精支持状态                                                                                                |
| `premium`                                       | `routes/premium`                             | HomeLayout | `LoginPanel` + Premium 介绍                                                                                                            |
| `about`                                         | `routes/about`                               | HomeLayout | 项目介绍、Discord 面板、`ChangelogPanel`                                                                                               |
| `help-wanted`                                   | `routes/help-wanted`                         | HomeLayout | 参与贡献入口                                                                                                                           |
| `contributor/:id`                               | `routes/contributor`                         | HomeLayout | `ContributorDetails`                                                                                                                   |
| `search/:searchTerm?`                           | `routes/search`                              | HomeLayout | 解析 WCL/军械库 URL 或报告码并跳转                                                                                                     |
| `*`（兜底）                                     | `routes/not-found`                           | HomeLayout | 404                                                                                                                                    |

## 2. 布局系统

### 2.1 `AppLayout`（`src/interface/layouts/AppLayout.tsx`）

应用根外壳。挂载时检测 IE、分发 `fetchUser()`（除非 `VITE_FORCE_PREMIUM`）。渲染：IE 全屏警告（否则 `<Outlet/>`）、`Footer`、`PortalTarget`、`Hotkeys`、`ScrollRestoration`、`ProgressBar`。用 `useWaSelector` 读 IE 状态与弹窗计数（多弹窗时给 body 加 `modal-open`）。

> 注意：**AppLayout 不渲染 NavigationBar**，各页面自行添加自己的导航栏。

### 2.2 `HomeLayout`（`src/interface/layouts/HomeLayout.tsx`）

营销/站点外壳。渲染：静态 `NavigationBar`（含 `LanguageSwitcher`）、`ReportSelectionHeader`（快速选历史报告）、非 Premium 用户的顶部广告位、`<main className="container">` 内左侧图标导航（News / Specs / About / Premium / Help wanted）与 `<Outlet/>`（包在 `ErrorBoundary`）。

### 2.3 `NavigationBar`（`src/interface/NavigationBar.tsx`）

全局顶栏：Logo、面包屑式 报告→战斗→玩家（读 Redux `navigation`）、Discord/GitHub/Premium 图标、以及 `children`（如 `LanguageSwitcher`）。

### 2.4 `SiteLayout`（`src/site/layout/SiteLayout.tsx`，lazy 分包）

ARC 战斗观测台外壳（site-refactor 视觉稿 v1），在 `src/interface/App.tsx` 中以 lazy 路由组接管 `/` 与 `/report-demo`。自带左侧 `NavigationRail`，全部样式作用域在 `.site` 类之下、与旧 `interface` 样式隔离（旧全局页脚经 `body:has(.site) footer` 隐藏）。页面与组件见 `src/site/README.md`；`/` 的 Analyze 入口动画结束后跳转 `REPORT_DEMO_URL`。

## 3. 报告界面子系统（`src/interface/report/`）

### 3.1 入口 `index.tsx`

`export function Component()` 渲染嵌套管线并在文件内定义两个"拦截"守卫：`UnsupportedSpecBouncer`（专精不受支持）与 `MissingCombatantInfoBouncer`（战斗缺 `combatantinfo` 事件）。

### 3.2 管线组件

| 组件             | 职责                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| `ReportLoader`   | 最外层，拉取 `fetchFights`，提供 `<ReportProvider>`，处理 API 错误，设置导航标题 |
| `PatchChecker`   | 若报告早于当前补丁，显示"查看旧版本"面板（`PatchProvider`）                      |
| `FightSelection` | 无战斗参数时渲染战斗选择列表；命中则 `<FightProvider>`                           |
| `PlayerLoader`   | SWR 拉玩家，无玩家时渲染选择界面；命中则 `<PlayerProvider>`                      |
| `SupportChecker` | 拦截过旧/未维护专精，可"继续"（Redux 持久化）                                    |
| `ResultsLoader`  | 分析阶段编排：解析器/事件/阶段/角色/过滤/分批次解析                              |

### 3.3 `Results`（`src/interface/report/Results/index.tsx`）

结果外壳。持有 `adjustForDowntime` 状态，`parser.generateResults()` 计算 `ParseResults`，提供 `ResultsContext` + `CombatLogParserProvider`，渲染 `Header`（标签栏/阶段/时间过滤）、警告、当前标签 `<Outlet/>`、页脚（贡献者/WCL/Wipefest 链接）。宽屏且非 Premium 时显示侧栏广告。

### 3.4 关键上下文与 hooks

- 上下文：`ReportContext` / `FightContext` / `PlayerContext` / `PatchContext` / `ConfigContext` / `ExpansionContext` / `CombatLogParserContext`。
- hooks（`report/hooks/`）：`useEvents`、`useParser`、`useEventParser`、`useBossPhaseEvents`、`useCharacterProfile`、`usePhases`、`useTimeEventFilter`。

## 4. 功能页面速览

### 4.1 角色页 `routes/character.tsx` → `CharacterParses`

按 `?game=` 参数决定正式服/经典服，展示某角色在某区域/服务器的历史解析（Best 排名、补丁、装备等）。CN 区域跳过 battle.net 头像拉取，用 `FALLBACK_PICTURE`。

### 4.2 公会页 `routes/guild.tsx` → `GuildReports`

展示公会的最近战报列表，含进度/参与信息。

### 4.3 专精列表页 `routes/specs.tsx`

把 `AVAILABLE_CONFIGS`（`src/parser/index.ts` 导出的全部专精配置）按正式服（按支持度排序）与经典服分组，渲染 `SpecListItem`，展示每个专精的支持等级。

### 4.4 支持统计页 `routes/support-stats.tsx`

`StatsTable`：每个专精的服务端指标（支持等级、最近改动、补丁、活跃时间、CD/GCD/未知技能错误率）。数据来自 `server-metrics` 上传统计。

### 4.5 搜索页 `routes/search.tsx`

用 `ReportSelecter.constructURL` 解析 WCL/军械库 URL 或报告码，跳转到对应报告；否则显示"无效搜索参数"。

## 5. 报告标签（Tab）系统

- **静态标签**：`Results/TABS.ts` 定义 `OVERVIEW / STATISTICS / TIMELINE / CHARACTER / EVENTS / ABOUT` 等标准 URL key。
- **动态标签**：`routes/report/dynamic.tsx` 把 `:resultTab` 在 `results.tabs` 中查找，命中则 `tab.render()`（包 `ErrorBoundary`），否则"404 tab not found"。这是 Powered by 各专精自定义 `Analyzer.tab()` 的机制。
- 标签栏由 `Results/Header` 渲染（静态标签 + 专精 `results.tabs` 合并）。

## 6. 页面间导航

- `makeAnalyzerUrl`（`src/interface/makeAnalyzerUrl.ts`）—— 生成报告/战斗/玩家/标签的规范 URL。
- `ReportSelecter`（`src/interface/ReportSelecter.tsx`）—— HomeLayout 报告快速选择头（`ReportSelectionHeader`）与搜索页的"粘贴报告链接"输入，导出 `constructURL`；ARC 观测台首页（`src/site`）不含此组件。
- 面包屑导航态存于 Redux `navigation` slice，供 `NavigationBar` 显示。
