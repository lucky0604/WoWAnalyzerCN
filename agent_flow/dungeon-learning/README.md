# WoWAnalyzerCN 大秘境学习模块规划索引

> 状态：方案已确认，开发分支已完成 Phase 0、Phase 1A 预览、Phase 2 的地图/查询/只读 Route 与 Boss 页面，以及 Phase 3 的主动回忆薄弱项反馈；正式攻略内容仍按副本逐本建设，Phase 1B 尚未宣称完成。
>
> 目标版本：Midnight Season 2。
>
> 产品定位：Dungeon Learning Companion（副本学习助手），不是 MDT/Threechest 的网页复刻。

## 结论先行

本模块应作为 WoWAnalyzerCN 的独立一级业务域，负责“进本前学习”；现有 `src/parser/**` 与 `src/analysis/**` 继续负责“打完后的日志分析”。首版的核心不是地图编辑或路线生产，而是让普通玩家在 10～15 分钟内形成以下认知链：

```text
副本全貌
→ 我往哪里走
→ 这一波为什么这样拉
→ 哪只怪最危险
→ 哪个技能必须处理
→ 漏处理会怎样
→ 我的角色应该做什么
→ Boss 还要记住什么
→ 自测并复习薄弱点
```

建议以“学习模式”为默认页，并分为 60 秒进本前复习、5 分钟建立全貌、10～15 分钟完整学习；只读推荐路线是学习素材。地图承担空间解释，不承担路线编辑。

## 已确认的产品前提

1. 首要任务是学会打本，地图只是媒介。
2. 视觉延续 WoWAnalyzerCN 的深色、金色强调和专业数据工具气质。
3. Route Editor、协作、导入导出、MDT 复刻不进入当前目标。
4. Threechest 只作为交互思想和数据管线的研究样本，不直接复制其代码。
5. Threechest 的坐标/位置信息可作为首版规范化数据快照，并保留来源、版本和可替换 adapter；不因此自动采用其 forces、攻略文字或代码。
6. 本地开发可通过配置化 Remote Dev Asset Provider 直接加载 `threechest.io` 的在线图片；URL 不写进业务数据或组件，禁止进入 production build、preview/staging 和公开材料。
7. 部署阶段再确认生产图片来源；未确认时生产使用占位图，不能自动回退到 Threechest。
8. WCL 通过现有 WoWAnalyzerCN 基础设施访问：开发环境可使用 `localhost:9528`，线上使用现有 `rpglogs.cn` 相关服务。

## 文档目录

- [00-current-repository-audit.md](./00-current-repository-audit.md)：当前仓库、Threechest、WCL 与质量基线审计。
- [01-product-requirements.md](./01-product-requirements.md)：详细 PRD、用户任务、功能需求与验收标准。
- [02-competitive-adversarial-review.md](./02-competitive-adversarial-review.md)：Threechest 与竞品分析、反例、对抗性评审。
- [03-ux-design-spec.md](./03-ux-design-spec.md)：信息架构、桌面/移动布局、视觉与交互规范。
- [04-architecture-data-model.md](./04-architecture-data-model.md)：领域边界、数据分层、Schema、状态和加载策略。
- [05-data-source-review.md](./05-data-source-review.md)：数据/资源来源、授权状态、开发临时素材门禁。
- [06-implementation-phases.md](./06-implementation-phases.md)：实施 Phase、交付物、质量门和退出标准。
- [07-content-operations-and-testing.md](./07-content-operations-and-testing.md)：攻略维护、新赛季更新、测试与运营指标。
- [08-confirmed-development-source-decisions.md](./08-confirmed-development-source-decisions.md)：坐标、Threechest 远程开发图片与生产替换策略的确认记录。
- [09-s2-rotation-correction-review.md](./09-s2-rotation-correction-review.md)：S2 轮换池校正、legacy 坐标隔离与第二轮对抗性审查。
- [10-phase1a-content-preview.md](./10-phase1a-content-preview.md)：Phase 1A RLP 内容草稿、空间待接入门禁与审查记录。
- [11-phase2-3-implementation-review.md](./11-phase2-3-implementation-review.md)：Phase 2–3 实现、对抗性 Review、修复与验证证据。
- [12-browser-qa.md](./12-browser-qa.md)：本地 Chrome 桌面/移动端路由、交互、错误与溢出检查记录。
- [13-phase1b-implementation-review.md](./13-phase1b-implementation-review.md)：Phase 1B 作者工时门禁、坐标 importer 预检与对抗性 Review 记录。

## 当前代码审计摘要

## 当前实现进度

- `/dungeons` 已展示官方 Midnight S2 八本覆盖路线；建设中副本只能显示建设状态，不能进入空壳学习页。
- 当前 S2 轮换来源记录在 `season2RotationSource`，以 Blizzard 公告为目录事实来源；Threechest 克隆里的旧 8 本不再标记为 S2。
- Threechest 坐标快照位于 `src/dungeon/data/coordinates/**`，采用 `threechest-yx → normalized-v1`，作为独立的 `legacyThreechestCoordinateInventory` 保留，用于导入/地图回归测试，不自动映射到 S2。
- 本地开发可从 `/dungeons/legacy/:sourceKey` 打开明确标注为 `DEV ONLY · LEGACY COORDINATE QA` 的只读页面，验证 Threechest 瓦片 manifest、坐标转换和 spawn 层；该 route 在 production 不注册，也不提供路线编辑。
- 当前 S2 条目只有在显式配置 `coordinateSnapshotId` 后才会开放位置参考；没有可靠坐标时显示“位置参考待接入”，不会用旧副本数据替代。
- `/dungeons/:dungeonId/reference` 仅展示位置、组别、巡逻和快照审计信息，不展示未经批准的 forces、技能或路线事实。
- 正式学习页目前通过本地预览展示 RLP 的来源化内容草稿；空间数据 pending、forces pending 或缺失 Spell ID 都会保留为 warning，并在 reviewed/published 时强制阻断。Altar fixture 仍仅用于数据合同回归。
- Inspector、只读 Route 和只读 Boss 学习页已建立互相可达的深链；Route/Boss 页面只解释已有知识，不提供编辑、导入或保存路线的操作。
- Phase 1B 已加入内容完整度报告：分别审计 Enemy 事实引用、Situation/Route/Boss 学习表面、无上下文 Pull 和空 Boss 技能卡；正式状态会将缺口升级为 release error。
- formal review 还必须记录作者自测（学习模式、全部 Situation/Route 覆盖和完成时间），不能只填写作者/第二审校者姓名。
- formal review 还必须记录作者工时：整本副本总分钟数，以及每个 `routine`/`critical` Situation 的分钟数；这些数据用于校准后续八本扩展成本，不进入玩家进度。
- 学习页已完成“先选把握程度、再揭示答案”的主动回忆约束，并显示已回忆/模糊/不会/待复习汇总；进度写入失败时会明确提示，不把内存状态伪装成已持久化。
- 学习入口统一经过 `getDungeonLearningAccess`：draft 只能显示为本地预览，fixture、stale、来源未批准或正式校验失败的文档不能渲染学习课件；WCL 适配器也复用同一正式门禁。
- 内容维护 quickstart 已提供 `dungeon:new` / `dungeon:add` / `dungeon:check --dungeon`，草稿不会自动进入 runtime registry。
- `dungeon:impact`、`dungeon:status stale`、`dungeon:preview`、`dungeon:publish`、`dungeon:rollback` 已提供显式 release/stale ledger 流程；publish 只写 release manifest，不自动注册页面。
- `pnpm dungeon:check-dist` 是发布前的 remote-dev/Threechest 产物扫描门禁。

### 可直接复用

- `src/interface/App.tsx`：React Router v6 data router 与 lazy route 模式。
- `src/interface/layouts/AppLayout.tsx`：全局错误、Footer、Portal、Hotkeys、加载进度等应用外壳。
- `src/interface/NavigationBar.tsx`：全局导航风格与登录/语言等能力。
- `src/interface/_design-system.scss`、`src/interface/Theme.scss`：深色分层背景、边框、阴影、金色主色。
- `src/interface/Panel.tsx`、Guide 相关组件：内容分组与数据面板模式，可复用样式原则，Dungeon 特有卡片仍应独立创建。
- `src/interface/SpellLink.tsx`、`SpellIcon`、`useSpellInfo`、Tooltip 体系：技能名称、图标和提示。
- `src/common/CN_MAPPING/**`：中文 Dungeon、Boss、Mob、Spell 名称回退链。
- `src/common/makeWclApiUrl.ts`、`src/common/fetchWclApi.ts`：WCL 请求、错误类型和 CN 环境切换。
- Vitest、Playwright、Lingui、Sentry 以及现有格式化/类型检查工具。

### 不应复用或侵入

- 不在 `CombatLogParser`、Analyzer、ReportContext 中实现攻略领域。
- 不把攻略主观结论写进基础 Spell/NPC 表。
- 不把 Dungeon 页面状态全部放入全局 Redux。
- 不将 Threechest 的 reducer、编辑器、协作、MDT 导入导出、WCL 路线匹配代码搬入本项目。

### Threechest 可借鉴的抽象

- Pull 引用具体 spawn，而不是只引用 NPC 类型。
- Pull 列表与地图高亮双向联动。
- Enemy forces 和累计进度由基础数据推导，而不是人工重复填写。
- 地图坐标转换独立封装。
- 版本化发布清单与“数据不完整时拒绝发布”的思想。

但 Threechest 当前是编辑器中心架构，使用 React 18、Leaflet、Redux undo/persist、协作和 MDT 数据；它的 `enemyIndex-spawnIndex` 标识、单一平面假设、类型强转和 S1 数据都不适合作为 WoWAnalyzerCN 的长期领域模型。

## 建议的双样本验证

选择 **Ruby Life Pools / 红玉新生法池** 作为完整工程垂直切片，原因是：

- 是回归副本，地图和机制资料相对容易交叉验证。
- 线性与开放区域并存，可验证地图、楼层/区域和 Pull 学习模型。
- 小怪、Boss、角色职责和高危技能足够丰富，能暴露 Schema 缺口。
- 用户对副本可能有历史印象，便于验证“旧记忆与 S2 改动提示”。

RLP 可能让回归玩家依靠旧记忆取得虚高测试成绩，因此同时用全新 S2 副本 **Altar of Fangs** 做 3 个高危 Situation + 1 个 Boss 的学习样本。两者都验证即时/延迟主动回忆后，才扩到八本。

知识以稳定 Situation（区域/地标/怪物组合/危险模式）为主键，Route Pull 只引用、合并或拆分这些场景；“第 7 波”不再是学习进度和攻略的身份。

垂直切片不是先做一个空壳页面，而是完整跑通：数据注册、地图、默认学习路线、场景讲解、怪物技能、Boss、角色/能力建议、自测、进度、校验与测试。

## 决策门

在进入实现前，以下条件必须满足：

- 本地开发固定使用配置化 Threechest Remote Dev Provider；生产图片未确认时接受占位图。
- Ruby Life Pools 的 S2 spawn、forces、技能与 Boss 机制至少经过两类来源交叉校验。
- 内容负责人接受本文档定义的攻略模板和审校流程。
- 已指定第二审校者；如果只有单人维护，新内容只能到 draft，不能标 published。
- Phase 1 只读范围锁定，不临时加入 Route Editor、社区或完整 WCL 复盘。
