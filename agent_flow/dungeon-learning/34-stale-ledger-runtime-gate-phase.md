# Phase 34：Stale Ledger Runtime Gate

状态：已完成

## 背景

Phase 33 已把发布文档绑定到事实和坐标 artifact，但 `dungeon:status stale` 之前只写入维护目录的 JSON；浏览器运行时仍只看 `DungeonDocument.version.status`。维护者标记某个 Situation、Ability 或 RouteStep 过期后，页面可能继续展示旧建议，形成“操作成功、用户仍可访问”的发布安全缺口。

## 本阶段目标

1. 建立版本化 `src/dungeon/data/authoring/stale.json` 作为构建时 ledger，保留 knowledgeId、原因、UTC 标记时间和可选 snapshotId。
2. 运行时严格校验 ledger；损坏时 fail-closed，不把 stale 清单错误当作“没有过期内容”。
3. `getDungeonLearningAccess` 在文档知识实体命中 ledger 时返回 `stale`，阻止 preview/formal/deep-link 继续渲染，并保留原有 `version.status='stale'` 兼容路径。
4. `dungeon:check` 校验 ledger 结构、重复 ID、时间戳和已登记知识 ID，避免写入无法被 runtime 解释的记录。
5. 不改变发布 manifest 的格式、不读取用户可写 localStorage、不侵入 parser/analysis；release loader 仍留后续阶段。

## 数据合同

```json
{
  "version": 1,
  "entries": [
    {
      "knowledgeId": "rlp-situation-...",
      "reason": "coordinate snapshot changed",
      "markedAt": "2026-08-12T00:00:00.000Z",
      "snapshotId": "threechest-coordinate-snapshot-..."
    }
  ]
}
```

`knowledgeId` 必须非空且唯一；`reason` 必须非空；`markedAt` 必须是可 round-trip 的 UTC ISO 时间；`snapshotId` 如存在也必须非空。全局 check 还要求 ID 能在当前 preview registry 中解析，防止 stale ledger 漂移成无人维护的孤儿记录。

## 非目标

- 不自动修改 `DungeonDocument.version.status` 或发布 manifest。
- 不将 stale ledger 暴露为用户可编辑的浏览器状态。
- 不在本阶段实现 release manifest → runtime registry loader；构建仍使用静态 registry。

## 验收标准

- 空 ledger 不影响现有 draft/fixture/reference 行为。
- ledger 命中 Enemy、Ability、Situation、Boss、Route 或 RouteStep 时，学习入口统一返回 stale 且不可打开。
- malformed ledger、重复 ID、非法 UTC 时间、未知知识 ID 使 `dungeon:check` 失败；直接 runtime 读取 malformed ledger 也 fail-closed。
- 既有 `version.status='stale'` 行为和 stale reason 保持兼容。
- typecheck、受影响测试、`dungeon:check`、全量 dungeon tests、build 和 diff check 通过。

## 实现与审查证据

- 新增 `src/dungeon/runtime/staleLedger.ts` 与版本化 `src/dungeon/data/authoring/stale.json`；运行时、preview、publish、`dungeon:check` 共用严格 ledger 校验。
- `dungeon:status stale` 在写入前拒绝损坏 ledger、未知 knowledge ID、重复 ID 和非法 UTC 时间；写入仍使用原子替换。
- 对抗性审查已覆盖 malformed/custom ledger、未知 ID、跨副本 scoped check、preview/publish stale 一致性；结论 PASS。
- 维护性与性能审查已修复重复 ledger 扫描和批量 ID 的线性 includes；结论 PASS。
- 验证：`vitest src/dungeon scripts/dungeons` 40 files / 256 tests、`pnpm typecheck`、`pnpm dungeon:check`、`pnpm dungeon:check-dist`、`pnpm build`、`git diff --check` 全部通过。
