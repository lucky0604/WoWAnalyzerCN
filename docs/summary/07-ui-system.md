# 07 · UI 组件库与工具系统

本文梳理 `src/interface/` 下的通用 UI 组件、工具系统与展示组件，供快速查找复用。

## 1. 通用基础组件

`src/interface/index.ts` 是界面组件的 barrel，集中 re-export 常用项：

| 组件                                                                                                                            | 文件                 | 用途                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Panel`                                                                                                                         | `Panel.tsx`          | 万能内容卡片：标题块（title/subheading/anchor/explanation/actions/backButton）+ `.panel-body`，几乎每页都用 |
| `Tooltip` / `TooltipElement`                                                                                                    | `Tooltip.tsx`        | 基于 fork 的 `react-tooltip-lite` 的 tooltip，portal 渲染进 `#portal-root`，方向感知、可 hover              |
| `MaybeTooltip`                                                                                                                  | `Tooltip.tsx`        | 条件 tooltip                                                                                                |
| `Icon`                                                                                                                          | `Icon.tsx`           | 游戏图标 `<img>`（`assets.rpglogs.com/img/warcraft/...`），带 `BAD_ICONS`/`ICON_RENAME` 处理                |
| `SpellLink`                                                                                                                     | `SpellLink.tsx`      | 法术链接，hover 时 `useFetchTooltip` 拉 tooltip，经 `useTooltipContext` 显示                                |
| `SpellIcon` / `ItemIcon` / `ItemLink` / `ItemSetLink` / `SpecIcon` / `ResourceIcon` / `ResourceLink` / `RoleIcon` / `ActorLink` | 对应文件             | 各类游戏实体的图标/链接                                                                                     |
| `Expandable` / `ControlledExpandable`                                                                                           | `Expandable.tsx`     | 可展开区域                                                                                                  |
| `AlertDanger` / `AlertInfo` / `AlertWarning`                                                                                    | `Alert*.tsx`         | 三种告警框                                                                                                  |
| `ErrorBoundary`                                                                                                                 | `ErrorBoundary.tsx`  | 错误边界                                                                                                    |
| `makeAnalyzerUrl`                                                                                                               | `makeAnalyzerUrl.ts` | 生成报告/战斗/玩家/标签 URL                                                                                 |

其它：`DelayRender`、`PerformanceStrong`、`QualityIcon`、`ProgressBar`、`LoadingBar`、`ReadableListing`、`DocumentTitle`、`Modal`、`Portal`/`PortalTarget`、`Hotkeys`、`Changelog`/`ChangelogPanel`、`ContributorButton`、`NameSearch`、`Ad`（含 `AdErrorBoundary`、`Location`）、`ReportSelecter`（导出 `constructURL`）、`ReportSelectionHeader`、`ReportRaidBuffList`。

## 2. 统计框（Statistic）系统

主要位于 `src/parser/ui/`（虽在 parser 下，本质是展示组件）：

- **`Statistic.tsx`** —— 主统计框（class 组件），props `size`（standard/small/medium/large/flexible）、`wide`/`ultrawide`、`category`（`STATISTIC_CATEGORY`）、`position`、`tooltip` 信息角、`drilldown` 链接、`dropdown` 展开。
- 变体：`StatisticBox`、`StatisticGroup`、`StatisticBar`、`StatisticsListBox`、`LazyLoadStatisticBox`、`TalentAggregateStatistic`、`UptimeBarSubStatistic`。
- 常量：`STATISTIC_ORDER`、`STATISTIC_CATEGORY`。
- 值/文本助手：`BoringSpellValueText`、`BoringItemValueText`、`BoringResourceValue`、`ItemDamageDone`、`ItemHealingDone`、`ItemCooldownReduction`、`PlayerBreakdown`、`DonutChart`、`Gauge`、`UptimeBar`、`PerformanceBar`、`QualitativePerformance`、`WeightedPerformance`。
- `MajorDefensiveStatistic`（`src/interface/MajorDefensiveStatistic.tsx`）—— 侧重"大防御技能"的专用统计框。
- 图表：`BaseChart`、`DonutChart`、`FlushLineChart`、`ManaLevelGraph`、`ActiveTimeGraph`、`DistanceRadar`、`Cooldown`/`CooldownBar`/`CooldownOverview`、`SpellSeq`、`TalentAggregateBar`。

## 3. Tooltip 系统（两套并存）

- **`react-tooltip-lite` 派生**：`Tooltip`/`TooltipElement`（静态/块内容），portal 渲染。
- **新式游标跟随**：`TooltipContext.tsx`（`TooltipProvider`/`useTooltipContext`）+ `CustomTooltip`（`showTooltip(content, x, y)`/`hideTooltip()`），`SpellLink` 用它显示动态拉取的 tooltip。
- **URL 提供者**：`src/interface/wowDbProvider.ts` —— 模块级 URL 构建器，默认 `https://db.damijing.com`。导出 `setWowDbBaseUrl`、`getWowDbBaseUrl`、`spellUrl`、`itemUrl`、`itemSetUrl`、`npcUrl`、`resourceUrl`（返回 `null` → 资源链接不支持）。这是 tooltip 数据库提供方的集中切换点。
- `src/interface/useTooltip.tsx`：读 Redux `tooltips.baseUrl`，调 `setWowDbBaseUrl`，返回 `{ item, itemSet, npc, resource, spell }` 助手。
- `src/interface/useFetchTooltip.ts`：拉取 tooltip 内容（`SpellLink` 用）。
- `src/interface/useSpellInfo.ts`：查法术名/图标（zh 叠加中文名，见 06）。

## 4. 指南子系统（Guide）

现代分析呈现方式，位于 `src/interface/guide/`。详见 [04-analysis-engine.md](./04-analysis-engine.md) §5。

- 核心 `index.tsx`：`GuideProps`、`Guide`、`Section`/`SubSection`/`SectionHeader`、hooks（`useInfo`/`useEvents`/`useAnalyzer`/`useAnalyzers`）、性能标记/颜色助手。
- `components/`：`GuideSection`、`GuideDataWrapper`（`StatsRow`、`StatCard`、`HelperText`、`PerfBadge`、`StatsGrid`、`FilterBadge`）、`CastSummary`/`CastOverview`/`CastDetail`、`CastEfficiencyPanel`、`CastSequence`、`BuffUptimeBar`、`StackedBar`、`TipBox`/`PerformanceTipBox`、`ProblemList`、`Explanation`/`ExplanationRow`、`CooldownExpandable`、`CooldownGraphSubSection`、`DamageTakenPointChart`、`PassFailBar`、`GradiatedPerformanceBar`、`HideExplanationsToggle`、`HideGoodCastsToggle`、`PerformanceBoxRow/`。
- `components/Apl/`：施法优先级（APL）规则渲染。
- `components/MajorDefensives/`：大防御技能使用分析（`MajorDefensiveAnalyzer`、`DamageMitigationChart`、`MitigationSegments`、`Timeline`）。
- `components/Preparation/`：战前准备（消耗品/附魔/增益/宝石）。
- `foundation/`：最低支持专精的自动基线分析。

## 5. 报告页 UI（`src/interface/report/`）

- 选择流程：`PlayerTile`、`PlayerSelection`、`FightSelectionPanel`/`FightSelectionPanelList`、`RaidCompositionDetails`、`ReportRaidBuffList`。
- 结果：`Results/`（`Header`、`Overview`、`ReportStatistics`、`TimelineTab`、`CharacterTab`、`EncounterStats`、`TimeFilter`、`ResultsLoadingIndicator`、`FightDowntimeToggle`、`ItemWarning`、`DegradedExperience`）。
- 守卫/警告：`PatchChecker`、`SupportChecker`（`SupportCheckerSpecOutOfDate`/`SupportCheckerSpecPartialSupport`）、`OldExpansionWarning`、`ReportDurationWarning`、`ReportNoEligibleFightsWarning`、`ReportFightNotEligibleWarning`、`AdvancedLoggingWarning`。

## 6. 时间轴（`src/interface/report/Results/Timeline`）

`Timeline`、`Casts`、`Auras`、`Cooldowns`、`EnemyCasts`、`Lane`、`Settings`、`configuration/`（各专精施法条）、`EmbeddedTimeline`。

## 7. 其它界面工具

- `src/interface/controls/`、`src/interface/Table/`、`src/interface/timeline-diagram/`、`src/interface/CooldownGrid/`、`src/interface/icons/`、`src/interface/images/`、`src/interface/audio/`——各类子工具集。
- hooks：`useGoogleAnalytics`、`usePremium`、`useSessionFeatureFlag`、`useSpellInfo`、`useTooltip`、`useFetchTooltip`。
- `src/interface/static/`：bootstrap 等静态资源。
- Social 按钮：`DiscordButton`、`GitHubButton`、`PatreonButton`、`ThirdPartyButtons`。

## 8. 皮肤与主题

- `src/interface/App.scss`、`Theme.scss`、`Game.scss`、`_design-system.scss` —— 全局与设计系统样式。
- `Footer`、`Header`、`NavigationBar`、`HomeLayout`、`PremiumLoginPanel` 等各自的 scss。
- ARC 观测台（`src/site/`）走独立的 CSS 令牌体系：`styles/` 下 tokens → typography → effects → motion → components 按序在 `SiteLayout` 引入，全部作用域在 `.site` 类下、与上述全局样式隔离；组件不写裸 hex，颜色一律引用 `tokens.css`，`prefers-reduced-motion` 在 `effects.css` 全局降级。详见 `src/site/README.md`。

## 9. 关键复用建议

- 新页面优先用 `Panel` 做内容卡，用 `Statistic` 体系做数据块。
- 观测台（`src/site/`）页面一律用 `src/site/ui/` 自己的 `Panel`/`Button`/`Divider`，不要混用 `src/interface` 的组件或全局样式。
- Tooltip 优先用新式 `TooltipProvider` + `wowDbProvider`（`SpellLink` 模式），它支持动态内容与中文名。
- 指南类输出应走 `Guide` 组件 + `guide/components/` 的构建块，而非旧的 `statistic()/tab()`。
