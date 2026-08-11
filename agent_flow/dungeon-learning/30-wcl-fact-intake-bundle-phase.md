# Phase 30：WCL 当前 build 事实接入 bundle

日期：2026-08-11

分支：`codex/dungeon-learning`

## 背景

Phase 24–28 已经分别提供 WCL 快照抓取、事实预检、候选绑定、人工决策和 manifest
生成 CLI。真实当前 build report 到位后，如果维护者手动串联这些命令，容易出现快照、候选计划和
决策模板的 identity 不一致，也容易误以为生成了 draft 就已经完成了内容绑定。

本阶段提供一个只负责 intake 编排的 bundle 命令，复用已有的 fail-closed runtime 合同，不改变
parser、analysis、ReportContext 或正式学习授权。它把一次 WCL 抓取整理成可审阅的目录：

```text
bundle/
  snapshot.json       # WCL 事实 draft；不包含原始 report/events
  binding-plan.json   # 候选映射审计；不自动采纳
  decisions.template.json # TODO 模板；不可直接生成 manifest
  authoring-document.json # （提供 --document 时）输入文档的只读副本
  intake.json          # 产物 identity、状态、跳过项和诊断摘要
```

## 范围

1. 新增 `dungeon:fact-intake` CLI，参数至少包括 `--api-base`、`--report-code`、`--dungeon`、
   `--build`、`--document` 和 `--out-dir`；可透传 `--fight-id`、分页/超时/大小限制。
2. 先调用现有 `captureWclFactInputs` 与 `buildWclFactSnapshot`，再调用现有
   `buildFactBindingPlan` 和 `createFactBindingDecisionTemplate`。
3. 所有输出都使用原子写入；输出目录只能是新目录或显式 `--force` 覆盖，不能与输入文件或目录
   通过 realpath、symlink 或 hardlink 重叠。
4. 默认只生成 draft；`--release` 只能让已有 release gate 继续校验，不能绕过 forces、来源、当前
   build 或目录 identity 门禁。
5. bundle 失败时不留下部分成功目录；`--json` 返回稳定的阶段、路径和 diagnostics。
   snapshot-only bundle 只写入 `snapshot.json` 与 `intake.json`，并在 `intake.json.skipped`
   中明确记录未提供文档而跳过的 plan/template；带文档的 bundle 写入五个文件。
6. `intake.json` 只保存 snapshot/plan/template 的摘要和路径，不保存 token、原始 report/events 或
   未审阅的攻略结论。

## 明确不做

- 不把 WCL 事实自动绑定到 Enemy/Ability。
- 不生成 forces、Pull 顺序、路线理由、Situation、Boss 文案或角色建议。
- 不把 bundle 注册进 runtime registry，不改变目录状态，不开放正式学习深链。
- 不把当前尚未存在的 S2 live report、NPC、Spell 或 forces 数值写入仓库。

## 退出标准

- 给定单 fight WCL API 输入，成功输出 snapshot-only 两件产物，或带文档时五件 bundle 产物；产物的 snapshot/dungeon/build/revision
  identity 一致。
- 多 fight 未传 `--fight-id`、分页不完整、report/events code 不一致或当前 build 不匹配时，
  fail-closed 且输出目录不产生半成品。
- 没有 `DungeonDocument` 时明确生成 snapshot-only bundle，并将 plan/template 标记为 skipped，
  不能伪造候选计划。
- 已有输出目录不传 `--force` 时拒绝覆盖；输入路径别名、symlink、hardlink 均拒绝。
- 新增 unit/CLI 负向测试；不修改 parser/analysis，现有 dungeon/scripts 测试、typecheck、
  `dungeon:check` 和生产构建继续通过。

## 后续

真实 report 到位后，维护者可把 bundle 交给第二审校者逐行填写 decisions；只有通过已有
`dungeon:fact-binding-manifest --complete` 才能进入事实绑定和独立 forces 审核。
