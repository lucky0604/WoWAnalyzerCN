# 01 · 整体架构与技术栈

## 1. 项目定位

WoWAnalyzerCN 是一个**纯客户端（SPA）**的魔兽世界战斗日志分析应用。它不维护自己的战斗数据，而是把 Warcraft Logs（WCL）当作数据源，把"职业专精分析规则"当作核心资产，在浏览器端完成海量战斗事件的拉取、解析与可视化。

上游是开源的 [WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer)（AGPL-3.0），本项目是面向国服的定制分支。

## 2. 分层架构

代码按职责大致分为四层，全部位于 `src/` 下：

```
┌─────────────────────────────────────────────────────────────┐
│  界面层 src/interface                                       │
│  路由 / 页面 / 报告加载流程 / 通用 UI 组件 / 指南子系统       │
├─────────────────────────────────────────────────────────────┤
│  分析引擎 src/parser + src/analysis                         │
│  CombatLogParser 核心 / 事件系统 / 模块系统 / 各专精分析实现  │
├─────────────────────────────────────────────────────────────┤
│  数据层 src/common + src/game                               │
│  WCL API 客户端 / CN 网关 / 中文映射 / 游戏静态数据表         │
├─────────────────────────────────────────────────────────────┤
│  运行时 src/index.tsx / Root.tsx / store.ts / App.tsx        │
│  挂载入口 / Provider 组合 / Redux store / 路由表              │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 运行时装配（`src/Root.tsx`）

React 应用从 `src/index.tsx` 挂载，`Root` 组件按"由外到内"包裹所有 Provider：

```tsx
<UnheadProvider head={head}>          // @unhead/react 管理 <head>
  <ReduxProvider store={store}>       // Redux store
    <I18nProvider>                    // 多语言加载（见 06）
      <TooltipProvider>               // 共享 Tooltip 门户
        <RootErrorBoundary>           // 错误边界（需要 i18n 所以放在最内）
          <App />                     // 路由实例
        </RootErrorBoundary>
      </TooltipProvider>
    </I18nProvider>
  </ReduxProvider>
</UnheadProvider>
```

### 2.2 路由表（`src/interface/App.tsx`）

使用 react-router v6 data router，所有路由 `lazy()` 懒加载，按需分包。完整路由表见 [03-page-structure.md](./03-page-structure.md)。

### 2.3 Redux store（`src/store.ts`）

`configureStore` + `combineReducers`，共 10 个 slice：

| slice                                    | 文件                                                        | 职责                                             |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `internetExplorer`                       | `interface/reducers/internetExplorer`                       | 记录 IE 用户（触发全屏警告）                     |
| `user`                                   | `interface/reducers/user`                                   | 当前登录用户 / Premium 状态                      |
| `navigation`                             | `interface/reducers/navigation`                             | 导航栏面包屑（报告/战斗/玩家标题）               |
| `reportHistory`                          | `interface/reducers/reportHistory`                          | 最近查看的报告历史                               |
| `language`                               | `interface/reducers/language`                               | 当前语言（cookie 持久化，默认 zh）               |
| `specsIgnoredNotSupportedWarning`        | `interface/reducers/specsIgnoredNotSupportedWarning`        | 用户选择忽略"不支持警告"的专精                   |
| `openModals`                             | `interface/reducers/openModals`                             | 打开的弹窗计数（控制 body `modal-open`）         |
| `tooltips`                               | `interface/reducers/tooltips`                               | 工具提示基址配置                                 |
| `charactersById`                         | `interface/reducers/charactersById`                         | 角色资料缓存（`Record<guid, CharacterProfile>`） |
| `reportCodesIgnoredPreviousPatchWarning` | `interface/reducers/reportCodesIgnoredPreviousPatchWarning` | 忽略旧补丁提示的报告码                           |

> ⚠️ 注意：`src/interface/reducers/report.ts` 定义了一个 `report` slice，但**并未注册到 store**，属于死代码。真正的"当前报告"存于 React Context（`ReportContext`），见 02。

Redux 通过 `useWaDispatch` / `useWaSelector`（`src/interface/utils/`）提供类型安全的 `AppDispatch`/`RootState` 封装。

### 2.4 页面布局系统

三套布局，满足不同页面的 chrome 需求：

- **`AppLayout`**（`src/interface/layouts/AppLayout.tsx`）—— 应用根布局：IE 检测、`<Outlet/>`、`Footer`、`PortalTarget`、`Hotkeys`、`ScrollRestoration`、`ProgressBar`。**不渲染导航栏**。
- **`HomeLayout`**（`src/interface/layouts/HomeLayout.tsx`）—— 营销/站点外壳：导航栏 + 语言切换、报告快速选择器、广告位、左侧图标导航（News/Specs/About/Premium/Help wanted）、`<Outlet/>`。
- **`SiteLayout`**（`src/site/layout/SiteLayout.tsx`，lazy 分包）—— ARC 战斗观测台外壳（site-refactor 视觉稿 v1）：接管 `/` 与 `/report-demo`，自带 `NavigationRail`，样式全部作用域在 `.site` 之下、与旧 `interface` 样式隔离（详见 `src/site/README.md`）。

报告/角色/公会页面在 `AppLayout` 内自行渲染 `NavigationBar`；首页类旧页面（`/news` 等）走 `HomeLayout`；`/` 与 `/report-demo` 由 `SiteLayout` 接管。

## 3. 技术选型要点

### 3.1 状态管理：Redux + SWR + Context 三轨

- **Redux**：导航、用户、语言、缓存等**跨页面全局态**。
- **SWR**（仅一处）：`PlayerLoader` 用 `useSWR` 拉取战斗玩家列表，`isPaused` 在经典服不支持版本时暂停。
- **React Context**：报告页走深层嵌套的 Context 链（`ReportContext` → `FightContext` → `PlayerContext` → `PatchContext`），配合 React 19 `use()`；`ConfigContext`/`ExpansionContext`/`CombatLogParserContext`/`ResultsContext` 供分析运行时读取。

### 3.2 国际化：Lingui 6

- 语言目录 `src/localization/{de,en,es,fr,it,ko,pl,pt,ru,zh}`，`sourceLocale: 'en'`，`zh` 为默认。
- 每个专精的分析文本还有独立的 `content.json`，与 `src/analysis/retail/{class}/{spec}/` 目录一一对应。
- 详见 [06-cn-localization.md](./06-cn-localization.md)。

### 3.3 分析引擎：类 + 手写依赖注入

分析引擎是**纯类**（非 React），每个报告/战斗/玩家实例化一个 `CombatLogParser`。模块系统基于手写的依赖注入（`Module.dependencies` + `CombatLogParser.initializeModules`），专精通过覆写 `static specModules` 和 `static guide` 扩展。详见 [04-analysis-engine.md](./04-analysis-engine.md)。

## 4. 国服定制总览

本项目相对上游的定制点，贯穿各层：

| 层          | 定制                                          | 关键文件                                                        |
| ----------- | --------------------------------------------- | --------------------------------------------------------------- |
| 数据源      | 直连国服 WCL API                              | `src/common/makeWclApiUrl.ts`、`vite.config.ts` `/wcl-api` 代理 |
| 角色资料    | 新增 CN 英雄榜网关                            | `src/common/fetchCnArmory.ts`、`/cn-armory` 代理                |
| 服务器 slug | 生成国服服务器名→slug 表                      | `src/common/CN_SERVER_SLUG.ts`、`scripts/cn-sn-slug/`           |
| 中文翻译    | 技能/首领/副本/NPC/区域 中文名映射            | `src/common/CN_MAPPING/`                                        |
| 构建        | `cn-overrides` 插件把 CN Guide 定向到覆盖文件 | `vite-plugins/cn-overrides.ts`                                  |
| 部署        | nginx 反代三个国服 API、Docker                | `default.conf.template`、`docker-compose.yml`                   |

详见 [06-cn-localization.md](./06-cn-localization.md) 的完整梳理。

## 5. 关键横切事实（写代码前必读）

1. WCL 是 **REST v1**（非 GraphQL），浏览器**从不持有 API key**，认证在代理/服务器侧。
2. 报告存于 **React Context**（`ReportContext`），不是 Redux；`reducers/report.ts` 是死代码。
3. 分析有**两套输出模型**并存：旧 `statistic()/tab()` 与新的 `Guide` 组件。
4. CN 角色资料只能来自 CN 网关，且**必须走同源 `/cn-armory`**（网关 CORS 禁止自定义 `auth` 头跨域预检）。
5. 玩家列表是唯一 SWR 消费者；角色资料缓存在 Redux `charactersById`。
