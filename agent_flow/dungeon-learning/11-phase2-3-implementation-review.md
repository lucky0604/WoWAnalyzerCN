# Phase 2–3 实现、对抗性 Review 与提交记录

> 更新：2026-08-10
> 分支：`codex/dungeon-learning`

## 已落地

- Inspector：楼层深链、当前 Pull 聚焦、地图/文本等价、敌人/技能/Situation/Route 只读反查。
- Route：只读路线详情、层级假设、Pull 顺序、forces/空间待核验状态、Situation 深链；没有编辑、导入、保存入口。
- Boss：核心技能的动作/后果/角色建议、Situation 学习入口、位置门禁、无 WCL/实测证据时不生成失败排名。
- 学习：先选择回忆置信度再揭示答案；薄弱项汇总、次日复习入口、内容 fingerprint、`lastRole` 恢复；storage 写入失败有明确提示。
- 薄弱项复习：支持 `review=weak` 深链，只保留未揭示、模糊或不会的场景；当薄弱项清空时提供回到完整学习的空状态，而不是显示空课件。
- 响应式地图：Inspector 与只读 Route 均支持键盘可用的收起/展开和“地图聚焦”视图；聚焦会自动恢复地图内容，不改变楼层深链、Pull 选择或路线只读边界。
- 正式入口：`reviewed/published` 文档访问副本根路径时 canonical redirect 到学习页；需要调试对象的链接显式使用 `?view=inspector`，避免正式内容默认落到 Inspector。
- 覆盖路线图：目录状态细化为 `registered → raw-ready → route-ready → knowledge-draft → coordinate-ready → reviewed → published → stale`，卡片显示实际文档计数与 `updatedAt`；RLP 当前为 `coordinate-ready`，其余 S2 副本为 `registered`。
- 本地资源 QA：新增 dev-only `/dungeons/legacy/:sourceKey` 只读页，直接验证 Threechest manifest、normalized 坐标和 spawn 索引；App production route 不注册。
- 发布门禁：顶层及 Enemy/Ability/Situation/Route/Boss 嵌套 provenance 必须存在且批准；诊断 path 带来源索引。

## Review 发现与修复

| 发现                                     | 修复                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 路线切换后步骤选择可能残留               | 按 route/revision 重置首个步骤，并增加 `aria-pressed`                                                      |
| 待核验空间下显示 `0 forces` 会误导       | 统一显示“待核验/待接入”                                                                                    |
| Boss 场景可能跨 Boss 串联                | 仅按共享技能或绑定 spawn 建立反向关联                                                                      |
| 无阶段时仍生成空学习 URL                 | 没有可用 Situation 时回到 Inspector                                                                        |
| 未选置信度即可揭示答案                   | reveal 按钮保持 disabled，直到选择置信度                                                                   |
| persisted role 写入但刷新不恢复          | URL role 优先，否则读取 `lastRole`                                                                         |
| 未批准嵌套来源不受发布门禁约束           | 增加 nested provenance error/warning                                                                       |
| 多个来源产生重复 React key               | 诊断路径加入 `provenance[index]`                                                                           |
| 空 provenance 可绕过 `some()` 检查       | 顶层和嵌套实体都要求至少一条来源                                                                           |
| 移动端地图占满正文且无法快速回到学习内容 | 增加 `aria-expanded`/`hidden` 同步的收起按钮、固定聚焦视图和 Escape 退出路径，Route/Inspector 共用样式契约 |
| 正式副本根路径仍打开 Inspector           | 仅 `?view=inspector` 保留检查入口，正式文档默认跳转 `/learn`，并修正学习/Route/Boss 反向链接               |
| 目录的“建设中”无法区分内容阶段           | 引入可校验的覆盖状态和更新时间；状态要求对应的 DungeonDocument，避免手工标签领先于真实内容                 |
| Threechest 坐标虽已导入但无法在网页核验  | 增加隔离的 legacy QA 页面和入口；明确不属于 S2、无学习/路线编辑语义                                        |

## 证据

- Dungeon 相关测试：19 个文件，当前 72 个测试通过；新增 schema/learning/UI/地图状态/目录覆盖/legacy 资源 QA 测试覆盖上述负例，并包含薄弱项复习和分享链接回归。
- `pnpm dungeon:check` 通过，当前登记 1 个学习草稿、2 个预览文档、8 个 S2 目录项、1 个当前 S2 RLP 坐标参考、8 个 legacy Threechest 坐标快照。
- `pnpm typecheck`、受影响文件 `oxlint`、`oxfmt --check` 通过。
- `pnpm build` 通过；存在仓库原有 LightningCSS 选择器和大 chunk warning。
- `pnpm dungeon:check-dist` 通过，未把 Threechest/remote-dev 标记带入 dist。
- 全仓库 `pnpm lint` 仍有既有 i18n/unused-import 基线错误；没有用它掩盖 Dungeon 受影响文件的 lint 结果。
- 2026-08-10 复跑：Dungeon 相关 19 个文件 / 72 个测试、`pnpm dungeon:check`、`pnpm typecheck`、`pnpm build` 与 `pnpm dungeon:check-dist` 均通过；构建仍仅有仓库已有的 LightningCSS 选择器和大 chunk warning。

## 尚未宣称完成

- RLP 仍是 `draft + spatial pending + forces pending`，不能标记 reviewed/published；当前草稿已覆盖三场 Boss、10 个可行动机制和 7 个学习场景，但不代表每个实际波次都已有经过核验的路线数据。
- Threechest 克隆目前是旧副本池；其 legacy 坐标不能自动映射到 Midnight S2 八本。
- Altar of Fangs 仍是数据合同 fixture，不是虚构的正式攻略。
- 真实浏览器/移动端 QA 已在本地 Chrome 完成关键流程；详细结果见 `12-browser-qa.md`。视觉验收仍不等同于内容事实审校，RLP 的 spatial/forces/NPC/Spell 门禁仍保持打开。
