# PRD: WoWAnalyzerCN 中英文名称映射

> **Branch**: `localization` | **Base**: `midnight` | **Commit**: `3199b83fc1`
> **Source plan**: `agent_flow/plan-cn-name-mapping.md` (approved by CEO + Eng review)
> **Format**: Ralph Loop compatible

---

## 1. Introduction/Overview

WoWAnalyzerCN 从 Warcraft Logs API 获取战斗数据。API 返回的 `fight.name`（Boss 名称）、`report.title`（副本标题）均为英文。虽然项目使用 Lingui i18n 框架处理静态 UI 文本，但动态 API 数据无法通过编译期翻译文件覆盖。

本项目从 `~/Documents/Code/rpglogs/wcl-mp-client`（魔兽世界辅助工具微信小程序）导入已有的中英文名称映射数据（500+ Boss 名、30+ Zone 名、8 个地城名），在 WoWAnalyzerCN 中创建中文名称查找层，使战斗选择列表、分析结果页等处的 Boss/副本名称显示为中文。

**数据来源文件**：`wcl-mp-client/src/assets/datas/zones.ts`（3535行，500+ 中文条目）

---

## 2. Goals

- 创建 `src/common/CN_MAPPING/` 数据模块，从 wcl-mp-client 导入 Boss/Zone/Dungeon 中文名映射
- 将 `game/raids/` 下所有 boss 定义的 `name` 字段从英文替换为中文
- 在 API 数据展示点注入中文名查找逻辑（`getBossName.ts`、`getFightName.ts`、`Header/index.tsx`）
- 保持英文 fallback：映射未命中时使用原始 API 英文名，不影响功能
- `pnpm typecheck` 和 `pnpm lint` 通过
- 浏览器验证：加载中文 WCL report 后，战斗列表和结果页显示中文 Boss 名

---

## 3. User Stories

### US-001: 创建 CN_MAPPING 数据模块

**Description**: As a 开发者, I want 从 wcl-mp-client 导入中英文名称映射数据 so that 项目有一个统一的中文名称查找数据源。

**Acceptance Criteria**:

- [ ] 创建 `src/common/CN_MAPPING/` 目录
- [ ] `bossNames.ts` 包含 `Record<number, string>` 映射（encounter ID → 中文名），从 `wcl-mp-client/src/assets/datas/zones.ts` 提取全部 200+ 条 boss encounter
- [ ] `zoneNames.ts` 包含 `Record<number, string>` 映射（zone ID → 中文名）
- [ ] `dungeonNames.ts` 包含 `Record<string, string>` 映射（slug → 中文名）
- [ ] `index.ts` 导出 `getBossCnName(id)`、`getZoneCnName(id)`、`getDungeonCnName(slug)` 查找函数
- [ ] 查找函数在未命中时返回 `null`（不抛异常）
- [ ] `pnpm typecheck` 通过

### US-002: 替换 boss 定义文件中的英文名称

**Description**: As a 中国用户, I want 战斗分析页面显示中文 Boss 名 so that 我不需要看英文就能理解分析结果。

**Acceptance Criteria**:

- [ ] `game/raids/vs_dr_mqd/*.ts`（9 个 boss 文件）的 `name` 字段更新为中文
- [ ] `game/raids/mythicplusseasonone/index.ts`（8 个地城/encounter）的 `name` 字段更新为中文
- [ ] `game/raids/mop_msv_hof_toes/*.ts` 的 `name` 字段更新为中文
- [ ] `game/raids/throne_of_thunder/*.ts` 的 `name` 字段更新为中文
- [ ] `game/ZONES.ts` zone name 确认/更新为中文
- [ ] `pnpm typecheck` 通过

### US-003: 创建 getBossDisplayName 查找函数

**Description**: As a 开发者, I want 一个统一的中文名查找函数 so that 所有展示 Boss 名的位置都能正确获取中文名，且有多层 fallback 保证不破坏功能。

**Acceptance Criteria**:

- [ ] 创建 `src/common/getBossDisplayName.ts`
- [ ] 三层优先级查找链：`findByBossId(id)?.name`（硬编码中文） → `getBossCnName(id)`（映射表） → `fallbackName`（API 英文）
- [ ] 当三层都返回时，返回最高优先级的结果
- [ ] `pnpm typecheck` 通过

### US-004: API 数据展示点注入中文名映射

**Description**: As a 中国用户, I want 从 WCL API 加载 report 后看到的 Boss 名是中文的 so that 整个应用的中文体验一致。

**Acceptance Criteria**:

- [ ] `common/getBossName.ts` 使用 `getBossDisplayName(fight.boss, fight.name)` 替代直接使用 `fight.name`
- [ ] `common/getFightName.ts` 通过调用更新后的 `getBossName` 自动获得中文名
- [ ] `interface/report/Results/Header/index.tsx` 中 `BossMiniBox` 的 `boss?.name ?? fight.name` fallback 逻辑确认可正确展示中文（boss 匹配时使用已更新的 boss.name；未匹配时考虑使用 `getBossDisplayName`）
- [ ] `interface/NavigationBar.tsx` 中 `report.title` 在可解析时映射为中文 zone 名
- [ ] 英文 locale（`lang=en`）下仍可正常显示（Boss 名保持中文，因为中文是数据源的默认行为——CN fork 特性）
- [ ] `pnpm typecheck` 通过

### US-005: 测试与验证

**Description**: As a 开发者, I want 映射查找函数有测试覆盖 so that 数据准确性和 fallback 行为得到保证。

**Acceptance Criteria**:

- [ ] `CN_MAPPING/__tests__/bossNames.test.ts` 测试至少 10 个 boss ID 的映射正确性
- [ ] `CN_MAPPING/__tests__/zoneNames.test.ts` 测试 zone ID 映射正确性
- [ ] `getBossDisplayName.test.ts` 测试：已知 boss ID 返回中文、未注册 boss ID 返回 fallback、trash fight (boss=0) 返回 fallback
- [ ] 浏览器验证：加载中文 WCL report，确认战斗选择列表和结果页显示中文
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过

---

## 4. Functional Requirements

### FR-1: 映射数据模块

- FR-1.1: `src/common/CN_MAPPING/bossNames.ts` 导出 `BOSS_CN_NAMES: Record<number, string>`，包含所有从 `wcl-mp-client/src/assets/datas/zones.ts` 提取的 encounter ID→中文名映射
- FR-1.2: `src/common/CN_MAPPING/zoneNames.ts` 导出 `ZONE_CN_NAMES: Record<number, string>`，包含 zone ID→中文名映射
- FR-1.3: `src/common/CN_MAPPING/dungeonNames.ts` 导出 `DUNGEON_CN_NAMES: Record<string, string>`，包含 slug→中文名映射
- FR-1.4: `src/common/CN_MAPPING/index.ts` 导出 `getBossCnName(id: number): string | null`、`getZoneCnName(id: number): string | null`、`getDungeonCnName(slug: string): string | null`
- FR-1.5: 所有查找函数在 ID/slug 未注册时返回 `null`，不抛出错误

### FR-2: Boss 定义更新

- FR-2.1: `game/raids/vs_dr_mqd/` 下 9 个 boss 文件的 `buildBoss({ name: ... })` 参数更新为中文名
- FR-2.2: `game/raids/mythicplusseasonone/index.ts` 中 8 个 `buildBoss({ name: ... })` 参数更新为中文名
- FR-2.3: `game/raids/mop_msv_hof_toes/` 下所有 `buildBoss({ name: ... })` 参数更新为中文名
- FR-2.4: `game/raids/throne_of_thunder/` 下所有 `buildBoss({ name: ... })` 参数更新为中文名

### FR-3: 中文名查找层

- FR-3.1: `src/common/getBossDisplayName.ts` 导出 `getBossDisplayName(fightBossId: number, fallbackName: string): string`
- FR-3.2: 查找优先级：`findByBossId(id)?.name` > `getBossCnName(id)` > `fallbackName`
- FR-3.3: `common/getBossName.ts` 中 `fight.name` 替换为 `getBossDisplayName(fight.boss, fight.name)`
- FR-3.4: `interface/report/Results/Header/index.tsx:BossMiniBox` 中 boss 未匹配的 fallback 使用 `getBossDisplayName(fight.boss, fight.name)`

### FR-4: API 标题映射

- FR-4.1: `interface/NavigationBar.tsx` 中 `report.title` 的展示，当标题可解析为 zone 名时显示中文 zone 名

### FR-5: 测试

- FR-5.1: 单元测试覆盖 `getBossCnName`、`getZoneCnName`、`getBossDisplayName`
- FR-5.2: 类型检查 (`pnpm typecheck`) 通过
- FR-5.3: 代码检查 (`pnpm lint`) 通过
- FR-5.4: 浏览器验证确认中文显示正确

---

## 5. Non-Goals (Out of Scope)

- ❌ **Spell 名称中文化**：`wcl-mp-client` 不包含技能 ID→中文名映射（数据源缺失），需要单独的 spell name 中文化项目
- ❌ **Lingui 翻译文件更新**：静态 UI 文本的中文化由现有 i18n 机制单独处理，不在本项目范围
- ❌ **WCL API 行为修改**：不改变 `translate` 参数或其他 API 请求行为
- ❌ **玩家名/服务器名翻译**：用户数据不应翻译
- ❌ **自动数据同步机制**：映射数据为静态常量，手动更新即可（新版本 ~每 6 个月一次变更）
- ❌ **E2E 自动化测试**：当前项目无 E2E 框架，浏览器手动验证即可

---

## 6. Design Considerations

无 UI 变更。所有变更为数据层替换（英文 string → 中文 string），不影响组件结构、样式或交互。

- 复用现有组件：`BossMiniBox`、`FightSelectionPanel`、`NavigationBar` 无需修改渲染逻辑
- 中文名作为 `string` 值直接覆盖，与现有的 Lingui `i18n._()` 调用无关（Lingui 处理格式化字符串如 "Kill - 3:45"，其中 Boss 名作为插值参数）

---

## 7. Technical Considerations

### 7.1 数据导入方式

从 `wcl-mp-client/src/assets/datas/zones.ts` 手动提取 encounter 条目，构建 `Record<number, string>`。不使用运行时导入（避免跨项目依赖）。

提取模板：

```typescript
// 从 zones.ts 中遍历每个 zone 的 encounters 数组
// 对每个 { id: number, name: string } 生成一行映射
[id]: 'name',
```

### 7.2 注入点总览

| 文件                                        | 修改方式                                | 影响函数/组件                     |
| ------------------------------------------- | --------------------------------------- | --------------------------------- |
| `game/raids/**/*.ts`                        | 替换 `name: "English"` → `name: "中文"` | `buildBoss()`, `findByBossId()`   |
| `common/getBossName.ts`                     | 使用 `getBossDisplayName()`             | `getBossName()`, `getFightName()` |
| `interface/report/Results/Header/index.tsx` | 更新 fallback 逻辑                      | `BossMiniBox`                     |
| `interface/NavigationBar.tsx`               | 添加 title 映射                         | 导航栏标题                        |

### 7.3 性能

- 查找函数为 O(1) hash lookup + O(n) 遍历（n≈30，对 `findByBossId`）
- 每个页面仅调用 1-2 次（非高频事件）
- 数据模块约 15KB gzipped

### 7.4 与现有 i18n 的关系

```
Lingui (静态 UI 文本)          CN_MAPPING (动态 API 数据)     SPELLS (硬编码技能)
────────────────────────────────────────────────────────────────────────────────
Button labels, nav, help     Boss names, zone names,        Spell ID → name
messages.json (zh/en)        dungeon names, seasons          (P2: 添加 CN name)
静态编译期翻译               运行时 O(1) 查找                编译期常量 + 运行时注册
```

两种翻译系统互补，不互相覆盖。

---

## 8. Success Metrics

- **覆盖率**：当前赛季所有 Boss（~30 个）显示中文名 → 100%
- **覆盖率**：Zone 名称中文化 → 100%（当前赛季 3-5 个 zone）
- **覆盖率**：Dungeon 名称中文化 → 100%（当前赛季 8 个地城）
- **Fallback 安全**：映射未命中时用户体验不降级（仍显示英文名）
- **类型安全**：`pnpm typecheck` 零错误
- **代码质量**：`pnpm lint` 零错误

---

## 9. Open Questions

- Q1: `report.title` 的格式是否固定？映射 zone name 后是否需要保留其他信息（如难度、服务器名）？
  - **默认处理**：仅替换可识别的 zone 名部分，保留其余字符串
- Q2: 英文 locale 用户是否应该看到中文 Boss 名？
  - **当前方案**：是的。`game/raids/` 中的 name 字段是所有 locale 共享的 —— WoWAnalyzerCN 是 CN 专用 fork
- Q3: Spell name 中文化的数据来源是什么？
  - **延后**：需要从游戏客户端中文数据（如 zhCN.lua）提取 spell ID→中文名映射。作为独立 PR 处理

---

## 10. File Change Manifest

### 新增文件

```
src/common/CN_MAPPING/index.ts
src/common/CN_MAPPING/bossNames.ts          (~200 lines)
src/common/CN_MAPPING/zoneNames.ts           (~30 lines)
src/common/CN_MAPPING/dungeonNames.ts        (~10 lines)
src/common/CN_MAPPING/__tests__/bossNames.test.ts
src/common/CN_MAPPING/__tests__/zoneNames.test.ts
src/common/getBossDisplayName.ts
src/common/__tests__/getBossDisplayName.test.ts
```

### 修改文件（阶段 2 – Boss 名称替换）

```
game/raids/vs_dr_mqd/Beloren.ts              (name: "英文" → "中文")
game/raids/vs_dr_mqd/Chimaerus.ts            (同上)
game/raids/vs_dr_mqd/CrownOfTheCosmos.ts     (同上)
game/raids/vs_dr_mqd/ImperatorAverzian.ts    (同上)
game/raids/vs_dr_mqd/LightblindedVanguard.ts (同上)
game/raids/vs_dr_mqd/MidnightFalls.ts        (同上)
game/raids/vs_dr_mqd/Salhadaar.ts            (同上)
game/raids/vs_dr_mqd/VaelgorEzzorak.ts       (同上)
game/raids/vs_dr_mqd/Vorasius.ts             (同上)
game/raids/mythicplusseasonone/index.ts      (8个 name 更新)
game/raids/mop_msv_hof_toes/*.ts             (多个 boss name 更新)
game/raids/throne_of_thunder/*.ts            (多个 boss name 更新)
```

### 修改文件（阶段 3 – API 映射注入）

```
common/getBossName.ts                        (使用 getBossDisplayName)
common/getFightName.ts                       (继承修改)
interface/report/Results/Header/index.tsx     (fallback 逻辑)
interface/NavigationBar.tsx                  (title 映射)
```

---

_此 PRD 基于 `agent_flow/plan-cn-name-mapping.md` 生成，已通过 CEO + Eng 双评审（6/6 consensus）。_
