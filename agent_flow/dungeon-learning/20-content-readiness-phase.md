# Phase：S2 内容就绪度与学习缺口门禁

日期：2026-08-11

分支：`codex/dungeon-learning`

目标：在当前 build 的 NPC、Spell、forces 和正式审校证据尚未齐备时，仍然让用户看懂“哪里已有位置参考、哪里还不能学习”，并让目录 UI、`dungeon:report` 使用同一套判断，避免把坐标或内部 fixture 误显示成完整攻略。

## 实现范围

- 新增 `src/dungeon/runtime/contentReadiness.ts`，为每个副本计算六道独立门：
  - 位置参考：snapshot、stable SpawnId、source use 是否通过；
  - 怪物事实：NPC ID、当前 build 事实来源；
  - 技能事实：Spell ID、动作、后果和批准来源；
  - forces 与 Pull：forces snapshot、已核验敌人和可推导 Pull forces（允许有 spawn 的零 forces Boss Pull，但路线必须包含至少一个正 forces Pull）；
  - 学习表面：Situation、关键技能、Pull、Boss 是否完整引用；
  - 作者与第二审校：版本、来源、作者自测和第二审校门禁。
- 新增 `src/dungeon/runtime/formalAccess.ts` 作为学习授权唯一入口：本地 draft preview 仍可用；正式学习、路线、Boss 和 WCL 深链必须同时满足目录 `reviewed/published`、文档正式校验和六道门全部 ready。
- `Provenance.gameBuild`、`Enemy.factBuild` 与 `DungeonDocument.forcesSnapshot` 提供机器可校验的 build、snapshot 和 digest 绑定；forces 还必须指向提交的 `dungeonForcesSnapshotRegistry`，并逐项匹配 enemy→forces payload、总量、来源和 build。单独把 `forcesStatus` 改为 `verified` 不再足以通过门禁。
- `fixture` 明确排除在学习内容之外；它仍可用于 Inspector、Schema 和回归测试。
- `/dungeons` 的 S2 卡片展示 `ready/6`、当前就绪状态和每道门的待办原因；只有目录状态为 reviewed/published 且六道门全部 ready 才允许正式学习入口。
- `pnpm dungeon:report` 从只报告已注册文档改为报告完整 S2 八本；没有 DungeonDocument 的条目保留 `validation: null`、零内容计数和明确的 pending 门。

## 当前事实

截至本阶段，报告应稳定显示：

| 条目     | 当前状态                           | 就绪度                    | 解释                                                                 |
| -------- | ---------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| RLP      | `coordinate-ready` + draft preview | `1/6`，`learning-preview` | 有位置参考和本地学习草稿；NPC/Spell/forces/完整学习引用/审校仍待核验 |
| 其余七本 | `coordinate-ready`                 | `1/6`，`coordinate-only`  | 只有只读坐标与巡逻参考；没有被伪造的 DungeonDocument、技能或路线     |

这些状态不是发布结论。要进入 `reviewed/published`，仍必须提供当前 live build 的事实快照、完整 Pull 绑定、作者自测、第二审校和合法生产图片来源。

## 测试与验证

- `src/dungeon/runtime/contentReadiness.test.ts` 覆盖：无文档的 coordinate-only、RLP reference-only draft 不计入正式事实、fixture 不计入学习内容、八本报告数量稳定。
- 受影响单测：content readiness、access、coverage。
- `pnpm typecheck` 与 `pnpm dungeon:report` 必须通过；报告必须覆盖 8 个 S2 条目。
- `dungeon:check` 对未来 `reviewed/published` 条目执行正式学习门禁；当前 coordinate-ready 条目不会被误判为 release-ready，并校验 forces registry 的 key 唯一性、digest/元数据和 payload 总量。

## 未完成门禁

本阶段没有新增或猜测 NPC ID、Spell ID、forces、路线顺序或生产图片 URL。内容负责人提供经过审计的事实快照后，才进入下一阶段的事实导入、Pull 完整性和作者审校。

## Review 与修复记录

本阶段完成两轮对抗性、可维护性和性能 review。首轮提出的正式深链绕过、fixture 报告误计数、目录/文档身份漂移、旧 build 事实、可变 forces 标记、学习路线 intent、审校人重复、就绪详情截断和重复解析均已修复；复审未发现阻断项。

额外的 fail-closed 保护包括：畸形 review/Ability 文本不会让 UI 或报告抛异常；注入的 access 必须携带匹配的 `documentId`；已登记但无文档的学习、路线和 Boss 深链显示“待接入”而不是 404；非 S2 文档不会绕过目录门禁自动跳转学习页。

验证证据：`pnpm typecheck`；Dungeon 领域与脚本相关测试 30 files / 159 tests；`node --import tsx/esm scripts/dungeons/check.ts`；`node --import tsx/esm scripts/dungeons/check-dist.ts`；`node --import tsx/esm scripts/dungeons/report.ts`（8 条目）。
