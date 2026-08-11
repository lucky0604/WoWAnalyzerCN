# Learning Wave Context 实现与对抗性 Review

日期：2026-08-11

分支：`codex/dungeon-learning`

代码提交：`5b0e591689 feat: surface learning wave context`

## 本轮目标

把“学习课节”与“路线波次上下文”连接起来，让用户在理解怪物技能、处理动作和
角色职责之后，能确认这一节对应路线中的哪一个节点；同时保留数据事实门禁，不能把
Threechest 来源坐标锚点误显示为完整 Pull、forces 或正式攻略。

本轮没有修改 `src/parser/**`、`src/analysis/**`，也没有把 Threechest 的编辑器、路线
决策或代码搬入 WoWAnalyzerCN。

## 实现范围

### Runtime

`src/dungeon/runtime/learning.ts` 新增 `LearningWaveContext`，由现有 `PullStep`、
Situation 的 `anchorSpawnIds` 和当前文档事实解析得到：

- `anchorSpawnIds`：只保留当前文档已知的 source-plane 位置锚点；
- `spawns` / `enemies`：优先提供完整 Pull 的已知成员，同时补充 Situation 锚点对应的
  怪物上下文；
- `hasCompletePull`：只有文档 `spatialStatus=verified`、Pull 非空且每个 spawn 都能解析时
  才为 true；
- `hasVerifiedForces`：除完整 Pull 外，还要求总 forces 为正、上下文敌人非空，并且每个
  敌人明确标记 `forcesStatus=verified`；未设置状态不会被当成已核验；
- `forcesPoints`：继续由现有 schema helper 从 spawn 推导，不在学习层复制 forces 公式。

学习指纹现在包含路线 ID、步骤 ID、锚点、spawn/enemy ID、forces 和事实完整度；坐标或
绑定变化会使旧的 recall 进度失效，避免用户继续复习已经改变的空间上下文。

同一 Situation 复用在多条路线时，学习计划保留 `(route, step)` 配对，路线卡片不会把
某一条路线的步骤错误链接到另一条路线。`lesson.route` 仍作为当前层级假设的首个关联
路线摘要，完整的路线身份由每个 `waveContext.route` 保留。

### Learning UI

`src/interface/routes/dungeon-learning.tsx` 与对应 SCSS 增加“这一节对应哪些波次”卡片：

- 展示路线节点、步骤标题、学习理由；
- 明确区分“完整波次”和“学习锚点”；
- 展示怪物上下文、位置参考锚点数量和 forces 核验状态；
- 提供只读路线节点链接，继续由地图解释空间关系；
- 页面文案明确声明“位置锚点不等于完整 Pull 或 forces 结论”；
- 移动端 facts 栏切为单列，沿用现有 WoWAnalyzerCN 深色/金色设计 token。

当前 RLP S2 预览因此会显示少量已绑定的怪物上下文和 6 个位置参考锚点，但 forces 仍
显示为“待核验”，不会制造数值攻略。

## 对抗性 Review 发现与修复

| 发现                                                               | 风险                               | 处理                                                   |
| ------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------ |
| `forcesStatus` 未设置时若按“非 pending”判断，会误报已核验          | 草稿 forces 可能被用户当成正式事实 | 改为只接受明确值 `verified`                            |
| 学习指纹只覆盖 Situation/Ability/Pull，不覆盖空间上下文            | 坐标/绑定变化后旧 recall 仍被复用  | 将 wave context 的稳定派生字段纳入指纹，并增加回归测试 |
| 一条 Situation 出现在多条路线时，旧 map 会把步骤与最后一条路线混配 | 新增路线链接可能打开错误路线       | 内部改为保存 `(route, step)`，增加多路线回归测试       |

关键门禁检查：

- 无 SQL、竞态写入、LLM 输出信任边界或 shell 注入路径；
- 无 `dangerouslySetInnerHTML`；React Link 使用编码后的文档/路线 ID；
- 未新增 enum/status 值；
- 未增加网络请求、图片来源或生产资源回退逻辑；
- 未把 source-plane 坐标升级为自有 NPC、Spell、forces 或路线事实。

## 验证证据

```text
pnpm exec vitest run src/dungeon scripts/dungeons \
  src/interface/routes/dungeon-reference.test.tsx \
  src/interface/routes/dungeons.test.tsx \
  src/interface/routes/dungeon-route.test.tsx
  24 files, 110 tests passed

pnpm typecheck
  passed

pnpm exec oxlint --max-warnings 0 --deny-warnings \
  src/dungeon/runtime/learning.ts \
  src/dungeon/runtime/learning.test.ts \
  src/interface/routes/dungeon-learning.tsx \
  src/interface/routes/dungeon-learning.test.tsx
  0 warnings, 0 errors

git diff --check
  passed

VITE_DUNGEON_ROUTES=true pnpm build
  passed; existing large-chunk and plugin-timing warnings only

pnpm dungeon:check-dist
  Dungeon dist guard passed: 769 asset(s) scanned
```

## 当前结论与未关闭门

本轮“学习内容 ↔ 波次位置上下文”实现可合并到当前开发分支，但 RLP 仍是：

```text
dataStatus: draft
spatialStatus: pending
forcesStatus: pending
```

因此仍不能作为 `reviewed/published` 正式攻略。下一轮必须继续完成：

1. 将 166 个稳定 source SpawnId 绑定到完整自有 Floor/Enemy 语义；
2. 取得并核验当前 S2 build 的 NPC、Spell 与 forces 快照；
3. 完成作者自测记录、真实第二审校者和浏览器/发布 QA；
4. 生产部署前切换到经授权的 OSS 图片 provider，并再次运行 dist 资源门禁。

本轮没有触碰仓库中预先存在的 `docs/summary/` 未跟踪目录。
