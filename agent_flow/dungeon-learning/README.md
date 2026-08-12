# WoWAnalyzerCN 大秘境学习模块规划索引

> 状态：方案已确认，开发分支已完成 Phase 0、Phase 1A 预览、Phase 2 的地图/查询/只读 Route 与 Boss 页面，以及 Phase 3 的主动回忆薄弱项反馈；S2 八本只读坐标参考已接入，但正式攻略内容仍按副本逐本建设，Phase 1B 尚未宣称完成。
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
- [14-phase5-wcl-navigation-review.md](./14-phase5-wcl-navigation-review.md)：WCL 与学习双向导航、动态加载和生产路由 flag 的实现 Review。
- [15-rlp-s2-coordinate-import-review.md](./15-rlp-s2-coordinate-import-review.md)：RLP 当前 S2 PTR 坐标快照、来源 hash、字段白名单与门禁 Review。
- [16-learning-wave-context-review.md](./16-learning-wave-context-review.md)：学习课节与波次上下文、锚点/forces 门禁、多路线配对与代码 Review。
- [17-learning-wave-context-browser-qa.md](./17-learning-wave-context-browser-qa.md)：桌面/移动浏览器 smoke、主动回忆和只读 Route 深链证据。
- [18-s2-fact-and-asset-preflight.md](./18-s2-fact-and-asset-preflight.md)：S2 坐标、NPC/Spell/forces 事实与 Threechest 远程图片的预检和替换契约。
- [19-s2-coordinate-expansion-review.md](./19-s2-coordinate-expansion-review.md)：S2 八本坐标快照、stable SpawnId、来源 hash 与对抗性 Review 证据。
- [20-content-readiness-phase.md](./20-content-readiness-phase.md)：S2 六道内容就绪门、正式深链授权与缺口报告的实现证据。
- [21-fact-snapshot-preflight-phase.md](./21-fact-snapshot-preflight-phase.md)：NPC/Spell/forces 事实快照合同、canonical digest 与 release 预检 CLI。
- [22-fact-binding-phase.md](./22-fact-binding-phase.md)：事实快照到自有 Enemy/Ability 的显式 mapping、draft 生成、forces 重算与 release 覆盖门禁。
- [23-fact-binding-plan-phase.md](./23-fact-binding-plan-phase.md)：事实绑定候选审计、歧义报告与不自动采纳的 manifest 模板。
- [24-wcl-fact-snapshot-phase.md](./24-wcl-fact-snapshot-phase.md)：WCL report/events 只读归一化为 FactSnapshot draft，明确不派生 forces/路线。
- [25-wcl-fight-scope-phase.md](./25-wcl-fight-scope-phase.md)：多 fight WCL report 的显式单 fight 裁剪与 fail-closed 合同。
- [26-wcl-api-capture-phase.md](./26-wcl-api-capture-phase.md)：配置化 WCL API 抓取、分页汇总与 FactSnapshot 草稿生成。
- [27-fact-binding-decision-phase.md](./27-fact-binding-decision-phase.md)：人工映射决策文件、候选采纳边界与安全 manifest 生成。
- [28-fact-binding-intake-phase.md](./28-fact-binding-intake-phase.md)：从候选计划生成不可直接消费的人工决策模板，降低真实快照接入时的漏项风险。
- [29-wcl-encounter-identity-phase.md](./29-wcl-encounter-identity-phase.md)：绑定 WCL S2 zone/encounter identity，让报告侧可以保守识别八本副本。
- [30-wcl-fact-intake-bundle-phase.md](./30-wcl-fact-intake-bundle-phase.md)：把当前 build 的 WCL 抓取、事实快照、候选计划和人工 TODO 模板原子整理为可审阅 bundle。
- [31-learning-progress-hardening-phase.md](./31-learning-progress-hardening-phase.md)：加固浏览器学习进度的本地存储合同、部分恢复和 fail-closed 行为。
- [32-readiness-and-intake-contract-phase.md](./32-readiness-and-intake-contract-phase.md)：让正式学习 coverage 只认 learning route，并加固 WCL intake runtime options 的 fail-closed 合同。
- [33-release-artifact-identity-phase.md](./33-release-artifact-identity-phase.md)：把事实快照/绑定 manifest 与坐标快照/identity sidecar 绑定到 DungeonDocument，阻断同 build 手工事实和空间快照错配。
- [34-stale-ledger-runtime-gate-phase.md](./34-stale-ledger-runtime-gate-phase.md)：让 `dungeon:status stale` 的知识过期标记进入运行时学习门禁，并对损坏 ledger fail-closed。

## 当前代码审计摘要

## 当前实现进度

- `/dungeons` 已展示官方 Midnight S2 八本覆盖路线；建设中副本只能显示建设状态，不能进入空壳学习页。
- `/dungeons` 与 `pnpm dungeon:report` 共用六道内容就绪门；目录只展示 `coordinate-only`、`learning-preview` 或阻断原因，不把坐标、fixture 或旧 build 事实伪装成正式攻略。
- 六道门与正式深链共用 `getDungeonScopedLearningAccess`；forces 只有在 committed registry 的 digest、当前 build、enemy→forces payload 和 Pull 推导全部匹配时才可放行，当前仍没有虚构的 S2 forces 快照。
- 当前 S2 轮换来源记录在 `season2RotationSource`，以 Blizzard 公告为目录事实来源；Threechest 克隆里的旧 8 本不再标记为 S2。
- Threechest 坐标快照位于 `src/dungeon/data/coordinates/**`，采用 `threechest-yx → normalized-v1`；旧库存继续作为独立的 `legacyThreechestCoordinateInventory` 保留，S2 八本通过显式 snapshot/key 和 committed identity sidecar 接入，不与 legacy source key 混用。
- 本地开发可从 `/dungeons/legacy/:sourceKey` 打开明确标注为 `DEV ONLY · LEGACY COORDINATE QA` 的只读页面，验证 Threechest 瓦片 manifest、坐标转换和 spawn 层；该 route 在 production 不注册，也不提供路线编辑。
- 当前 S2 条目只有在显式配置 `coordinateSnapshotId` 后才会开放位置参考；八本均已接入固定到 Threechest `origin/ptr` 提交的 S2 PTR 坐标快照，并通过独立 `s2-*` source/identity key 隔离 legacy 库，不会用旧副本数据替代。
- RLP 本地学习预览已将 166 个稳定 SpawnId 接入独立的只读位置参考平面，其它七本也已接入只读坐标层（合计 1,220 个位置）；未绑定 NPC 仅显示数字占位符，空间层不会推导 forces、技能或路线事实，sidecar 漂移时 fail-closed。可用的巡逻点会以独立折线呈现，仍不代表路线决策。
- `dungeon:check` 对每个坐标快照校验规范化 payload digest、字段白名单、source approval 与 identity sidecar digest；legacy aggregate 也改为基于规范化 payload digest。坐标 JSON 随大秘境路由懒加载，当前 dungeon chunk 约 506.5KB raw / 62.6KB gzip（新增数据约 447KB raw），作为本 Phase 的已知预算记录。
- 其它七本目前只开放只读坐标参考（共 1,220 个来源 spawn），不自动生成 Enemy、forces、技能、波次或学习路线；identity registry 与 snapshot 不匹配时统一 fail-closed。
- RLP 的 source NPC、Situation 锚点和 snapshot 绑定已外置到版本化 `src/dungeon/data/coordinates/rlp.bindings.json`，后续赛季可替换数据 manifest，不需要修改空间预览代码。
- `/dungeons/:dungeonId/reference` 仅展示位置、组别、巡逻和快照审计信息，不展示未经批准的 forces、技能或路线事实。
- 正式学习页目前通过本地预览展示 RLP 的来源化内容草稿；空间数据 pending、forces pending 或缺失 Spell ID 都会保留为 warning，并在 reviewed/published 时强制阻断。Altar fixture 仍仅用于数据合同回归。
- Inspector、只读 Route 和只读 Boss 学习页已建立互相可达的深链；Route/Boss 页面只解释已有知识，不提供编辑、导入或保存路线的操作。
- Phase 1B 已加入内容完整度报告：分别审计 Enemy 事实引用、Situation/Route/Boss 学习表面、无上下文 Pull 和空 Boss 技能卡；正式状态会将缺口升级为 release error。
- formal review 还必须记录作者自测（学习模式、全部 Situation/Route 覆盖和完成时间），不能只填写作者/第二审校者姓名。
- formal review 还必须记录作者工时：整本副本总分钟数，以及每个 `routine`/`critical` Situation 的分钟数；这些数据用于校准后续八本扩展成本，不进入玩家进度。
- 学习页已完成“先选把握程度、再揭示答案”的主动回忆约束，并显示已回忆/模糊/不会/待复习汇总；进度写入失败时会明确提示，不把内存状态伪装成已持久化。
- 学习入口统一经过 `getDungeonScopedLearningAccess`：draft 只能显示为本地预览，正式学习、Route、Boss 和 WCL 深链必须同时通过目录状态、文档校验和六道内容门；fixture、stale、来源未批准或正式校验失败的文档不能渲染学习课件。
- 内容维护 quickstart 已提供 `dungeon:new` / `dungeon:add` / `dungeon:check --dungeon`，草稿不会自动进入 runtime registry。
- `dungeon:impact`、`dungeon:status stale`、`dungeon:preview`、`dungeon:publish`、`dungeon:rollback` 已提供显式 release/stale ledger 流程；publish 只写 release manifest，不自动注册页面。
- `pnpm dungeon:check-dist` 是发布前的 remote-dev/Threechest 产物扫描门禁。
- `pnpm dungeon:fact-check --input=<file>` 提供事实快照的只读结构、目录、build、来源与 canonical digest 预检；当前没有因此新增或猜测 S2 NPC、Spell 或 forces 数据。
- `pnpm dungeon:fact-bind --snapshot=<file> --bindings=<file> --document=<file> --out=<file>` 将已预检事实绑定到新的 authoring draft；不覆盖来源、不发布、不自动生成路线或攻略结论。
- `pnpm dungeon:fact-binding-plan --snapshot=<file> --document=<file> --out=<file>` 只生成候选映射审计和空 manifest 模板；候选不会自动写入绑定文件。
- `pnpm dungeon:fact-binding-decisions-template --plan=<file> --out=<file> --reviewer=<name> --reviewed-at=<UTC ISO>` 从候选计划生成带完整 identity/sourceKey 的人工决策模板；模板中的 `TODO` 不是合法决策，必须逐行改成 `accept`、`reject` 或 `override` 后才能进入 manifest 流程。已有输出必须显式传 `--force` 才会替换。
- `pnpm dungeon:fact-binding-manifest --plan=<file> --decisions=<file> --out=<file>` 只把维护者明确记录的 accept/override 决策生成 binding manifest；缺失、歧义或 reject 不会被静默采纳。
- `pnpm dungeon:fact-from-wcl --report=<file> --events=<file> --dungeon=<id> --build=<build> --out=<file>` 将用户提供的 WCL 导出转换为 draft FactSnapshot；不生成 forces、路线或攻略结论。
- `pnpm dungeon:fact-from-wcl-api --api-base=<url> --report-code=<code> --dungeon=<id> --build=<build> --out=<file>` 从配置化 WCL 服务抓取 report/events 后复用同一 draft 适配器；分页、fight scope 或服务响应异常会 fail-closed。
- `pnpm dungeon:fact-intake --api-base=<url> --report-code=<code> --dungeon=<id> --build=<build> --out-dir=<dir>` 将一次当前 build WCL 抓取原子整理为 snapshot-only bundle；额外提供 `--document`、`--reviewer` 和 `--reviewed-at` 才会生成候选计划与不可消费的 TODO 决策模板，不会自动绑定或发布。
- 学习进度只接受合法的版本、角色、置信度、UTC 时间和内容指纹；损坏的 localStorage 记录按条丢弃，不会阻断学习页面，也不会把未确认的对象写回浏览器存储。
- 正式 `learning-surfaces` 门只按 `intent=learning` 路线计算覆盖；pug-safe/custom-reference 路线仍可查询，但不能替代教学路线满足发布门。
- 正式文档现在必须携带可重算的 `factBinding` 与坐标 `coordinateBinding` identity；事实门要求 Enemy/Ability provenance 指向同一 snapshot，发布会重新校验 manifest digest 与坐标来源 hash。
- `src/dungeon/data/authoring/stale.json` 是构建时 stale ledger；`dungeon:status stale` 默认写入该文件，runtime 会对命中的 Enemy/Ability/Situation/Boss/Route/RouteStep 统一阻断，ledger 损坏或未知 ID 会在 `dungeon:check` 失败。
- `validateDungeonDocument` 在 reviewed/published 状态下与 `dungeon:publish` 复用 learning-route 覆盖口径；正式内容至少需要一条包含 Pull 的 learning 路线。`dungeon:report` 同时输出带 `routeIntent=all` 标记的兼容 coverage 与独立 `learningCoverage`。
- 多 fight WCL report 可额外传 `--fight-id=<id>`，只按可验证的 fight 时间和 actor 归属裁剪；不传时拒绝把全局 roster 与单场 events 拼接。
- WCL 前置导航已接入：正式副本可从 Inspector 进入现有 report selector；正式报告识别到已发布副本后才显示学习深链。报告侧通过 dynamic import 加载 Dungeon adapter，默认不会影响 parser/analysis 初始路径。
- S2 目录已绑定 WCL live zone 55/PTR zone 56 及八组 live/PTR encounter ID；规范化 identity evidence 与 digest 位于 `src/dungeon/data/wcl/season2.identity.json`，报告侧优先使用 encounter ID，显式 zone 冲突、Boss/originalBoss 冲突和歧义标题均 fail-closed，只有未带 encounter ID 且 report zone 未冲突时才使用标题回退，避免把多区域/团本报告的复制标题误识别为副本。
- 生产/preview 路由必须显式设置 `VITE_DUNGEON_ROUTES=true`；Threechest legacy 坐标 QA 路由永远只在 DEV 注册。图片 provider 仍需单独切换为 OSS 或 placeholder。

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
