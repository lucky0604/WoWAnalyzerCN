# Phase 1B 实现与对抗性 Review 记录

日期：2026-08-11
分支：`codex/dungeon-learning`

## 本轮范围

本轮没有把 RLP 的空间或 forces 数据写成猜测值，完成了三个可以独立验收的 Phase 1B/内容运营门禁：

1. `ContentReview.authoringEffort`：正式内容必须记录整本副本总工时，以及每个 `routine`/`critical` Situation 的正整数分钟数。该字段只用于估算后续 S2 内容生产成本，不进入玩家 localStorage 进度或学习指纹。
2. Threechest 坐标 importer：`--dry-run` 不写文件，`--check` 对规范化 JSON 做语义比对；输入结构、坐标、group 和重复 source spawn identity 在写入前阻断；正式写入使用同目录临时文件 + `rename`。
3. Threechest spawn identity reconciliation：以显式的规范化 snapshot、可选上一版 snapshot 和 identity registry 为输入；默认只预览，只有 `--write-registry` 才写 registry；source ID 变化时优先按上一版坐标自动匹配，无法唯一匹配则阻断，且 registry 写入同样采用原子替换。

## Review 发现与修复

| 发现                                                     | 处理                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| importer 文档承诺 `--dry-run`，脚本却总是写输出          | 抽出可测试 `runImport`，增加 dry-run；默认生成行为保持不变                                  |
| `--check` 对旧 snapshot 的数组格式化空白产生误报         | 改为解析 JSON 后比较语义，保留 canonical 结构字段顺序                                       |
| malformed source 可能在 `flatMap` 前抛出无诊断 TypeError | 加入 source/enemy/spawn/patrol/coordinate 结构校验                                          |
| source spawn ID 重复会生成不可区分的 normalized identity | 写入前以 `DUNGEON_THREECHEST_DUPLICATE_SPAWN_ID` 阻断                                       |
| 进程中断可能留下截断 JSON                                | 使用同目录临时文件和原子 rename，并在 finally 清理临时文件                                  |
| formal review 可跳过作者工时证据                         | 增加 `DUNGEON_REVIEW_EFFORT_*` 诊断；draft 为 warning，reviewed/published 为 release error  |
| reconciliation 可能把不同副本的历史 snapshot 混配        | 校验 previous/current `dungeonKey` 一致；snapshot、registry 的 slug、ID、坐标和版本均先校验 |
| ambiguous auto-match 若仍写 registry 会固化错误身份      | `--write-registry` 遇到 ambiguous 直接失败，保持原 registry 不变；默认 preview 不产生写入   |

没有发现 SQL、网络代理、XSS、parser/analysis 侵入或 Threechest URL 进入 production bundle 的新增问题。

## 验证证据

- `pnpm vitest run scripts/dungeons/import-threechest.test.ts scripts/dungeons/reconcile-threechest.test.ts`：8 tests passed。
- `pnpm vitest run src/dungeon/schema/validate.test.ts`：17 tests passed，包含缺失、malformed、unknown、非正整数工时路径。
- 受影响 dungeon/UI/operations/importer/reconciliation suite：24 files，100 tests passed。
- `pnpm dungeon:generate -- --dungeon=all --check`：8 个 legacy snapshot 全部通过。
- `pnpm dungeon:check`：通过，1 registered、2 preview、8 S2 catalog、8 legacy snapshot。
- `pnpm typecheck`、受影响文件 `oxlint`、`oxfmt`：通过。
- `pnpm dungeon:reconcile -- --snapshot=src/dungeon/data/coordinates/aa.json --json`：仅输出 preview 报告，没有创建默认 registry；ambiguous、跨副本 previous snapshot 和 malformed identity 均有测试覆盖。

对应提交：

- `50c0f175d1 feat: gate formal dungeon content by authoring effort`
- `41072c0d6f feat: add safe coordinate import preflight`
- `1fcd281d65 fix: atomically write dungeon snapshots`
- `b30915afdb feat: add spawn identity reconciliation workflow`

## 退出条件仍未满足

RLP 仍保持 `draft + spatial pending + forces pending`。当前仓库只有 Threechest 克隆中的旧副本坐标库存，不能证明它们是 Midnight S2 RLP 坐标；因此没有给 RLP 填充坐标、forces、spawn 或 `published` 状态。进入 reviewed/published 前仍需：

- 当前 S2 的可核验空间/forces snapshot 与 reconciliation；
- 作者自测记录和真实第二人审校；
- 当前游戏 build 的 Spell/NPC/机制验证；
- 再运行完整浏览器 QA 与 release manifest 检查。
