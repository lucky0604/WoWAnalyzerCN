# RLP 当前 S2 坐标快照导入与对抗性 Review

日期：2026-08-11
分支：`codex/dungeon-learning`
结论：坐标参考门关闭条件已满足；学习内容的 forces、作者自测和第二人审校门仍保持关闭。

## 来源与范围

本次导入使用用户提供的 Threechest 克隆目录 `agent_flow/threechest` 的
`origin/ptr` 分支，并固定到提交：

```text
9eb71e0ca19d777b06ec0faa53f2e6608b991a55  mdt update
source file: src/data/mdtDungeons/rlp_mdt.json
source dungeon key: rlp
source dungeon index: 42
```

规范化结果提交为 `src/dungeon/data/coordinates/rlp.json`：

- snapshot：`threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr`；
- raw SHA-256：`2f0736b96608b8899b823a902c755563de245f484ebf2c8c439b9d08d226c60a`；
- 转换：`threechest-yx → normalized-v1`；
- 规模：166 个 spawn；
- identity registry：`src/dungeon/data/coordinates/rlp.identity.json`，166 个稳定 SpawnId；
- 字段：`floorId`、`position`、`groupId`、`patrol`、`sourceEnemyId`、`sourceEnemyIndex`；
- 未导入：forces、技能/数值、攻略文字、路线决策、图片 URL 和 Threechest 源码。

这是“当前 S2 PTR 的位置参考快照”，不是已发布的 WoWAnalyzerCN 攻略，也不是把
MDT/Threechest 路线搬进来。

复现注意：`agent_flow/threechest` 当前工作分支是 `main`，默认 checkout 不含
`rlp_mdt.json`；本次 importer 的 `--check` 使用了单独的 `origin/ptr` 固定提交
checkout，并通过 `--threechest-root=<ptr-checkout>` 指定输入。不要为重跑校验而切换
用户的 Threechest 工作目录；运行时不依赖该目录，只依赖本仓库的规范化快照与来源 hash。

## 接入设计

S2 catalog 的稳定 `sourceKey` 保持 `ruby-life-pools`，坐标源 key 显式记录为
`coordinateSnapshotKey: rlp`。runtime 只按这个声明解析 snapshot，不增加隐式的
slug 别名表，也不从旧 `legacyThreechestCoordinateInventory` 回退。

RLP catalog 状态提升为 `coordinate-ready`，位置参考 runtime 已消费 committed identity
registry，但 `rubyLifePoolsPhase1Draft` 仍是
`dataStatus: draft`、`spatialStatus: pending`、`forcesStatus: pending`。因此：

- 位置参考可以展示为只读地图/spawn 层；
- 位置快照不能自动填充自有 Enemy、Situation、Route 或 forces；
- `/dungeons/ruby-life-pools/learn` 仍不会被正式学习门禁放行；
- WCL 识别不会因坐标 ready 而生成正式学习链接。

## 学习预览接入

当前本地 registry 使用 `rlpSpatialPreview` 作为 runtime 文档：它把 166 个稳定 SpawnId
投影到独立的只读 source plane，并为已确认的少量概念提供代表性 anchor；尚未完成语义绑定
的 NPC 只生成 `未绑定的源 NPC <id>` 数字占位符。该层只表达“哪里有一个来源 spawn”，不
宣称自有 Floor/Enemy、forces、Spell、路线顺序或拉怪建议。identity sidecar 形状、数量或
映射异常时预览 fail-closed，保留原草稿而不是让 dungeon chunk 在加载时崩溃。
路线预览会把 pending 文档的步骤投影到同一 source plane；地图只高亮 Situation 的已绑定
学习锚点，不把这些锚点显示成完整 Pull 或 forces 结论。
NPC 与 Situation 的绑定位于 `src/dungeon/data/coordinates/rlp.bindings.json`，后续赛季更新
可替换 manifest 与 snapshot；运行时会校验 snapshot、source floor、已 authored NPC 和全部
Situation 覆盖，失败时回退到没有 spawn 的原草稿。

## 对抗性 Review

| 反例                                           | 保护措施                                                 | 结果 |
| ---------------------------------------------- | -------------------------------------------------------- | ---- |
| `rlp` 被错误当成 catalog 的 `ruby-life-pools`  | catalog 显式声明 `coordinateSnapshotKey`                 | 通过 |
| RLP 误回退到旧副本坐标                         | snapshot ID、source key 双重匹配，未匹配即返回空         | 通过 |
| 源顺序变化导致 Route/Situation 引用漂移        | 166 个 source spawn 与 committed stable SpawnId 一一对应 | 通过 |
| 只替换 JSON 却忘记更新来源证据                 | source registry 记录 hash、提交证据和字段白名单          | 通过 |
| 坐标导入顺便带入 forces/攻略事实               | normalized JSON 只保留位置关系字段                       | 通过 |
| `coordinate-ready` 被误解为可发布攻略          | 正式文档仍维持 draft/spatial pending/forces pending      | 通过 |
| sourceId 相同但 enemy/floor 事实改变仍静默重绑 | reconciliation 输出 `drift` 并阻断 registry 写入         | 通过 |

## 验证证据

```text
pnpm exec vitest run src/dungeon/data/season2Catalog.test.ts src/dungeon/runtime/coordinates.test.ts
  2 files, 10 tests passed
pnpm dungeon:generate -- --dungeon=rlp --threechest-root=<ptr-checkout> \
  --snapshot=threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr \
  --retrieved-at=2026-08-11 --check
  166 coordinate spawns checked against the fixed PTR source
pnpm dungeon:check
  1 registered, 2 preview, 8 S2 catalog, 1 coordinate reference, 8 legacy snapshots
pnpm exec tsx scripts/dungeons/reconcile-threechest.ts --snapshot=src/dungeon/data/coordinates/rlp.json --registry=src/dungeon/data/coordinates/rlp.identity.json --json
  blocked=false, exact=166, registry entries=166
pnpm typecheck
  passed
pnpm exec vitest run src/dungeon scripts/dungeons src/interface/routes/dungeon-reference.test.tsx src/interface/routes/dungeons.test.tsx
  24 files, 107 tests passed
VITE_DUNGEON_ROUTES=true pnpm build && pnpm dungeon:check-dist
  build passed; dist guard scanned 769 assets
```

下一步仍需把已提交的 source identity registry 绑定到 RLP 自有 Floor/Enemy 语义，确认当前
build 的 NPC/Spell/forces 事实，再补作者自测和真实第二人审校；这些完成前不进入
`reviewed`/`published`。

## Addendum 2026-08-12 — RLP coordinate refresh from MDT master

The RLP S2 coordinate snapshot was refreshed by running threechest's `mdtDungeons.ts`
extraction logic (luaparse) directly against the MDT addon master
`Midnight/RubyLifePools.lua` (dungeonIndex 42, totalCount 553), then importing through
`scripts/dungeons/import-threechest.ts`.

- snapshotId: `threechest-coordinate-snapshot-2026-08-12-rlp-s2`
- coordinate digest `sha256:600a49515bee6817d9f202a56644097e4ed40bc5570b953cca16707d7fe0f613`
- raw payload digest `sha256:2dd1303529cba98420fc9c0114125458249e7721d0b2ff0bec7c754d799e18b6`
- identity sidecar digest `sha256:b0f1547113d10529c9c7f947f1493c11acfdd8a998e87cd9033a4518513d438a`
- 150 coordinate spawns (24 enemy indices, 4 bosses), source coordinate space
  `threechest-yx`, normalized to `normalized-v1`
- raw source: `https://github.com/Nnoggie/MythicDungeonTools/blob/master/Midnight/RubyLifePools.lua`
  (redacted from committed snapshot; recorded here for provenance)

The prior PTR-era snapshot (`...-2026-08-11-rlp-s2-ptr`, 166 spawns) remains registered
and approved; the catalog now points at the refreshed snapshot.
