# 内容维护、测试与运营计划

## 1. 为什么内容运维是核心系统

此模块的长期成本主要来自知识更新，而不是 React 页面。攻略必须像代码一样有 ID、版本、来源、校验、review 和 stale 状态，否则精美页面会快速变成过期信息的放大器。

## 2. Knowledge Authoring 模板

### 2.0 10 分钟 Quickstart（实施时必须交付）

计划提供可复制命令，实际参数在 Phase 0 以 mini fixture 验证后冻结：

```bash
pnpm dungeon:new dungeon --season midnight-s2 --slug example-dungeon
pnpm dungeon:add enemy --dungeon example-dungeon
pnpm dungeon:add ability --dungeon example-dungeon
pnpm dungeon:add situation --dungeon example-dungeon
pnpm dungeon:add boss --dungeon example-dungeon
pnpm dungeon:add route-step --dungeon example-dungeon
pnpm dungeon:check --dungeon example-dungeon
pnpm start
```

Scaffold 写入 TODO、稳定 ID、provenance 占位和最小合法结构，不修改 generated 文件。未提供 `--npc-id` / `--spell-id` 时保持缺省并输出 source-gate warning，不写入 `1` 这类伪造占位数字；新草稿的空间和 forces 状态默认为 `pending`。Quickstart 包含目录图、术语表、成功输出、五类真实失败和 Inspector 链接。

### 2.1 新增一只怪

1. 从已批准的数据来源确认 NPC ID、英文名和出现副本。
2. 确认所有 spawn、floor、坐标、group/patrol，并运行生成器。
3. 确认 enemy forces 和事实能力；不要凭 tooltip 猜测实际可打断/驱散状态。
4. 检查 `CN_MAPPING`；缺失时按现有项目规范增加中文名或记录 fallback warning。
5. 为会改变决策的技能创建 `AbilityKnowledge`：
   - 严重度和是否 decision-critical。
   - 玩家动作。
   - 漏处理后果。
   - 角色差异。
   - 一句话记忆（仅高危）。
   - 来源、适用 patch、验证时间。
6. 将怪物知识归入一个或多个稳定 Situation；需要路线展示时，再把 spawn 加入具体 Pull。
7. 在 Situation 中解释组合风险，在 Pull rationale 中只解释这条路线为何这样组织。
8. 运行 validate/report，检查未知引用、缺失知识和重复 spawn。
9. 本地打开 debug inspector 核对位置、ID、反向引用。
10. 第二位审校者检查“事实正确”和“动作可执行”，再进入 reviewed。

知识应优先归入稳定 Situation（区域/地标/怪物组合/危险模式），再由具体路线 Pull 引用。不要以“第 7 波”作为攻略实体名；路线重排、合并或拆分后，学习记录和知识引用仍应有效。

### 2.2 新增一个技能

```text
确认 Spell ID/施法者
→ 记录客观事实
→ 判断是否影响决策
→ 定义动作与后果
→ 关联出现 Situation/Boss，并由路线步骤反向引用
→ 写来源与版本
→ 角色审校
→ 校验 tooltip/fallback
```

不要仅因为怪物拥有技能就写攻略；reference-only 能力留在事实层或完整查询页。

### 2.3 新增一个路线步骤 / Pull

这一步维护的是“学习路线如何经过知识场景”，不是创建新的攻略身份。Situation 先于 Pull 存在；路线重排不得造成学习进度丢失。

- 使用 stable spawn ID 列表。
- 填写路线意图和“为什么这样拉”。
- 选择 3～5 个 decision-critical knowledge 引用。
- 写一句话记忆，不重复技能全文。
- 如果跨 floor/事件，使用 `TransitionStep` 或 `EventStep` 表达。
- forces 和怪物组成必须由 resolver 推导。
- 任何 skip、隐身、职业要求写入 requirements/caveat。
- 引用一个或多个 Situation，并声明 `coverage: full|partial`；merge/split 由引用关系推导。

## 3. 新赛季更新 Runbook

```text
1. 创建/更新 Season manifest，状态先设 PTR
2. 获取已批准 source snapshot，记录 hash/version
3. 运行 importer/normalizer
4. 查看 raw diff：spawn、forces、skills、boss、floors
5. 运行 dungeon:generate 与聚合门 dungeon:check
6. 处理 missing CN 与 invalid references
7. 为每本选择 learning/pug-safe route
8. 生成 knowledge coverage report
9. 迁移仍有效的 knowledge，过期内容标 stale
10. 编写/审校新 Situation、路线步骤、技能、Boss 和 checkpoint
11. 地图 QA 与多 floor QA
12. 用户任务测试
13. 全套 tests/build/e2e
14. 资源/license manifest 签核
15. Season status 切 live，发布 manifest
```

热修流程缩短为：获取变更 → raw diff → 标记受影响 knowledge → 定向审校 → tests → 发布 revision。不要重新生成后静默覆盖人工知识。

### 3.1 热修与回滚命令契约

实施时提供以下可重复流程：

```text
dungeon:impact <snapshot>
→ 输出受影响 Enemy/Ability/Situation/RouteStep/Checkpoint
dungeon:status stale <knowledge IDs>
→ 先撤回不可靠建议，事实仍可读
dungeon:check --affected
→ 只验证影响范围 + 全局引用
dungeon:preview --dungeon <slug>
→ 审校
dungeon:publish --input <draft.json> --revision <n>
→ 通过完整度/来源门禁后原子写入显式 release manifest
dungeon:rollback
→ 恢复 release manifest 的 previousRevision
```

Importer 支持 `--dry-run`、幂等重跑和中断恢复；禁止生成失败后留下半更新 current 指针。版权/错误 P0 必须能通过小型 catalog/manifest 变更或快速回滚下线，不依赖人工编辑大量内容。

## 4. 内容 Review Checklist

### 事实

- [ ] NPC/Spell/Boss/Encounter ID 正确。
- [ ] spawn/floor/forces 与当前版本一致。
- [ ] 打断、硬控、驱散、免疫事实经过验证。
- [ ] 中文 fallback 不产生误导。

### 教学

- [ ] 每个高危 Situation 解释危险因果；路线 Pull 另外解释“为什么这样拉”。
- [ ] Critical 技能包含动作和漏处理后果。
- [ ] Critical Situation 名称脱离 Pull 编号仍可被玩家识别。
- [ ] 默认没有展示无关技能。
- [ ] 一句话记忆可复述，不是百科摘要。
- [ ] 角色建议没有隐藏团队通用责任。
- [ ] 能力建议使用“可解诅咒者/有进攻驱散者”等真实能力，不把责任错误绑定到角色。
- [ ] 自测考行动决策，不考冷知识。

### 可信度

- [ ] provenance、patch、verifiedAt 完整。
- [ ] 路线适用层级/能力/风险明确。
- [ ] 草稿和已审校内容状态准确。
- [ ] 没有复制第三方攻略文字或图片。

## 5. 测试金字塔

### 5.1 Data/Contract Tests

- Schema version 与 migration。
- 重复 ID、非法 ID、未知引用。
- stable spawn ID 在输入重排后不变。
- identity reconciliation 对来源漂移/更换输出 exact/auto-match/ambiguous/new/removed；ambiguous 阻断。
- coordinate bounds 和 floor transition。
- route spawn 唯一性、forces 及累计值。
- RouteStep 联合类型：跨 floor 必有 TransitionStep，事件不伪装成 Pull。
- Ability knowledge 按 caster/context 隔离，相同 Spell ID 不被错误合并。
- decision-critical knowledge 完整度。
- Boss order/phases。
- provenance/version/stale 规则。
- production asset provider 门禁。
- per-dungeon generated manifest/chunk 注册。

### 5.2 Unit Tests

- coordinate transform：源边界→normalized→screen 与 inverse。
- Pull derivation：怪物计数、forces、累计、技能去重/排序。
- knowledge resolver：名称 fallback、角色高亮、缺失知识、过期状态。
- situation/route resolver：Pull 合并/拆分后知识和进度仍绑定稳定 Situation。
- mechanic visual mapping：每个 action type 有 label/icon/token。
- progress revision：知识变更只失效相关节点。
- URL parser：非法 dungeon/situation/route step/floor/role 使用 canonical replace。
- asset provider：dev/prod/placeholder 行为。
- ProgressStorage：损坏 JSON、旧 schema、quota/禁用和内存降级。

### 5.3 Component/Integration Tests

- Dungeon list 显示真实完成度和缺图状态。
- Overview 关键内容和开始/继续 CTA。
- Pull 切换更新内容与地图，不丢焦点。
- 角色过滤只高亮/折叠，不隐藏通用动作。
- Enemy 搜索、机制筛选、空状态。
- Ability tooltip 失败 fallback。
- Boss 章节和自测链接。
- localStorage progress 恢复和版本失效。
- stale/partial/loading/error 状态。

### 5.4 Playwright Critical Journey

```text
/dungeons
→ 选择已 reviewed 的 Ruby Life Pools（未完成副本不可进入）
→ 阅读速览并切换 Healer
→ 开始学习
→ 跳到高危 Pull
→ 地图定位并选择 Enemy
→ 打开 Ability tooltip
→ 标记薄弱项
→ 完成 checkpoint 并答错一题
→ 跳回相关 Pull
→ 查看只读路线/floor
→ 查看 Boss
→ 刷新并恢复进度
```

再增加：移动 viewport、键盘 journey、地图 404、非法深链和 production remote-dev guard。

## 6. 性能基准

在 Phase 0/2 记录可重复基线：

- `/dungeons` JS/data 增量大小。
- 进入一个副本的独立 chunk 和 raw/knowledge gzip 大小。
- 地图图片首屏字节数和缓存策略。
- RLP 最大 floor 的 SVG 节点数、首次渲染、切 Pull 时间。
- 搜索/筛选 95th percentile 响应。

建议预算作为初始警戒线，而非拍脑袋验收：

- season manifest < 30KB gzip。
- 单本 raw + knowledge < 250KB gzip（不含图片）。
- `/dungeons` 不预取八本完整 chunk。
- 切 Pull 的主线程交互目标 < 100ms。

如果超标先测量数据重复和渲染范围，再决定拆 chunk/Canvas；不要先引入复杂技术。

## 6.1 维护体验与 TTHW 目标

工具摩擦和内容创作时间分开记录：scaffold、编辑、校验修复、审校等待、发布。

| 任务                                      |                      目标 |
| ----------------------------------------- | ------------------------: |
| 跑通 mini fixture                         |                  ≤ 5 分钟 |
| 修改已有攻略并通过 check                  |                 ≤ 10 分钟 |
| 新增怪物 + 关键技能 + 首个 Pull/Situation |                 ≤ 30 分钟 |
| 从 approved snapshot 创建新副本骨架       |                 ≤ 45 分钟 |
| P1 热修确认影响到发布 revision            | ≤ 30 分钟（不含审校等待） |

Phase 1B 实测并校准；完整攻略撰写和第二人审校不混入工具 TTHW。

## 7. 可观测与反馈

### 技术信号

- data/chunk/asset/tooltip 加载失败率。
- 非法深链恢复次数。
- stale knowledge 被访问次数。
- local progress 写入失败。
- 每本 bundle 与地图资源体积趋势。

### 产品信号

- 开始学习、完成关键节点、完成 checkpoint、复习薄弱项。
- 从 Overview 直接跳 Enemy DB 的比例（过高可能表示速览不足）。
- 每条内容的“过期/错误/不清楚”反馈。
- 角色分布和高频复习 Pull。
- 即时无提示回忆率、次日延迟回忆率；新玩家/回归玩家分组。
- 与长文/视频对照任务的记忆效果和总耗时。

不记录用户输入的私密 WCL URL、自测具体答案历史或可识别个人信息，除非未来有明确隐私设计。

## 8. 内容错误响应

严重度：

- P0：会导致错误路线/错误动作、版权资源误发布。立即下线相关 knowledge/asset。
- P1：关键技能、forces、Boss 机制过期。目标 24 小时内标 stale 并修复。
- P2：中文、措辞、次要角色建议。进入正常内容迭代。

错误修复应更新 knowledge revision、verifiedAt 和 changelog；关联进度只失效受影响节点。

## 9. Definition of Done

一个副本只有同时满足以下条件才显示 `published`：

- Raw、地图资源、Route、关键技能、Boss、中文 fallback 校验通过。
- 所有 critical Pull 有 rationale、动作、后果、记忆句。
- 关键内容经过第二人审校并有版本来源。
- 全部 critical journey 测试通过。
- 没有 dev/未授权资源进入产物。
- 完成桌面、移动、键盘、缺图和 stale QA。
- owner、更新时间与反馈入口明确。

单人维护模式只能将新内容推进到 `draft`；可以单人立即把错误内容标 stale/下线。恢复 `published` 必须由已登记的第二审校者确认。
