# Midnight S2 轮换池校正与第二轮对抗性审查

> 审查日期：2026-08-10
> 结论：已修正并通过 targeted review；正式攻略内容仍未发布。

## 发现的问题

首版实现把 Threechest 克隆中可见的 8 个 source key（`aa/magi/cavns/xenas/wind/pit/seat/sky`）直接登记为 Midnight S2。该克隆的地图/坐标库存与当前 S2 轮换池不是同一个清单，继续沿用会造成三个产品错误：

1. `/dungeons` 展示错误副本；
2. 位置参考把旧本数据误认为当前 S2 数据；
3. WCL 标题匹配与未来内容 authoring 会绑定错误的 dungeon ID。

## 核验结果

S2 目录事实以 Blizzard 公告为准：

<https://news.blizzard.com/en-us/article/24294369/the-shadows-deepen-midnight-season-2-begins-august-18>

当前 8 本为：

- Altar of Fangs
- Murder Row
- Den of Nalorakk
- The Blinding Vale
- Voidscar Arena
- Ruby Life Pools
- Kings' Rest
- Temple of Sethraliss

## 修正后的边界

- `season2DungeonCatalog` 只登记上述官方 S2 轮换池。
- `season2RotationSource` 记录目录事实来源、检索日期和字段白名单。
- Threechest 旧快照保留在 `legacyThreechestCoordinateInventory`，用于 importer、坐标转换和地图 renderer 回归，不是 S2 目录成员。
- S2 条目的 `coordinateSnapshotId` 变为可选；没有经过核验的当前来源时，UI 显示“位置参考待接入”。
- `getCoordinateReference` 必须显式拥有匹配 snapshot ID，不能因 source key 碰巧相同而回退到 legacy 数据。
- `dungeon:check` 与 `dungeon:impact` 分别校验/报告 S2 目录和 legacy 坐标库存，不能混计。
- 远程图片 manifest 的旧 Threechest key 改为 `legacy-threechest:*`，避免与未来 S2 资源 key 混淆。

## 对抗性检查

| 反例                            | 保护措施                                          | 结果 |
| ------------------------------- | ------------------------------------------------- | ---- |
| 把旧 source key 重新塞回 S2     | catalog validator 拒绝 legacy key 重用            | 通过 |
| S2 条目没有坐标却误开位置页     | `coordinateSnapshotId` 必须存在且与 snapshot 匹配 | 通过 |
| 用旧地图补齐新 S2               | UI 不提供 fallback，显示待接入                    | 通过 |
| 旧快照 hash 被错误当成 S2 hash  | global check/impact 只从 legacy inventory 读取    | 通过 |
| WCL encounter ID 未核验却硬匹配 | 当前 S2 条目不填写未经确认的 ID，标题匹配保持保守 | 通过 |
| 生产包带入 Threechest URL       | `dungeon:check-dist` 继续扫描产物                 | 通过 |

## 验证命令

```bash
pnpm dungeon:check
pnpm dungeon:check-dist
pnpm typecheck
pnpm exec vitest run src/dungeon scripts/dungeons/authoring.test.ts scripts/dungeons/operations.test.ts src/interface/routes/dungeon-reference.test.tsx
pnpm build
```

本轮 targeted Vitest 为 13 个文件、45 个测试全部通过；构建保留仓库既有 LightningCSS `:global` 与大 chunk warning，但未新增阻断错误。

## 后续门

下一步不是把 legacy 坐标强行映射到 S2，而是逐本取得当前 S2 的可核验位置/地图来源，再为 Ruby Life Pools 和 Altar of Fangs 完成真实知识垂直切片，最后扩展到其余 6 本。
