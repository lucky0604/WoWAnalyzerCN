# src/site — 战斗观测台（site-refactor 视觉稿 v1）

设计来源：`agent_flow/site-refactor/WowAnalyzerCN_UI_UX_IMPLEMENTATION_SPEC_v1.md`
（配套两张 CHATGPT 视觉稿截图，同目录）。

页面上线方式：`src/interface/App.tsx` 中 `<SiteLayout />` 路由组接管
`/`（首页）与 `/report-demo`（示例战报）。所有样式作用域在 `.site` 类之下，
与旧 `interface` 样式完全隔离；旧全局页脚通过 `body:has(.site) footer` 隐藏。

## 目录

```
src/site/
├── layout/      SiteLayout（.site 根 + 背景层）、NavigationRail（左侧导航轨）
├── pages/       Home（首页）、ReportDemo（示例战报页）
├── combat/      CombatRoute（SVG 战斗路线）、InstrumentStrip（仪器条）、Playback（回放条）
├── analysis/    InsightCard（洞察卡）、PriorityCard（P1–P4）、EvidenceToolbox（证据工具箱）
├── dossier/     DossierCard（档案卡）、DossierSpine（档案脊）
├── ui/          Panel / Button / Divider / IconSlot / curve.ts（路径换算）/ 装饰 SVG
├── demo/        battle.ts（演示数据，视觉稿虚构，不依赖真实 WCL）
└── styles/      tokens → typography → effects → motion → components（按序在 SiteLayout 引入）
```

## 素材接入点（当前全部为代码实现，可按需替换为位图）

| 位置                  | 现状（代码实现）                                                                  | 如何换成图片/素材                                                           |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 页面噪点纹理          | `effects.css` `--tex-noise`（feTurbulence SVG data-URI，0.035 overlay）           | 生成 `noise.webp` 后把 `--tex-noise: url(...)` 换成图片路径即可，其余不用动 |
| 观测网格              | `effects.css` `--tex-grid`（96px 平铺 SVG data-URI）                              | 同上，换 `--tex-grid`；建议保留 `mask-image` 径向淡出                       |
| 背景法阵              | `src/site/ui/arcane-circle.svg`（720×720，金+紫同心环）                           | 替换同路径文件，或换 `SiteLayout.tsx` 里的 `arcCircleUrl` 引用              |
| 角饰（面板左上/右下） | `src/site/ui/corner-a.svg` / `corner-b.svg`                                       | 替换同名文件；引用在 `effects.css` `.panel--corners::before/::after`        |
| Logo                  | `src/site/ui/logo.svg`（48×48 金色准星方块）                                      | 替换同路径文件                                                              |
| 分隔菱形 / 星芒       | `divider-diamond.svg`、`divider-diamond-arcane.svg`、`sparkle.svg`                | 替换同名文件                                                                |
| 副本/首领图标         | `DossierSpine` 的 `IconSlot` 未传 `icon` → 渲染星芒占位                           | 传 WoW 图标名（`iconUrl` 语义，走 assets.rpglogs.com），或本地图片          |
| 技能图标              | `demo/battle.ts` 的 `icon` 字段（奥术强化/唤醒/法力宝石/奥术飞弹，真实 CDN 图标） | 改 `icon` 字符串即可；路线节点徽标与快照条共用                              |
| 分析工作台其余 tab    | 「技能时序 / 团队协同 / 原始事件」渲染占位文案                                    | 在 `ReportDemo.tsx` 的 `tab === '法力曲线'` 分支旁补真实视图                |

## 约定

- 颜色一律引用 `tokens.css` 令牌，组件不写裸 hex；奥术紫只用于"当前分析焦点"。
- 动效令牌 `--motion-*`/`--ease-*`；`prefers-reduced-motion` 全局降级在 `effects.css`。
- 中英文案为硬编码演示数据（不走 Lingui），接真实数据时再决定 i18n 方案。
- 路径/曲线绘制：`ui/curve.ts` 的 `catmullRomPath`（Catmull-Rom→bezier）与
  `pathFractionAt`（节点→dash 单位换算，Focus Mode 焦点段用）。
