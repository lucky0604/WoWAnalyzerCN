# Phase 25：WCL 多 fight report 的显式单 fight scope

日期：2026-08-11

分支：`codex/dungeon-learning`

## 目标

让常见的 WCL 完整 report 可以安全进入 Phase 24，而不把全报告 `enemies` roster 与某一
场 events 错误拼接。scope 必须由维护者显式指定 `fight-id`，适配器只做可验证的裁剪，
不根据副本名称、NPC 名称、事件数量或数组顺序猜测目标战斗。

## 输入合同

- `--fight-id` 必须是正整数，且存在于 `report.fights[].id`。
- 目标 fight 必须有有限的 `start_time/end_time`，且结束时间不早于开始时间。
- 所有可选 fight 的时间范围都必须互不重叠，边界相等也视为歧义并阻断；仅凭 timestamp
  不能安全拆分重叠战斗。
- 多 fight report 的每个 `enemies[]` 必须包含 actor 级 `fights[]` 归属；只保留归属于目标
  fight 的 actor。缺少归属时返回 `WCL_FACT_ENEMY_SCOPE_UNAVAILABLE`，不采用全局 roster。
- 事件 envelope 先通过 Phase 24 的分页门禁；适配器只保留实际参与施法提取的事件，必须
  有有限 `timestamp`，并按 `[start_time, end_time]` 闭区间过滤。damage/heal 等非施法事件
  在 scope 阶段直接丢弃，不会复制到下一步或影响事实快照。
- 不传 `--fight-id` 时，多 fight report 返回 `WCL_FACT_FIGHT_SCOPE_REQUIRED`；单 fight、
  缺省或空 fights 输入保持 Phase 24 行为。

## 实现

- `buildWclFactSnapshot` 增加可选 `fightId`，在 enemy/event 分组前执行 scope。
- `pnpm dungeon:fact-from-wcl --fight-id=<id>` 将 scope 选择写入默认 snapshot ID，避免
  同一 report 的不同战斗复用同一 draft 标识；生成的 FactSnapshot 也保留可选 `fightId`，
  并纳入 canonical digest，覆盖自定义 `--snapshot-id` 场景。
- scope 结果只进入新的 draft FactSnapshot，不修改原始 JSON、catalog、bindings 或文档。
- 没有新增 NPC、Spell、forces、路线或攻略内容；forces 仍由独立快照提供。

## 验收

- 未指定 fight-id 的多 fight 输入 fail-closed。
- 指定有效 fight-id 时只输出目标 fight 的 actor、施法事件和稳定 digest。
- 不存在的 fight、非法时间范围、缺少 actor fights、缺少施法 timestamp 均返回稳定诊断。
- CLI、runtime、Phase 21–24 相关测试、typecheck、`dungeon:check` 和 dist guard 通过。

## 下一步

将实际当前 build 的单 fight WCL draft 交给 `fact-binding-plan`，由维护者人工确认 source
Enemy/Ability 到 WoWAnalyzerCN 实体的映射；scope 不改变人工批准边界，也不代表事实已达到
正式发布门禁。
