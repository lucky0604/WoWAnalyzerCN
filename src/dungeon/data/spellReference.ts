/**
 * 8 本 Midnight S2 的敌人/技能运行时参考层。
 *
 * - 敌人 → 技能清单与逐 NPC attributes（interruptible / 驱散类型）来自
 *   mdtFacts 参考层（Phase A，source of record）；
 * - spellId → 名字/图标来自 spellFacts/s2.json（Phase C，构造时经 grimoire-wow
 *   DBC 数据生成；版本与 gameBuild 记录在字典头部）；
 * - spellId → zhCN 名/已填数值说明来自 spellFacts/s2.zhTooltips.json
 *   （构造时经 wago.tools DB2 抓取并由 generate-spell-tooltips 渲染，
 *   capturedAt 与登记位见文件头）。
 * - 头像与技能图标沿用自建 OSS / rpglogs CDN；换源只改本文件两处常量。
 */
import altarOfFangsReference from './mdtFacts/altar-of-fangs.json';
import denOfNalorakkReference from './mdtFacts/den-of-nalorakk.json';
import kingsRestReference from './mdtFacts/kings-rest.json';
import murderRowReference from './mdtFacts/murder-row.json';
import rubyLifePoolsReference from './mdtFacts/ruby-life-pools.json';
import templeOfSethralissReference from './mdtFacts/temple-of-sethraliss.json';
import theBlindingValeReference from './mdtFacts/the-blinding-vale.json';
import voidscarArenaReference from './mdtFacts/voidscar-arena.json';
import s2SpellDictionaryJson from './spellFacts/s2.json';
import s2ZhTooltipsJson from './spellFacts/s2.zhTooltips.json';

interface MdtReferenceEnemy {
  npcId: number;
  /** MDT 双语名（enUS 原名 + zhCN 汉化，来自 MDT Locales 的社区翻译）。 */
  name?: { enUS?: string; zhCN?: string };
  /** MDT mob.scale，地图用它对同类型 NPC 区分图标大小；缺失时 UI 回退 1。 */
  scale?: number;
  isBoss?: boolean;
  spells: Array<{ id: number; attributes: string[] }>;
}
interface MdtReferenceShape {
  slug: string;
  sourceKey: string;
  /** 快照头部：副本总 forces 点数（MDT addCount 之和）。 */
  totalEnemyForcesPoints?: number;
  /** MDT 社区汉化覆盖度：full / partial / none。 */
  nameZhCoverage?: string;
  enemies: MdtReferenceEnemy[];
}

const REFERENCE_SOURCES: MdtReferenceShape[] = [
  altarOfFangsReference as unknown as MdtReferenceShape,
  denOfNalorakkReference as unknown as MdtReferenceShape,
  kingsRestReference as unknown as MdtReferenceShape,
  murderRowReference as unknown as MdtReferenceShape,
  rubyLifePoolsReference as unknown as MdtReferenceShape,
  templeOfSethralissReference as unknown as MdtReferenceShape,
  theBlindingValeReference as unknown as MdtReferenceShape,
  voidscarArenaReference as unknown as MdtReferenceShape,
];

interface S2SpellDictionary {
  version: 1;
  packageVersion: string;
  gameBuild: string;
  spells: Record<string, { name: string; icon: string; attributes: string[] }>;
  /** grimoire 无法解析的 spellId -> 原因；登记位允许缺失但不允许静默。 */
  unknownGate: Record<string, string>;
}
const SPELL_DICTIONARY = s2SpellDictionaryJson as unknown as S2SpellDictionary;

export interface SpellFact {
  name: string;
  icon: string;
}

export interface EnemySpellBook {
  spellIds: number[];
  /** spellId → 该施法者身上的 MDT attributes（interruptible / 驱散类型等）。 */
  attributes: ReadonlyMap<number, readonly string[]>;
}

const enemySpellBookByNpcId = new Map<number, EnemySpellBook>();
// npcId → 图面体型（mdtFacts 参考层）：地图图标大小与 Boss 放大的来源。
const enemyVisualByNpcId = new Map<number, { scale?: number; isBoss: boolean }>();
// npcId → 中文名（mdtFacts 参考层）：位置参考页浮层标题在无敌人目录时的回退。
const enemyNameZhByNpcId = new Map<number, string>();
REFERENCE_SOURCES.forEach((dungeon) => {
  dungeon.enemies.forEach((enemy) => {
    const spellIds: number[] = [];
    const attributesById = new Map<number, string[]>();
    enemy.spells
      .slice()
      .sort((left, right) => left.id - right.id)
      .forEach((spell) => {
        spellIds.push(spell.id);
        attributesById.set(spell.id, [...spell.attributes].sort());
      });
    enemySpellBookByNpcId.set(enemy.npcId, { spellIds, attributes: attributesById });
    enemyVisualByNpcId.set(enemy.npcId, {
      scale: enemy.scale,
      isBoss: enemy.isBoss ?? false,
    });
    if (enemy.name?.zhCN) {
      enemyNameZhByNpcId.set(enemy.npcId, enemy.name.zhCN);
    }
  });
});

export const DUNGEON_REFERENCE_ASSET_ORIGIN =
  'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com';

/** NPC 头像地址（自建 OSS /npc_portraits/<npcId>.png）。 */
export function npcPortraitUrl(npcId: number): string {
  return `${DUNGEON_REFERENCE_ASSET_ORIGIN}/npc_portraits/${npcId}.png`;
}

/** 技能图标地址（暴雪图标名 → rpglogs CDN，与 interface/Icon 的 iconUrl 同一来源）。 */
export function dungeonSpellIconUrl(icon: string): string {
  return `https://assets.rpglogs.com/img/warcraft/abilities/${icon}.jpg`;
}

/** 返回某个 NPC 的完整技能 ID 清单；npcId 缺失或未收录时返回空数组。 */
export function getEnemySpellIds(npcId: number | undefined): number[] {
  if (npcId === undefined) return [];
  return enemySpellBookByNpcId.get(npcId)?.spellIds ?? [];
}

/** 返回某个 NPC 的图面体型比例（mdtFacts mob.scale）；未收录时返回 undefined。 */
export function getEnemyScale(npcId: number | undefined): number | undefined {
  if (npcId === undefined) return undefined;
  return enemyVisualByNpcId.get(npcId)?.scale;
}

/** 返回某个 NPC 是否为 Boss（参考层标记，地图上 Boss 图标放大）；未收录时返回 false。 */
export function isEnemyBoss(npcId: number | undefined): boolean {
  if (npcId === undefined) return false;
  return enemyVisualByNpcId.get(npcId)?.isBoss ?? false;
}

/** 返回某个 NPC 的中文名（mdtFacts 参考层，MDT 社区汉化）；未收录时返回 undefined。 */
export function getEnemyNameZh(npcId: number | undefined): string | undefined {
  if (npcId === undefined) return undefined;
  return enemyNameZhByNpcId.get(npcId);
}

/** 返回某个 NPC 逐技能的 MDT attributes；未收录时返回空 Map。 */
export function getEnemySpellAttributes(
  npcId: number | undefined,
): ReadonlyMap<number, readonly string[]> {
  if (npcId === undefined) return new Map();
  return enemySpellBookByNpcId.get(npcId)?.attributes ?? new Map();
}

/** 字典中找不到该 spellId 时返回 undefined（如 ID 占位）。 */
export function getSpellFact(spellId: number | undefined): SpellFact | undefined {
  if (spellId === undefined) return undefined;
  const fact = SPELL_DICTIONARY.spells[String(spellId)];
  return fact ? { name: fact.name, icon: fact.icon } : undefined;
}

interface S2ZhTooltipFile {
  tooltips: Record<string, { name: string; desc: string }>;
}
const ZH_TOOLTIPS = s2ZhTooltipsJson as unknown as S2ZhTooltipFile;

export interface SpellTooltipZh {
  /** zhCN 技能名；空串归一为 undefined。 */
  name?: string;
  /** 生成时已填充数值变量的中文说明。 */
  desc?: string;
}

/**
 * spellId → 中文技能名/说明快照（s2.zhTooltips.json，wago.tools 离线层）。
 * 未收录或快照仅存空串时返回 undefined。运行时优先级见 DungeonMap：
 * 已审校 abilities > RLP 金标准 > 本快照。
 */
export function getSpellTooltipZh(spellId: number | undefined): SpellTooltipZh | undefined {
  if (spellId === undefined) return undefined;
  const entry = ZH_TOOLTIPS.tooltips[String(spellId)];
  if (!entry) return undefined;
  return { name: entry.name || undefined, desc: entry.desc || undefined };
}

export interface SpellDictionaryAudit {
  /** 全部 8 本 mdtFacts 参考层里出现的 spellId（升序）。 */
  referencedSpellIds: number[];
  /** 参考层出现但字典既无事实也未登记缺失的 spellId。 */
  missingFromDictionary: number[];
  /** 字典 unknownGate 登记、参考层确实引用的 spellId。 */
  unknownRegistered: number[];
  /** 字典里登记的 attributes 与参考层跨施法者并集不一致的 spellId。 */
  attributeMismatches: Array<{ spellId: number; dictionary: string[]; references: string[] }>;
  /** 字典头部自述统计：事实条数与 unknownGate 条数（门禁核对参考层引用数）。 */
  dictionaryFacts: number;
  dictionaryUnknowns: number;
}

/**
 * 完整性与漂移审计（门禁与测试共用，不参与运行时渲染）。
 *
 * 与生成器在同一语义下重算：attributes = 参考层跨全部施法者并集、排序去重。
 * 字典若被手改或生成规则漂移，这里会如实报出 mismatch。
 */
export function validateSpellDictionaryCoverage(): SpellDictionaryAudit {
  const unionBySpellId = new Map<number, Set<string>>();
  const referencedSpellIds = new Set<number>();
  REFERENCE_SOURCES.forEach((dungeon) => {
    dungeon.enemies.forEach((enemy) => {
      enemy.spells.forEach((spell) => {
        referencedSpellIds.add(spell.id);
        let union = unionBySpellId.get(spell.id);
        if (!union) {
          union = new Set<string>();
          unionBySpellId.set(spell.id, union);
        }
        spell.attributes.forEach((attribute) => union.add(attribute));
      });
    });
  });

  const missingFromDictionary: number[] = [];
  const unknownRegistered: number[] = [];
  const attributeMismatches: Array<{
    spellId: number;
    dictionary: string[];
    references: string[];
  }> = [];

  for (const spellId of [...referencedSpellIds].sort((left, right) => left - right)) {
    const fact = SPELL_DICTIONARY.spells[String(spellId)];
    if (!fact) {
      if (SPELL_DICTIONARY.unknownGate[String(spellId)]) {
        unknownRegistered.push(spellId);
      } else {
        missingFromDictionary.push(spellId);
      }
      continue;
    }
    const references = [...(unionBySpellId.get(spellId) ?? new Set<string>())].sort();
    if (JSON.stringify(fact.attributes) !== JSON.stringify(references)) {
      attributeMismatches.push({ spellId, dictionary: fact.attributes, references });
    }
  }

  return {
    referencedSpellIds: [...referencedSpellIds].sort((a, b) => a - b),
    missingFromDictionary,
    unknownRegistered,
    attributeMismatches,
    dictionaryFacts: Object.keys(SPELL_DICTIONARY.spells).length,
    dictionaryUnknowns: Object.keys(SPELL_DICTIONARY.unknownGate).length,
  };
}

export interface MdtReferenceSummary {
  /** 收录敌人数（含 Boss）。 */
  enemies: number;
  /** 跨全部敌人去重后的技能 ID 数。 */
  spells: number;
  /** 副本总 forces 点数（快照头部 totalEnemyForcesPoints）。 */
  totalForces: number;
  /** MDT 社区汉化覆盖度：full / partial / none。 */
  zhCoverage: string;
}

const mdtReferenceSummaryBySourceKey = new Map<string, MdtReferenceSummary>();
REFERENCE_SOURCES.forEach((dungeon) => {
  const spells = new Set<number>();
  dungeon.enemies.forEach((enemy) => enemy.spells.forEach((spell) => spells.add(spell.id)));
  const summary: MdtReferenceSummary = {
    enemies: dungeon.enemies.length,
    spells: spells.size,
    totalForces: dungeon.totalEnemyForcesPoints ?? 0,
    zhCoverage: dungeon.nameZhCoverage ?? 'unknown',
  };
  // 目录的 sourceKey 是 slug 形态（altar-of-fangs），MDT 快照的 sourceKey 是
  // 缩写形态（aof）；两把键都注册，查找方无需关心是哪一族。
  mdtReferenceSummaryBySourceKey.set(dungeon.slug, summary);
  mdtReferenceSummaryBySourceKey.set(dungeon.sourceKey, summary);
});

/** 按 sourceKey（aof/mdr/…）返回该副本 MDT 参考层的统计；未收录返回 undefined。 */
export function getMdtReferenceSummary(sourceKey: string): MdtReferenceSummary | undefined {
  return mdtReferenceSummaryBySourceKey.get(sourceKey);
}