# Phase 28：事实绑定人工 intake 模板

日期：2026-08-11

分支：`codex/dungeon-learning`

## 背景

Phase 26/27 已经可以把真实 WCL 数据转成 FactSnapshot、生成候选绑定计划并消费人工决策。
但维护者仍需要手工复制 plan identity、逐行抄 sourceKey，实际接入第一份真实快照时容易漏行、
误用旧 plan 或把空 manifest 当作“已处理”。本阶段只改善 intake，不创建任何游戏事实。

## 目标与边界

- 从已通过严格校验的候选计划生成一份可编辑的 decisions 模板。
- 模板自动带出 `planDigest`、snapshot/document identity、reviewer、reviewedAt 和全部 Enemy/Ability sourceKey。
- 每一行初始为 `decision: "TODO"` 且 `reason` 为空；`TODO` 不是合法决策值，因此模板不能直接被 manifest CLI 消费。改成 `reject` 或 `override` 时必须补充真实理由。
- 不猜测 NPC、Spell、Boss 身份，不自动采纳候选，不生成 forces、路线或攻略文案。
- 不修改 parser、analysis、ReportContext 或现有副本运行时内容。

## CLI

```bash
pnpm dungeon:fact-binding-decisions-template \
  --plan=./tmp/ruby-life-pools.plan.json \
  --out=./tmp/ruby-life-pools.decisions.template.json \
  --reviewer=content-owner \
  --reviewed-at=2026-08-11T12:00:00.000Z \
  --json
```

输出文件只是一份人工工作底稿。维护者应：

1. 对照 plan 中的 candidates 和 reasons 逐行确认；
2. 将 `TODO` 改为 `accept`、`reject` 或 `override`；
3. `accept` 只能用于唯一 `suggested` 候选；歧义、blocked 或非候选目标必须使用 `override` 并写理由；
4. `reject` 必须写理由；
5. 将编辑后的文件另存为正式 decisions 文件，再执行 `fact-binding-manifest`。

模板生成器会先复用 manifest 决策生成器的完整 plan digest、identity、coverage、候选状态和 schema 校验。
计划不完整、digest 不匹配或文档/快照身份不一致时不会写模板。已有输出文件默认拒绝覆盖，只有显式
`--force` 才允许替换；输入 plan 即使通过 symlink/hardlink 指向输出也会被拒绝。

## 验收

- 每个 plan sourceKey 恰好生成一行模板，Enemy/Ability 分区保持一致。
- 模板 identity 与 plan 完全一致，`TODO` 被 manifest CLI 稳定拒绝，不会产生空 binding manifest。
- 篡改 plan、错误 digest、缺失输入、输出别名和无效 reviewedAt 均返回结构化错误且不写输出。
- 新增 runtime/CLI 测试、typecheck、format、lint、`dungeon:check` 和既有 dungeon 测试通过。

## 下一步

模板工具完成后，仍需要内容负责人提供真实当前 build 的单 fight WCL report 和独立 forces 证据；本阶段不把
任何占位数据提升为正式副本知识。
