# Phase 1A：RLP 内容学习预览实施记录

> 实施日期：2026-08-10
> 状态：`DRAFT_PREVIEW_ONLY`

## 已实现

- RLP 作为本地学习预览文档注册，包含 5 个稳定 Situation、1 个 Boss、4 个学习路线 Pull 上下文。
- `quick`、`overview`、`full` 三种学习模式都能在没有地图加载的情况下生成 Lesson；学习进度仍绑定 Situation fingerprint。
- 机制知识只写入项目自己的 `AbilityKnowledge`，每条保留官方论坛或交叉参考来源；没有把第三方攻略原文放入仓库。
- 已知的 NPC/Spell ID 直接记录；尚未完成核验的 Spell ID 保持缺省，不用 `0` 或猜测值冒充事实。

## 空间与 forces 门禁

当前 RLP 文档标记：

```text
dataStatus: draft
spatialStatus: pending
forcesStatus: pending
```

因此：

- Pull 可以先作为“学习上下文”存在，但没有未经核验的 spawn 坐标。
- 总 forces 暂不计算；页面必须显示待接入，而不是显示伪造的数值。
- draft 阶段这些问题是可定位 warning；切换到 reviewed/published 时会变成阻断错误。
- Threechest legacy 坐标库存不能自动填充 RLP，除非后续获得明确的 S2 对应快照并完成 reconciliation。

## 学习入口与审校门禁

- 学习入口统一调用 `getDungeonLearningAccess`；`draft` 仅显示为本地预览，fixture、stale、正式校验失败的文档不会渲染课件。
- `reviewed` / `published` 还必须有作者、第二审校者、审校时间以及与文档一致的 `gameBuild`；`reference-only` 来源不能进入正式学习。
- Inspector 会把 pending 的空间、forces、Spell ID、审校元数据和来源问题逐条展示为可复制诊断，避免只看一个“warning 数字”。

## 未完成与进入 Phase 1B 的门

1. 获取并登记 S2 对应的坐标/位置 snapshot，完成 stable spawn identity reconciliation。
2. 从获批准来源补齐 forces，并为缺失技能补齐经过版本核验的 Spell ID。
3. 对 RLP 全部稳定 Situation、路线和 Boss 进行作者自测与第二人审校。
4. 根据 live build 重跑机制验证；PTR 草稿不能直接标记 published。

## Phase 1B 草稿扩展（2026-08-10）

本轮没有把 RLP 标记为 reviewed/published，而是先扩大“可学习的动作模型”：

- 三场 Boss 学习卡：梅莉杜莎、科基亚、基拉卡与厄尔卡。
- 新增寒冰碎片、熔岩巨石、灼热重击、炼狱喷吐、风暴气流五个机制；每个机制都拆成“动作 / 后果 / 角色建议 / 记忆句”。
- 梅莉杜莎转阶段加入“小龙与护盾先识别”的学习上下文；科基亚把标记、巨石路径和承伤拆成三步；末段把火焰落点和风向移动分开练习。
- 新增 Blizzard PTR 反馈来源作为 reference-only provenance；没有复制第三方攻略原文，新增内容仍不能作为已核验的 live 事实。
- 学习路线新增 Boss 上下文，但所有 pull 仍保持空 spawn；因此这不是可执行 MDT 路线，也不会伪造波次、坐标或 forces。

这样可以先验证“玩家是否能理解每个关键场景”，再在下一步接入 S2 对应空间快照、NPC/Spell ID 和 forces。若任一来源或 live build 发生变化，必须递增 revision 并重新通过审校门禁。

在以上门禁关闭前，RLP 只能作为本地内容学习预览，不能出现在正式 S2 学习入口。

## Phase 2/3 交互落地补充

- Inspector 支持按敌人、技能、Situation 和 Route 的只读反向查询；地图支持楼层深链、当前 Pull 聚焦和键盘可访问的 spawn 选择。
- Route 页面只读展示路线意图、层级假设、Pull 顺序、位置上下文和 Situation 入口；空间 pending 时 forces 明确显示“待核验”。
- Boss 页面把现有 Boss、核心技能、Situation、角色建议和位置门禁串成学习卡；没有 WCL/实测样本时不生成“常见失败”排名，也不把未建模内容写成阶段时间轴。
- 主动回忆必须先选择置信度再揭示答案；学习页会汇总薄弱节点，并保持 fingerprint 与 revision 绑定。

## Phase 1B 内容完整度审查补充

- `src/dungeon/schema/coverage.ts` 现在会分别记录 Enemy 事实引用与 Situation/Route/Boss 学习表面，避免“怪物挂了技能”被误算成“玩家学到了技能”。
- `pnpm dungeon:report` 输出 Situation 是否被路线覆盖、decision-critical 技能是否进入学习表面、没有 Situation 的 Pull 以及缺少核心技能的 Boss 卡。
- 报告还会区分“完全没有路线引用”和“只有 partial 引用”；正式内容至少要有一个 `full` 学习上下文。
- `validateDungeonDocument` 在 draft/fixture 阶段将这些缺口作为可定位 warning，在 reviewed/published 阶段升级为 release error；RLP 当前会明确报告未挂路线的 `rlp-situation-hatchery-transition`。
- 这一步只关闭内容完整度的工程门，不改变 RLP 的 `spatialStatus: pending`、`forcesStatus: pending`、来源批准和第二人审校门；因此 RLP 仍然不能发布。
