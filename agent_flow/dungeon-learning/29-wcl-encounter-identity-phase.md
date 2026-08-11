# Phase 29：WCL S2 副本身份绑定

日期：2026-08-11

分支：`codex/dungeon-learning`

## 背景

WCL 导航适配器已经存在，但 S2 目录原先没有 `wclEncounterId`，所以真实报告即使包含最终 Boss
encounter，也无法通过高置信身份识别；适配器只能依赖标题回退。标题可能被用户复制、报告包含多个
区域，不能作为默认身份来源。

本阶段使用当前配置的 CN WCL 服务读取 `/v1/zones`，仅保留 zone/encounter 身份元数据，不读取或提交
NPC、Spell、forces、路线或玩家行为事实。

## 绑定结果

| WoWAnalyzerCN          | live encounter / zone | PTR encounter / zone |
| ---------------------- | --------------------: | -------------------: |
| `altar-of-fangs`       |          `12993 / 55` |         `62993 / 56` |
| `murder-row`           |          `12813 / 55` |         `62813 / 56` |
| `den-of-nalorakk`      |          `12825 / 55` |         `62825 / 56` |
| `the-blinding-vale`    |          `12859 / 55` |         `62859 / 56` |
| `voidscar-arena`       |          `12923 / 55` |         `62923 / 56` |
| `ruby-life-pools`      |         `112521 / 55` |        `162521 / 56` |
| `kings-rest`           |          `61762 / 55` |        `111762 / 56` |
| `temple-of-sethraliss` |          `61877 / 55` |        `111877 / 56` |

来源记录在 `season2WclCatalogSource`：`/v1/zones`、live zone `55`、PTR zone `56`、retrievedAt
`2026-08-11`，并保存 host-neutral evidence reference、字段白名单和 identity payload digest；规范化的
identity evidence 保存在 `src/dungeon/data/wcl/season2.identity.json`，不包含 NPC、Spell 或战斗事实。
WCL report/events 的事实抓取仍由 Phase 24–26 处理，不能把本阶段的 ID 绑定当作当前 build 事实证明。

## 匹配策略

1. `fightBoss`/`fightOriginalBoss` 命中已登记 live 或 PTR encounter ID 时，返回 `encounter-id` 高置信匹配。
2. 两个 encounter 字段若指向不同副本，或 encounter 与显式 report zone（55/56）不一致，直接拒绝。
3. 没有 encounter ID 时，只有 report zone 缺失、为 `0` 或明确为 S2 live/PTR zone，才允许标题回退；标题命中多个副本也直接拒绝。
4. report zone 明确属于其它区域时，复制的 S2 副本标题不会触发匹配。
5. 匹配到的目录条目仍必须通过 `getDungeonScopedLearningAccess`；本阶段不会开放 draft 或 coordinate-only
   副本的正式学习深链。

## 验收

- 八个 S2 条目均有唯一、正整数 live/PTR encounter ID 和对应 zone ID。
- 目录校验拒绝缺失、重复或错误 zone/encounter 元数据。
- WCL source metadata、identity digest、八个 live/PTR encounter ID 的正向匹配，以及跨区域、冲突 ID、歧义标题负向用例通过。
- 不修改 parser、analysis、ReportContext 或 WCL API 请求链路。
- dungeon tests、typecheck、lint、format、`dungeon:check`、`dungeon:check-dist` 和生产构建通过。

## 下一步

S2 zone 当前尚未产生可供内容绑定的稳定 live report 时，继续保持 `coordinate-only/preview`；待内容负责人
提供当前 build 的单 fight report 后，再进入 NPC/Spell/forces 绑定和学习文案审校。
