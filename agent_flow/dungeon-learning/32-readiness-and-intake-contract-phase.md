# Phase 32：正式学习门禁与事实接入合同加固

日期：2026-08-11

分支：`codex/dungeon-learning`

## 背景

Phase 20 已建立六道内容就绪门，Phase 24–30 已建立 WCL 事实快照与 intake bundle。
复审发现两个不依赖真实 WCL 数据、但会影响后续正式发布的边界：

1. `learning-surfaces` 使用全量路线 coverage 汇总。只要 `pug-safe` 或
   `custom-reference` 路线覆盖完整，即使 `intent=learning` 的路线没有覆盖全部场景，也可能被标记为 ready。
2. `buildFactIntakeBundle` 是公开 runtime API，调用方传入 `null`、数组或缺失必填字段的
   options 时，会在校验前解引用并抛出异常，不能保证结构化 fail-closed。

这一步只修合同与门禁，不写入或猜测当前版本 NPC、Spell、forces 或攻略文字。

## 范围

### 1. Learning route scoped coverage

- `getDungeonContentCoverage` 支持按 `RouteKnowledge.intent` 计算覆盖。
- `getDungeonContentReadiness` 的 `learning-surfaces` 只使用 `intent=learning` 的路线。
- reviewed/published 的 `validateDungeonDocument` 与 `dungeon:publish` 复用同一 learning-route
  coverage；正式内容至少需要一条包含 Pull 的 learning 路线，不能只靠 pug-safe、push 或
  custom-reference 路线通过发布门。
- 现有 report/Inspector 的全量 coverage 语义保持兼容；只有正式学习门使用 scoped coverage。
  `dungeon:report` 会显式输出 `coverage.routeIntent=all` 与独立的 `learningCoverage`，避免两种
  口径被误读。
- 增加反例：非 learning 路线覆盖完整、learning 路线缺 Situation 时，门禁仍为 pending。

### 2. Fact intake options envelope

- `buildFactIntakeBundle` 在首次解引用前验证 options 是普通对象。
- `reportCode`、`dungeonId`、`season`、`gameBuild`、`snapshotId`、`evidenceRef`、`capturedAt`
  必须是非空字符串；可选 `fightId` 必须是正整数。
- 可选 `licenseStatus`、`requireApproved`、`reviewer`、`reviewedAt` 和 `document` 也在入口处
  做运行时 shape 校验；带 document 时 reviewer/reviewedAt 必须是非空字符串。
- malformed options 返回稳定 `FACT_INTAKE_OPTIONS_INVALID` 诊断，不抛 TypeError。
- 现有 CLI 参数解析和正常 snapshot-only/template-ready 流程保持不变。

## 明确不做

- 不自动选择路线、Pull、NPC、Spell 或 forces。
- 不改变 `parser/**`、`analysis/**` 或正式内容发布状态。
- 不把非 learning 路线删除；它们仍可用于 Route/Inspector 查询，只不能满足正式学习表面门。

## 退出标准

- route intent 反例测试通过，现有 coverage/report 测试不回归。
- malformed options 的 runtime 测试覆盖 `null`、数组、缺字段和非法 fightId。
- 受影响 Dungeon/runtime 与 scripts 测试、typecheck、`dungeon:check`、生产构建通过。
- 完成 adversarial/maintainability/performance review，修复问题后在当前分支提交。
