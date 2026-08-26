# 04 · 分析引擎与解析器核心

本文深入 `src/parser/` 与 `src/analysis/`，讲解"一份战斗事件流如何变成一份分析报告"。

## 1. 解析器核心（`src/parser/core`）

### 1.1 `CombatLogParser` —— 总编排器

**文件**：`src/parser/core/CombatLogParser.tsx`。默认导出类 `CombatLogParser`，以及类型 `DependenciesDefinition`。

它不是 React 组件，而是一个**纯类**，在界面层为每个 报告/战斗/玩家 实例化一次。构造函数入参：`(config, report, selectedPlayer, selectedFight, playerCombatantInfo, characterProfile, playerDetails)`，随即调用 `initializeModules()`，合并三份静态模块表：

- `internalModules`（核心接线：`eventEmitter`、`combatants`、`enemies`、`spellInfo`、`debugAnnotations`、normalizers）
- `defaultModules`（共享模块：`healingDone`/`damageDone`/`damageTaken`、`abilityTracker`、`abilities`、`buffs: Auras`、`CastEfficiency`、`spellUsable`、`haste`、`statTracker`、`globalCooldown`，以及物品/种族/饰品检查器）
- `specModules`（由各专精子类覆写）

关键方法：
- `initializeModules()` / `loadModule()` —— 手写依赖注入循环。按各模块静态 `dependencies` 解析已加载模块，按 `priority` 排序，最多迭代 `MAX_DI_ITERATIONS`(100) 次。初始化失败的模块记入 `disabledModules[ModuleError.INITIALIZATION]`（生产吞错，开发重抛）。
- `getModule()` / `getOptionalModule()` —— 按类（或其父类）查模块实例，`instanceof` 沿继承链匹配，`_moduleCache` 缓存。
- `normalize(events)` —— 按 `priority` 顺序运行所有活跃 `EventsNormalizer`，每个都会变换事件数组。
- `generateResults(adjustForDowntime)` —— 按 priority 逆序遍历模块，收集 `Analyzer.statistic()` 与 `Analyzer.tab()` 的 React 元素到 `ParseResults`；某模块出错时整轮重试并 `deepDisable` 该模块。
- `buildGuide()` —— 若子类设了 `static guide`，用 `GuideContainer > GuideContext > ExplanationContextProvider > SpellUsageContextProvider` 包裹，传入 `{ modules, info, events }`。
- `info` getter —— 组装 `Info` 对象（abilities、pets、战斗时间、selectedCombatant）传给指南组件与 metric。
- `serverMetrics` —— 聚合错误率（cooldown/gcd/active-time）供上传。
- 其它：`applyTimeFilter`、`fightDuration`、`currentTimestamp`、`eventCount`、`eventHistory`（实时数组）、`normalizedEvents`（过 normalizer 后）。

### 1.2 `Module` —— 所有模块的基类

**文件**：`src/parser/core/Module.ts`，默认导出 `Module`。

每个模块（normalizer、analyzer、emitter、tracker）都继承 `Module`。持有 `owner`（CombatLogParser）、`active`、`priority`、`key`，暴露 `selectedCombatant`/`config` getter 与 `debug/log/warn/error` 控制台助手。静态 `applyDependencies(options, instance)` 把非 owner/priority 的选项赋到实例上——这就是类型化依赖注入的机制。`Options` 接口在此导出。

### 1.3 三种模块原型

- **`Analyzer`**（`Analyzer.ts`）：继承 `EventSubscriber`。导出 `SELECTED_PLAYER = 1`、`SELECTED_PLAYER_PET = 2`、`Options`、`ParseResultsTab`、`withDependencies` HOC，以及函数式分析器工厂 `statistic()` 与 `suggestion()`。覆写 `statistic()`（返回 ReactNode）与废弃的 `tab()`；`addDebugAnnotation()` 喂给调试视图。
- **`EventSubscriber`**（`EventSubscriber.ts`）：模块订阅事件的基类。`addEventListener(filter, listener)` 调用 `owner.addEventListener(...)` 并把 listener 绑定到模块；`!this.active` 时跳过。
- **`EventsNormalizer`**（`EventsNormalizer.ts`）：抽象类，暴露抽象 `normalize(events)`、`getFightStartIndex()`、`addDebugAnnotation()`。

### 1.4 实体类型

- **`Combatant` / `FullCombatant`**（`Combatant.ts`）：`Combatant` 继承 `Entity`，代表一个友好玩家，解析 `spec`、`race`、`faction`、`pullStats`（冻结基础属性 + `config.statMultipliers`）、天赋（经典服点法 + 正式服天赋树 `importTalentTree`）、装备 `parseGear`、雕文、战前 buff `parsePrepullBuffs`。提供 `hasTalent()`、`getTalentRank()`、`hasTrinket()`、`has2PieceByTier()` 等。`FullCombatant`（被选玩家）必有完整 `CombatantInfoEvent`，由 `Combatants` 模块只构造一次。
- **`Combatants`**（`parser/shared/modules/Combatants.ts`）：把每个友好玩家注册为 `Combatant`，被选玩家注册为 `FullCombatant`。暴露 `selected`、`players`、`getEntity(event)`/`getSourceEntity(event)`。若被选玩家缺 `CombatantInfoEvent` **会抛错**。
- **`Entity` / `Enemy` / `Enemies` / `Pet` / `Pets`**：敌人与宠物实体及其注册模块（`Enemies.ts` 还导出 `encodeEventTargetString`）。

### 1.5 指标与统计计算

- `metric.ts`：`Info`（接口）、`Metric`（类型）、默认 `metric(fn)`（按 `(events, ...args)` 记忆化，避免重渲染重算）。
- `stats.ts` 及 `statsMultiplierTables/`：治疗/伤害/覆盖率的统计工具。
- 其它：`calculateEffectiveHealing`、`getResourceSpent`、`EventCalculateLib`、`HitCountAoE`、`mergeTimePeriods`、`DotSnapshots`。

### 1.6 建议/问题系统

核心已无独立 Suggestion 模块——建议由 `Analyzer.ts` 的函数式 `suggestion()` 工厂（已废弃）与 `ThresholdStyle`/`Threshold` 类型产生。`ParseResults.tsx` 导出 `ThresholdStyle` 枚举（BOOLEAN/PERCENTAGE/NUMBER/THOUSANDS/DECIMAL/SECONDS）、`Threshold`/`NumberThreshold`/`BoolThreshold`、`ParseResults`（持有 `tabs` 与 `statistics`）。更新的"问题"模型在指南子系统 `src/interface/guide/components/ProblemList.tsx`。

### 1.7 其它核心工具

`StateHistory.ts`（时间索引事件历史，`slice(start,end)`，用于 buff 覆盖与指南 `useEvents`）、`ISSUE_IMPORTANCE.ts`、`SPELL_CATEGORY.ts`、`PhaseConfig.ts`、`Fight.ts`、`Report.ts`、`Player.ts`、`CharacterProfile.ts`、`ModuleError.ts`（错误状态枚举：INITIALIZATION/DEPENDENCY/EVENTS/RESULTS）。

## 2. 事件系统

### 2.1 `Events.ts`（1432 行）—— 类型、`EventType`、`Events` 过滤器工厂

- `EventType` 枚举覆盖真实 WCL 事件（`heal`、`damage`、`cast`、`begincast`、`applybuff`、`applydebuff`、`removebuff(debuff)`、`refreshbuff`、`summon`、`resourcechange`、`interrupt`、`death`、`combatantinfo`、`aurabroken`、`empowerstart/end`、`leech`、`staggerclear`、`staggerprevented`、`reflect`）以及 WoWA 模块**虚构**的事件（`fightend`、`globalcooldown`、`beginchannel`/`endchannel`/`cancelchannel`、`updatespellusable`、`maxchargesincreased/decreased`、`changestats`、`spendresource`、`freecast`、`phasestart/end`、`filtercooldowninfo`、`filterbuffinfo`、`beginresourcecap`，以及专精定制如 `atonement`、`beacon_applied`、`fullshardgained`）。
- `MappedEventTypes` 把每个 `EventType` 映射到具体接口；`AnyEvent<T>` 解析到映射类型。
- 默认导出对象 `Events`：每个事件类型是一个 getter，返回全新的 `EventFilter`（如 `Events.damage`、`Events.cast`、`Events.applybuff`、`Events.heal`、`Events.fightend`、`Events.any`）。配合 `.by(SELECTED_PLAYER)`、`.to(...)`、`.spell(spell)`，惯用法是 `Events.cast.by(SELECTED_PLAYER).spell(TALENT)`。
- 事件链接：`Event` 有 `_linkedEvents`、`_processedLinks`、`__fabricated`、`__modified`、`__reordered` 标记。`AddRelatedEvent`/`GetRelatedEvent(s)`/`HasRelatedEvent` 让模块跨事件附加/读取关系（指南时间轴大量使用）。

### 2.2 `EventFilter`（`EventFilter.ts`）

可链式 `.by(flag)`、`.to(flag)`、`.spell(spell|spell[])`；getter `getBy()/getTo()/getSpell()`。`by`/`to` 校验 `SELECTED_PLAYER | SELECTED_PLAYER_PET`。

### 2.3 `EventEmitter`（`core/modules/EventEmitter.ts`）—— 分发引擎

把 listener 订阅进 `_eventListenersByEventType`（按模块 `priority` 排序），`triggerEvent(event)` 先分发给 CATCH_ALL 再按类型分发。为每个 listener 编译过滤器（by/to/spell）与 active 检查，错误时 `owner.deepDisable(module, ModuleError.EVENTS, err)` + Sentry。提供 `fabricateEvent()`（创建 `__fabricated` 事件，若在分发中则经 `finally()` 延迟）与 `finally()`。维护 `owner._timestamp` 并 push 到 `owner.eventHistory`。

### 2.4 归一化器（Normalizers）

- `EventLinkNormalizer.ts` —— 声明式链接相关事件（`linkRelation`、`linkingEventId/Type`、`referencedEventId/Type`、时间缓冲、`anySource/anyTarget`、`reverseLinkRelation`、`maximumLinks`、`isActive`），喂给 `GetRelatedEvent` 消费者。
- `BuffRefreshNormalizer.ts` —— 修复 buff 刷新顺序。
- `EventOrderNormalizer.ts` —— 按声明的约束重排事件。
- `FriendlyCompatNormalizer.ts`、`InsertableEventsWrapper.ts`。
- 默认注册的共享归一化器：`ApplyBuff.ts`、`CancelledCasts.ts`、`Channeling.ts`、`FightEnd.ts`、`MissingCasts.ts`、`PhaseChanges.ts`、`PrePullCooldowns.ts`、`EmpowerNormalizer.ts`。它们在 `CombatLogParser.normalize()` 运行。

### 2.5 Buff 追踪

- **`Auras`**（`core/modules/Auras.ts`）：继承 `Analyzer.withDependencies({ abilities, haste })`。专精 `auras()` 返回 `SpellbookAura[]`；`loadAuras()` 构建活跃 `Aura`；`registerListeners()` 订阅 `applybuff/removebuff/applydebuff/removedebuff.to(SELECTED_PLAYER).spell(filter)` 并写入 `auraEvents`（`Map<spellId, buffEvent[]>`）。暴露 `history(spellId)`（一个 `StateHistory`）、`getAura`、`isKnownAura`、`add`。
- `core/modules/Aura.ts`：`Aura` 实体 + `SpellbookAura` 接口（`spellId`、`enabled`、`triggeredBySpellId`、`timelineHighlight`）。
- 层数追踪：`shared/modules/BuffStackTracker.ts`；覆盖工具：`BuffCountGraph`、`BuffStackGraph`、`DebuffUptime`、`HotTracker`。

### 2.6 冷却与施法/技能追踪

- **`Abilities`**（`core/modules/Abilities.ts`）：专精 `spellbook()` 返回 `SpellbookAbility[]`；`loadSpellbook()` 构建 `Ability`；`activeAbilities` 是启用的。关键 API：`getAbility`、`getExpectedCooldownDuration`、`getMaxCharges`、`increase/decreaseMaxCharges`（虚构 `MaxChargesIncreased/Decreased` 事件）、`getTimelineSortIndex`、`defaultRange`、`getIsEmpower`。
- `core/modules/Ability.ts`：`Ability` 实体 + `SpellbookAbility` 接口（cooldown、charges、castEfficiency、buffSpellId 等）。
- `shared/modules/SpellUsable.tsx`：冷却状态机（`beginCooldown`/`endCooldown`/`isOnCooldown`/`chargesAvailable`，发出 `UpdateSpellUsableEvent`）。专精会子类化它（如射击猎 `modules/core/SpellUsable.tsx`）加重置逻辑。
- `shared/modules/GlobalCooldown.tsx`：虚构 GCD 事件、追踪每分钟错误数。
- `shared/modules/AbilityTracker.ts`：按法术统计施法/伤害/治疗。
- `shared/modules/CastEfficiency.tsx`：计算施法效率（每分钟施法、最大施法、效率）。UI 在 `parser/ui/CastEfficiency.tsx`。
- `shared/modules/EventHistory.ts`：`getEvents`、`getEventsWithBuff`、`setActiveBuffTrigger`，专精分析与指南广泛使用。
- `shared/modules/SpellHistory.ts`、`CooldownHistory.ts`。
- `shared/modules/SpellManaCost.jsx`、`SpellResourceCost.ts`：给施法事件附加资源消耗。
- 施法归一化：`Channeling.ts`、`CancelledCasts.ts`、`MissingCasts.ts`、`PrePullCooldowns.ts`；增强器 `SpellTimeWaitingOnGlobalCooldown.ts`。

## 3. 专精分析实现（`src/analysis`）

### 3.1 目录布局

- `src/analysis/retail/<class>/<spec>/`：每专精含 `index.ts`（re-export `CONFIG`）、`CONFIG.tsx`（`Config` 对象）、`CombatLogParser.ts`（子类）、`CHANGELOG.tsx`、`constants.ts`、可选 `Guide.tsx`、`modules/`、`normalizers/`，有时 `guide/`。
- `src/analysis/classic/<class>/<spec>/`：同构（多数经典专精无 `Guide.tsx`）。
- `src/analysis/retail/<class>/shared/` 与经典对应目录：职业共享模块（如暗牧 `shared/` 导出 `AtonementAnalyzer`、`TwistOfFate`、`ShadowfiendNormalizer`）。

### 3.2 一个专精如何定义解析器（以戒律牧为例）

- `index.ts`：`export { default } from './CONFIG';`
- `CONFIG.tsx`：默认导出 `Config`：`branch: GameBranch.Retail`、`patchCompatibility`、`supportLevel`（如 `SupportLevel.Foundation`）、`description`、`exampleReport`、`spec: SPECS.DISCIPLINE_PRIEST`、`changelog`、懒加载 `parser: () => import('./CombatLogParser')`、`path: import.meta.url`。
- `CombatLogParser.ts`：`class CombatLogParser extends CoreCombatLogParser`，覆写 `static specModules = { ... }`（normalizers、analyzers、法术/天赋模块、法术信息覆写）与 `static guide = Guide;`。
- `Guide.tsx`：现代指南 React 组件。

### 3.3 注册与检测

- **`src/parser/index.ts`** —— 默认导出 `AVAILABLE_CONFIGS`（`Config[]`），把所有正式服 + 经典服专精配置**静态导入**并显式列出（约 60+ 个）。
- **`src/parser/getConfig.ts`** —— `getConfig(branch, specId, player)` 按 branch 过滤 `AVAILABLE_CONFIGS`，先按 `config.spec.id === specId` 找，找不到再按 `wclClassName`/`wclSpecName` 匹配；还导出 `getConfigForSpec(spec)`。
- **`src/parser/Config.ts`** —— `Config` 类型 + `SupportLevel` 枚举 + `configName()`。`CoreConfig` 含可选 `parser?: () => Promise<typeof CombatLogParser>`。

### 3.4 应用如何为玩家选解析器

`App.tsx` → `interface/routes/report`（懒加载）→ `interface/report/index.tsx` 渲染 `ReportLoader > FightSelection > PlayerLoader`。`PlayerLoader` 调 `getConfig()` 选 `Config`；`useParser(config)` 动态 import `config.parser()`；`useEventParser()` 实例化。`CombatLogParser` 的 `FullCombatant` 从 `SPECS` 解析 `specId` 确认专精。

## 4. 统计子系统（`src/parser/ui`）

- **`Statistic.tsx`** —— 主统计框 React 组件，props `wide`、`category`、`position`、`size`、`drilldown`、`dropdown`、`tooltip`。变体渲染器：`StatisticBox`、`StatisticGroup`、`StatisticBar`、`StatisticsListBox`、`LazyLoadStatisticBox`、`TalentAggregateStatistic`。
- 常量：`STATISTIC_CATEGORY.ts`、`STATISTIC_ORDER.tsx`。
- 值/文本助手：`BoringSpellValueText`、`BoringItemValueText`、`BoringResourceValue`、`ItemDamageDone`、`ItemHealingDone`、`ItemCooldownReduction`、`PlayerBreakdown`、`DonutChart`、`Gauge`、`UptimeBar`、`PerformanceBar`、`QualitativePerformance`、`WeightedPerformance`。
- 这些正是 `Analyzer.statistic()` 返回、`CombatLogParser.generateResults()` 收进 `ParseResults.statistics` 的 ReactNode。

## 5. 指南子系统（`src/interface/guide`）

- **`index.tsx`** —— 核心。导出 `GuideProps`、`Guide` 类型、`ModulesOf<T>`（类型化已构造模块映射）、`Section`、`SubSection`、`SectionHeader`、`GuideContext`、`GuideContainer`，以及 hooks `useAnalyzer`、`useAnalyzers`、`useEvents(range?)`、`useInfo`。还有性能标记/颜色助手（`PerfectMark`、`PerformanceMark`、`qualitativePerformanceToColor`）。渲染是纯 React——指南就是一个接收 `{ modules, events, info }` 的组件。
- **`components/`** —— 复用构建块：`Explanation`/`ExplanationRow`、`ProblemList`（优先级问题）、`CastDetail`、`CastEfficiencyPanel`、`CastOverview`、`CastSequence`、`CastSummaryAndBreakdown`、`CooldownExpandable`、`DamageTakenPointChart`、`BuffUptimeBar`、`GradiatedPerformanceBar`、`PerformanceBoxRow/`、`PassFailBar`、`StackedBar`、`TipBox`、`GuideTooltip`、`Preparation/`、`MajorDefensives/`。
- **`components/Apl/`** —— 施法优先级（APL）分析：`index.tsx`、`rules.tsx`、`timeline.tsx`、`violations/`、`README.md`。
- **`foundation/`** —— 面向最低支持专精的自动"Foundation"指南：`FoundationGuide.tsx`、`FoundationCooldownSection.tsx`、`FoundationDowntimeSection.tsx`/`V2`、`FoundationHealerManaSection.tsx`、`FoundationSupportBadge.tsx`、`ByRole.tsx`、`shared.tsx` + `analyzers/`（`MeleeUptimeAnalyzer`、`DowntimeDebuffAnalyzer`）。
- `parser/core/SpellUsage/core.tsx`：`SpellUsageContextProvider` + `SpellUsageSubSection`（`buildGuide` 用）；`parser/core/MajorCooldowns/MajorCooldown.tsx` & `CooldownUsage.tsx`：大技能使用框架（`MajorDefensives/` 消费）。

## 6. 时间轴（`src/interface/report/Results/Timeline`）

- `Timeline.tsx`（全场时间轴）、`Casts.tsx`、`Auras.tsx`、`Cooldowns.tsx`、`EnemyCasts.tsx`、`Lane.tsx`、`TimeIndicators.tsx`、`Settings.tsx`、`configuration/`（各专精施法条配置）、`EmbeddedTimeline.tsx`（用于指南小节内）。技能/光环轴来自 `Abilities`/`Auras` 模块与事件上的 `EventMeta` 标注。

## 7. 解析结果如何渲染

### 7.1 路由（`src/interface/App.tsx`）

```
report/:reportCode/:fightId?/:player?/:build?
  ├─ index / overview → routes/report/overview.tsx
  ├─ statistics → statistics.tsx
  ├─ timeline → timeline.tsx
  ├─ events → events.tsx
  ├─ debug → debug.tsx
  ├─ character → character.tsx
  ├─ about → about.tsx
  └─ :resultTab → routes/report/dynamic.tsx
```

### 7.2 `Results` 容器（`src/interface/report/Results/index.tsx`）

入参 `parser`、`characterProfile`、`makeTabUrl`、`selectedPhaseIndex`、`applyFilter`、`timeFilter`、`report`、`fight`、`player`、`loadingStatus`、`config`。它：
- 由 `loadingStatus` 计算 `isLoading`（解析器/事件/角色资料/阶段加载 + `parsingState !== DONE`）。
- `useCallback` 记忆化 `parser.generateResults(adjustForDowntime)`，存 `ParseResults`。
- 提供 `ResultsContext`（`results`、`generateResults`、`isLoading`、`adjustForDowntime`）并 `CombatLogParserProvider` 包裹。
- 渲染 `Header`（`results.tabs` 标签）、警告、当前路由 `<Outlet/>`、页脚元数据。

### 7.3 各标签

- **overview**：`useCombatLogParser()` 读 parser → `parser.buildGuide()` → `<Overview guide={...}/>`。无指南则显示占位文案。
- **dynamic**：`useParams()` 读 `{ resultTab }`，在 `results.tabs` 查找，`tab.render()`（`ErrorBoundary` 内），否则"404 tab not found"。
- **statistics**：`ReportStatistics`；**timeline**：`TimelineTab`；**events**：原始事件；**debug**：调试标注；**character/about**：`CharacterTab`/`About`。

### 7.4 完整解析管线（hooks）

详见 [02-data-flow.md](./02-data-flow.md) §2.5。核心是 `useEventParser`：实例化 parser → `normalize` → 空闲时分批 `triggerEvent` → `finish()` → `isLoading=false`，随后 `parser.generateResults()`/`buildGuide()` 渲染。

## 8. 关键横切结论

- **两套输出模型并存**：旧 `Analyzer.statistic()/tab()` → `ParseResults`（`statistics` / `:resultTab` 渲染）与新的 `Guide` 组件（`overview` 渲染）。
- **依赖注入是骨架**：`Module.dependencies` + `Module.applyDependencies` + `CombatLogParser.initializeModules` 构成手写 DI 容器；专精覆写 `static specModules` 与 `static guide` 进行扩展。
- **事件流**：原生 WCL 事件 → `normalize()`（归一化器重排/修复/链接）→ 分批 `EventEmitter.triggerEvent` 分发到类型化 listener → `eventHistory`/`normalizedEvents` → 分析器构建统计/标签/指南状态 → `generateResults()`/`buildGuide()` 渲染。