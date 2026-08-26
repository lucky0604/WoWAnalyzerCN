# WoWAnalyzerCN 项目分析文档（Summary）

> 本文档基于对 `WoWAnalyzerCN` 代码库的完整梳理编写，目标是让新接手者快速理解项目的**整体架构、数据流程、页面结构、分析引擎与国服定制实现**。

## 这是什么项目

**WoWAnalyzerCN** 是一个基于开源项目 [WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer) 二次开发的**魔兽世界战斗日志分析平台（国服定制版）**。

它做的事情：用户粘贴一个 Warcraft Logs（WCL）的**战斗日志报告链接**，WoWAnalyzer 会拉取并解析这场战斗发生的每一个战斗事件（施法、伤害、治疗、buff 等），结合对应职业专精的**分析规则**，输出一份详细的**战斗表现分析报告**——包括数据统计、技能使用建议、时间轴回放、角色装备天赋等。

本项目在 WoWAnalyzer 上游基础上针对**中国大陆（国服）**场景做了大量定制：

- **直连国服 WCL API**（`wcl-live-mp.rpglogs.cn`），不再依赖 `wowanalyzer.com` 代理
- 新增 **CN 英雄榜网关**（`webapi.rpglogs.cn`）用于拉取国服角色资料
- 大量 **中文翻译**（技能名、首领名、副本名、NPC 名等）
- 一套 **CN Guide 覆盖（override）机制**，让国服维护者可以定制各专精的分析指南而无需改动上游文件

## 技术栈速览

| 类别 | 选型 | 说明 |
|---|---|---|
| 框架 | **React 19** + TypeScript | 客户端渲染（SPA） |
| 路由 | **react-router-dom v6** | data router，全路由 `lazy()` 懒加载 |
| 状态管理 | **Redux Toolkit** + **SWR** | Redux 管导航/用户/缓存；SWR 管玩家列表 |
| 国际化 | **@lingui 6**（核心 + React + Vite 插件） | 10 种语言，中文为主 |
| 构建 | **Vite 8** + Rolldown | 含自定义 `cn-overrides` 插件 |
| 测试 | **Vitest** + **Playwright** | 单元测试 + e2e |
| 代码质量 | **oxlint** + **oxfmt** + oxc-parser | Rust 系工具链 |
| 监控 | **Sentry** | 错误上报与性能追踪 |
| 部署 | **Docker + nginx** | `docker-compose.yml`，nginx 反代国服 API |

## 顶层目录结构

```
.
├── src/
│   ├── index.tsx / Root.tsx / store.ts     # 应用入口、Provider 组合、Redux store
│   ├── interface/                          # 界面层（组件、路由、页面、报告 UI）
│   │   ├── App.tsx                         # 路由表定义
│   │   ├── routes/                         # 各页面路由组件
│   │   ├── layouts/                        # AppLayout / HomeLayout
│   │   ├── report/                         # 报告加载/选择/解析/结果 全流程
│   │   ├── guide/                          # 现代"指南"分析子系统
│   │   └── ...（大量通用 UI 组件）
│   ├── parser/                             # 分析引擎（解析器核心 + 共享模块 + UI 统计组件）
│   │   ├── core/                           # CombatLogParser、事件系统、模块系统
│   │   ├── shared/                         # 跨专精共享模块（buff、冷却、GCD…）
│   │   ├── ui/                             # 统计框（Statistic）等展示组件
│   │   └── index.ts                        # 所有专精配置的注册表
│   ├── analysis/                           # 各职业专精的分析实现
│   │   ├── retail/                         # 正式服（每专精一个目录）
│   │   └── classic/                        # 怀旧服
│   ├── game/                               # 游戏静态数据（职业/专精/难度/副本…）
│   ├── common/                             # 通用工具、WCL API 客户端、CN 网关、数据表
│   │   ├── CN_MAPPING/                     # 中文名映射（技能/首领/副本/NPC/区域）
│   │   ├── CN_SERVER_SLUG.ts               # 国服服务器 slug 表（生成）
│   │   ├── fetchWclApi.ts / fetchCnArmory.ts
│   │   ├── SPELLS/ TALENTS/ ITEMS/ NPCS/   # 游戏对象数据表
│   └── localization/                       # 多语言目录 + spec 子翻译 + CN overrides
├── scripts/                                # 各类生成脚本（talent/enchant/slug/翻译检查）
├── vite-plugins/                           # cn-overrides 构建插件
├── vite.config.ts                          # Vite 配置（含 /wcl-api、/cn-armory 代理）
├── default.conf / docker-compose.yml       # 国服部署
└── docs/                                   # 项目文档
```

## 各文档索引

本目录下按主题拆分为多篇独立文档，建议按顺序阅读：

| 文档 | 内容 | 建议阅读顺序 |
|---|---|---|
| [01-architecture.md](./01-architecture.md) | 整体分层架构、运行时装配、状态管理、国服定制总览 | 1 |
| [02-data-flow.md](./02-data-flow.md) | 数据流程：WCL API 客户端、报告加载管线、CN 网关、缓存 | 2 |
| [03-page-structure.md](./03-page-structure.md) | 页面结构与路由：完整路由表、布局系统、功能页面 | 3 |
| [04-analysis-engine.md](./04-analysis-engine.md) | 分析引擎：CombatLogParser、事件系统、模块系统、指南子系统 | 4 |
| [05-game-data.md](./05-game-data.md) | 游戏数据子系统：SPECS/SPELLS/TALENTS/ITEMS/副本 等数据表 | 5 |
| [06-cn-localization.md](./06-cn-localization.md) | 国服定制与国际化的深入解析 | 6 |
| [07-ui-system.md](./07-ui-system.md) | UI 组件库与工具系统（统计框、Tooltip、通用组件） | 7 |
| [08-tooling.md](./08-tooling.md) | 构建/开发/测试/部署工具链 | 8 |

---

## 核心概念速览（先读这篇）

### 一条日志报告如何变成一份分析

```
用户输入 WCL 报告码
  │
  ▼
ReportLoader  ──拉取 report/fights JSON──▶ 报告元数据（战斗列表）
  ▼
FightSelection ──选择一场战斗──▶ FightProvider
  ▼
PlayerLoader  ──SWR 拉取玩家列表──▶ 选一个玩家
  ▼
ConfigContext ──按 职业+专精 找到对应专精配置 Config
  ▼
useParser ──动态 import 该专精的 CombatLogParser 类
  ▼
useEvents ──分页拉取该玩家的战斗事件（report/events）
  ▼
useEventParser ──实例化 parser、normalize 事件、逐条 triggerEvent
  ▼
Results ──parser.generateResults() / parser.buildGuide()──▶ 渲染统计/指南
```

### 两个"分析输出模型"并存

- **旧模型**：各模块 `Analyzer.statistic()/tab()` 返回 React 元素 → 汇总成 `ParseResults` → 由 `statistics` / 动态 `:resultTab` 路由渲染。
- **新模型（指南 Guide）**：专精声明一个 `Guide` React 组件，由 `overview` 路由通过 `parser.buildGuide()` 渲染，是当前推荐的分析呈现方式。