# 已确认的开发数据与资源决策

> 决策日期：2026-08-10
> 状态：`ACCEPTED_FOR_LOCAL_DEVELOPMENT`
> 适用范围：Dungeon Learning Companion 的 Phase 0～Phase 3 本地开发。

## 1. 决策摘要

项目所有者确认：

1. 大秘境 spawn 坐标和位置信息可从 Threechest 导入 WoWAnalyzerCN，并由本项目长期维护规范化数据。
2. 本地功能开发可直接使用 [Threechest](https://threechest.io/) 的线上图片链接。
3. 部署阶段再决定生产图片来源；现在必须通过 Provider/manifest 配置，不在组件、Schema 或业务数据中硬编码 URL。

这三项决定足以开始本地工程实现，不代表采用 Threechest 的源码、编辑器架构、forces 数值、攻略文字或全部 MDT 派生数据。

## 2. 坐标/位置信息采用合同

当前已提交的八份坐标登记为 snapshot `threechest-coordinate-snapshot-2026-08-10`，对应 Threechest 克隆中的旧副本库存，并不等同于官方 Midnight S2 轮换池；它们在代码中通过 `legacyThreechestCoordinateInventory` 独立维护。提交到仓库的规范化 JSON 脱敏保存 source URL，但保留 raw SHA-256、转换版本和 source key，真实来源地址只通过导入命令参数或本地配置注入。

官方 Midnight S2 轮换目录单独记录在 `season2RotationSource`，当前 8 本以 Blizzard 公告为事实来源。只有某个 S2 条目显式绑定经过核验的 coordinate snapshot，才允许打开位置参考；不能因为 legacy 库存在相同或相似地图就自动复用。

允许导入：

- spawn 坐标；
- floor/区域归属；
- patrol/group 等纯位置关系，但每类字段仍需在 Schema 中明确语义；
- 为坐标解释所需的源 coordinate space 元数据。

导入后必须：

- 转换成 WoWAnalyzerCN 自有 `normalized-v1` coordinate space；
- 记录 Threechest source URL、snapshot/version、retrievedAt、raw hash 和 transform version；
- 使用 committed identity registry 生成稳定 `SpawnId`；
- 保留 raw → normalized diff 和 reconciliation 报告；
- 允许未来换来源或人工更新，而不改变已确认 identity 和攻略引用。

本决定不自动批准：enemy forces points、攻略文字、路线作者内容、图片文件、Threechest 源码以及 MDT 导入/导出实现。

## 3. Local-only 远程图片配置

业务层只能知道稳定 `assetKey`：

```ts
type DungeonAssetKey = string;

interface DungeonAssetProvider {
  getFloorMap(assetKey: DungeonAssetKey): DungeonAssetResult;
  getDungeonArtwork(assetKey: DungeonAssetKey): DungeonAssetResult;
}
```

开发链路：

```text
Authored/Generated Data: assetKey
→ RemoteDevAssetProvider
→ gitignored local asset manifest
→ Threechest remote URL
```

部署链路：

```text
Authored/Generated Data: same assetKey
→ OssDungeonAssetProvider 或 PlaceholderAssetProvider
→ approved production URL 或结构化占位图
```

建议本地配置形式（仓库根目录的 `.env.example` 已提供 legacy Threechest 公开瓦片模板；复制到 `.env.local` 后按需启用）：

```dotenv
VITE_DUNGEON_ASSET_PROVIDER=remote-dev
VITE_DUNGEON_DEV_ASSET_MANIFEST={"provider":"remote-dev","assets":{"<asset-key>":{"type":"tiles","urlTemplate":"https://example.invalid/maps/{x}_{y}.jpg","tileSize":64,"origin":[0,0]}}}
```

当前 Vite 浏览器端只读取 `VITE_` 前缀变量，因此 manifest 以 JSON 字符串注入；真实 URL 仍应只存在于被 `.gitignore` 保护的 `.env.local` 或本地启动脚本中。

坐标导入命令也要求通过参数或环境变量注入来源地址，不在脚本常量中内置：

```bash
pnpm dungeon:import-threechest -- \
  --dungeon=all \
  --source-url="$DUNGEON_THREECHEST_SOURCE_URL" \
  --snapshot=threechest-coordinate-snapshot-2026-08-10 \
  --retrieved-at=2026-08-10 \
  --redact-source-url \
  --output-dir=src/dungeon/data/coordinates
```

如果输出要进入 tracked 坐标目录，必须追加 `--redact-source-url`；含真实 URL 的审计输出只保留在 ignored 本地快照中。

`.env.local` 仍必须 gitignored；`.env.example` 中的 Threechest 地址是公开的开发期示例，不属于业务代码或生产资源承诺。部署前应把该 manifest 替换为 OSS/placeholder 配置，并由 dist 门禁确认没有 dev-only 地址进入产物。

## 4. 强制门禁

- `remote-dev` 仅允许 Vite DEV、`localhost`/loopback 和明确 flag 同时成立时启用。
- production、preview、staging、CI build 选择 `remote-dev` 必须立即失败。
- `src/**`、`public/**`、generated data 和 authored knowledge 禁止出现 Threechest URL。
- production build 后扫描 `dist`；出现 `threechest.io` 或实际资源 host 即失败。
- 远程图片加载失败时显示 placeholder，学习文字和列表仍可使用。
- 不创建代理、缓存镜像或绕过来源站 CORS/防盗链的逻辑。
- 不把本地页面截图用于 PR、公开演示或宣传材料。

## 5. 替换生产资源的验收

生产图片就绪时只允许修改：

- production asset manifest；
- `OssDungeonAssetProvider` 配置；
- 对应 provenance/license registry。

以下内容不应修改：

- Situation、RouteStep 和 Boss 知识；
- spawn ID 与坐标；
- React 页面组件；
- URL 路由和学习进度。

如果替换图片需要改组件或知识数据，说明 asset/provider 边界设计失败，应在部署前修正。

## 6. 仍未确认的部署事项

- 生产地图、背景和缩略图的最终来源及发布范围。
- enemy forces 与非坐标事实的数据来源。
- 远程开发图片失效时是否维护本地自制占位素材。

上述事项不阻塞本地功能开发，但会阻塞 production 发布。
