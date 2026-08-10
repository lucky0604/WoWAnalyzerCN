# 当前仓库真实状态审计

> 审计日期：2026-08-10
> WoWAnalyzerCN 分支：`midnight`
> 审计时 HEAD：`b2aa72e244`
> 工作性质：只读审计与实施设计；未实现 Dungeon 功能，未修改业务代码。

## 1. 审计结论

WoWAnalyzerCN 已具备承载“大秘境学习助手”的应用外壳、主题、技能元数据、国际化、路由、测试和 WCL 请求基础设施，但不存在可直接扩展成该产品的 Dungeon 领域模型。正确路径是新增独立的 `src/dungeon/**` 业务域，并只在应用路由和导航处做小面积接入。

Threechest 可以帮助验证“地图、路线步骤、具体怪物出生点和 forces 如何关联”的工程思路，但它是编辑器中心产品，不是学习产品。其代码、标识策略、状态管理、赛季数据和资源都不应成为 WoWAnalyzerCN 的生产依赖。

本轮建议的范围不是“把 Threechest 路线功能搬过来”，而是：

```text
从结构化副本事实出发
→ 组织成稳定的战斗 Situation
→ 用只读学习路线提供上下文
→ 教玩家识别危险、理解因果并明确个人动作
→ 通过主动回忆与薄弱点复习完成学习闭环
```

## 2. WoWAnalyzerCN 可复用基础

### 2.1 应用与路由

- `src/interface/App.tsx` 已使用 React Router v6 data router 与 lazy route，可注册独立 Dungeon layout 和按页拆包。
- `src/interface/layouts/AppLayout.tsx` 已提供全局应用壳，包括错误处理、Footer、Portal、快捷键和加载反馈。
- 当前 Home layout 带 wildcard；实施时 Dungeon 一级路由必须在它之前显式注册，避免被首页路由吞掉。
- `src/interface/NavigationBar.tsx` 是全站导航的一致性锚点，新入口应沿用其层级和交互，不另造一套顶栏。

### 2.2 主题与内容组件

- `src/interface/_design-system.scss` 与 `src/interface/Theme.scss` 已定义深色层级、边框、阴影和 WoW 金色强调色。
- `src/interface/App.scss` 已定义内容宽度、Poppins 标题与 Open Sans 正文字体基线。
- `src/interface/Panel.tsx`、Guide 相关组件可提供布局和内容密度参考；Dungeon 的 Situation、危险技能和自测卡片应是独立组件，不强行套成分析器面板。
- `SpellLink`、`SpellIcon`、`useSpellInfo` 与 Tooltip 体系可以支持技能名称、图标和补充说明。
- `src/common/CN_MAPPING/**` 可作为 Dungeon、Boss、Mob、Spell 中文名称回退链，但不能承载攻略判断和赛季版本事实。

### 2.3 WCL 与环境

- `src/common/makeWclApiUrl.ts` 和 `src/common/fetchWclApi.ts` 已提供 WCL URL 生成、请求和错误处理边界。
- 本地开发继续使用现有 `localhost:9528` 服务；线上继续走项目已经部署的 `rpglogs.cn` 服务，不新增第二套代理协议。
- 用户已确认 WCL API 可用于本项目。首版仍不新增“按日志自动还原路线”的重型分析器，只预留稳定 Knowledge ID 与未来 report navigation adapter。

### 2.4 工程工具

- 仓库已有 TypeScript、Vitest、Playwright、Lingui、Sentry、lint 和 build 基础设施。
- Dungeon 应增加自己的 Schema 校验、生成器、数据一致性、组件和 E2E 测试，而不是把校验散落在页面运行时。

## 3. 建议的隔离边界

### 应新增

```text
src/dungeon/
  schema/       # Raw、Authored Knowledge、Resolved Read Model
  data/         # 按副本拆分的生成产物与 manifest
  knowledge/    # Situation、技能、Boss、角色/能力建议
  runtime/      # resolver、URL、storage、feature/status adapters
  ui/           # Dungeon 页面和领域组件
scripts/dungeons/
  ingest/       # 允许来源的原始数据适配
  reconcile/    # stable identity 与 drift 处理
  validate/     # 跨文件、来源、发布状态和资源门禁
```

### 不应侵入

- 不在 `CombatLogParser`、Analyzer 或 ReportContext 中构建攻略页面。
- 不把攻略结论写入通用 Spell/NPC 数据表。
- 不为首版引入全局 Redux、undo/redo、协作或地图编辑器状态。
- 不让某个来源的坐标、怪物 key 或 Pull 编号直接成为公开知识 ID。

## 4. Threechest 审计

### 4.1 可参考的思想

- Pull 应引用具体 spawn，而不是只引用 NPC 类型。
- 地图选择和步骤列表需要双向联动。
- forces、累计进度和步骤覆盖应从基础数据推导，避免作者重复录入。
- 坐标转换应与 UI 分离。
- 版本化 manifest、生成校验和缺数据拒绝发布值得保留。

### 4.2 不应复制的部分

- 编辑器 reducer、Redux undo/persist、协作、导入导出和 MDT 兼容层。
- WCL 路线匹配代码；它不是首版学习闭环的必要条件。
- `enemyIndex-spawnIndex` 一类依赖数组顺序的身份。
- 对来源类型的强制断言、单一平面假设和来源内部 key。
- Threechest 的当前赛季内容。当前克隆中可见的是旧 8 本地图/坐标库存，不能作为 Midnight S2 轮换池正确性证据；S2 池必须以官方轮换公告单独核对。

### 4.3 代码与资源门禁

即使 WoWAnalyzerCN 重新实现相同产品概念，也必须避免逐文件翻译、复制独特实现表达或形成运行时依赖。工程团队只记录抽象、输入输出和行为验收，再以本项目领域模型重新实现。

项目所有者在 2026-08-10 确认：Threechest 坐标/位置信息可作为初始规范化快照；Threechest 在线图片可作为仅限 localhost 的远程视觉开发 fixture。工程边界为：

- 坐标导入必须保留 source snapshot、转换版本和 stable identity，不沿用来源内部数组序号；
- Threechest 图片 URL 放在 gitignored 的本地配置中，不写入业务数据或组件；
- 本地浏览器可直接请求远程图片，但不提交、不部署、不进入公开截图；
- production provider 只能指向已批准 OSS 资源或明确占位图；
- CI 扫描产物中的 Threechest/MDT 路径和 URL，命中即阻断。

这足以启动本地布局、地图和学习闭环开发，但不能把图片的“稍后替换”视为生产授权。Threechest 坐标/位置信息已按项目决策允许导入；forces 数值、图片和其他内容仍按各自来源单独管理。

## 5. 数据时效审计

- 目标是 Midnight Season 2；公开内容必须绑定明确的 season、game build、difficulty 和内容 revision。
- 当前 S2 副本池与机制仍可能经历 PTR/live 调整。结构可提前支持 PTR，但公开 `published` 只接受 live 或明确标注的当前验证版本。
- 赛季目录可以展示八本覆盖状态；未完成审校的副本不得以空壳学习页对外开放。
- 内部 Inspector 可以查看八本 raw/draft 状态，公开入口只展示 `reviewed/published` 内容。
- 任何同 Spell ID 的知识仍需结合 caster、Boss/小怪和 difficulty 上下文，不能仅按 Spell ID 合并。

## 6. 当前质量基线

本轮在未改业务代码的状态下执行：

| 检查             | 结果                         | 解释                                                                             |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `pnpm typecheck` | 通过，exit 0                 | 当前 HEAD 类型检查可作为 Dungeon 实施基线                                        |
| `pnpm lint`      | 失败：714 errors，0 warnings | 均来自当前仓库已有文件；主要是未使用 import 与 Lingui 规则，不是本轮规划文档引入 |
| `pnpm test`      | 未运行                       | 本轮没有功能代码变更，不把全量测试结果伪装成实施验证                             |
| `pnpm build`     | 未运行                       | 同上；Phase 0/1 建立 Dungeon 代码后再测 lazy chunk、payload 和产物资源           |
| `pnpm e2e`       | 未运行                       | 当前尚无可测试的 Dungeon 用户路径                                                |

实施前应冻结这份基线，并用 changed-scope 门禁保证新增 Dungeon 代码不产生新的 lint/type/test 失败。历史 lint 债务需显式列入 baseline/allowlist，不能用宽泛忽略规则掩盖新增问题。

## 7. 工作区保护说明

- `agent_flow/` 当前被 git 忽略，本文档集是本地规划交付物，不会自动进入产品提交。
- 审计时工作区另有用户所有的未跟踪目录 `docs/summary/`；本轮未读取、修改或清理它。
- 本轮没有创建分支、暂存、提交或推送，也没有修改 `src/**`、`scripts/**` 或 `package.json`。

## 8. 审计后的实施约束

只有以下事项明确后，才应从 Phase 0 进入生产数据导入：

1. 生产地图/图片的批准来源和可部署范围；未确认时固定使用占位图。
2. enemy forces 数值与其他非坐标事实的可提交、可派生和可再分发范围。
3. RLP 与 Altar 样本的内容作者、第二审校者和审校时限。
4. 首版 live key range、集合石队伍假设和学习友好路线的验收口径。

其余低风险技术选择按实施计划中的默认方案先用垂直切片测量，再决定是否升级，不提前引入编辑器级复杂度。
