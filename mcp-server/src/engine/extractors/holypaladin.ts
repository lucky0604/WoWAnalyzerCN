// Path-A Holy Paladin extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / hits / crits)
//   - holy-paladin-specific metrics (beacon transfer healing, Holy Shock stats,
//     Word of Glory / Light of Dawn breakdown, Holy Power economy, cooldown usage,
//     Lightsmith / Herald of the Sun hero talent tracking)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  CastEvent,
  HealEvent,
  DamageEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
  RefreshBuffEvent,
  ResourceChangeEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';

// --- Holy Paladin spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
// Calibrated against verified spell IDs from the spec.
export const HPAL_SPELLS = {
  // Direct heals
  HOLY_LIGHT: 82326,
  FLASH_OF_LIGHT: 19750,
  HOLY_SHOCK_HEAL: 25914,
  HOLY_SHOCK_DAMAGE: 25912,
  HOLY_SHOCK_CAST: 20473,
  WORD_OF_GLORY: 85673,
  LIGHT_OF_DAWN_HEAL: 225311,
  LIGHT_OF_DAWN_CAST: 85222,
  LIGHT_OF_THE_MARTYR: 447985,
  HOLY_PRISM_HEAL_DIRECT: 114871,
  HOLY_PRISM_HEAL_SPLASH: 114852,
  HOLY_PRISM_CAST: 114165,
  ETERNAL_FLAME: 156322,
  LAY_ON_HANDS: 633,

  // Beacon
  BEACON_OF_LIGHT_CAST_AND_BUFF: 53563,
  BEACON_OF_LIGHT_TRANSFER_HEAL: 53652,
  BEACON_OF_FAITH: 156910,
  BEACON_OF_VIRTUE: 200025,
  BEACON_OF_THE_SAVIOR_BUFF: 1244893,
  BEACON_OF_THE_SAVIOR_ABSORB: 1245369,

  // Cooldowns
  AVENGING_WRATH_CAST: 31884,
  AVENGING_CRUSADER_CAST: 216331,
  AVENGING_CRUSADER_HEAL_NORMAL: 216371,
  AVENGING_CRUSADER_HEAL_CRIT: 281465,
  DIVINE_TOLL: 375576,
  AURA_MASTERY: 31821,
  DIVINE_PROTECTION: 498,
  BLESSING_OF_SACRIFICE: 6940,
  BLESSING_OF_PROTECTION: 1022,
  BLESSING_OF_FREEDOM: 1044,
  TYRS_DELIVERANCE_TALENT: 1241275,
  TYRS_DELIVERANCE_BUFF: 200654,
  PROTECTION_OF_TYR: 200430,

  // Holy Power
  HOLY_POWER_RESOURCE_TYPE: 9,
  CRUSADER_STRIKE: 35395,
  JUDGMENT_CAST_HOLY: 275773,
  JUDGMENT_HP_ENERGIZE: 220637,
  HAMMER_OF_WRATH: 1241288,

  // Procs / buffs
  INFUSION_OF_LIGHT_BUFF: 54149,
  AWAKENING_TALENT: 414195,
  DIVINE_RESONANCE_HOLY_BUFF: 386730,
  DIVINE_RESONANCE_TALENT: 386738,
  EMPYREAN_LEGACY_BUFF: 387178,
  EMPYREAN_LEGACY_TALENT: 1241358,
  DIVINE_PURPOSE_BUFF: 223819,
  UNENDING_LIGHT_BUFF: 394709,
  RISING_SUNLIGHT_BUFF: 414204,

  // Lightsmith hero talents
  SACRED_WEAPON_HEAL: 441590,
  HOLY_BULWARK_ABSORB: 432607,
  DIVINE_GUIDANCE_HEAL: 433807,
  BLESSED_ASSURANCE_BUFF: 433019,

  // Herald of the Sun hero talents
  DAWNLIGHT_HEAL_SINGLE: 431381,
  DAWNLIGHT_HEAL_AOE: 431382,
  SUNS_AVATAR_SELF: 463074,
  SUN_SEAR: 431415,
  BLESSING_OF_ANSHE: 445204,
  SOLAR_GRACE: 439841,
  GLEAMING_RAYS: 431480,
} as const;

const HPAL_SPELLS_TO_HUMAN: Record<number, string> = {
  [HPAL_SPELLS.HOLY_LIGHT]: '圣光术',
  [HPAL_SPELLS.FLASH_OF_LIGHT]: '闪烁圣光',
  [HPAL_SPELLS.HOLY_SHOCK_HEAL]: '神圣震击(治疗)',
  [HPAL_SPELLS.HOLY_SHOCK_DAMAGE]: '神圣震击(伤害)',
  [HPAL_SPELLS.HOLY_SHOCK_CAST]: '神圣震击',
  [HPAL_SPELLS.WORD_OF_GLORY]: '荣耀圣言',
  [HPAL_SPELLS.LIGHT_OF_DAWN_HEAL]: '黎明之光(治疗)',
  [HPAL_SPELLS.LIGHT_OF_DAWN_CAST]: '黎明之光',
  [HPAL_SPELLS.LIGHT_OF_THE_MARTYR]: '殉道者之光',
  [HPAL_SPELLS.HOLY_PRISM_HEAL_DIRECT]: '神圣棱镜(直疗)',
  [HPAL_SPELLS.HOLY_PRISM_HEAL_SPLASH]: '神圣棱镜(溅射)',
  [HPAL_SPELLS.HOLY_PRISM_CAST]: '神圣棱镜',
  [HPAL_SPELLS.ETERNAL_FLAME]: '永恒之火',
  [HPAL_SPELLS.LAY_ON_HANDS]: '圣疗术',
  [HPAL_SPELLS.BEACON_OF_LIGHT_CAST_AND_BUFF]: '圣光信标',
  [HPAL_SPELLS.BEACON_OF_LIGHT_TRANSFER_HEAL]: '圣光信标(转移)',
  [HPAL_SPELLS.BEACON_OF_FAITH]: '信仰信标',
  [HPAL_SPELLS.BEACON_OF_VIRTUE]: '美德信标',
  [HPAL_SPELLS.BEACON_OF_THE_SAVIOR_BUFF]: '救世主信标',
  [HPAL_SPELLS.BEACON_OF_THE_SAVIOR_ABSORB]: '救世主信标(吸收)',
  [HPAL_SPELLS.AVENGING_WRATH_CAST]: '复仇之怒',
  [HPAL_SPELLS.AVENGING_CRUSADER_CAST]: '复仇圣战士',
  [HPAL_SPELLS.AVENGING_CRUSADER_HEAL_NORMAL]: '复仇圣战士(治疗)',
  [HPAL_SPELLS.AVENGING_CRUSADER_HEAL_CRIT]: '复仇圣战士(治疗暴击)',
  [HPAL_SPELLS.DIVINE_TOLL]: '神圣警钟',
  [HPAL_SPELLS.AURA_MASTERY]: '光环掌握',
  [HPAL_SPELLS.DIVINE_PROTECTION]: '圣佑术',
  [HPAL_SPELLS.BLESSING_OF_SACRIFICE]: '牺牲祝福',
  [HPAL_SPELLS.BLESSING_OF_PROTECTION]: '保护祝福',
  [HPAL_SPELLS.BLESSING_OF_FREEDOM]: '自由祝福',
  [HPAL_SPELLS.TYRS_DELIVERANCE_TALENT]: '提尔的拯救',
  [HPAL_SPELLS.TYRS_DELIVERANCE_BUFF]: '提尔的拯救(增益)',
  [HPAL_SPELLS.PROTECTION_OF_TYR]: '提尔的防护',
  [HPAL_SPELLS.CRUSADER_STRIKE]: '十字军打击',
  [HPAL_SPELLS.JUDGMENT_CAST_HOLY]: '制裁',
  [HPAL_SPELLS.JUDGMENT_HP_ENERGIZE]: '制裁(神圣能量)',
  [HPAL_SPELLS.HAMMER_OF_WRATH]: '愤怒之锤',
  [HPAL_SPELLS.INFUSION_OF_LIGHT_BUFF]: '圣光灌注',
  [HPAL_SPELLS.AWAKENING_TALENT]: '觉醒',
  [HPAL_SPELLS.DIVINE_RESONANCE_HOLY_BUFF]: '神圣共鸣',
  [HPAL_SPELLS.DIVINE_RESONANCE_TALENT]: '神圣共鸣(天赋)',
  [HPAL_SPELLS.EMPYREAN_LEGACY_BUFF]: '苍穹遗产',
  [HPAL_SPELLS.EMPYREAN_LEGACY_TALENT]: '苍穹遗产(天赋)',
  [HPAL_SPELLS.DIVINE_PURPOSE_BUFF]: '神圣目标',
  [HPAL_SPELLS.UNENDING_LIGHT_BUFF]: '无尽圣光',
  [HPAL_SPELLS.RISING_SUNLIGHT_BUFF]: '升起日光',
  [HPAL_SPELLS.SACRED_WEAPON_HEAL]: '神圣武器',
  [HPAL_SPELLS.HOLY_BULWARK_ABSORB]: '神圣壁垒',
  [HPAL_SPELLS.DIVINE_GUIDANCE_HEAL]: '神圣指引',
  [HPAL_SPELLS.BLESSED_ASSURANCE_BUFF]: '神佑保证',
  [HPAL_SPELLS.DAWNLIGHT_HEAL_SINGLE]: '晨光(单目标)',
  [HPAL_SPELLS.DAWNLIGHT_HEAL_AOE]: '晨光(群体)',
  [HPAL_SPELLS.SUNS_AVATAR_SELF]: '太阳化身',
  [HPAL_SPELLS.SUN_SEAR]: '烈日灼烧',
  [HPAL_SPELLS.BLESSING_OF_ANSHE]: '安阿尼之祝',
  [HPAL_SPELLS.SOLAR_GRACE]: '太阳恩典',
  [HPAL_SPELLS.GLEAMING_RAYS]: '闪耀光辉',
};

export interface SpellSummary {
  spellId: number;
  spellName: string;
  spellNameCN: string;
  casts: number;
  hits: number;
  ticks: number;
  crits: number;
  healing: number;
  overhealing: number;
  manaSpent: number;
  uniqueTargets: number;
  healingEfficiency: number | undefined;
}

export interface HolyPaladinReport {
  fightDurationMs: number;
  playerId: number;
  playerName: string;
  totals: {
    casts: number;
    healing: number;
    overhealing: number;
    rawHealing: number;
    healingEfficiency: number;
    manaSpent: number;
    hps: number;
    eventCount: number;
  };
  perSpell: SpellSummary[];
  specifics: {
    beacon: {
      transferHealing: number;
      transferOverhealing: number;
      transferHits: number;
      bySource: Array<{ spellId: number; spellNameCN: string; healing: number }>;
      activeBeaconCount: number;
      beaconOfFaithDetected: boolean;
      beaconOfVirtueCasts: number;
    };
    holyShock: {
      casts: number;
      healHits: number;
      damageHits: number;
      crits: number;
      iolProcs: number;
      iolConsumed: number;
    };
    wordOfGlory: {
      casts: number;
      healing: number;
      overhealing: number;
      empyreanLegacyProcs: number;
    };
    lightOfDawn: {
      casts: number;
      healing: number;
      overhealing: number;
      targetsHit: number;
    };
    holyPower: {
      generated: number;
      wasted: number;
      spent: number;
      efficiency: number;
    };
    cooldowns: {
      avengingWrathCasts: number;
      avengingCrusaderCasts: number;
      divineTollCasts: number;
      auraMasteryCasts: number;
      divineProtectionCasts: number;
      tyrsDeliveranceCasts: number;
      holyPrismCasts: number;
      layOnHandsCasts: number;
    };
    heroTalents: {
      lightsmith: {
        sacredWeaponHealing: number;
        sacredWeaponHits: number;
        holyBulwarkAbsorbs: number;
        divineGuidanceHealing: number;
        blessedAssuranceUses: number;
      };
      heraldOfTheSun: {
        dawnlightHealing: number;
        dawnlightHits: number;
        sunSearHealing: number;
        blessingOfAnsheUses: number;
        solarGraceMaxStacks: number;
      };
    };
  };
  detectedBuild: 'lightsmith' | 'herald-of-the-sun' | 'unknown';
  warnings: string[];
}

const HIT_TYPE_CRIT = 2;

/** Returns true when the spell ID is in the known beacon-transferring set. */
const BEACON_TRANSFERRING_IDS: Set<number> = new Set([
  HPAL_SPELLS.HOLY_SHOCK_HEAL, // 25914 — factor 1.0
  HPAL_SPELLS.LIGHT_OF_DAWN_HEAL, // 225311 — factor 0.5
  HPAL_SPELLS.FLASH_OF_LIGHT, // 19750 — factor 1.0
  HPAL_SPELLS.HOLY_PRISM_HEAL_DIRECT, // 114871 — factor 1.0
  HPAL_SPELLS.HOLY_PRISM_HEAL_SPLASH, // 114852 — factor 0.5
  HPAL_SPELLS.AVENGING_CRUSADER_HEAL_NORMAL, // 216371 — factor 1.0
  HPAL_SPELLS.AVENGING_CRUSADER_HEAL_CRIT, // 281465 — factor 1.0
  HPAL_SPELLS.WORD_OF_GLORY, // 85673 — factor 1.0
  HPAL_SPELLS.HOLY_LIGHT, // 82326 — factor 1.0
  HPAL_SPELLS.ETERNAL_FLAME, // 156322 — factor 1.0
]);

function isDirectHeal(spellId: number): boolean {
  return BEACON_TRANSFERRING_IDS.has(spellId);
}

function readCost(c: CastEvent, resourceType: number): number {
  const classRes = c.classResources;
  if (Array.isArray(classRes)) {
    const res = classRes.find((r) => r?.type === resourceType);
    if (res && typeof (res as { cost?: number }).cost === 'number') {
      return (res as { cost: number }).cost;
    }
  }
  const cWithLegacy = c as CastEvent & {
    resourceCost?: Record<number, number>;
    rawResourceCost?: Record<number, number>;
  };
  return (
    cWithLegacy.resourceCost?.[resourceType] ?? cWithLegacy.rawResourceCost?.[resourceType] ?? 0
  );
}

/** Returns true when the spell ID is a Holy Shock heal event. */
function isHolyShockHeal(spellId: number): boolean {
  return spellId === HPAL_SPELLS.HOLY_SHOCK_HEAL;
}

export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

interface RecentHeal {
  timestamp: number;
  sourceSpellId: number;
  targetID: number;
  amount: number;
  overheal: number;
}

export function extractHolyPaladinReport(input: ExtractInput): HolyPaladinReport {
  const { events, playerId, playerName, fightStart, fightEnd, warnings } = input;
  const fightDurationMs = fightEnd - fightStart;

  // Per-spell accumulators keyed by ability.guid
  const perSpell = new Map<number, SpellSummary & { _targets: Set<number> }>();
  const ensure = (
    spellId: number,
    fallbackName: string,
  ): SpellSummary & { _targets: Set<number> } => {
    let entry = perSpell.get(spellId);
    if (!entry) {
      entry = {
        spellId,
        spellName: fallbackName,
        spellNameCN: HPAL_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
        casts: 0,
        hits: 0,
        ticks: 0,
        crits: 0,
        healing: 0,
        overhealing: 0,
        manaSpent: 0,
        uniqueTargets: 0,
        healingEfficiency: undefined,
        _targets: new Set<number>(),
      };
      perSpell.set(spellId, entry);
    }
    return entry;
  };

  // Beacon tracking state
  const activeBeaconTargets = new Set<number>();
  let peakActiveBeaconCount = 0;
  let beaconOfFaithDetected = false;
  let beaconOfVirtueCasts = 0;

  // Beacon transfer attribution: rolling buffer of recent direct heals
  const recentDirectHeals: RecentHeal[] = [];
  const BEACON_TRANSFER_LOOKBACK_MS = 500;
  const BUFFER_RETENTION_MS = 1500;
  let beaconTransferHealing = 0;
  let beaconTransferOverhealing = 0;
  let beaconTransferHits = 0;
  const beaconSourceMap = new Map<
    number,
    { spellId: number; spellNameCN: string; healing: number }
  >();

  // Holy Shock tracking
  let holyShockCasts = 0;
  let holyShockHealHits = 0;
  let holyShockDamageHits = 0;
  let holyShockCrits = 0;
  let iolProcs = 0;
  let iolConsumed = 0;

  // Word of Glory tracking
  let wogCasts = 0;
  let wogHealing = 0;
  let wogOverhealing = 0;
  let empyreanLegacyProcs = 0;

  // Light of Dawn tracking
  let lodCasts = 0;
  let lodHealing = 0;
  let lodOverhealing = 0;
  let lodTargetsHit = 0;

  // Holy Power tracking
  let hpGenerated = 0;
  let hpWasted = 0;
  let hpSpent = 0;

  // Cooldown tracking
  let avengingWrathCasts = 0;
  let avengingCrusaderCasts = 0;
  let divineTollCasts = 0;
  let auraMasteryCasts = 0;
  let divineProtectionCasts = 0;
  let tyrsDeliveranceCasts = 0;
  let holyPrismCasts = 0;
  let layOnHandsCasts = 0;

  // Lightsmith tracking
  let sacredWeaponHealing = 0;
  let sacredWeaponHits = 0;
  let holyBulwarkAbsorbs = 0;
  let divineGuidanceHealing = 0;
  let blessedAssuranceUses = 0;

  // Herald of the Sun tracking
  let dawnlightHealing = 0;
  let dawnlightHits = 0;
  let sunSearHealing = 0;
  let blessingOfAnsheUses = 0;
  const solarGraceMaxStacks = 0;

  let totalCasts = 0;
  let totalHealing = 0;
  let totalOverhealing = 0;
  let totalManaSpent = 0;

  for (const ev of events) {
    switch (ev.type) {
      case EventType.Cast: {
        const c = ev as CastEvent;
        if (c.sourceID !== playerId) {
          break;
        }
        const id = c.ability.guid;
        const entry = ensure(id, c.ability.name);
        entry.casts += 1;
        totalCasts += 1;

        // Track mana cost on cast (resource type 0)
        const manaCost = readCost(c, 0);
        if (manaCost > 0) {
          entry.manaSpent += manaCost;
          totalManaSpent += manaCost;
        }

        // Track Holy Power cost on cast (resource type 9)
        const hpCost = readCost(c, HPAL_SPELLS.HOLY_POWER_RESOURCE_TYPE);
        if (hpCost > 0) {
          hpSpent += hpCost;
        }

        // Spell-specific cast handling
        switch (id) {
          case HPAL_SPELLS.HOLY_SHOCK_CAST:
            holyShockCasts += 1;
            break;
          case HPAL_SPELLS.WORD_OF_GLORY:
            wogCasts += 1;
            break;
          case HPAL_SPELLS.LIGHT_OF_DAWN_CAST:
            lodCasts += 1;
            break;
          case HPAL_SPELLS.BEACON_OF_VIRTUE:
            beaconOfVirtueCasts += 1;
            break;
          case HPAL_SPELLS.AVENGING_WRATH_CAST:
            avengingWrathCasts += 1;
            break;
          case HPAL_SPELLS.AVENGING_CRUSADER_CAST:
            avengingCrusaderCasts += 1;
            break;
          case HPAL_SPELLS.DIVINE_TOLL:
            divineTollCasts += 1;
            break;
          case HPAL_SPELLS.AURA_MASTERY:
            auraMasteryCasts += 1;
            break;
          case HPAL_SPELLS.DIVINE_PROTECTION:
            divineProtectionCasts += 1;
            break;
          case HPAL_SPELLS.TYRS_DELIVERANCE_TALENT:
            tyrsDeliveranceCasts += 1;
            break;
          case HPAL_SPELLS.HOLY_PRISM_CAST:
            holyPrismCasts += 1;
            break;
          case HPAL_SPELLS.LAY_ON_HANDS:
            layOnHandsCasts += 1;
            break;
        }
        break;
      }

      case EventType.Heal: {
        const h = ev as HealEvent;
        if (h.sourceID !== playerId) {
          break;
        }
        const id = h.ability.guid;
        const amount = h.amount;
        const overheal = h.overheal ?? 0;

        // Beacon transfer heal: attribute to nearest recent direct heal
        if (id === HPAL_SPELLS.BEACON_OF_LIGHT_TRANSFER_HEAL) {
          beaconTransferHealing += amount;
          beaconTransferOverhealing += overheal;
          beaconTransferHits += 1;

          // Look backward to find nearest direct heal (skip heals on same target)
          let nearest: RecentHeal | null = null;
          for (let i = recentDirectHeals.length - 1; i >= 0; i--) {
            const rh = recentDirectHeals[i];
            if (rh.targetID === h.targetID) continue;
            if (h.timestamp - rh.timestamp <= BEACON_TRANSFER_LOOKBACK_MS) {
              nearest = rh;
              break;
            }
          }
          if (nearest !== null) {
            const srcSpell = nearest.sourceSpellId;
            const cnName = HPAL_SPELLS_TO_HUMAN[srcSpell] ?? `spell-${srcSpell}`;
            const existing = beaconSourceMap.get(srcSpell);
            if (existing) {
              existing.healing += amount;
            } else {
              beaconSourceMap.set(srcSpell, {
                spellId: srcSpell,
                spellNameCN: cnName,
                healing: amount,
              });
            }
          }
          break;
        }

        // Non-beacon heal: accumulate per-spell
        const entry = ensure(id, h.ability.name);
        entry.healing += amount;
        entry.overhealing += overheal;
        if (h.tick) {
          entry.ticks += 1;
        } else {
          entry.hits += 1;
        }
        if (h.hitType === HIT_TYPE_CRIT) {
          entry.crits += 1;
        }
        entry._targets.add(h.targetID);
        totalHealing += amount;
        totalOverhealing += overheal;

        // Add to recent direct heals buffer (for beacon attribution)
        if (isDirectHeal(id)) {
          recentDirectHeals.push({
            timestamp: h.timestamp,
            sourceSpellId: id,
            targetID: h.targetID,
            amount,
            overheal,
          });
        }

        // Holy Shock heal tracking
        if (isHolyShockHeal(id)) {
          holyShockHealHits += 1;
          if (h.hitType === HIT_TYPE_CRIT) {
            holyShockCrits += 1;
          }
        }

        // Word of Glory heal tracking
        if (id === HPAL_SPELLS.WORD_OF_GLORY) {
          wogHealing += amount;
          wogOverhealing += overheal;
        }

        // Light of Dawn heal tracking
        if (id === HPAL_SPELLS.LIGHT_OF_DAWN_HEAL) {
          lodHealing += amount;
          lodOverhealing += overheal;
          lodTargetsHit += 1;
        }

        // Avenging Crusader healing
        if (
          id === HPAL_SPELLS.AVENGING_CRUSADER_HEAL_NORMAL ||
          id === HPAL_SPELLS.AVENGING_CRUSADER_HEAL_CRIT
        ) {
          // Tracked via per-spell summary only
        }

        // Lightsmith hero talent healing
        if (id === HPAL_SPELLS.SACRED_WEAPON_HEAL) {
          sacredWeaponHealing += amount;
          sacredWeaponHits += 1;
        }
        if (id === HPAL_SPELLS.DIVINE_GUIDANCE_HEAL) {
          divineGuidanceHealing += amount;
        }

        // Herald of the Sun hero talent healing
        if (id === HPAL_SPELLS.DAWNLIGHT_HEAL_SINGLE || id === HPAL_SPELLS.DAWNLIGHT_HEAL_AOE) {
          dawnlightHealing += amount;
          dawnlightHits += 1;
        }
        if (id === HPAL_SPELLS.SUN_SEAR) {
          sunSearHealing += amount;
        }
        break;
      }

      case EventType.Damage: {
        const d = ev as DamageEvent;
        if (d.sourceID !== playerId) {
          break;
        }
        const id = d.ability.guid;
        // Holy Shock damage hits
        if (id === HPAL_SPELLS.HOLY_SHOCK_DAMAGE) {
          holyShockDamageHits += 1;
        }
        break;
      }

      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) {
          break;
        }
        const id = b.ability.guid;
        switch (id) {
          case HPAL_SPELLS.BEACON_OF_LIGHT_CAST_AND_BUFF:
          case HPAL_SPELLS.BEACON_OF_FAITH:
          case HPAL_SPELLS.BEACON_OF_VIRTUE:
          case HPAL_SPELLS.BEACON_OF_THE_SAVIOR_BUFF:
            activeBeaconTargets.add(b.targetID);
            peakActiveBeaconCount = Math.max(peakActiveBeaconCount, activeBeaconTargets.size);
            if (id === HPAL_SPELLS.BEACON_OF_FAITH) {
              beaconOfFaithDetected = true;
            }
            break;
          case HPAL_SPELLS.INFUSION_OF_LIGHT_BUFF:
            iolProcs += 1;
            break;
          case HPAL_SPELLS.EMPYREAN_LEGACY_BUFF:
            empyreanLegacyProcs += 1;
            break;
          case HPAL_SPELLS.BLESSED_ASSURANCE_BUFF:
            blessedAssuranceUses += 1;
            break;
          case HPAL_SPELLS.BLESSING_OF_ANSHE:
            blessingOfAnsheUses += 1;
            break;
          case HPAL_SPELLS.SUNS_AVATAR_SELF:
          case HPAL_SPELLS.SOLAR_GRACE:
            // Track existence for build detection only
            break;
        }
        break;
      }

      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) {
          break;
        }
        // Infusion of Light refresh counts as another proc
        if (r.ability.guid === HPAL_SPELLS.INFUSION_OF_LIGHT_BUFF) {
          iolProcs += 1;
        }
        break;
      }

      case EventType.RemoveBuff: {
        const rb = ev as RemoveBuffEvent;
        if (rb.sourceID !== playerId) {
          break;
        }
        const id = rb.ability.guid;
        switch (id) {
          case HPAL_SPELLS.BEACON_OF_LIGHT_CAST_AND_BUFF:
          case HPAL_SPELLS.BEACON_OF_FAITH:
          case HPAL_SPELLS.BEACON_OF_VIRTUE:
          case HPAL_SPELLS.BEACON_OF_THE_SAVIOR_BUFF:
            activeBeaconTargets.delete(rb.targetID);
            break;
          case HPAL_SPELLS.INFUSION_OF_LIGHT_BUFF:
            // IOL consumed when removed (assumes FoL/HL cast consumed it)
            iolConsumed += 1;
            break;
        }
        break;
      }

      case EventType.ResourceChange: {
        const rc = ev as ResourceChangeEvent;
        if (rc.sourceID !== playerId) {
          break;
        }
        // Holy Power gains: resourceChangeType === 9 OR Judgment energize
        const resourceChangeType = (rc as { resourceChangeType?: number }).resourceChangeType;
        if (
          resourceChangeType === HPAL_SPELLS.HOLY_POWER_RESOURCE_TYPE ||
          rc.ability?.guid === HPAL_SPELLS.JUDGMENT_HP_ENERGIZE
        ) {
          const change = rc.resourceChange ?? 0;
          const waste = rc.waste ?? 0;
          hpGenerated += change;
          hpWasted += waste;
        }
        break;
      }

      default:
        break;
    }
  }

  // Prune stale entries from recentDirectHeals (keep last BUFFER_RETENTION_MS)
  const cutoff = fightEnd - BUFFER_RETENTION_MS;
  while (recentDirectHeals.length > 0 && recentDirectHeals[0].timestamp < cutoff) {
    recentDirectHeals.shift();
  }

  // Finalize beacon bySource
  const beaconBySource = Array.from(beaconSourceMap.values()).sort((a, b) => b.healing - a.healing);

  // Absorbs tracked via heal events — Holy Bulwark absorb count
  // (counts from heal events with id === HOLY_BULWARK_ABSORB via perSpell)
  const bulwarkEntry = perSpell.get(HPAL_SPELLS.HOLY_BULWARK_ABSORB);
  if (bulwarkEntry) {
    holyBulwarkAbsorbs = bulwarkEntry.hits;
  }

  // Finalize per-spell summaries
  const perSpellArray: SpellSummary[] = Array.from(perSpell.values()).map((e) => {
    const raw = e.healing + e.overhealing;
    return {
      spellId: e.spellId,
      spellName: e.spellName,
      spellNameCN: e.spellNameCN,
      casts: e.casts,
      hits: e.hits,
      ticks: e.ticks,
      crits: e.crits,
      healing: e.healing,
      overhealing: e.overhealing,
      manaSpent: e.manaSpent,
      uniqueTargets: e._targets.size,
      healingEfficiency: raw > 0 ? e.healing / raw : undefined,
    };
  });
  perSpellArray.sort((a, b) => b.healing - a.healing);

  const rawHealing = totalHealing + totalOverhealing;
  const totals = {
    casts: totalCasts,
    healing: totalHealing,
    overhealing: totalOverhealing,
    rawHealing,
    healingEfficiency: rawHealing > 0 ? totalHealing / rawHealing : 0,
    manaSpent: totalManaSpent,
    hps: fightDurationMs > 0 ? (totalHealing * 1000) / fightDurationMs : 0,
    eventCount: events.length,
  };

  const hpEfficiency = hpGenerated + hpWasted > 0 ? hpGenerated / (hpGenerated + hpWasted) : 0;

  return {
    fightDurationMs,
    playerId,
    playerName,
    totals,
    perSpell: perSpellArray,
    specifics: {
      beacon: {
        transferHealing: beaconTransferHealing,
        transferOverhealing: beaconTransferOverhealing,
        transferHits: beaconTransferHits,
        bySource: beaconBySource,
        activeBeaconCount: peakActiveBeaconCount,
        beaconOfFaithDetected,
        beaconOfVirtueCasts,
      },
      holyShock: {
        casts: holyShockCasts,
        healHits: holyShockHealHits,
        damageHits: holyShockDamageHits,
        crits: holyShockCrits,
        iolProcs,
        iolConsumed,
      },
      wordOfGlory: {
        casts: wogCasts,
        healing: wogHealing,
        overhealing: wogOverhealing,
        empyreanLegacyProcs,
      },
      lightOfDawn: {
        casts: lodCasts,
        healing: lodHealing,
        overhealing: lodOverhealing,
        targetsHit: lodTargetsHit,
      },
      holyPower: {
        generated: hpGenerated,
        wasted: hpWasted,
        spent: hpSpent,
        efficiency: hpEfficiency,
      },
      cooldowns: {
        avengingWrathCasts,
        avengingCrusaderCasts,
        divineTollCasts,
        auraMasteryCasts,
        divineProtectionCasts,
        tyrsDeliveranceCasts,
        holyPrismCasts,
        layOnHandsCasts,
      },
      heroTalents: {
        lightsmith: {
          sacredWeaponHealing,
          sacredWeaponHits,
          holyBulwarkAbsorbs,
          divineGuidanceHealing,
          blessedAssuranceUses,
        },
        heraldOfTheSun: {
          dawnlightHealing,
          dawnlightHits,
          sunSearHealing,
          blessingOfAnsheUses,
          solarGraceMaxStacks,
        },
      },
    },
    detectedBuild: detectBuild(events, playerId),
    warnings,
  };
}

function detectBuild(
  events: AnyEvent[],
  playerId: number,
): 'lightsmith' | 'herald-of-the-sun' | 'unknown' {
  let hasLightsmithHeal = false;
  let hasLightsmithBuff = false;
  let hasHeraldHeal = false;
  let hasHeraldBuff = false;

  const LIGHTSMITH_HEAL_IDS: readonly number[] = [
    HPAL_SPELLS.SACRED_WEAPON_HEAL,
    HPAL_SPELLS.HOLY_BULWARK_ABSORB,
    HPAL_SPELLS.DIVINE_GUIDANCE_HEAL,
  ];
  const LIGHTSMITH_BUFF_IDS: readonly number[] = [HPAL_SPELLS.BLESSED_ASSURANCE_BUFF];
  const HERALD_HEAL_IDS: readonly number[] = [
    HPAL_SPELLS.DAWNLIGHT_HEAL_SINGLE,
    HPAL_SPELLS.DAWNLIGHT_HEAL_AOE,
    HPAL_SPELLS.SUN_SEAR,
  ];
  const HERALD_BUFF_IDS: readonly number[] = [
    HPAL_SPELLS.SUNS_AVATAR_SELF,
    HPAL_SPELLS.BLESSING_OF_ANSHE,
    HPAL_SPELLS.SOLAR_GRACE,
  ];

  for (const ev of events) {
    if (ev.type === EventType.Heal && (ev as HealEvent).sourceID === playerId) {
      const id = (ev as HealEvent).ability.guid;
      if (LIGHTSMITH_HEAL_IDS.includes(id)) {
        hasLightsmithHeal = true;
      }
      if (HERALD_HEAL_IDS.includes(id)) {
        hasHeraldHeal = true;
      }
    }
    if (
      (ev.type === EventType.ApplyBuff || ev.type === EventType.RefreshBuff) &&
      (ev as ApplyBuffEvent).sourceID === playerId
    ) {
      const id = (ev as ApplyBuffEvent).ability.guid;
      if (LIGHTSMITH_BUFF_IDS.includes(id)) {
        hasLightsmithBuff = true;
      }
      if (HERALD_BUFF_IDS.includes(id)) {
        hasHeraldBuff = true;
      }
    }
  }

  if (hasLightsmithHeal || hasLightsmithBuff) {
    return 'lightsmith';
  }
  if (hasHeraldHeal || hasHeraldBuff) {
    return 'herald-of-the-sun';
  }
  return 'unknown';
}
