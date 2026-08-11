# Phase 1B：S2 事实与开发资源预检

日期：2026-08-11

分支：`codex/dungeon-learning`
结论：坐标可以作为只读学习上下文；当前 S2 的 NPC/Spell/forces 事实与生产图片仍未达到发布门槛。

## 1. Threechest 坐标范围

在用户提供的 `agent_flow/threechest` 克隆中，固定提交
`9eb71e0ca19d777b06ec0faa53f2e6608b991a55` 的 `src/data/mdtDungeons/` 包含当前 S2
八本文件：

```text
fang_mdt.json  kr_mdt.json  murd_mdt.json  nalo_mdt.json
rlp_mdt.json   tos_mdt.json vale_mdt.json  void_mdt.json
```

这些文件可以作为“来源坐标快照”的输入。导入器只允许写入下列位置关系字段：

- `floorId` / 坐标空间；
- spawn 坐标；
- `groupId` 与 patrol；
- `sourceEnemyId`、`sourceEnemyIndex` 等来源身份。

不得从同一个 MDT JSON 自动带入：

- forces 数值；
- 当前版本技能、打断/驱散/免疫事实；
- 路线顺序、跳怪选择、学习文字；
- 图片 URL 或 Threechest 的组件/编辑器代码。

当前垂直切片先完成了 RLP 学习平面；随后其它七本也按相同 importer + reconciliation 流程
提交了独立的 S2 snapshot 与 stable SpawnId registry。八本现在都处于
`coordinate-ready`，但只有 RLP 有学习草稿，不能因此开放其它七本的空壳学习页，也不能用
legacy 八本的同名/相似地图回退。

## 2. 事实导入门

正式 Enemy/Ability/Route 内容必须来自当前游戏 build 的可审计快照或人工复核记录。每个
事实至少需要：

| 事实       | 最低字段                             | 发布前证据                                   |
| ---------- | ------------------------------------ | -------------------------------------------- |
| Enemy      | WoW NPC ID、名称、spawn 归属         | 当前 build 的 game-data/WCL 快照，第二人复核 |
| Forces     | 单只怪 forces、总和、适用层级        | 与当前赛季规则一致的 forces snapshot         |
| Ability    | Spell ID、施法者、动作、漏处理后果   | tooltip/日志/游戏内验证，注明 patch/build    |
| Route Pull | 稳定 SpawnId、Situation 引用、完整性 | 地图 QA + 路线审校，不能只靠 source group    |

缺字段时保留 `draft` / `pending`，UI 可以显示“待核验”，但不得把 0、未知 ID 或未经确认
的旧赛季值当成事实。`validateDungeonDocument` 已将 NPC ID、Spell ID、forces、spatial
status、review/self-test/authoring-effort 作为正式状态门禁。

## 3. 图片资源探测结论

Threechest 代码使用 `/maps/{dungeonKey}/{x}_{y}.jpg` 形式的公开瓦片。2026-08-11 本地
只读探测结果如下：

- 旧 key（例如 `aa`）线上可返回 JPEG；
- 当前 S2 key（例如 `rlp`、`fang`、`kr`）在线上部署没有稳定可用的同路径瓦片（RLP
  返回 404）。

因此不能为了“看起来有图”把旧地图瓦片套到 S2 副本。RLP 当前学习预览在缺少
`midnight-s2:ruby-life-pools` manifest 条目时显示占位背景，这是有意的 fail-safe。

本地资源链路固定为：

```text
mapAssetKey
  → VITE_DUNGEON_DEV_ASSET_MANIFEST（仅 .env.local）
  → remote-dev provider（仅 localhost DEV）
  → Threechest 线上图片/瓦片
```

部署链路固定为：

```text
同一个 mapAssetKey
  → OSS manifest 或 placeholder provider
  → production/preview dist guard
```

URL 不得出现在 `src/**`、`public/**`、坐标 JSON、Situation/Route 数据或 React 组件中。
生产构建必须通过 `pnpm dungeon:check-dist`，Threechest 具体地址不能进入产物。

如果后续取得 RLP 或其它 S2 的合法图片来源，只需在本地/部署 manifest 增加对应
`mapAssetKey`，然后重新做图片失败回退、移动端和 dist 扫描验证；不应修改 SpawnId、学习
数据或 UI 组件。

## 4. 当前可执行的下一步

1. 由内容负责人提供当前 build 的 NPC/Spell/forces 快照，或指定可复核的 WCL/game-data
   查询结果；导入前先保留 raw hash 与 build。
2. 为每本副本运行坐标 importer 的 `--dry-run`、`--check` 和 identity reconciliation，
   只提交无漂移/无 ambiguous 的规范化位置数据。
3. 将 stable SpawnId 绑定到 WoWAnalyzerCN 自有 Floor/Enemy，再把 Pull 完整性从“位置锚点”
   提升为“已核验完整 Pull”。
4. 完成作者自测、真实第二审校和 authoring effort 后，才允许从 `draft` 进入 `reviewed`。
5. 部署前再决定 OSS 图片；在此之前使用占位图并保持学习文字可读。

## 5. 本轮退出判断

本轮没有把 404 的 S2 图片地址写进代码，也没有用 Threechest 的旧地图替代 S2 地图。
八本的位置参考可以用于坐标理解，但当前 `forces 待核验`、完整 Pull、作者自测和第二审校
仍是明确的未完成项；release gate 继续保持关闭。
