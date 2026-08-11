# S2 八本坐标扩展：实现与对抗性 Review

日期：2026-08-11

分支：`codex/dungeon-learning`

结论：八本 S2 坐标均已进入只读 `coordinate-ready` 层；学习内容、forces、技能和生产
资源门禁没有被放宽。

## 实现范围

输入固定为 Threechest `origin/ptr` 提交
`9eb71e0ca19d777b06ec0faa53f2e6608b991a55`。规范化文件放在
`src/dungeon/data/coordinates/`，S2 使用 `.s2.json` 与 `.s2.identity.json` 后缀，避免
覆盖同名 legacy 快照。

| S2 目录 | WoWAnalyzerCN ID       | snapshot                                                | spawn 数 |
| ------- | ---------------------- | ------------------------------------------------------- | -------: |
| `fang`  | `altar-of-fangs`       | `threechest-coordinate-snapshot-2026-08-11-s2-fang-ptr` |      160 |
| `murd`  | `murder-row`           | `threechest-coordinate-snapshot-2026-08-11-s2-murd-ptr` |      221 |
| `nalo`  | `den-of-nalorakk`      | `threechest-coordinate-snapshot-2026-08-11-s2-nalo-ptr` |      116 |
| `vale`  | `the-blinding-vale`    | `threechest-coordinate-snapshot-2026-08-11-s2-vale-ptr` |      276 |
| `void`  | `voidscar-arena`       | `threechest-coordinate-snapshot-2026-08-11-s2-void-ptr` |      218 |
| `rlp`   | `ruby-life-pools`      | `threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr`  |      166 |
| `kr`    | `kings-rest`           | `threechest-coordinate-snapshot-2026-08-11-s2-kr-ptr`   |      101 |
| `tos`   | `temple-of-sethraliss` | `threechest-coordinate-snapshot-2026-08-11-s2-tos-ptr`  |      128 |

总计 1,386 个来源 spawn。每本都有独立 identity registry，稳定 ID 在同一副本内从
`spawn-1` 开始；S2 resolver key 使用 `s2-fang` 等显式 key，RLP 的现有 `rlp` source
plane 绑定保持不变。

## Review 发现与修复

| 反例                                                         | 修复                                                                                                                                   | 结果                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| S2 新文件与 legacy 同名导致运行时读错快照                    | S2 使用显式 `coordinateSnapshotKey`/`coordinateIdentityRegistryKey`，runtime 不做隐式 slug 回退                                        | 通过                     |
| registry 只有 source ID/数量正确，但 enemy/floor 语义被篡改  | `getCoordinateReference` 现在校验 registry `version`、stable/source 唯一性，以及 `enemyId`/`floorId` 与 snapshot 的对应关系            | 通过，错误时 fail-closed |
| `dungeon:check` 只校验 RLP 的 hash，新增七本可能漂移         | 改为遍历所有 S2 catalog coordinate entries，逐本检查 snapshot、hash 和 approved source use                                             | 通过                     |
| payload 改动只更新/保留 JSON 内的 `rawSha256` 即可绕过校验   | release gate 改用排除 digest 字段后的规范化 payload digest；identity sidecar 也绑定独立 digest，legacy aggregate 同样使用规范化 digest | 通过                     |
| source 被 revoke/expire 后已构建页面仍可渲染坐标             | runtime resolver 与 CLI 都调用 `checkSourceUse`，来源不再 approved 时 fail-closed                                                      | 通过                     |
| sourceId 重复会被 Map 静默覆盖；同源位置大幅移动被当成 exact | sidecar 要求 source/stable 唯一且 entry 数量精确；reconcile 对超过 15 normalized units 的位置移动输出 blocking drift                   | 通过                     |
| 坐标变化无法进入 impact/stale 流程                           | `coordinateImpact` 同时覆盖 legacy 与 S2，并保持 resolver key 隔离                                                                     | 通过                     |
| 有坐标就误开放空壳学习页                                     | 目录状态只提升到 `coordinate-ready`；学习入口仍要求 reviewed/published DungeonDocument                                                 | 通过                     |
| MDT 文件意外携带攻略事实或 URL                               | 导入字段白名单只允许位置/组别/巡逻/来源身份；生成文件没有 `sourceUrl`、forces、ability、route 字段                                     | 通过                     |
| patrol 数据进入快照但用户看不到关系                          | 只读地图以蓝色折线和表格计数呈现 patrol；不把它升级为路线或 forces 事实                                                                | 通过                     |

## 可复现验证

每本 S2 快照均运行：

```bash
pnpm exec tsx scripts/dungeons/import-threechest.ts \
  --dungeon=<key> \
  --threechest-root=<fixed-ptr-checkout> \
  --snapshot=threechest-coordinate-snapshot-2026-08-11-s2-<key>-ptr \
  --retrieved-at=2026-08-11 \
  --check \
  --output=src/dungeon/data/coordinates/<key>.s2.json

pnpm exec tsx scripts/dungeons/reconcile-threechest.ts \
  --snapshot=src/dungeon/data/coordinates/<key>.s2.json \
  --registry=src/dungeon/data/coordinates/<key>.s2.identity.json \
  --json
```

本轮结果：

- 七本新增快照 importer：`exact` 分别为 160、101、221、116、128、276、218；
- 七本 identity reconciliation：无 `ambiguous`、`drift` 或 `new` 项；
- `pnpm dungeon:check`：8 个 S2 coordinate reference、8 个 legacy snapshot，source registry approved；
- 受影响 suite：24 files、112 tests passed；
- `pnpm typecheck`：通过；
- `VITE_DUNGEON_ROUTES=true pnpm build`：通过；
- `pnpm dungeon:check-dist`：769 个产物扫描通过，未发现 Threechest 具体 URL。
- `dungeon` 懒加载 chunk 当前约 506.50 kB（gzip 62.64 kB）；新增 S2 坐标 raw 约 447 kB。该预算记录为信息级性能项，后续可按副本拆分动态 import。

## 未完成门禁

坐标 ready 只代表“可以理解位置”，不代表“可以学习完整攻略”。以下仍必须逐本完成：

1. 当前 build 的 NPC/Spell/forces 快照与 provenance；
2. 自有 Floor/Enemy 语义和完整 Pull 绑定；
3. Situation、技能动作、角色建议、Boss 与路线教学；
4. 作者自测、第二审校、authoring effort；
5. 合法的生产图片来源和部署 manifest。

在这些条件满足前，UI 必须保持只读位置参考、占位图可用、学习入口关闭。
