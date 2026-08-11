# Phase 27：人工事实映射决策与安全 manifest 生成

日期：2026-08-11

分支：`codex/dungeon-learning`

## 目标

把 Phase 23 生成的候选计划交给内容维护者人工确认，并以独立的决策文件生成
Phase 22 可消费的 `FactBindingManifest`。本阶段解决维护体验和审计留痕，不自动
采纳候选，不把 NPC/Spell 事实变成正式内容，也不触碰路线或 forces。

## 决策合同

- 决策文件必须绑定候选计划的 `planDigest`（覆盖候选行、status、coverage 和 metadata），以及 snapshotId、snapshot digest、副本、赛季、build、文档 revision；生成器会重新计算 planDigest，旧计划不能复用旧决策。
- 每个计划中的 Enemy/Ability sourceKey 都必须出现一条明确决策；漏填不是“暂不处理”，而是错误。
- `accept` 只能采纳唯一的 `suggested` 候选；对 ambiguous、blocked、unmapped 或非候选目标必须使用 `override` 并填写理由。
- `reject` 不生成 manifest 映射，但必须填写理由；这会保留 warning，并使 `--complete` 失败。
- 生成结果只含被明确 accept/override 的映射，输出仍是事实绑定输入，不是发布候选。
- 同一事实类型内不能把多个 sourceKey 映射到同一个文档 Enemy/Ability；跨类型 ID 不互相冲突。
- `reviewer` 和可解析的 `reviewedAt` 必须记录，决策文件本身作为审计输入保存，不写进严格的 binding manifest。

## 新增交付物

- `src/dungeon/runtime/factBindingDecisions.ts`：严格校验决策文件、计划 identity、候选采纳边界和目标冲突，生成 manifest。
- `scripts/dungeons/fact-binding-manifest.ts`：只读 plan/decisions，原子写入新的 manifest；拒绝覆盖输入文件及 hardlink/symlink 别名。
- `pnpm dungeon:fact-binding-manifest --plan=<plan.json> --decisions=<decisions.json> --out=<manifest.json>`。
- `--complete` 仅允许全部来源事实被 accept/override；不传时允许带 reject 的 draft manifest，供维护者继续补证据。

## 推荐工作流

```text
fact-from-wcl-api
→ fact-check
→ fact-binding-plan
→ 人工填写 decisions.json（accept / reject / override）
→ fact-binding-manifest
→ fact-bind（仍只生成新的 draft）
→ forces 独立快照、内容审校、第二人复核
```

候选计划和决策文件可以包含真实来源 ID，但本阶段不把真实 WCL 输入、NPC、Spell 或 forces 数值提交到仓库。

## 验收

- suggested 候选可明确 accept；ambiguous 候选不能被静默 accept。
- reject、缺少 sourceKey、跨计划 identity、重复目标和错误 override 均有稳定诊断，且不写输出。
- 生成的 manifest 可继续被现有 `fact-bind` 复验；`--complete` 不能把 reject 伪装成完整快照。
- 相关 runtime/CLI 测试、typecheck、format、lint 和 `dungeon:check` 通过。

## 不在本阶段

- 不抓取或提交新的真实 report。
- 不自动根据 NPC/Spell 名称、数组顺序或坐标猜测映射。
- 不生成 forces、Pull 顺序、路线理由、技能动作或学习文案。
- 不改变浏览器端正式学习门禁；未完成事实与内容审校的副本继续保持 coordinate-only/preview。

## 下一步

由内容负责人提供当前 live build 的单 fight WCL report，生成第一份真实 draft；随后逐本人工映射，取得独立 forces 证据，并进入 Enemy/Ability/Situation/Route/Boss 的内容审校。
