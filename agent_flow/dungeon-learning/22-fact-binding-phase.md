# Phase 22：事实快照到 authoring draft 的显式绑定

## 目标

把已经通过 Phase 21 预检的 NPC/Spell/forces 事实快照，安全地接入 WoWAnalyzerCN 自有的 `DungeonDocument` 草稿。此 Phase 只解决“来源事实如何对应到我们维护的 Enemy/Ability”的工程边界，不声称已经拥有任何真实 S2 NPC、Spell 或 forces 数据。

## 设计决定

1. **映射必须显式维护**：`FactBindingManifest` 以 source-local `enemyKey`/`abilityKey` 对应自有 `Enemy.id`/`AbilityKnowledge.id`。不按数组顺序、名称或 NPC/Spell ID 猜测映射。
2. **输入与内容分层**：事实快照只包含 ID、施法者关系和 forces 数值；攻略文案、Situation、Route 意图和 Pull 选择仍由 WoWAnalyzerCN authoring 内容维护。
3. **输出永远是新 draft**：`fact-bind` 不允许覆盖输入文档、事实快照或 mapping manifest（包括 symlink/hardlink 别名），输出 revision + 1 的 `dataStatus=draft`，清除 `review` 与 `forcesSnapshot`，forces 状态回到 `pending`，并保留事实来源 provenance。
4. **路线只重算派生值**：绑定后按现有 spawn→Enemy 关系重新计算 `expectedEnemyForcesPoints`；不会新增、排序、拆分或选择 Pull，也不会从 forces 推导攻略建议。
5. **release 仍 fail-closed**：绑定入口会再次执行事实快照完整校验；`--release` 要求事实快照已通过 approved source、当前 build、digest、目录和完整 forces 门，同时要求快照覆盖 authoring document 的全部 Enemy/Ability。缺映射只产生 draft warning，不能生成 release candidate。
6. **旧事实不向前继承**：未被当前快照提供的 NPC、Spell、forces 和总 forces 会分别清空/归零并保持 pending；路线只从当前输出重新推导，避免部分快照混入旧 build 数值。
7. **不自动发布**：绑定结果不会写入 runtime registry、catalog status、release manifest 或生产路由；后续仍需内容校验、第二审校和既有 publish 门禁。

## 交付物

- `src/dungeon/runtime/factBinding.ts`：manifest 合同、完整事实快照复验、映射诊断、provenance 注入、draft 生成和 Pull forces 重算。
- `scripts/dungeons/fact-bind.ts`：本地/CI 可复用的 JSON CLI。
- `pnpm dungeon:fact-bind`：CLI 入口。
- `factBinding.test.ts` 与 `fact-bind.test.ts`：成功、重复/未知 ID、施法者不一致、digest 篡改和 release 覆盖不足回归。

## 使用方式

```bash
pnpm dungeon:fact-bind \
  --snapshot=./incoming/facts.json \
  --bindings=./incoming/ruby-life-pools.bindings.json \
  --document=src/dungeon/data/authoring/ruby-life-pools.json \
  --out=./incoming/ruby-life-pools.bound-draft.json \
  --json
```

接入已批准的生产候选快照时额外传入 `--release --build=<目标 build>`。命令成功只表示生成了新的 draft；必须将输出人工检查、运行 `dungeon:check` 和内容审校后，才能进入后续 release 流程。

CLI 会在同目录写入临时文件并原子 rename，避免已有 draft 在进程中断时留下截断 JSON；输入路径的普通路径、symlink 和 hardlink 别名均会被拒绝。

## 明确不在本 Phase

- 不提交真实 S2 NPC、Spell、forces 数值或第三方事实文件。
- 不把 Threechest 代码、攻略文字、路线或 forces 作为事实输入。
- 不自动补齐缺失的 Enemy/Ability，不删除未映射的 authoring 文案。
- 不处理图片资源来源；图片仍由既有 provider 配置和生产替换门禁管理。

## 验收与下一步

本 Phase 的验收是绑定合同可验证、篡改 fail-closed、输出不可覆盖来源文档且保持 draft。下一步需要在获得可审计的当前 build NPC/Spell/forces 快照后，为每本 S2 副本维护 binding manifest，再进入内容事实交叉校验与学习文案审校；在此之前目录继续保持 coordinate-only/preview 状态。
