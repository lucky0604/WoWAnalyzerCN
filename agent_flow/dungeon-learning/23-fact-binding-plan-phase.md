# Phase 23：事实绑定候选审计与 manifest 模板

## 目标

在拿到真实、可审计的当前 build 事实快照后，降低逐本维护 `FactBindingManifest` 的成本，同时保持“来源事实 → 自有实体”的人工确认边界。本阶段不提交任何 S2 NPC、Spell 或 forces 数值，也不自动接受候选映射。

## 设计决定

1. `fact-binding-plan` 先独立校验 snapshot 和 authoring document，再输出候选；digest、build、目录或文档结构失败时不生成 plan。
2. Enemy 候选只依据精确 `npcId`，并额外报告 `isBoss` 是否一致；不按中文名、数组顺序或坐标猜测。
3. Ability 候选只依据精确 `spellId`，并报告来源 caster NPC 集合与文档 caster 集合是否一致；多个候选或 caster 不一致都不能标为可直接采纳。
4. 生成的 `manifestTemplate` 始终保持空的 `enemies`/`abilities` 数组。候选只是审计建议，维护者必须人工复制确认后的行，再运行 Phase 22 的 `fact-bind`。
5. plan 是新的、可删除的审计产物，不写 runtime registry、catalog status、release manifest 或 DungeonDocument。

## 交付物

- `src/dungeon/runtime/factBindingPlan.ts`：候选计算、歧义状态、覆盖统计和空 manifest 模板。
- `scripts/dungeons/fact-binding-plan.ts`：本地/CI JSON plan CLI，带输入别名保护和原子输出。
- 对精确 NPC/Spell、Boss 类型冲突、重复候选、caster mismatch、digest 篡改和 CLI 失败路径的测试。

## 使用方式

```bash
pnpm dungeon:fact-binding-plan \
  --snapshot=./incoming/facts.json \
  --document=src/dungeon/data/authoring/ruby-life-pools.json \
  --out=./incoming/ruby-life-pools.binding-plan.json \
  --json
```

`binding-plan.json` 中的 `enemies`/`abilities` 行包含 `candidates`、`reasons` 和 `status`。只有人工确认后，才把行写入独立的 bindings JSON，再执行：

```bash
pnpm dungeon:fact-bind \
  --snapshot=./incoming/facts.json \
  --bindings=./incoming/ruby-life-pools.bindings.json \
  --document=src/dungeon/data/authoring/ruby-life-pools.json \
  --out=./incoming/ruby-life-pools.bound-draft.json \
  --json
```

## 明确不在本 Phase

- 不把唯一候选自动写成 accepted binding。
- 不从候选推断 Pull、forces、技能动作、Situation 或路线。
- 不把候选报告当作发布批准，也不改变现有运行时页面。
- 不解决图片资源来源或生产 OSS 签核。

## 验收与下一步

验收重点是：同一输入稳定生成相同候选；NPC/Spell ID 缺失、重复或 caster 不一致时明确进入人工复核；输出模板为空且不会改变输入。下一步是在获得真实快照后，为 S2 副本逐本人工确认 bindings，再进入事实交叉核验和学习文案审校。
