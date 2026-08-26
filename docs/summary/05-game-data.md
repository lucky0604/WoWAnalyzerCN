# 05 · 游戏数据子系统

本文介绍静态游戏数据的组织方式（`src/game` 与 `src/common` 下的数据表），以及它们如何被消费。

## 1. 元数据与枚举（`src/game/`）

`src/game/` 存放游戏的**元数据与枚举**：

| 文件 | 内容 |
|---|---|
| `SPECS.ts` | `SPECS`：每个专精对象 `{ id, index, className/specName(MessageDescriptor), role, primaryStat, ranking, wclClassName, wclSpecName, branch, masterySpellId }`；类型 `BaseSpec`/`RetailSpec`/`ClassicSpec`/`Spec`；守卫 `isRetailSpec`/`isClassicSpec` |
| `GameBranch.ts` | 枚举 `GameBranch { Retail, Classic }` + `currentExpansion(branch)` |
| `Expansion.ts` | `Expansion` 枚举、`CLASSIC_EXPANSION`、`RETAIL_EXPANSION` |
| `VERSIONS.ts` | WCL game-version ↔ 版本/分支映射（`wclGameVersionToExpansion`、`wclGameVersionToBranch`、`isUnsupportedClassicVersion`） |
| `DIFFICULTIES.ts` | 难度：`DIFFICULTIES`、`CLASSIC_DIFFICULTIES`、`getLabel` |
| `CLASSES.ts` / `RACES.ts` / `ROLES.ts` | 职业 / 种族 / 角色定位 |
| `RESOURCE_TYPES.ts` / `GEAR_SLOTS.tsx` | 资源类型 / 装备槽位 |
| `ITEM_QUALITIES.ts` / `MAGIC_SCHOOLS.ts` / `HIT_TYPES.ts` | 物品品质 / 魔法系别 / 命中类型 |
| `TIERS.ts` / `ZONES.ts` | 套装 T 几 / 区域 |
| `BLOODLUST_BUFFS.ts` / `Faction.ts` | 嗜血 buff / 阵营 |
| `classColor.ts` / `getAverageItemLevel.ts` / `isLatestPatch.ts` | 职业颜色 / 平均装等 / 是否最新补丁 |
| `RealmList.ts` / `REALMS.ts` | 服务器列表（含 `REALMS.CN` 国服服务器） |
| `raids/` | 副本/首领配置（见 §3） |

## 2. 游戏对象数据表（`src/common/SPELLS`、`TALENTS`、`ITEMS`、`NPCS`）

### 2.1 `src/common/SPELLS/`

- `Spell.ts`：`Spell` 接口（id、name、icon、各职业消耗字段）+ `Enchant`、`LegendarySpell`、`isSpell` 守卫。
- `index.ts`：默认导出 `SPELLS`（复合表，经 `safeMerge` + `indexById` + `proxyRestrictedTable` 构建），另有 `maybeGetSpell`、`registerSpell`、`updateSpellName`。合并各职业文件（`deathknight.ts`…`warrior.ts`）、`racials.ts`、`others.ts`、`encounter.ts`、`food.ts`、资料片法术集（`thewarwithin`、`midnight`）以及分析定义的法术。
- `classic/`：经典服法术表。

### 2.2 `src/common/TALENTS/`

各职业天赋文件 + `index.ts`（复合 `TALENTS`）、`getTalentFromEntry.ts`、`maybeGetTalent.ts`、`IGNORED.ts`。天赋由**自动生成脚本**（`scripts/talents/generate-talents.ts`）从 `wow-dbc` 生成（见 08）。

### 2.3 `src/common/ITEMS/`

`Item.ts`（Item 接口）、各职业文件、`gems.ts`/`gemsUtils.ts`、`index.ts`（复合 `ITEMS`）、`classic/`。附有 `scripts/enchants/generate-enchants.ts` 生成附魔/宝石。

### 2.4 `src/common/NPCS/`

`NPC.ts`（NPC 接口）、`shaman.ts`、`index.ts`（`NPCS`）。

### 2.5 消费模式

数据通过 `common/indexById.ts`（`indexById`、`proxyRestrictedTable`）构建"命名键 + id 键"双查表。`parser/getConfig.ts` / `parser/Config.ts`（`Config`、`SupportLevel`、`configName`）把 `Spec` 绑定到其分析配置（`patchCompatibility`、`changelog`、`supportLevel`、`parser`、`pages`、`contributors`）。`AVAILABLE_CONFIGS`（`src/parser` 导出）驱动 `specs.tsx` 与 `support-stats.tsx`。

## 3. 副本/首领配置（`src/game/raids/`）

- `index.ts`：导出 `EncounterConfig`、`EncounterTimelineAbility`、`EncounterTimelineDebuff`、`findByBossId`、`findZoneByBossId`、`normalizedEncounterId`、`Boss`。
- `builders.ts`：构建器。
- 每个副本一个目录：`mop_msv_hof_toes`（熊猫人）、`mythicplusseasonone`、`siege_of_orgrimmar`（决战奥格瑞玛）、`sporefall`、`throne_of_thunder`（雷电王座）、`vs_dr_mqd`。

## 4. 中文名映射（`src/common/CN_MAPPING/`）

国服最有价值的定制之一，把游戏对象映射到中文名。详见 [06-cn-localization.md](./06-cn-localization.md)：

- `index.ts`：`getBossCnName(id)`、`getZoneCnName(id)`、`getDungeonCnName(slug)`、`getMobCnName(name)`，并 re-export 法术名助手。
- `spellNames.ts`：`SPELL_CN_NAMES: Record<number, string>`（约 230 条，按职业分组）+ `getSpellCnName(id)` / `getSpellCnNameByEnglish(englishName)`（懒构建大小写无关的反向索引）。
- `bossNames.ts` / `dungeonNames.ts` / `mobNames.ts` / `zoneNames.ts`。

## 5. 数据生成脚本

游戏数据表大量依赖**自动生成**（见 [08-tooling.md](./08-tooling.md)）：

- `scripts/talents/generate-talents.ts` → `src/common/TALENTS/*.ts`
- `scripts/enchants/generate-enchants.ts` → `src/common/ITEMS/**/*.ts`
- `scripts/cn-sn-slug/generate-cn-server-slug.mjs` → `src/common/CN_SERVER_SLUG.ts`
- `scripts/spell-lists/` → 法术列表更新

这些表都带 `@generated ... DO NOT EDIT DIRECTLY` 头，改动需回归生成脚本而非直接编辑。