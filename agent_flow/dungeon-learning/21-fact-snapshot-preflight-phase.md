# Phase 21：NPC / Spell / forces 事实快照预检

日期：2026-08-11
分支：`codex/dungeon-learning`

## 目标

在没有可靠的 Midnight S2 当前 build 事实快照之前，不把猜测写进正式副本文档；等内容负责人拿到可审计的 NPC、Spell 和 forces 数据后，可以用同一份 JSON 合同完成目录绑定、build 绑定、来源门禁和 digest 预检。

本阶段只建立“事实输入的边界和工具”，不新增任何 S2 NPC ID、Spell ID、forces 数值、路线顺序、攻略结论或图片 URL。

## 交付物

- `src/dungeon/runtime/factSnapshot.ts`
  - 定义版本化 `FactSnapshot` 合同。
  - 只保存来源事实：NPC/Spell ID、敌人身份、施法者关系、可选 forces 数值；不保存角色建议、危险等级、Pull 顺序或攻略文案。
  - 校验副本/赛季目录身份、唯一 enemyKey/abilityKey、正 NPC/Spell ID、技能施法者引用、forces 完整性和总量一致性。
  - 对 release candidate 要求 `official`、`game-data` 或 `wcl` 来源且 `licenseStatus=approved`；`manual-test` 只能用于单测和 draft 预检。
  - 提供排除 `digest` 字段后的稳定 JSON canonicalization，避免把文件内自报 digest 当作自身证明。
  - v1 对顶层、enemy 和 ability 字段使用严格 allowlist；未知字段直接阻断，不能被规范化时静默丢弃。
  - `validateFactSnapshotIntegrity` 使用 Web Crypto 独立计算 canonical digest；正式调用还必须提供已登记的 catalog entry 和调用方指定的 expected build。
- `scripts/dungeons/fact-preflight.ts`
  - 提供 `pnpm dungeon:fact-check --input=<file> [--dungeon=<id>] [--build=<build>] [--release] [--json]`。
  - 默认做结构/身份/digest 预检；`--release` 额外执行正式来源与授权门禁。
  - `--release` 必须显式提供 `--build`，避免把输入文件自带的旧 build 当作当前 build 证明。
  - 只读输入文件，不写入 runtime registry，不注册 DungeonDocument，也不修改既有草稿。
- 测试覆盖模块校验、catalog drift、重复身份、未知 caster、forces 不完整/总量漂移、release 来源门禁和 CLI digest 篡改检测。

## 输入合同（v1）

```json
{
  "version": 1,
  "snapshotId": "<source snapshot identity>",
  "fightId": 123,
  "dungeonId": "<S2 catalog id>",
  "season": "midnight-s2",
  "gameBuild": "<exact build or data snapshot build>",
  "source": "official | game-data | wcl | manual-test",
  "licenseStatus": "approved | reference-only | needs-review",
  "evidenceRef": "<ticket, export, URL, or stored evidence id>",
  "capturedAt": "<ISO timestamp>",
  "digest": "sha256:<64 lowercase hex>",
  "enemies": [
    { "enemyKey": "<stable source-local key>", "npcId": 123, "isBoss": false, "forcesPoints": 5 }
  ],
  "abilities": [
    {
      "abilityKey": "<source-local key>",
      "spellId": 456,
      "casterEnemyKeys": ["<enemyKey>"],
      "interruptible": true
    }
  ],
  "totalEnemyForcesPoints": 5
}
```

`fightId` 是可选的 source scope；只有 WCL 等来源能证明 report 内的单场 fight 时才填写。
它属于 canonical payload，会参与 digest；缺省时保持其它来源快照的 v1 行为。

`forcesPoints` 可以暂时全部缺省，表示事实尚未接入；一旦出现一个 forces 值，就必须覆盖快照中每个敌人，并与 `totalEnemyForcesPoints` 精确相等。零 forces Boss 是合法值，不应被当作缺失。

## Digest 规则

canonical payload 是递归按 key 排序后的快照 JSON，并排除 `digest` 字段；数组顺序仍然是来源文件的一部分。计算方式为：

```text
sha256(JSON.stringify(stableSort(snapshot without digest)))
```

这只证明“当前文件内容与其 digest 一致”，不替代来源授权或人工审校。来源是否可信、证据是否可追溯，仍由 `source`、`licenseStatus`、`evidenceRef` 和 release review 负责。公开的 `validateFactSnapshot`/`validateFactSnapshotIntegrity` 都会先独立计算 canonical digest，再决定是否 release-ready。

## 操作流程

1. 内容负责人从已批准的官方、game-data 或 WCL 导出生成快照；开发阶段可先用 `manual-test` 做合同测试，但不能以此发布。
2. 在本地执行 `pnpm dungeon:fact-check --input=/path/to/snapshot.json --dungeon=<id> --json`；准备 release candidate 时追加 `--release --build=<当前目标 build>`。
3. 修复所有 error；warning 只能说明当前是 draft/非 release 来源，不能被静默当作 ready。
4. 准备正式证据后再次执行 `--release`，确认 catalog id、season、gameBuild、NPC/Spell 引用和 forces 总量均与内容文档一致。
5. 经第二审校者确认后，才把快照摘要/registry 绑定到 DungeonDocument；Phase 20 的 `contentReadiness` 仍是正式学习入口的最终门禁。

## 与现有门禁的边界

| 层              | 本阶段负责                                                                      | 本阶段不负责                         |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| Fact preflight  | 输入合同、来源状态、目录身份、调用方提供的目标 build、ID 引用、canonical digest | 证明来源本身真实、自动抓取新赛季数据 |
| Forces registry | 由 Phase 20 绑定已提交的 forces digest/总量                                     | 生成或猜测 forces                    |
| DungeonDocument | 后续把已审计事实映射到 Enemy/Ability/Situation                                  | 把快照自动变成路线或攻略文案         |
| Learning UI     | 继续展示 pending/blocked 原因                                                   | 把 NPC/Spell 事实直接当作学习建议    |

## Review / 验证

- `pnpm exec vitest run src/dungeon/runtime/factSnapshot.test.ts scripts/dungeons/fact-preflight.test.ts`
- `pnpm typecheck`
- `pnpm dungeon:fact-check --input=<fixture> --json`（只使用测试临时文件，不提交假事实）
- `git diff --check`

退出标准：工具和合同可验证，但当前 S2 仍不因本阶段而新增正式 NPC、Spell、forces 或学习入口；只有提供真实、获批且经过第二审校的快照后，才进入后续事实导入 phase。
