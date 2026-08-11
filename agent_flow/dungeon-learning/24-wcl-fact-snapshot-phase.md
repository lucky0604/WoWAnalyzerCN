# Phase 24：WCL report/events 事实快照归一化

日期：2026-08-11
分支：`codex/dungeon-learning`

## 目标

提供一个配置/输入驱动的 WCL 原始导出适配器，让内容负责人可以把现有 WCL API 或
`rpglogs.cn` 服务返回的 `report`、`events` JSON 保存为 Phase 21 `FactSnapshot` draft。
本阶段不在浏览器端新增网络请求，不修改分析器，也不把任何未审校数据注册到正式副本。

## 归一化合同

- `report.enemies[].guid` 作为 NPC ID，`report.enemies[].id` 只作为本次报告内的 actor ID。
  缺少或非法 `guid` 时阻断，禁止用 actor ID 猜 NPC ID。
- `subType`/`type` 必须明确为 `Boss` 或 `NPC`；同一 NPC ID 出现冲突身份时阻断。
- `events[].sourceID` 只有在能映射到 report enemy actor 时才参与施法者关系；玩家或未知
  actor 的事件会被跳过并计数。
- 如果 report 与 events envelope 都带有 report code，必须完全一致；draft 模式只有一侧带
  code 时保留 warning，要求人工确认两个导出来自同一报告；`--release` 会将该身份未核验
  情况升级为 error 并阻断。
- `events` 必须是完整事件数组；如果 envelope 带有 `nextPageTimestamp`、`nextPage` 或
  `hasMore=true` 等分页标记，适配器会阻断，必须先在输入侧汇总所有页面。
- 输入 report 默认必须已裁剪为单个副本战斗：`report.fights` 只能为空、缺省或包含一项。
  对标准多 fight 导出可以显式传入 `--fight-id`，适配器只在 report.fights、每个 enemy
  的 fights 归属和事件 timestamp 都可验证时执行裁剪；无法验证时仍 fail-closed。
- 仅 `cast`/`begincast`/`channel`/`beginchannel`/`empowerstart` 事件参与提取；
  `damage` 等带有 ability 字段的事件不会被误当作施法事实。
- `events[].ability.guid` 生成 Spell ID 与 caster enemyKey 关系；不推断
  `interruptible`、动作、后果、角色建议或学习严重度。
- 同一 NPC ID 的多个 actor 会合并成一个 source-local `wcl:npc:<npcId>`，同一 Spell 与
  caster 关系只输出一行，结果按 ID 排序保证 digest 稳定。
- WCL 导出不提供可审计的逐敌人 forces，因此快照明确省略 forces；路线、坐标、Pull 顺序
  和攻略文案永远不会从 WCL 事件生成。

## 使用方式

```bash
pnpm dungeon:fact-from-wcl \
  --report=./incoming/report.json \
  --events=./incoming/events.json \
  --fight-id=123 \
  --dungeon=ruby-life-pools \
  --build=<当前目标 build> \
  --evidence-ref=<WCL report URL/code> \
  --snapshot-id=<稳定快照 ID> \
  --captured-at=<ISO timestamp> \
  --out=./incoming/ruby-life-pools.wcl-facts.json \
  --json
```

`--events` 可省略，此时只生成敌人目录 draft 并明确 warning。默认
`licenseStatus=reference-only`；`--release` 仍会因 forces 缺失和事实授权/完整性门禁失败，
不能把 WCL report 导出直接当作正式事实。

注意：WCL report API 的完整报告通常包含多个 `fights` 和全局 `enemies` roster。传入
`--fight-id` 后 CLI 会按 fight 时间范围过滤施法事件、按 actor fights 归属过滤敌人，并
保留原始 report URL/code 作为 `--evidence-ref`；不传则必须先在输入侧完成单 fight 裁剪。

生成文件下一步必须经过：

```text
fact-from-wcl
→ fact-check --build=<当前 build>
→ fact-binding-plan
→ 人工确认 sourceKey → WoWAnalyzerCN Enemy/Ability
→ fact-bind（仍只生成 draft）
→ 内容校验、第二审校、forces 独立快照和 publish 门禁
```

## 安全与边界

- 输入 report/events 只读；输出使用临时文件后 atomic rename，禁止覆盖普通路径、symlink
  或 hardlink 输入。
- 输出不修改 catalog、coordinate identity、DungeonDocument、release manifest 或运行时
  registry。
- 不复制 WCL 文本、图片或路线；只保留源快照所需的数值 ID、来源类型、证据引用和 digest。
- 本阶段不在代码中保存真实 S2 report、NPC、Spell 或 forces 数据；测试全部使用隔离的假数据。

## 验收

- 相同 report/events 与 metadata 生成完全相同的 canonical digest。
- 敌人 actor/NPC、Boss 冲突、施法者映射、空 roster、缺 events、输出别名均有负向测试。
- 生成的 draft 永远没有 `totalEnemyForcesPoints`，release 入口 fail-closed。
- `pnpm typecheck`、WCL adapter/CLI 测试、Dungeon domain tests、`dungeon:check` 和 dist guard
  均通过。
