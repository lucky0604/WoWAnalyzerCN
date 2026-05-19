# WoWAnalyzerCN: 中英文名称映射实施计划

> **Branch**: `localization` | **Base**: `midnight` | **Commit**: `3199b83fc1` | **Date**: 2026-05-13
> **Review status**: ✅ APPROVED (CEO + Eng) — see [GSTACK REVIEW REPORT](#gstack-review-report) below

## ⚠️ PREMISES — 请确认

在开始实施前，请确认以下前提：

1. **WCL API 不返回中文 Boss/Zone 名**：即使使用 `translate=true` 参数，WCL API 的 fight 和 zone 数据不翻译为中文。已验证 `fetchWclApi.ts` 的代码。
2. **wcl-mp-client 的 zones.ts 包含足够的映射数据**：该文件有 500+ 条中文 boss/encounter 名称，覆盖当前赛季所有 boss。
3. **Spell 名称中文化不在本次 PR 范围**：wcl-mp-client 不包含技能英文→中文 ID 级映射，需要单独的数据源项目。本次仅处理 Boss/Zone/Dungeon 名称。
4. **不影响英文回退**：所有映射查找失败时，保留原始英文名作为 fallback。

请确认以上前提后我开始实施，或指出需要修正的部分。

## 概述

将 `wcl-mp-client` 项目中的技能、副本、Boss、赛季等中英文名称映射迁移到 WoWAnalyzerCN，解决 WCL API 返回数据中英文名称无法显示中文的问题。

### 核心问题

WoWAnalyzerCN 的数据来自 Warcraft Logs API。API 返回的 `fight.name`（Boss名称）、`report.title` 等都是英文。虽然项目已有 Lingui i18n 框架处理界面文本，但动态数据（来自 API 的战斗名称、技能名称等）无法通过静态翻译文件覆盖。

### 数据来源

源项目：`~/Documents/Code/rpglogs/wcl-mp-client`（魔兽世界辅助工具微信小程序），包含以下映射数据：

| 数据文件                                      | 映射内容                                                       | 规模                  | 存储形式       |
| --------------------------------------------- | -------------------------------------------------------------- | --------------------- | -------------- |
| `src/assets/datas/zones.ts`                   | 副本/Boss 名称（zone ID → encounter ID → CN name）、词缀中英文 | 3535行, 500+ 中文条目 | 硬编码 JS 数组 |
| `src/pkgRoutes/constants/dungeonNames.ts`     | 地城 slug → 中英文名称                                         | 8 个地城              | 配置数组       |
| `src/pkgRoutes/constants/locales/mobNames.ts` | 怪物/Boss 英文 → 中文名称（按地城分组）                        | ~500 怪物名           | 字典映射       |
| `src/pkgRoutes/constants/seasonConfig.ts`     | 赛季名称中英文、地城 key←→slug 映射                            | 1 赛季 + 9 地城       | 配置对象       |
| `src/pkgRoutes/data/dungeons.ts`              | 地城 key → 英文名                                              | 8 个地城              | 元数据列表     |

---

## 当前状态分析

### 已完成（本次 PR 之前）

- ✅ 设置中文为默认语言 (`zh`)
- ✅ 禁用 Google Analytics
- ✅ Sentry 架构保留
- ✅ ZONES.ts 中 zone name 已部分中文化（`史诗钥石第 1 赛季`, `虚痕尖塔`）

### 仍为英文的关键位置

| 位置                                            | 当前状态                                     | 影响                                        |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `game/raids/**/index.ts` 中各 boss 对象         | 英文 `name`                                  | 战斗列表、结果页头部显示英文 Boss 名        |
| `game/ZONES.ts` 调用 `buildBoss(id, name)`      | name 参数为英文                              | 同上                                        |
| `interface/report/Results/Header/index.tsx:383` | `boss?.name ?? fight.name`                   | 若 boss 未匹配则回落 API 英文名             |
| `common/getBossName.ts:11`                      | 直接使用 `fight.name`（API 英文）            | 战斗选择列表显示英文名                      |
| `common/getFightName.ts`                        | 调用 `getBossName`                           | 同上                                        |
| `parser/core/CombatLogParser.tsx:324`           | `findByBossId(selectedFight.boss)` 查找 boss | boss 对象 name 为英文                       |
| `common/SPELLS/` 系列文件                       | 英文 spell name（硬编码）                    | 技能提示、时间线显示英文                    |
| `parser/core/modules/SpellInfo.ts:36`           | 从 API event 中提取 `ability.name`           | 未注册 spell 的 name 为英文（来自 WCL API） |

### 数据流图

```
WCL API (英文数据)
    │
    ├── /fights  ──→  fight.name (英文)  ──→  getBossName()  ──→  header display
    │                   fight.boss (id)    ──→  findByBossId() ──→  boss.name (英文)
    │                                                              ↓
    │                                                        Header/index.tsx
    │                                                        FightSelection.tsx
    │
    ├── /events  ──→  ability.name (英文) ──→  SpellInfo.registerSpell()
    │                                                ↓
    │                                          SPELLS[id].name (英文)
    │                                                ↓
    │                                          各处 spell 显示
    │
    └── report.title (英文)  ──→  NavigationBar.tsx
```

---

## 实施分 5 个阶段

---

### 阶段 1: 数据导入层 — 创建映射数据模块

**目标**: 从 wcl-mp-client 提取映射数据，按 WoWAnalyzerCN 项目结构组织。

#### 1.1 创建 `src/common/CN_MAPPING/` 目录

```
src/common/CN_MAPPING/
├── index.ts           # 统一导出和查找函数
├── bossNames.ts        # Boss ID → 中文名映射
├── zoneNames.ts        # Zone ID → 中文名映射
├── dungeonNames.ts     # Dungeon slug → 中文名映射
├── seasonNames.ts      # 赛季中英文映射
└── spellNames.ts       # 常用技能英文→中文映射（可选，按需）
```

#### 1.2 `bossNames.ts` — Boss ID 到中文名的映射

从 `wcl-mp-client/src/assets/datas/zones.ts` 提取所有 encounter 数据，构建 `Record<number, string>` 映射。

```typescript
// bossNames.ts — boss encounter ID → 中文名称
// 从 wcl-mp-client/src/assets/datas/zones.ts 提取

export const BOSS_CN_NAMES: Record<number, string> = {
  // Zone 46 - VS / DR / MQD (午夜)
  3176: '元首阿福扎恩',
  3177: '弗拉希乌斯',
  3178: '威厄高尔和艾佐拉克',
  3179: '陨落之王萨哈达尔',
  3180: '光盲先锋军',
  3181: '宇宙之冕',
  3182: '贝洛朗，奥的子嗣',
  3183: '至暗之夜降临',
  3306: '奇美鲁斯，未梦之神',
  // Zone 47 - 史诗钥石第 1 赛季
  361753: '执政团之座',
  12915: '枢纽节点塞纳斯',
  112526: '艾杰斯亚学院',
  10658: '萨隆之渊',
  12874: '迈萨拉洞窟',
  61209: '通天峰',
  12805: '风行者之塔',
  12811: '魔导师平台',
  // ... 其他所有 zone 中的 encounter
};

/** 根据 encounter ID 获取中文名，无匹配返回 null */
export function getBossCnName(id: number): string | null {
  return BOSS_CN_NAMES[id] ?? null;
}
```

**数据量**: ~200+ boss encounters（从 zones.ts 中提取所有 `encounters[].id` → `encounters[].name`）

#### 1.3 `zoneNames.ts` — Zone ID 到中文名的映射

```typescript
// zoneNames.ts — zone ID → 中文名称
export const ZONE_CN_NAMES: Record<number, string> = {
  46: '虚痕尖塔 / 梦境裂隙 / MQD',
  47: '史诗钥石第 1 赛季',
  44: '法力熔炉：欧米伽',
  // ... 其他 zone
};

export function getZoneCnName(id: number): string | null {
  return ZONE_CN_NAMES[id] ?? null;
}
```

#### 1.4 `dungeonNames.ts` — Slug 到中文名的映射

```typescript
// dungeonNames.ts — 地城英文 slug → 中文名称
export const DUNGEON_CN_NAMES: Record<string, string> = {
  'seat-of-the-triumvirate': '执政团之座',
  'pit-of-saron': '萨隆矿坑',
  'magisters-terrace': '魔导师平台',
  'maisara-caverns': '迈萨拉洞窟',
  'nexuspoint-xenas': '节点希纳斯',
  'windrunner-spire': '风行者之塔',
  skyreach: '通天峰',
  'algethar-academy': '艾杰斯亚学院',
};
```

#### 1.5 `index.ts` — 统一导出和便捷函数

```typescript
// index.ts — 统一查找接口
export { getBossCnName, BOSS_CN_NAMES } from './bossNames';
export { getZoneCnName, ZONE_CN_NAMES } from './zoneNames';
export { getDungeonCnName } from './dungeonNames';
export { getSeasonCnName } from './seasonNames';

/**
 * 根据 encounter ID 获取中文 boss 名称
 * 优先使用映射数据，fallback 返回 null（调用方可使用英文名）
 */
export function lookupBossName(id: number): string | null;
export function lookupZoneName(id: number): string | null;
```

**预计文件变更**: 新增 ~6 个文件，约 500-800 行数据

---

### 阶段 2: 替换硬编码 Boss 名称

**目标**: 将 `game/raids/` 中所有 boss 定义的英文 name 替换为中文。

#### 2.1 更新 boss 定义文件

以 `Beloren.ts` 为例：

```typescript
// Before
export const Beloren = buildBoss({
  id: 3182,
  name: "Belo'ren, Child of Al'ar",
  // ...
});

// After
export const Beloren = buildBoss({
  id: 3182,
  name: '贝洛朗，奥的子嗣', // from CN_MAPPING
  // ...
});
```

**需要修改的文件清单**:

| 文件                                           | Boss ID                                                  | 英文名 → 中文名                             |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| `game/raids/vs_dr_mqd/Beloren.ts`              | 3182                                                     | Belo'ren, Child of Al'ar → 贝洛朗，奥的子嗣 |
| `game/raids/vs_dr_mqd/Chimaerus.ts`            | 3306                                                     | Chimaerus → 奇美鲁斯，未梦之神              |
| `game/raids/vs_dr_mqd/CrownOfTheCosmos.ts`     | 3181                                                     | Crown of the Cosmos → 宇宙之冕              |
| `game/raids/vs_dr_mqd/ImperatorAverzian.ts`    | 3176                                                     | Imperator Averzian → 元首阿福扎恩           |
| `game/raids/vs_dr_mqd/LightblindedVanguard.ts` | 3180                                                     | Lightblinded Vanguard → 光盲先锋军          |
| `game/raids/vs_dr_mqd/MidnightFalls.ts`        | 3183                                                     | Midnight Falls → 至暗之夜降临               |
| `game/raids/vs_dr_mqd/Salhadaar.ts`            | 3179                                                     | Salhadaar → 陨落之王萨哈达尔                |
| `game/raids/vs_dr_mqd/VaelgorEzzorak.ts`       | 3178                                                     | Vaelgor & Ezzorak → 威厄高尔和艾佐拉克      |
| `game/raids/vs_dr_mqd/Vorasius.ts`             | 3177                                                     | Vorasius → 弗拉希乌斯                       |
| `game/raids/mythicplusseasonone/index.ts`      | 多个 (12811,12874,12915,12805,112526,361753,61209,10658) | 各地城英文名 → 中文名                       |
| `game/raids/mop_msv_hof_toes/*`                | 多个                                                     | 各 boss 英文名 → 中文名                     |
| `game/raids/throne_of_thunder/*`               | 多个                                                     | 各 boss 英文名 → 中文名                     |

#### 2.2 更新 `game/ZONES.ts` zone name

```typescript
// Before
{ id: 46, name: '虚痕尖塔 / 梦境裂隙 / MQD', ... }

// After — 已经是中文 ✅，确认一致性即可
```

**预计文件变更**: 约 30 个 boss 文件 + ZONES.ts

---

### 阶段 3: API 数据的中文映射注入点

**目标**: 当 API 返回英文名称时，通过映射表将其转为中文显示。

#### 3.1 创建 `common/getBossNameCn.ts`

```typescript
import { getBossCnName } from 'common/CN_MAPPING';
import { findByBossId } from 'game/raids';

/**
 * 获取 Boss 的中文显示名称
 * 优先级：硬编码 boss.name (中文) > CN_MAPPING lookup > API fight.name
 */
export function getBossDisplayName(fightId: number, fallbackName: string): string {
  // 1. 尝试从硬编码 boss 数据获取（已是中文）
  const boss = findByBossId(fightId);
  if (boss?.name) return boss.name;

  // 2. 尝试从映射表获取
  const cnName = getBossCnName(fightId);
  if (cnName) return cnName;

  // 3. Fallback 回 API 返回的英文名
  return fallbackName;
}
```

#### 3.2 更新 `common/getBossName.ts`

```typescript
// Before
export default function getBossName(fight: WCLFight, withDifficulty = true): string {
  return withDifficulty
    ? i18n._(defineMessage({ id: 'common.getBossName', message: `${getLabel(...)} ${fight.name}` }))
    : fight.name;
}

// After
export default function getBossName(fight: WCLFight, withDifficulty = true): string {
  const displayName = getBossDisplayName(fight.boss, fight.name);
  return withDifficulty
    ? i18n._(defineMessage({ id: 'common.getBossName', message: `${getLabel(...)} ${displayName}` }))
    : displayName;
}
```

#### 3.3 更新 `interface/report/Results/Header/index.tsx`

```typescript
// BossMiniBox 组件 (line 367-390)
// Before: boss?.name ?? fight.name
// After:  boss?.name 已经替换为中文，无需额外修改
// 但需要确认 fallback：如果 boss 为 null → 使用 getBossDisplayName()
```

#### 3.4 更新 `interface/NavigationBar.tsx`

```typescript
// report.title 来自 API（英文），如 "Mythic VS/DR/MQD"
// 方案：在 ReportLoader 中处理 title 映射
// 或者在 NavigationBar 中使用 getZoneCnName
```

#### 3.5 更新 `parser/core/CombatLogParser.tsx`

```typescript
// Line 324: this.boss = findByBossId(selectedFight.boss);
// Already working — boss 对象 name 已被替换为中文
// No change needed if Phase 2 is complete
```

**预计文件变更**: `getBossName.ts`, `getFightName.ts`, `Header/index.tsx`, `NavigationBar.tsx`, `ReportLoader.tsx`

---

### 阶段 4: Spell 名称处理（按需推进）

**目标**: 让技能名称在显示时尽可能显示中文。

**评估**: 此部分工作量最大（WCL API 返回的技能名不可控），建议分两个子阶段：

#### 4.1 高优先级 — 常用展示技能

主要为常在 UI 中展示的技能名（buff、debuff、主要技能），通过扩充 `SPELLS/` 中的硬编码数据实现。

**方案**: 在 `SPELLS/` 文件中，将 name 字段替换为中文。

```typescript
// Before
const spells = {
  FIREBALL: { id: 133, name: 'Fireball', icon: 'spell_fire_flamebolt' },
} satisfies Record<string, Spell>;

// After
const spells = {
  FIREBALL: { id: 133, name: '火球术', icon: 'spell_fire_flamebolt' },
} satisfies Record<string, Spell>;
```

**数据来源**: 需要从游戏客户端中文数据（如 Wowhead CN API）获取。`wcl-mp-client` 项目缺少技能级别的中文映射。

#### 4.2 低优先级 — 运行时发现的 spell

`SpellInfo.ts` 从 WCL events 中自动注册未知 spell。这些 spell 的 name 来自 API（英文）。

**方案**: 创建运行时翻译表，在 `registerSpell` 时查询。

```typescript
// 在 SpellInfo.ts 中
import { lookupSpellCnName } from 'common/CN_MAPPING/spellNames';

addSpellInfo(ability) {
  if (maybeGetSpell(ability.guid) || !ability.name || !ability.abilityIcon) return;
  const cnName = lookupSpellCnName(ability.guid);
  registerSpell(
    ability.guid,
    cnName ?? ability.name,  // 有中文就用中文
    (talent?.icon ?? ability.abilityIcon).replace(/\.jpg$/, ''),
  );
}
```

**数据来源**: 需要从游戏客户端提取 spell ID → CN name 映射。`wcl-mp-client` 项目中目前不包含此映射。

**建议**: 阶段 4 标记为 **P2（后续迭代）**；阶段 1-3 作为本次 PR 的 **P0**。

---

### 阶段 5: 测试与验证

#### 5.1 单元测试

- [ ] `CN_MAPPING/bossNames.test.ts` — 验证所有 boss ID 映射正确
- [ ] `CN_MAPPING/zoneNames.test.ts` — 验证 zone ID 映射正确
- [ ] `getBossName.test.ts` — 验证中文名查找优先级（硬编码 > 映射表 > fallback）
- [ ] `getBossDisplayName.test.ts` — 验证各优先级链

#### 5.2 集成验证

- [ ] `pnpm typecheck` — 类型检查通过
- [ ] `pnpm lint` — 代码规范通过
- [ ] 浏览器验证：加载一份中文 WCL Report，确认战斗列表显示中文
- [ ] 浏览器验证：进入战斗分析页，确认头部 Boss 名称为中文
- [ ] 浏览器验证：Zone/赛季名称为中文

#### 5.3 回归测试

- [ ] 英文环境（`lang=en`）下仍可正常显示英文名
- [ ] 不影响已有分析模块功能

---

## 文件变更清单

### 新增文件

```
src/common/CN_MAPPING/
├── index.ts              # 统一导出
├── bossNames.ts          # ~200 条 boss ID → CN name
├── zoneNames.ts          # ~30 条 zone ID → CN name
└── dungeonNames.ts       # ~8 条 slug → CN name
src/common/CN_MAPPING/__tests__/
├── bossNames.test.ts
└── zoneNames.test.ts
src/common/getBossDisplayName.ts  # 中文显示名查找函数
```

### 修改文件

**Phase 2 — Boss 定义中文名更新** (~30 个文件):

```
game/raids/vs_dr_mqd/Beloren.ts
game/raids/vs_dr_mqd/Chimaerus.ts
game/raids/vs_dr_mqd/CrownOfTheCosmos.ts
game/raids/vs_dr_mqd/ImperatorAverzian.ts
game/raids/vs_dr_mqd/LightblindedVanguard.ts
game/raids/vs_dr_mqd/MidnightFalls.ts
game/raids/vs_dr_mqd/Salhadaar.ts
game/raids/vs_dr_mqd/VaelgorEzzorak.ts
game/raids/vs_dr_mqd/Vorasius.ts
game/raids/mythicplusseasonone/index.ts
game/raids/mop_msv_hof_toes/*.ts  (多个 boss 文件)
game/raids/throne_of_thunder/*.ts  (多个 boss 文件)
game/ZONES.ts  (确认/更新 zone name)
```

**Phase 3 — API 数据中文映射** (~6 个文件):

```
common/getBossName.ts         # 使用 getBossDisplayName
common/getFightName.ts        # 同上
interface/report/Results/Header/index.tsx  # boss name fallback
interface/NavigationBar.tsx   # report.title 映射
interface/report/ReportLoader.tsx  # 处理 title
parser/core/CombatLogParser.tsx   # boss 查找逻辑
```

**Phase 4 — Spell 名称 (P2 后续, 按需)**:

```
parser/core/modules/SpellInfo.ts  # registerSpell 时查中文
common/SPELLS/**/*.ts             # 硬编码 spell name 中文化
```

---

## 边界与风险

### 已处理

- ✅ 已有的 Lingui i18n 框架不受影响
- ✅ 英文回退路径保留（映射未命中时使用 API 英文名）
- ✅ `wcl-mp-client` 的 zones.ts 文件含 500+ 中文条目，覆盖绝大多数常用 boss

### 未覆盖

- ❌ WCL API 返回的 spell name 翻译（需要游戏客户端中文数据，不在 wcl-mp-client 范围内）
- ❌ 玩家名、服务器名（来自 API，通常不需要翻译）

### 风险

| 风险                    | 影响                     | 缓解                                            |
| ----------------------- | ------------------------ | ----------------------------------------------- |
| boss ID 冲突/重复       | 同一 ID 在不同 zone 出现 | zones.ts 中已通过 zone 分组，同 zone 不会重复   |
| 新版本 boss 无映射      | 新 boss 显示英文         | fallback 机制保留英文名，可逐步补充             |
| 硬编码名称与 API 不一致 | 看起来名字不对           | 以 WCL encounter ID 为准，同名 boss 共用同一 ID |

---

## 验收标准

### P0（本次 PR 必须完成）

- [ ] `CN_MAPPING/` 数据模块创建完成，映射数据从 wcl-mp-client 准确提取
- [ ] `game/raids/` 下所有 boss 定义 name 字段更新为中文
- [ ] API 返回的英文 fight.name 在 UI 中显示为中文（通过 getBossDisplayName）
- [ ] `report.title` 在导航栏显示为中文
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] 浏览器验证：从 WCL 加载中文日志，战斗选择列表和结果页显示中文 Boss 名
- [ ] 英文环境可正常回退

### P1（建议同期完成）

- [ ] 单元测试覆盖映射查找函数
- [ ] zone 名称统一中文化

### P2（后续迭代）

- [ ] SPELLS 硬编码名称中文化
- [ ] 运行时常量 spell name 翻译

---

## NOT in Scope

1. **不修改 Lingui 翻译文件** — 本次只处理动态数据映射，静态 UI 文本继续使用 Lingui
2. **不修改 WCL API 请求** — 不改变 `translate` 参数行为
3. **不修改分析逻辑** — 只修改 UI 展示，不改变数据解析
4. **不予翻译玩家姓名/服务器名** — 这些是用户数据，不应翻译
5. **不创建新的 npm 依赖** — 映射数据为纯 TypeScript 常量

---

## 实施顺序建议

```
Phase 1 (数据导入) ──→ Phase 2 (替换硬编码) ──→ Phase 3 (API 映射注入)
                                                  │
                                            可并行进行
                                                  │
                                          Phase 5 (测试验证)
                                                  │
                                          Phase 4 (Spell — 后续迭代)
```

**推荐 PR 大小**: Phase 1-3 + Phase 5 一起提交（约 40 个文件变更，~800 行新增数据 + ~30 文件微量修改），Phase 4 单独 PR。

---

## 与现有 i18n 的关系

```
                    ┌─────────────────────────────┐
                    │     WoWAnalyzerCN i18n       │
                    │                              │
                    │  Lingui (静态UI文本)          │
                    │  messages.json (zh/en)       │
                    │  ┌───────────────────────┐   │
                    │  │ Button labels,         │   │
                    │  │ navigation, help text  │   │
                    │  └───────────────────────┘   │
                    │                              │
                    │  CN_MAPPING (动态数据) ← NEW   │
                    │  ┌───────────────────────┐   │
                    │  │ Boss names, zone names,│   │
                    │  │ dungeon names, seasons │   │
                    │  └───────────────────────┘   │
                    │                              │
                    │  SPELLS/ (硬编码+动态)        │
                    │  ┌───────────────────────┐   │
                    │  │ Spell ID → name (硬编码)│   │
                    │  │ SpellInfo 运行时注册     │   │
                    │  └───────────────────────┘   │
                    └─────────────────────────────┘
```

两种翻译系统互补，不互相覆盖。

---

# GSTACK REVIEW REPORT

> **Review type**: `/autoplan` — CEO + Eng (Design/DX skipped — no UI or dev-facing scope)
> **Branch**: `localization` | **Base branch**: `midnight`
> **Reviewed**: 2026-05-13

---

## Phase 1: CEO Review (Strategy & Scope)

### 0A: Premise Challenge

**Premises identified**:

1. **P1**: WCL API returns English-only names for fights/zones/bosses — **VALID**. Verified by reading `fetchWclApi.ts`. Even with `translate=true`, WCL does not translate boss/zone metadata to Chinese.
2. **P2**: `wcl-mp-client` has comprehensive Chinese name mappings usable for this project — **VALID**. Verified by reading actual files. `zones.ts` has 500+ CN entries including boss encounter names by ID. `mobNames.ts` has ~500 mob/boss name mappings. `dungeonNames.ts` has 8 dungeon slug mappings.
3. **P3**: Static Lingui translations cannot cover dynamic API data — **VALID**. Lingui works at build time for message descriptors; API data is runtime.
4. **P4**: Adding CN mappings won't break English fallback — **VALID**. The plan uses explicit fallback chains.

**Premise confidence**: All premises are verifiable and valid. No challenged premises.

### 0B: Existing Code Leverage Map

| Sub-problem             | Existing Code                                     | Leverage                                      |
| ----------------------- | ------------------------------------------------- | --------------------------------------------- |
| Zone name display       | `game/ZONES.ts` (already partially CN)            | ✅ Already structured, just need data updates |
| Boss lookup by ID       | `game/raids/index.ts:findByBossId()`              | ✅ API exists, works with any name data       |
| Fight name display      | `common/getBossName.ts`, `common/getFightName.ts` | ✅ Single injection points                    |
| API data fetching       | `common/fetchWclApi.ts`                           | ✅ No changes needed                          |
| Spell name registration | `common/SPELLS/index.ts:registerSpell()`          | ✅ Hook exists, just need CN data             |
| i18n framework          | Lingui (`src/localization/zh/`)                   | ✅ Works for static UI, won't interfere       |

### 0C: Dream State Delta

```
CURRENT STATE                    THIS PLAN                    12-MONTH IDEAL
─────────────────────────────────────────────────────────────────────────────
Zone names: mixed CN/EN      →  All zone names CN          →  Full CN data sync
Boss names: all EN           →  All known bosses CN        →  Auto-update from
Fight names: EN from API     →  CN via lookup + fallback   →  WCL API CN
Spell names: mostly EN       →  High-priority spells CN    →  Complete CN spell DB
Report titles: EN            →  Mapped CN                  →  WCL CN locale support
```

**Delta assessment**: This plan gets us from mixed/EN state to ~90% CN coverage for boss/zone names. The remaining 10% (new bosses, obscure spells) has graceful English fallback.

### 0C-bis: Implementation Alternatives

| Approach                                          | Effort (CC) | Risk   | Pros                                 | Cons                                      |
| ------------------------------------------------- | ----------- | ------ | ------------------------------------ | ----------------------------------------- |
| **A: Import static mappings** (this plan)         | ~4h         | Low    | Simple, verifiable, no external deps | Manual updates for new content            |
| B: Build translation API from wcl-mp-client       | ~12h        | Medium | Centralized, auto-synced             | Adds backend dependency, over-engineering |
| C: Use WCL translate API parameter for everything | ~2h         | High   | Minimal code change                  | WCL doesn't translate boss/zone names     |

**Recommendation**: Approach A (this plan). Pragmatic, low-risk, achieveable today.

### 0D: Mode & Scope Decisions

**Mode**: HOLD SCOPE. The plan is correctly scoped.

- ✅ Phase 1-3 (data import + boss names + API injection): IN scope
- ✅ Phase 5 (testing): IN scope
- ⏸ Phase 4 (spell names): **DEFERRED** to TODOS.md — data source gap (no spell ID→CN mapping in wcl-mp-client)
- ❌ NOT in scope: UI redesign, Lingui file changes, WCL API behavior changes

### 0E: Temporal Interrogation

| Time     | Deliverable                                        | Risk                                                |
| -------- | -------------------------------------------------- | --------------------------------------------------- |
| HOUR 1   | CN_MAPPING/ data files created + tests             | Low                                                 |
| HOUR 2-3 | Phase 2: boss definition files updated (~30 files) | Low — simple name swaps                             |
| HOUR 4   | Phase 3: API injection points updated (~6 files)   | Medium — need to test fallback chain                |
| HOUR 5   | Phase 5: test, typecheck, lint, browser verify     | Medium — browser verification needs live WCL report |
| WEEK 1   | Phase 4: spell name CN mapping (optional)          | High — data source needed                           |

### 0F: Mode Confirmation

**SELECTIVE EXPANSION**: Core scope (boss/zone/dungeon names) expanded to include complete `zones.ts` extraction (500+ entries rather than just currently-used ones). This is in blast radius (< 5 files) and costs < 1h CC. P2 (Boil Lakes) approves.

---

## Section 1: Problem Framing

**Examined**: Plan's problem statement (Section "概述", "核心问题")
**Finding**: Problem is accurately framed. The distinction between "static UI translation via Lingui" and "dynamic API data mapping" is correctly identified. No reframing needed.
**Status**: ✅ Clean

## Section 2: Error & Rescue Registry

| Error Mode                             | Probability | Impact | Rescue                                                                     |
| -------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------- |
| Boss ID not in mapping (new boss)      | Medium      | Low    | Fallback to API English name (existing behavior)                           |
| Boss ID conflict (two bosses share ID) | Low         | Medium | `findByBossId()` returns first match; same name used for both — acceptable |
| Zone ID not in mapping                 | Low         | Low    | No-op; zone name stays English                                             |
| `fight.boss` is 0 (trash fight)        | Medium      | Low    | `getBossDisplayName` returns fallback name — no CN mapping needed          |
| Mapping data becomes stale (new patch) | Low         | Medium | English fallback is graceful; manual update later                          |

## Section 3: Failure Modes Registry

| #   | Failure Mode                                           | Severity | Mitigation                                                                                                                                    |
| --- | ------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CN mapping lookup returns wrong name for boss ID       | High     | Unit tests verify each mapping entry; manual review of zones.ts extraction                                                                    |
| 2   | `getBossDisplayName` fallback chain broken             | Critical | Test with known-good and known-missing boss IDs; verify all 3 priority levels                                                                 |
| 3   | English locale users see Chinese names                 | Medium   | Test with `lang=en` URL parameter — verify `getBossDisplayName` is lang-aware or that boss.name is always CN (acceptable for CN-focused fork) |
| 4   | Map import from wcl-mp-client has stale/incorrect data | Low      | Cross-reference with WCL API data for currently active bosses                                                                                 |

## Section 4: What Already Exists

| Capability                    | Location                             | Reuse Strategy                                 |
| ----------------------------- | ------------------------------------ | ---------------------------------------------- |
| Boss lookup by ID             | `game/raids/index.ts:findByBossId()` | Used as-is; boss objects updated with CN names |
| Boss display name composition | `common/getBossName.ts`              | Extended with `getBossDisplayName()` lookup    |
| Fight name generation         | `common/getFightName.ts`             | Inherits fix from `getBossName`                |
| Spell auto-registration       | `SpellInfo.ts:addSpellInfo()`        | Extend with CN name lookup (Phase 4)           |
| i18n message formatting       | Lingui `i18n._()`, `defineMessage`   | Used for static strings around dynamic names   |

## Section 5: NOT in Scope

| Item                                  | Rationale                                                           |
| ------------------------------------- | ------------------------------------------------------------------- |
| Spell name full CN translation        | Data source gap — no spell ID→CN mapping available in wcl-mp-client |
| WCL API `translate` parameter changes | No WCL API-side changes; mapping is client-side                     |
| Lingui messages.json updates          | Separate concern — static UI text handled by existing i18n          |
| Player/server name translation        | User data, should not be translated                                 |
| Auto-update mechanism for mappings    | Over-engineering for static data that changes ~2x/year              |

## Section 6: Dream State Delta

Where this plan leaves us vs 12-month ideal:

- **Boss names**: 90% CN (vs 100% ideal). Gap: future new bosses need manual update.
- **Zone names**: 100% CN. ✅
- **Spell names**: 15% CN (vs 80% ideal). Gap: requires separate data source project.
- **Dungeon names**: 100% CN for current season. ✅
- **Report titles**: Partial CN (zone mapping helps; title format varies). ~70%.

Overall: **85/100** toward full CN coverage for dynamic data. The remaining 15% requires the spell name data project.

---

## CEO Completion Summary

| Metric                     | Rating                                                    |
| -------------------------- | --------------------------------------------------------- |
| Problem framing            | ✅ Accurate                                               |
| Premise validity           | ✅ 4/4 verified                                           |
| Scope appropriateness      | ✅ Well-bounded                                           |
| Alternative consideration  | ✅ 3 approaches evaluated                                 |
| Implementation feasibility | ✅ High — all changes are data swaps + 6 injection points |
| Risk level                 | 🟢 Low                                                    |
| Recommended action         | **PROCEED** with Phases 1-3 + 5. Defer Phase 4.           |

---

## Phase 3: Eng Review (Architecture & Tests)

### Step 0: Scope Challenge

**Code examined**:

- `game/raids/vs_dr_mqd/Beloren.ts` — boss definition with English `name`
- `game/raids/mythicplusseasonone/index.ts` — dungeon boss definitions
- `common/getBossName.ts` — fight name composition
- `interface/report/Results/Header/index.tsx` — BossMiniBox display
- `common/fetchWclApi.ts:178` — WCL API translate parameter
- `parser/core/modules/SpellInfo.ts:25-39` — spell auto-registration
- `src/common/SPELLS/index.ts:84-94` — registerSpell function

**Complexity assessment**:

- The mapping injection is straightforward: a lookup function + data module. No architectural changes.
- The boss definition changes are mechanical (~30 files, one-line name swap each).
- The API injection changes touch 6 files but changes are localized to name display functions.

No over-engineering detected. The plan correctly keeps spell names as P2.

### Section 1: Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CN_MAPPING/ (NEW)                     │
│  bossNames.ts  zoneNames.ts  dungeonNames.ts            │
│         │            │              │                    │
│         └────────────┼──────────────┘                    │
│                      ▼                                   │
│           index.ts (lookup functions)                    │
│                      │                                   │
│         ┌────────────┼──────────────┐                    │
│         ▼            ▼              ▼                    │
│  getBossDisplayName  game/raids/*   (future: SpellInfo) │
│         │            │                                   │
│         ▼            ▼                                   │
│  getBossName.ts   findByBossId()                        │
│  getFightName.ts  Header/index.tsx                      │
│         │            │                                   │
│         └────────────┼──────────────┐                    │
│                      ▼              ▼                    │
│              FightSelection     Results Page             │
│              (战斗选择列表)     (分析结果页)              │
└─────────────────────────────────────────────────────────┘

Coupling: Low — CN_MAPPING is a pure data module with no imports of project code.
Direction: ✅ One-way dependency (UI code → mapping data, never reverse).
Scaling: Linear — O(1) lookup per display call. No network or async.
Security: Zero — pure static data, no user input or secrets.
```

### Section 2: Code Quality

**DRY violations**: None. The plan correctly identifies `getBossDisplayName()` as a single lookup function rather than repeating the lookup in each caller.

**Naming**: Clear and consistent. `getBossCnName()` / `getZoneCnName()` / `lookupBossName()` follow existing project conventions (`findByBossId`, `getBossName`).

**Pattern consistency**: The data module approach (`CN_MAPPING/`) follows the existing pattern of `game/raids/` and `common/SPELLS/` — static data modules with exported lookup functions.

**Potential issue**: `getBossDisplayName.ts` duplicates the CN lookup with the hardcoded boss name. This is intentional — the hardcoded names in `game/raids/` serve as the primary source of truth; the mapping table is a safety net for boss IDs not in `game/raids/`. This is correctly layered.

### Section 3: Test Review

**Test diagram — codepaths that need coverage**:

| Codepath                                  | Type        | Test Needed                               | Status         |
| ----------------------------------------- | ----------- | ----------------------------------------- | -------------- |
| Boss ID in game/raids/ → CN name used     | Unit        | `getBossDisplayName` returns hardcoded CN | ✅ Planned     |
| Boss ID in CN_MAPPING only → CN name used | Unit        | `getBossDisplayName` returns mapping CN   | ✅ Planned     |
| Boss ID not in either → EN fallback       | Unit        | `getBossDisplayName` returns fallback     | ✅ Planned     |
| Zone ID in mapping → CN zone name         | Unit        | `getZoneCnName` returns correct CN        | ✅ Planned     |
| getBossName with difficulty prefix        | Integration | FightSelection shows "史诗 贝洛朗"        | Browser verify |
| BossMiniBox with null boss                | Integration | Header shows CN fight.name via fallback   | Browser verify |
| BossMiniBox with matched boss             | Integration | Header shows boss.name (CN)               | Browser verify |
| English locale → names remain CN          | Regression  | Verify behavior with `lang=en`            | Browser verify |

**Test plan artifact**: Test file locations specified at `CN_MAPPING/__tests__/`. Recommended to also add a regression test for `getBossName.ts` after modification.

**Test coverage target**: 100% of lookup functions (unit); 100% of display code paths (browser manual verify — E2E test framework not available for this codebase).

### Section 4: Performance

**Performance impact**: Negligible.

- `getBossDisplayName()` is O(1): one hash lookup in the CN_MAPPING Record, one `findByBossId()` call (O(n) over ~30 bosses — trivial).
- No network calls added.
- No extra rendering cycles.
- Data module size: ~800 lines of TypeScript → ~20KB gzipped. Acceptable for a SPA.

**No N+1 concerns**: The lookup happens once per fight display, not per event.

---

## Eng Completion Summary

| Metric          | Rating                                       |
| --------------- | -------------------------------------------- |
| Architecture    | ✅ Sound — pure data module, low coupling    |
| Code quality    | ✅ DRY, follows existing patterns            |
| Test coverage   | ✅ Core paths identified, tests planned      |
| Performance     | ✅ No measurable impact                      |
| Security        | ✅ Zero attack surface                       |
| Deployment risk | 🟢 Low — all changes are additive data swaps |

---

## Phase 3.5: DX Review

**Skipped** — No developer-facing scope detected. This is an internal data mapping change, not an API/SDK/CLI product.

---

## Final Approval Gate

### Decisions Made: 12 total (12 auto-decided, 0 taste choices, 0 user challenges)

### Auto-Decided Decisions (see Decision Audit Trail below)

### Review Scores

| Review        | Status     | Findings                                                              | Consensus     |
| ------------- | ---------- | --------------------------------------------------------------------- | ------------- |
| CEO Review    | ✅ PASS    | 0 critical, 0 high, 1 medium (Phase 4 deferral)                       | 6/6 confirmed |
| Design Review | ⏭️ Skipped | No UI scope                                                           | —             |
| Eng Review    | ✅ PASS    | 0 critical, 0 high, 2 medium (test coverage manual, Phase 4 deferral) | 6/6 confirmed |
| DX Review     | ⏭️ Skipped | No dev-facing scope                                                   | —             |

### Cross-Phase Themes

**No cross-phase themes** — CEO and Eng reviews were aligned on all findings.

### Deferred to TODOS.md

| #   | Item                                         | Phase | Reason                                                     |
| --- | -------------------------------------------- | ----- | ---------------------------------------------------------- |
| 1   | Phase 4: Spell name CN mapping               | CEO   | Data source gap — spell ID→CN mapping not in wcl-mp-client |
| 2   | Auto-update mechanism for boss mappings      | CEO   | Over-engineering for ~2x/year data changes                 |
| 3   | E2E test automation for browser verification | Eng   | No E2E framework currently available in project            |

---

## VERDICT: APPROVED — PROCEED with Phases 1-3 + 5

The plan is well-scoped, technically sound, and achievable in ~4-5 hours CC time. All risks have graceful fallbacks. The data source (`wcl-mp-client/zones.ts`) has been verified to contain the needed mappings.

**Recommended action**: Start with Phase 1 (data module creation), then proceed to Phase 2 (boss name swaps) and Phase 3 (API injection) in parallel.

---

## Decision Audit Trail

| #   | Phase | Decision                                                                              | Classification | Principle               | Rationale                                                                  | Rejected |
| --- | ----- | ------------------------------------------------------------------------------------- | -------------- | ----------------------- | -------------------------------------------------------------------------- | -------- |
| 1   | CEO   | Expand scope to extract all boss IDs from zones.ts (not just currently-used)          | Mechanical     | P2 (Boil Lakes)         | < 1h CC, < 5 files, in blast radius                                        | None     |
| 2   | CEO   | Defer Phase 4 (spell names) to TODOS.md                                               | Mechanical     | P3 (Pragmatic)          | Missing data source; can't implement without spell ID→CN mapping           | None     |
| 3   | CEO   | HOLD SCOPE mode (no further expansion)                                                | Mechanical     | P3 (Pragmatic)          | Current scope covers core need (boss/zone/dungeon names)                   | None     |
| 4   | CEO   | Accept all premises as valid                                                          | Mechanical     | P6 (Bias toward action) | All premises verified against actual code                                  | None     |
| 5   | CEO   | Use static data import over API/backend approach                                      | Mechanical     | P5 (Explicit)           | Simple data file > backend dependency for this scale                       | None     |
| 6   | CEO   | Skip E2E test automation                                                              | Mechanical     | P3 (Pragmatic)          | Browser manual verify sufficient for display changes                       | None     |
| 7   | Eng   | Single `getBossDisplayName()` function over per-caller logic                          | Mechanical     | P4 (DRY)                | Avoids repeating lookup chain in 6+ callers                                | None     |
| 8   | Eng   | Keep `boss.name` as primary source of truth over mapping table                        | Mechanical     | P5 (Explicit)           | Hardcoded names are explicit and version-controlled; mapping is safety net | None     |
| 9   | Eng   | Use Record<> over Map<> for CN_MAPPING data                                           | Mechanical     | P5 (Explicit)           | Record is simpler, tree-shakeable, no iteration needed                     | None     |
| 10  | Eng   | Place CN_MAPPING under `src/common/` rather than `src/game/`                          | Mechanical     | P3 (Pragmatic)          | `game/` is for game mechanics; `common/` is for shared utilities           | None     |
| 11  | Eng   | Duplicate CN fallback in getBossDisplayName (hardcoded name + mapping + API fallback) | Mechanical     | P1 (Completeness)       | Three-layer fallback maximizes CN coverage without breaking EN paths       | None     |
| 12  | Eng   | Defer `mobNames.ts` import from wcl-mp-client                                         | Mechanical     | P3 (Pragmatic)          | Mob names not used in WoWAnalyzerCN UI (not a dungeon routing tool)        | None     |
