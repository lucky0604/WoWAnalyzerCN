// Path-A restoration shaman extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / manaSpent / hits / crits / ticks)
//   - resto-shaman-specific metrics (Riptide HoT, Chain Heal bounces, Cloudburst Totem,
//     Ascendance window healing, Earthliving, totem tracking, hero talent detection)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  CastEvent,
  HealEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
  RefreshBuffEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';

// Reuse shared SpellSummary from mistweaver (same shape for all specs)
import type { SpellSummary } from './mistweaver.js';
import type { BaseSpecReport } from './registry.js';

// --- Restoration Shaman spell IDs (WoW 12.x / TWW Midnight) ---
// Calibrated against real CN WCL event stream.
export const RS_SPELLS = {
  // Direct heals
  HEALING_WAVE: 77472,
  HEALING_SURGE: 8004,
  CHAIN_HEAL: 1064, // all bounces use same ID
  RIPTIDE: 61295, // cast, HoT apply, HoT tick, direct heal — distinguish via event.type + event.tick
  WELLSPRING_HEAL: 197997,
  EARTH_SHIELD_HEAL: 379,
  DOWNPOUR_HEAL: 207778,
  HEALING_RAIN_HEAL: 73921,
  HEALING_RAIN_TOTEMIC: 456366,
  SURGE_OF_EARTH_HEAL: 320747,
  PRIMORDIAL_WAVE_HEAL: 375985,
  PRIMORDIAL_WAVE_CAST: 375982,
  PRIMORDIAL_WAVE_BUFF: 375986,
  TIDEWATERS_HEAL: 462425,

  // Earthliving
  EARTHLIVING_WEAPON_HEAL: 382024, // HoT tick, event.tick === true

  // Totems
  HEALING_STREAM_TOTEM_CAST: 5394,
  HEALING_STREAM_TOTEM_HEAL: 52042,
  CLOUDBURST_TOTEM_HEAL: 157503, // release burst
  CLOUDBURST_TOTEM_RECALL: 201764, // manual early release cast
  HEALING_TIDE_TOTEM_HEAL: 114942,
  EARTHEN_WALL_TOTEM_ABSORB: 201633,
  EARTHEN_WALL_TOTEM_SELF_DAMAGE: 201657,
  SPIRIT_LINK_TOTEM_REDISTRIBUTE: 98021,
  SPIRIT_LINK_TOTEM_SUMMON: 98008, // well-known cast ID for spirit link totem summon
  SPIRIT_LINK_TOTEM_BUFF: 325174,
  MANA_TIDE_SUMMON: 16190, // well-known cast ID for mana tide totem summon
  MANA_TIDE_BUFF: 320763,
  MANA_SPRING: 381931,
  ANCESTRAL_PROTECTION_BUFF: 207495,
  SURGING_TOTEM: 444995, // Totemic hero
  SURGING_TOTEM_RECALL: 1221348,
  STORMSTREAM_TOTEM_CAST: 1267068,
  STORMSTREAM_TOTEM_HEAL: 1267745,
  STORMSWELL_HEAL: 1268684,

  // Cooldowns
  ASCENDANCE_RESTORATION_TALENT: 114052, // cast + buff
  ASCENDANCE_HEAL: 114083, // burst per cast in window
  ASCENDANCE_INITIAL_HEAL: 294020,
  SPIRITWALKERS_GRACE: 79206,
  NATURES_SWIFTNESS: 378081,
  TIDAL_WAVES_BUFF: 53390,
  UNDULATION_BUFF: 216251,
  FLASH_FLOOD_BUFF: 280615,
  ANCESTRAL_VIGOR: 207400,
  HIGH_TIDE_BUFF: 288675,
  DEEP_HEALING_MASTERY: 77226,
  RESURGENCE: 101033,

  // Hero talent heals
  ANCESTRAL_AWAKENING_HEAL: 382311,
  OVERFLOWING_SHORES_HEAL: 383223,
  TOTEMIC_REBOUND_CHAIN_HEAL: 458357,
  CALL_OF_ANCESTORS_CHAIN_HEAL: 447433,
} as const;

const RS_SPELLS_TO_HUMAN: Record<number, string> = {
  [RS_SPELLS.HEALING_WAVE]: '治疗波',
  [RS_SPELLS.HEALING_SURGE]: '治疗之涌',
  [RS_SPELLS.CHAIN_HEAL]: '治疗链',
  [RS_SPELLS.RIPTIDE]: '激流',
  [RS_SPELLS.WELLSPRING_HEAL]: '泉涌',
  [RS_SPELLS.EARTH_SHIELD_HEAL]: '大地之盾',
  [RS_SPELLS.DOWNPOUR_HEAL]: '倾盆大雨',
  [RS_SPELLS.HEALING_RAIN_HEAL]: '治疗之雨',
  [RS_SPELLS.HEALING_RAIN_TOTEMIC]: '治疗之雨(图腾祭祀)',
  [RS_SPELLS.SURGE_OF_EARTH_HEAL]: '大地奔涌',
  [RS_SPELLS.PRIMORDIAL_WAVE_HEAL]: '始源之潮(治疗)',
  [RS_SPELLS.PRIMORDIAL_WAVE_CAST]: '始源之潮',
  [RS_SPELLS.PRIMORDIAL_WAVE_BUFF]: '始源之潮(增益)',
  [RS_SPELLS.TIDEWATERS_HEAL]: '潮汐之水',
  [RS_SPELLS.EARTHLIVING_WEAPON_HEAL]: '大地生命武器',
  [RS_SPELLS.HEALING_STREAM_TOTEM_CAST]: '治疗之泉图腾',
  [RS_SPELLS.HEALING_STREAM_TOTEM_HEAL]: '治疗之泉图腾(治疗)',
  [RS_SPELLS.CLOUDBURST_TOTEM_HEAL]: '暴雨图腾(释放)',
  [RS_SPELLS.CLOUDBURST_TOTEM_RECALL]: '暴雨图腾(手动召回)',
  [RS_SPELLS.HEALING_TIDE_TOTEM_HEAL]: '治疗之潮图腾',
  [RS_SPELLS.EARTHEN_WALL_TOTEM_ABSORB]: '大地之墙图腾(吸收)',
  [RS_SPELLS.SPIRIT_LINK_TOTEM_REDISTRIBUTE]: '灵魂链接图腾(重分配)',
  [RS_SPELLS.SPIRIT_LINK_TOTEM_SUMMON]: '灵魂链接图腾',
  [RS_SPELLS.MANA_TIDE_SUMMON]: '法力之潮图腾',
  [RS_SPELLS.MANA_SPRING]: '法力之泉',
  [RS_SPELLS.ANCESTRAL_PROTECTION_BUFF]: '先祖护佑',
  [RS_SPELLS.SURGING_TOTEM]: '涌动图腾',
  [RS_SPELLS.SURGING_TOTEM_RECALL]: '涌动图腾(召回)',
  [RS_SPELLS.STORMSTREAM_TOTEM_CAST]: '风暴之流图腾',
  [RS_SPELLS.STORMSTREAM_TOTEM_HEAL]: '风暴之流图腾(治疗)',
  [RS_SPELLS.STORMSWELL_HEAL]: '风暴涌流(治疗)',
  [RS_SPELLS.ASCENDANCE_RESTORATION_TALENT]: '升腾',
  [RS_SPELLS.ASCENDANCE_HEAL]: '升腾(爆发治疗)',
  [RS_SPELLS.ASCENDANCE_INITIAL_HEAL]: '升腾(初始治疗)',
  [RS_SPELLS.SPIRITWALKERS_GRACE]: '灵魂行者恩典',
  [RS_SPELLS.NATURES_SWIFTNESS]: '自然迅捷',
  [RS_SPELLS.TIDAL_WAVES_BUFF]: '潮汐奔涌',
  [RS_SPELLS.ANCESTRAL_AWAKENING_HEAL]: '先祖觉醒',
  [RS_SPELLS.OVERFLOWING_SHORES_HEAL]: '溢出海岸',
  [RS_SPELLS.TOTEMIC_REBOUND_CHAIN_HEAL]: '图腾祭祀回弹(治疗链)',
  [RS_SPELLS.CALL_OF_ANCESTORS_CHAIN_HEAL]: '先祖召唤(治疗链)',
};

// ── Report interface ────────────────────────────────────────────────

export interface RestoShamanReport extends BaseSpecReport {
  perSpell: SpellSummary[];
  specifics: {
    riptide: {
      casts: number;
      initialHits: number;
      hotApplies: number;
      hotRefreshes: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
      initialHealing: number;
    };
    chainHeal: {
      casts: number;
      bounceHits: number;
      averageBouncesPerCast: number;
      totalHealing: number;
      totalOverhealing: number;
    };
    cloudburst: {
      releaseHits: number;
      totalReleaseHealing: number;
      manualRecalls: number;
    };
    earthliving: {
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
    };
    totems: {
      healingStreamTotemCasts: number;
      healingStreamTickHealing: number;
      healingTideTotemTicks: number;
      healingTideTotemHealing: number;
      earthenWallTotemAbsorbed: number;
      spiritLinkTotemCasts: number;
      manaTideTotemCasts: number;
    };
    cooldowns: {
      ascendanceCasts: number;
      ascendanceWindowHealing: number;
      ascendanceBurstHealing: number;
      spiritwalkersGraceCasts: number;
      naturesSwiftnessCasts: number;
      primordialWaveCasts: number;
    };
    heroTalent: {
      totemic: {
        surgingTotemCasts: number;
        stormstreamHealing: number;
        totemicReboundChainHealing: number;
        healingRainTotemicHealing: number;
      };
      farseer: {
        callOfAncestorsChainHealing: number;
        ancestralAwakeningHealing: number;
      };
    };
  };
  detectedBuild: 'totemic' | 'farseer' | 'unknown';
}

// ── Constants ───────────────────────────────────────────────────────

const MANA_RESOURCE_TYPE = 0;
const HIT_TYPE_CRIT = 2;
const CHAIN_HEAL_WINDOW_MS = 250; // 250ms window for bounce detection per cast

function readManaCost(c: CastEvent): number {
  const classRes = c.classResources;
  if (Array.isArray(classRes)) {
    const mana = classRes.find((r) => r?.type === MANA_RESOURCE_TYPE);
    if (mana && typeof (mana as { cost?: number }).cost === 'number') {
      return (mana as { cost: number }).cost;
    }
  }
  const cWithLegacy = c as CastEvent & {
    resourceCost?: Record<number, number>;
    rawResourceCost?: Record<number, number>;
  };
  return (
    cWithLegacy.resourceCost?.[MANA_RESOURCE_TYPE] ??
    cWithLegacy.rawResourceCost?.[MANA_RESOURCE_TYPE] ??
    0
  );
}

// ── Extract input ───────────────────────────────────────────────────

export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

// ── Extractor ───────────────────────────────────────────────────────

export function extractRestoShamanReport(input: ExtractInput): RestoShamanReport {
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
        spellNameCN: RS_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // Chain Heal bounce tracking: 250ms window per cast (same pattern as Vivify cleave)
  let lastChainHealCastAt: number | null = null;
  let lastChainHealHits = 0;
  let lastChainHealPrimarySeen = false;
  const chainHealCastHits: number[] = [];

  // Ascendance window tracking
  let inAscendance = false;

  // Initialize specifics
  const specifics: RestoShamanReport['specifics'] = {
    riptide: {
      casts: 0,
      initialHits: 0,
      hotApplies: 0,
      hotRefreshes: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
      initialHealing: 0,
    },
    chainHeal: {
      casts: 0,
      bounceHits: 0,
      averageBouncesPerCast: 0,
      totalHealing: 0,
      totalOverhealing: 0,
    },
    cloudburst: {
      releaseHits: 0,
      totalReleaseHealing: 0,
      manualRecalls: 0,
    },
    earthliving: {
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
    },
    totems: {
      healingStreamTotemCasts: 0,
      healingStreamTickHealing: 0,
      healingTideTotemTicks: 0,
      healingTideTotemHealing: 0,
      earthenWallTotemAbsorbed: 0,
      spiritLinkTotemCasts: 0,
      manaTideTotemCasts: 0,
    },
    cooldowns: {
      ascendanceCasts: 0,
      ascendanceWindowHealing: 0,
      ascendanceBurstHealing: 0,
      spiritwalkersGraceCasts: 0,
      naturesSwiftnessCasts: 0,
      primordialWaveCasts: 0,
    },
    heroTalent: {
      totemic: {
        surgingTotemCasts: 0,
        stormstreamHealing: 0,
        totemicReboundChainHealing: 0,
        healingRainTotemicHealing: 0,
      },
      farseer: {
        callOfAncestorsChainHealing: 0,
        ancestralAwakeningHealing: 0,
      },
    },
  };

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

        const manaCost = readManaCost(c);
        if (manaCost > 0) {
          entry.manaSpent += manaCost;
          totalManaSpent += manaCost;
        }

        switch (id) {
          case RS_SPELLS.RIPTIDE:
            specifics.riptide.casts += 1;
            break;
          case RS_SPELLS.CHAIN_HEAL:
            if (lastChainHealCastAt !== null) {
              chainHealCastHits.push(lastChainHealHits);
            }
            lastChainHealCastAt = c.timestamp;
            lastChainHealHits = 0;
            lastChainHealPrimarySeen = false;
            specifics.chainHeal.casts += 1;
            break;
          case RS_SPELLS.CLOUDBURST_TOTEM_RECALL:
            specifics.cloudburst.manualRecalls += 1;
            break;
          case RS_SPELLS.HEALING_STREAM_TOTEM_CAST:
            specifics.totems.healingStreamTotemCasts += 1;
            break;
          case RS_SPELLS.SPIRIT_LINK_TOTEM_SUMMON:
            specifics.totems.spiritLinkTotemCasts += 1;
            break;
          case RS_SPELLS.MANA_TIDE_SUMMON:
            specifics.totems.manaTideTotemCasts += 1;
            break;
          case RS_SPELLS.ASCENDANCE_RESTORATION_TALENT:
            specifics.cooldowns.ascendanceCasts += 1;
            break;
          case RS_SPELLS.SPIRITWALKERS_GRACE:
            specifics.cooldowns.spiritwalkersGraceCasts += 1;
            break;
          case RS_SPELLS.NATURES_SWIFTNESS:
            specifics.cooldowns.naturesSwiftnessCasts += 1;
            break;
          case RS_SPELLS.PRIMORDIAL_WAVE_CAST:
            specifics.cooldowns.primordialWaveCasts += 1;
            break;
          case RS_SPELLS.SURGING_TOTEM:
            specifics.heroTalent.totemic.surgingTotemCasts += 1;
            break;
          case RS_SPELLS.STORMSTREAM_TOTEM_CAST:
            // Stormstream totem cast — tracked via perSpell; hero healing from its heal events
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
        const entry = ensure(id, h.ability.name);
        const amount = h.amount;
        const overheal = h.overheal ?? 0;
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

        // Ascendance window healing: capture ALL healing while in window
        if (inAscendance) {
          specifics.cooldowns.ascendanceWindowHealing += amount;
        }

        switch (id) {
          case RS_SPELLS.RIPTIDE:
            // Single-ID disambiguation: use tick flag and event type
            if (h.tick) {
              specifics.riptide.hotTicks += 1;
              specifics.riptide.hotHealing += amount;
              specifics.riptide.hotOverhealing += overheal;
            } else {
              specifics.riptide.initialHits += 1;
              specifics.riptide.initialHealing += amount;
            }
            break;

          case RS_SPELLS.CHAIN_HEAL:
            if (
              lastChainHealCastAt !== null &&
              h.timestamp - lastChainHealCastAt <= CHAIN_HEAL_WINDOW_MS
            ) {
              lastChainHealHits += 1;
            }
            // Primary target is the first heal in the window; bounceHits excludes it
            if (lastChainHealPrimarySeen) {
              specifics.chainHeal.bounceHits += 1;
            }
            lastChainHealPrimarySeen = true;
            specifics.chainHeal.totalHealing += amount;
            specifics.chainHeal.totalOverhealing += overheal;
            break;

          case RS_SPELLS.CLOUDBURST_TOTEM_HEAL:
            specifics.cloudburst.releaseHits += 1;
            specifics.cloudburst.totalReleaseHealing += amount;
            break;

          case RS_SPELLS.EARTHLIVING_WEAPON_HEAL:
            specifics.earthliving.hotTicks += 1;
            specifics.earthliving.hotHealing += amount;
            specifics.earthliving.hotOverhealing += overheal;
            break;

          case RS_SPELLS.HEALING_STREAM_TOTEM_HEAL:
            specifics.totems.healingStreamTickHealing += amount;
            break;

          case RS_SPELLS.HEALING_TIDE_TOTEM_HEAL:
            specifics.totems.healingTideTotemTicks += 1;
            specifics.totems.healingTideTotemHealing += amount;
            break;

          case RS_SPELLS.EARTHEN_WALL_TOTEM_ABSORB:
            // Absorb amount = heal event amount
            specifics.totems.earthenWallTotemAbsorbed += amount;
            break;

          case RS_SPELLS.ASCENDANCE_HEAL:
          case RS_SPELLS.ASCENDANCE_INITIAL_HEAL:
            specifics.cooldowns.ascendanceBurstHealing += amount;
            break;

          case RS_SPELLS.STORMSTREAM_TOTEM_HEAL:
          case RS_SPELLS.STORMSWELL_HEAL:
            specifics.heroTalent.totemic.stormstreamHealing += amount;
            break;

          case RS_SPELLS.TOTEMIC_REBOUND_CHAIN_HEAL:
            specifics.heroTalent.totemic.totemicReboundChainHealing += amount;
            break;

          case RS_SPELLS.HEALING_RAIN_TOTEMIC:
            specifics.heroTalent.totemic.healingRainTotemicHealing += amount;
            break;

          case RS_SPELLS.CALL_OF_ANCESTORS_CHAIN_HEAL:
            specifics.heroTalent.farseer.callOfAncestorsChainHealing += amount;
            break;

          case RS_SPELLS.ANCESTRAL_AWAKENING_HEAL:
            specifics.heroTalent.farseer.ancestralAwakeningHealing += amount;
            break;
        }
        break;
      }

      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) {
          break;
        }
        switch (b.ability.guid) {
          case RS_SPELLS.RIPTIDE:
            specifics.riptide.hotApplies += 1;
            break;
          case RS_SPELLS.ASCENDANCE_RESTORATION_TALENT:
            if (b.targetID === playerId) {
              inAscendance = true;
            }
            break;
        }
        break;
      }

      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) {
          break;
        }
        switch (r.ability.guid) {
          case RS_SPELLS.RIPTIDE:
            specifics.riptide.hotRefreshes += 1;
            break;
        }
        break;
      }

      case EventType.RemoveBuff: {
        const rb = ev as RemoveBuffEvent;
        if (rb.sourceID !== playerId) {
          break;
        }
        switch (rb.ability.guid) {
          case RS_SPELLS.ASCENDANCE_RESTORATION_TALENT:
            if (rb.targetID === playerId) {
              inAscendance = false;
            }
            break;
        }
        break;
      }

      default:
        break;
    }
  }

  // Flush last chain heal window
  if (lastChainHealCastAt !== null) {
    chainHealCastHits.push(lastChainHealHits);
  }

  // Compute average bounces per cast from window-based history
  specifics.chainHeal.averageBouncesPerCast =
    specifics.chainHeal.casts > 0
      ? chainHealCastHits.reduce((a, b) => a + b, 0) / specifics.chainHeal.casts
      : 0;

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

  // Sort by effective healing desc
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

  return {
    fightDurationMs,
    playerId,
    playerName,
    totals,
    perSpell: perSpellArray,
    specifics,
    detectedBuild: detectBuild(specifics),
    warnings,
  };
}

// ── Hero talent detection ───────────────────────────────────────────

function detectBuild(
  specifics: RestoShamanReport['specifics'],
): RestoShamanReport['detectedBuild'] {
  const totemic =
    specifics.heroTalent.totemic.surgingTotemCasts > 0 ||
    specifics.heroTalent.totemic.stormstreamHealing > 0 ||
    specifics.heroTalent.totemic.totemicReboundChainHealing > 0 ||
    specifics.heroTalent.totemic.healingRainTotemicHealing > 0;

  const farseer =
    specifics.heroTalent.farseer.callOfAncestorsChainHealing > 0 ||
    specifics.heroTalent.farseer.ancestralAwakeningHealing > 0;

  if (farseer) {
    return 'farseer';
  }
  if (totemic) {
    return 'totemic';
  }
  return 'unknown';
}
