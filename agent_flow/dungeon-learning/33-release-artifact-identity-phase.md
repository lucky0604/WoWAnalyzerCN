# Phase 33：Release Artifact Identity Binding

状态：实现中

## 背景

Phase 32 已经把六道内容就绪门、learning-route coverage 和 WCL intake 的输入合同收紧，但正式文档仍可能只凭“同 build + approved provenance + 可编辑 ID”满足怪物/技能事实门；空间侧也只核对目录快照，没有核对 `DungeonDocument` 自身使用的坐标快照和 stable SpawnId sidecar。这样会让文档内容与审计产物脱钩。

## 本阶段目标

把两个身份链写进 `DungeonDocument`，并在草稿、就绪度、schema release validation 和 publish 之间保持一致：

1. `factBinding` 保存 FactSnapshot 身份、canonical manifest digest，以及完整的 sourceKey→Enemy/Ability 映射。
2. `coordinateBinding` 保存 normalized coordinate snapshot 的 `snapshotId/rawSha256` 与 identity sidecar hash。
3. `fact-bind` 生成的新 draft 自动携带 `factBinding`；RLP 空间预览携带 `coordinateBinding`，但仍是 draft/preview。
4. 任何正式 reviewed/published 文档缺少或篡改这两条 identity 链时 fail-closed；发布前重算 manifest digest，并重新匹配坐标来源注册表。
5. readiness 的 Enemy/Ability facts 门必须同时看到 binding identity 和对应 snapshot provenance，不能被手工填写的同 build ID 冒充。

## 数据合同

```ts
interface FactBindingIdentity {
  version: 1;
  registryKey: string;
  snapshotId: string;
  snapshotDigest: `sha256:${string}`;
  manifestDigest: `sha256:${string}`;
  dungeonId: string;
  season: string;
  gameBuild: string;
  enemies: {
    sourceKey: string;
    documentEnemyId: string;
    npcId: number;
    isBoss: boolean;
    forcesPoints: number;
  }[];
  abilities: {
    sourceKey: string;
    documentAbilityId: string;
    spellId: number;
    casterEnemyKeys: string[];
  }[];
}

interface CoordinateBindingIdentity {
  sourceId: 'threechest';
  snapshotId: string;
  rawSha256: string;
  identityHash?: `sha256:${string}`;
}
```

`manifestDigest` 的 canonical payload 排除 digest 自身（也排除 registryKey），覆盖版本、snapshot identity、文档 identity 和 sourceKey→owned ID 配对；`publishDocument` 发布前重新计算，禁止只相信输入 JSON 的自报值。运行时 readiness/schema 使用 committed reviewed registry 的 digest、sourceKey↔owned ID 配对和逐行事实值做同步门禁；registry 本身由 `dungeon:check` 校验，不能用临时手工行替代。绑定后的 NPC/Spell/caster/forces 值另由 reviewed fact-binding registry 逐行保存并比对，不能只凭 digest 字符串放行。`registryKey` 还必须命中 reviewed fact-binding registry，且 registry 中的 snapshot/manifest digest、sourceKey 集合、逐行配对和事实值必须完全一致。坐标 identity 必须同时匹配 committed source registry 的 raw hash、sidecar hash 和 catalog snapshot ID；嵌入坐标 payload 的完整 digest 校验留给后续空间 artifact phase。

## 非目标

- 不在本阶段提交新的 S2 NPC、Spell、forces 或攻略结论。
- 不把远程图片、Threechest 路线编辑器或 WCL route 逻辑引入运行时。
- 不把发布清单自动接入静态 runtime registry；该问题留给后续 release-loader phase。

## 验收标准

- 旧 draft/fixture 仍可用于 Inspector 和合同测试，但 reviewed/published 缺少任一 identity 时被明确诊断阻断。
- `fact-bind` 输出包含可重算的 `factBinding`，映射行覆盖全部当前文档 Enemy/Ability 且目标 ID 不重复。
- 空、跨副本、跨 build、错误 digest、未登记 registry、错误坐标 snapshot 或错误 sidecar hash 均不能进入 formal readiness/publish。
- RLP spatial preview 的 coordinates gate 仍可 ready，但 facts、forces、learning 和 review gate 不被误报为 ready。
- `pnpm dungeon:check`、typecheck、全量 dungeon tests、build 与 diff check 全部通过。
