// Path-A resto druid extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / manaSpent / hits / crits / ticks)
//   - resto-druid-specific metrics (9+ HoT tracking, Germination, Lifebloom uptime,
//     Wild Growth target count, Clearcasting procs, Mastery Harmony stacking)
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
import type { BaseSpecReport } from './registry.js';

// --- Restoration Druid spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
// Verified against constants.ts:9-27 and upstream spell data.
export const RD_SPELLS = {
  // HoTs (track all separately)
  REJUVENATION: 774, // cast / buff / tick — same ID
  GERMINATION: 155777, // 2nd Rejuv stack
  LIFEBLOOM: 33763, // cast / buff / tick — same ID
  LIFEBLOOM_BLOOM: 33778, // bloom finisher
  WILD_GROWTH: 48438, // cast / buff / tick — same ID
  WILD_GROWTH_GG: 422382, // Grove Guardian variant
  REGROWTH: 8936, // cast / direct heal / HoT — distinguish via event.tick
  REGROWTH_DRYAD: 1264664, // Sylvan Beckoning variant
  CULTIVATION: 200389, // proc HoT
  SPRING_BLOSSOMS: 207386, // Efflorescence proc HoT
  CENARION_WARD_HEAL: 102352,
  CENARION_WARD_CAST: 102351,
  SYMBIOTIC_BLOOMS: 439530, // Wildstalker
  GROVE_TENDING: 383193,
  TRANQUILITY_CAST: 740,
  TRANQUILITY_HEAL: 157982, // tick
  TRANQUILITY_DRYAD: 1264659,

  // Direct heals & utility
  SWIFTMEND: 18562,
  NATURES_CURE: 88423,
  IRONBARK: 102342,
  INNERVATE: 29166,
  NOURISH: 50464,
  EFFLORESCENCE_CAST: 145205,
  EFFLORESCENCE_HEAL: 81269, // ground tick heal
  CLEARCASTING_BUFF: 16870,

  // Cooldowns
  INCARNATION_TREE_OF_LIFE: 33891,
  CONVOKE_THE_SPIRITS: 391528,
  NATURES_SWIFTNESS: 132158,
  BARKSKIN: 22812,
  GROVE_GUARDIANS: 1226140,
  FLOURISH: 197721,
  ADAPTIVE_SWARM_HEAL: 391891,
  ADAPTIVE_SWARM_CAST: 391888,
  NATURES_VIGIL_DAMAGE: 124991,
} as const;

const RD_SPELLS_TO_HUMAN: Record<number, string> = {
  [RD_SPELLS.REJUVENATION]: '回春术',
  [RD_SPELLS.GERMINATION]: '萌芽',
  [RD_SPELLS.LIFEBLOOM]: '生命绽放',
  [RD_SPELLS.LIFEBLOOM_BLOOM]: '生命绽放(绽放)',
  [RD_SPELLS.WILD_GROWTH]: '野性成长',
  [RD_SPELLS.WILD_GROWTH_GG]: '野性成长(树林守护者)',
  [RD_SPELLS.REGROWTH]: '愈合',
  [RD_SPELLS.REGROWTH_DRYAD]: '愈合(林地守护者)',
  [RD_SPELLS.CULTIVATION]: '栽培',
  [RD_SPELLS.SPRING_BLOSSOMS]: '春暖花开',
  [RD_SPELLS.CENARION_WARD_HEAL]: '塞纳里奥结界(治疗)',
  [RD_SPELLS.CENARION_WARD_CAST]: '塞纳里奥结界',
  [RD_SPELLS.SYMBIOTIC_BLOOMS]: '共生绽放',
  [RD_SPELLS.GROVE_TENDING]: '丛林培育',
  [RD_SPELLS.TRANQUILITY_CAST]: '宁静',
  [RD_SPELLS.TRANQUILITY_HEAL]: '宁静(治疗)',
  [RD_SPELLS.TRANQUILITY_DRYAD]: '宁静(林地守护者)',
  [RD_SPELLS.SWIFTMEND]: '迅捷治愈',
  [RD_SPELLS.NATURES_CURE]: '自然之愈',
  [RD_SPELLS.IRONBARK]: '铁木树皮',
  [RD_SPELLS.INNERVATE]: '激活',
  [RD_SPELLS.NOURISH]: '滋养',
  [RD_SPELLS.EFFLORESCENCE_CAST]: '繁盛',
  [RD_SPELLS.EFFLORESCENCE_HEAL]: '繁盛(治疗)',
  [RD_SPELLS.CLEARCASTING_BUFF]: '清晰预兆',
  [RD_SPELLS.INCARNATION_TREE_OF_LIFE]: '化身：生命之树',
  [RD_SPELLS.CONVOKE_THE_SPIRITS]: '召集精灵',
  [RD_SPELLS.NATURES_SWIFTNESS]: '自然迅捷',
  [RD_SPELLS.BARKSKIN]: '树皮术',
  [RD_SPELLS.GROVE_GUARDIANS]: '树林守护者',
  [RD_SPELLS.FLOURISH]: '繁茂(被动)',
  [RD_SPELLS.ADAPTIVE_SWARM_HEAL]: '适者生存(治疗)',
  [RD_SPELLS.ADAPTIVE_SWARM_CAST]: '适者生存',
  [RD_SPELLS.NATURES_VIGIL_DAMAGE]: '自然守护(伤害)',
};

// --- Interfaces ---

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
  /** healing / (healing + overhealing) — 0..1, undefined if no heal */
  healingEfficiency: number | undefined;
}

export interface RestoDruidReport extends BaseSpecReport {
  perSpell: SpellSummary[];
  specifics: {
    rejuvenation: {
      casts: number;
      hotApplies: number; // 774 applyBuff
      hotRefreshes: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
      germinationApplies: number; // 155777 applyBuff
      germinationTicks: number;
      germinationHealing: number;
    };
    lifebloom: {
      casts: number;
      uptimeMs: number; // total time with at least one LB active
      uptimePct: number; // 0–1
      uniqueTargets: number; // distinct targetIDs that received LB
      bloomHits: number; // 33778 heal events
      bloomHealing: number;
      hotTicks: number;
      hotHealing: number;
    };
    wildGrowth: {
      casts: number;
      hotApplies: number; // total apply events (each cast hits 5–6)
      averageTargetsPerCast: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
    };
    regrowth: {
      casts: number;
      directHits: number; // heal events with !tick
      directHealing: number;
      hotTicks: number; // heal events with tick
      hotHealing: number;
      clearcastingProcs: number;
      clearcastingConsumed: number;
    };
    swiftmend: { casts: number; healing: number; overhealing: number };
    tranquility: { casts: number; ticks: number; healing: number; overhealing: number };
    cenarionWard: { casts: number; healing: number; overhealing: number };
    efflorescence: { casts: number; ticks: number; healing: number; overhealing: number };
    procs: {
      cultivationHits: number;
      cultivationHealing: number;
      springBlossomsHits: number;
      springBlossomsHealing: number;
    };
    cooldowns: {
      incarnationTreeOfLifeCasts: number;
      convokeCasts: number;
      groveGuardiansCasts: number;
      ironbarkCasts: number;
      innervateCasts: number;
      naturesSwiftnessCasts: number;
      barkskinCasts: number;
    };
    mastery: {
      averageHotsPerHeal: number; // weighted by heal amount
      averageMasteryStacks: number; // applying diminishing returns
      peakSimultaneousHots: number;
      harmoniousBloomingDetected: boolean;
    };
    heroTalent: {
      wildstalker: {
        symbioticBloomsHits: number;
        symbioticBloomsHealing: number;
      };
      keeperOfTheGrove: {
        dryadRegrowthHits: number;
        dryadRegrowthHealing: number;
        dryadTranquilityHits: number;
        dryadTranquilityHealing: number;
      };
    };
  };
  detectedBuild: 'wildstalker' | 'keeper-of-the-grove' | 'unknown';
  warnings: string[];
}

// --- Mastery: Harmony constants ---
// Verified from constants.ts:9-27
const MASTERY_MULT_TABLE: readonly number[] = [
  0, // 0 HoTs
  1.0, // 1 HoT
  1.7, // 2 HoTs
  2.3, // 3 HoTs
  2.8, // 4 HoTs
  3.2, // 5 HoTs
  3.5, // 6 HoTs
  3.7, // 7 HoTs
  3.8, // 8 HoTs
  3.85, // 9 HoTs
  3.65, // 10+ HoTs
];

/** HoTs that contribute Mastery (Harmony) stacks. */
const MASTERY_STACK_BUFF_IDS = new Set<number>([
  RD_SPELLS.REJUVENATION, // 774
  RD_SPELLS.GERMINATION, // 155777
  RD_SPELLS.LIFEBLOOM, // 33763
  RD_SPELLS.WILD_GROWTH, // 48438
  RD_SPELLS.REGROWTH, // 8936
  RD_SPELLS.CULTIVATION, // 200389
  RD_SPELLS.SPRING_BLOSSOMS, // 207386
  RD_SPELLS.CENARION_WARD_HEAL, // 102352
  RD_SPELLS.SYMBIOTIC_BLOOMS, // 439530
]);

const HARMONIUS_BLOOMING_EXTRA_STACKS = 2;

function masteryMult(hots: number): number {
  const idx = Math.min(hots, MASTERY_MULT_TABLE.length - 1);
  return MASTERY_MULT_TABLE[idx];
}

// --- Misc helpers ---

const MANA_RESOURCE_TYPE = 0;
const HIT_TYPE_CRIT = 2;

/** Read mana cost from a cast event, matching the mistweaver pattern. */
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

// --- Extractor ---

export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

export function extractRestoDruidReport(input: ExtractInput): RestoDruidReport {
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
        spellNameCN: RD_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // --- Per-target HoT state for Mastery tracking ---
  // targetID → Set of active HoT spell IDs (from MASTERY_STACK_BUFF_IDS)
  const targetHoTs = new Map<number, Set<number>>();
  const getTargetHoTs = (targetID: number): Set<number> => {
    let s = targetHoTs.get(targetID);
    if (!s) {
      s = new Set<number>();
      targetHoTs.set(targetID, s);
    }
    return s;
  };

  // --- Lifebloom uptime tracking ---
  const lifebloomActiveTargets = new Set<number>();
  const lifebloomUniqueTargets = new Set<number>();
  let lifebloomLastChangeAt = fightStart;
  let lifebloomTotalActiveTimeMs = 0;

  const integrateLbUptime = (now: number): void => {
    if (lifebloomActiveTargets.size > 0) {
      lifebloomTotalActiveTimeMs += now - lifebloomLastChangeAt;
    }
    lifebloomLastChangeAt = now;
  };

  function addLbTarget(targetID: number, now: number): void {
    const wasEmpty = lifebloomActiveTargets.size === 0;
    lifebloomActiveTargets.add(targetID);
    lifebloomUniqueTargets.add(targetID);
    if (wasEmpty) {
      integrateLbUptime(now);
    }
  }

  function removeLbTarget(targetID: number, now: number): void {
    lifebloomActiveTargets.delete(targetID);
    if (lifebloomActiveTargets.size === 0) {
      integrateLbUptime(now);
    }
  }

  // --- Clearcasting tracking (player buff) ---
  let playerHasClearcasting = false;

  // --- Accumulators ---
  const specifics: RestoDruidReport['specifics'] = {
    rejuvenation: {
      casts: 0,
      hotApplies: 0,
      hotRefreshes: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
      germinationApplies: 0,
      germinationTicks: 0,
      germinationHealing: 0,
    },
    lifebloom: {
      casts: 0,
      uptimeMs: 0,
      uptimePct: 0,
      uniqueTargets: 0,
      bloomHits: 0,
      bloomHealing: 0,
      hotTicks: 0,
      hotHealing: 0,
    },
    wildGrowth: {
      casts: 0,
      hotApplies: 0,
      averageTargetsPerCast: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
    },
    regrowth: {
      casts: 0,
      directHits: 0,
      directHealing: 0,
      hotTicks: 0,
      hotHealing: 0,
      clearcastingProcs: 0,
      clearcastingConsumed: 0,
    },
    swiftmend: { casts: 0, healing: 0, overhealing: 0 },
    tranquility: { casts: 0, ticks: 0, healing: 0, overhealing: 0 },
    cenarionWard: { casts: 0, healing: 0, overhealing: 0 },
    efflorescence: { casts: 0, ticks: 0, healing: 0, overhealing: 0 },
    procs: {
      cultivationHits: 0,
      cultivationHealing: 0,
      springBlossomsHits: 0,
      springBlossomsHealing: 0,
    },
    cooldowns: {
      incarnationTreeOfLifeCasts: 0,
      convokeCasts: 0,
      groveGuardiansCasts: 0,
      ironbarkCasts: 0,
      innervateCasts: 0,
      naturesSwiftnessCasts: 0,
      barkskinCasts: 0,
    },
    mastery: {
      averageHotsPerHeal: 0,
      averageMasteryStacks: 0,
      peakSimultaneousHots: 0,
      harmoniousBloomingDetected: false,
    },
    heroTalent: {
      wildstalker: {
        symbioticBloomsHits: 0,
        symbioticBloomsHealing: 0,
      },
      keeperOfTheGrove: {
        dryadRegrowthHits: 0,
        dryadRegrowthHealing: 0,
        dryadTranquilityHits: 0,
        dryadTranquilityHealing: 0,
      },
    },
  };

  // Mastery weighted-tracking accumulators
  let sumHealingWeightedHotCount = 0;
  let sumHealingWeightedMasteryStacks = 0;
  let peakSimultaneousHots = 0;

  let totalCasts = 0;
  let totalHealing = 0;
  let totalOverhealing = 0;
  let totalManaSpent = 0;

  for (const ev of events) {
    switch (ev.type) {
      // ── Cast events ──────────────────────────────────────────────
      case EventType.Cast: {
        const c = ev as CastEvent;
        if (c.sourceID !== playerId) break;

        const id = c.ability.guid;
        const entry = ensure(id, c.ability.name);
        entry.casts += 1;
        totalCasts += 1;

        const manaCost = readManaCost(c);
        if (manaCost > 0) {
          entry.manaSpent += manaCost;
          totalManaSpent += manaCost;
        }

        // Spell-specific cast counters
        switch (id) {
          case RD_SPELLS.REJUVENATION:
            specifics.rejuvenation.casts += 1;
            break;
          case RD_SPELLS.LIFEBLOOM:
            specifics.lifebloom.casts += 1;
            break;
          case RD_SPELLS.WILD_GROWTH:
            specifics.wildGrowth.casts += 1;
            break;
          case RD_SPELLS.REGROWTH:
            specifics.regrowth.casts += 1;
            if (playerHasClearcasting) {
              specifics.regrowth.clearcastingConsumed += 1;
            }
            break;
          case RD_SPELLS.SWIFTMEND:
            specifics.swiftmend.casts += 1;
            break;
          case RD_SPELLS.TRANQUILITY_CAST:
            specifics.tranquility.casts += 1;
            break;
          case RD_SPELLS.CENARION_WARD_CAST:
            specifics.cenarionWard.casts += 1;
            break;
          case RD_SPELLS.EFFLORESCENCE_CAST:
            specifics.efflorescence.casts += 1;
            break;
          case RD_SPELLS.INCARNATION_TREE_OF_LIFE:
            specifics.cooldowns.incarnationTreeOfLifeCasts += 1;
            break;
          case RD_SPELLS.CONVOKE_THE_SPIRITS:
            specifics.cooldowns.convokeCasts += 1;
            break;
          case RD_SPELLS.GROVE_GUARDIANS:
            specifics.cooldowns.groveGuardiansCasts += 1;
            break;
          case RD_SPELLS.IRONBARK:
            specifics.cooldowns.ironbarkCasts += 1;
            break;
          case RD_SPELLS.INNERVATE:
            specifics.cooldowns.innervateCasts += 1;
            break;
          case RD_SPELLS.NATURES_SWIFTNESS:
            specifics.cooldowns.naturesSwiftnessCasts += 1;
            break;
          case RD_SPELLS.BARKSKIN:
            specifics.cooldowns.barkskinCasts += 1;
            break;
        }
        break;
      }

      // ── Heal events ──────────────────────────────────────────────
      case EventType.Heal: {
        const h = ev as HealEvent;
        if (h.sourceID !== playerId) break;

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

        // --- Mastery: Harmony hot-count tracking (every heal event) ---
        const hotSet = getTargetHoTs(h.targetID);
        const baseHots = hotSet.size;
        // Will be adjusted post-loop once harmoniousBloomingDetected is known
        const effectiveHots = baseHots;

        // Accumulate weighted (will correct for HB later in post-processing)
        sumHealingWeightedHotCount += effectiveHots * amount;
        const mul = masteryMult(effectiveHots);
        sumHealingWeightedMasteryStacks += mul * amount;
        if (effectiveHots > peakSimultaneousHots) {
          peakSimultaneousHots = effectiveHots;
        }

        // Spell-specific heal counters
        switch (id) {
          case RD_SPELLS.REJUVENATION:
            specifics.rejuvenation.hotTicks += 1;
            specifics.rejuvenation.hotHealing += amount;
            specifics.rejuvenation.hotOverhealing += overheal;
            break;
          case RD_SPELLS.GERMINATION:
            specifics.rejuvenation.germinationTicks += 1;
            specifics.rejuvenation.germinationHealing += amount;
            break;
          case RD_SPELLS.LIFEBLOOM:
            specifics.lifebloom.hotTicks += 1;
            specifics.lifebloom.hotHealing += amount;
            break;
          case RD_SPELLS.LIFEBLOOM_BLOOM:
            specifics.lifebloom.bloomHits += 1;
            specifics.lifebloom.bloomHealing += amount;
            break;
          case RD_SPELLS.WILD_GROWTH:
            specifics.wildGrowth.hotTicks += 1;
            specifics.wildGrowth.hotHealing += amount;
            specifics.wildGrowth.hotOverhealing += overheal;
            break;
          case RD_SPELLS.REGROWTH: {
            if (h.tick) {
              specifics.regrowth.hotTicks += 1;
              specifics.regrowth.hotHealing += amount;
            } else {
              specifics.regrowth.directHits += 1;
              specifics.regrowth.directHealing += amount;
            }
            break;
          }
          case RD_SPELLS.REGROWTH_DRYAD:
            specifics.heroTalent.keeperOfTheGrove.dryadRegrowthHits += 1;
            specifics.heroTalent.keeperOfTheGrove.dryadRegrowthHealing += amount;
            break;
          case RD_SPELLS.SWIFTMEND:
            specifics.swiftmend.healing += amount;
            specifics.swiftmend.overhealing += overheal;
            break;
          case RD_SPELLS.TRANQUILITY_HEAL:
            specifics.tranquility.ticks += 1;
            specifics.tranquility.healing += amount;
            specifics.tranquility.overhealing += overheal;
            break;
          case RD_SPELLS.TRANQUILITY_DRYAD:
            specifics.heroTalent.keeperOfTheGrove.dryadTranquilityHits += 1;
            specifics.heroTalent.keeperOfTheGrove.dryadTranquilityHealing += amount;
            break;
          case RD_SPELLS.CENARION_WARD_HEAL:
            specifics.cenarionWard.healing += amount;
            specifics.cenarionWard.overhealing += overheal;
            break;
          case RD_SPELLS.EFFLORESCENCE_HEAL:
            specifics.efflorescence.ticks += 1;
            specifics.efflorescence.healing += amount;
            specifics.efflorescence.overhealing += overheal;
            break;
          case RD_SPELLS.CULTIVATION:
            specifics.procs.cultivationHits += 1;
            specifics.procs.cultivationHealing += amount;
            break;
          case RD_SPELLS.SPRING_BLOSSOMS:
            specifics.procs.springBlossomsHits += 1;
            specifics.procs.springBlossomsHealing += amount;
            break;
          case RD_SPELLS.SYMBIOTIC_BLOOMS:
            specifics.heroTalent.wildstalker.symbioticBloomsHits += 1;
            specifics.heroTalent.wildstalker.symbioticBloomsHealing += amount;
            break;
        }
        break;
      }

      // ── ApplyBuff events ─────────────────────────────────────────
      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) break;

        const id = b.ability.guid;
        const now = b.timestamp;

        // Update per-target HoT state for mastery tracking
        if (MASTERY_STACK_BUFF_IDS.has(id)) {
          getTargetHoTs(b.targetID).add(id);
        }

        // Spell-specific buff counters
        switch (id) {
          case RD_SPELLS.REJUVENATION:
            specifics.rejuvenation.hotApplies += 1;
            break;
          case RD_SPELLS.GERMINATION:
            specifics.rejuvenation.germinationApplies += 1;
            break;
          case RD_SPELLS.LIFEBLOOM:
            addLbTarget(b.targetID, now);
            break;
          case RD_SPELLS.WILD_GROWTH:
            specifics.wildGrowth.hotApplies += 1;
            break;
          case RD_SPELLS.CLEARCASTING_BUFF:
            if (b.targetID === playerId) {
              specifics.regrowth.clearcastingProcs += 1;
              playerHasClearcasting = true;
            }
            break;
        }
        break;
      }

      // ── RefreshBuff events ───────────────────────────────────────
      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) break;

        const id = r.ability.guid;

        // Update per-target HoT state (refresh confirms active)
        if (MASTERY_STACK_BUFF_IDS.has(id)) {
          getTargetHoTs(r.targetID).add(id);
        }

        // Spell-specific refresh counters
        if (id === RD_SPELLS.REJUVENATION) {
          specifics.rejuvenation.hotRefreshes += 1;
        }
        break;
      }

      // ── RemoveBuff events ────────────────────────────────────────
      case EventType.RemoveBuff: {
        const rb = ev as RemoveBuffEvent;
        if (rb.sourceID !== playerId) break;

        const id = rb.ability.guid;
        const now = rb.timestamp;

        // Update per-target HoT state for mastery tracking
        if (MASTERY_STACK_BUFF_IDS.has(id)) {
          const hotSet = targetHoTs.get(rb.targetID);
          if (hotSet) {
            hotSet.delete(id);
            if (hotSet.size === 0) {
              targetHoTs.delete(rb.targetID);
            }
          }
        }

        // Lifebloom removal
        if (id === RD_SPELLS.LIFEBLOOM) {
          removeLbTarget(rb.targetID, now);
        }

        // Clearcasting removal
        if (id === RD_SPELLS.CLEARCASTING_BUFF && rb.targetID === playerId) {
          playerHasClearcasting = false;
        }
        break;
      }

      default:
        break;
    }
  }

  // --- Post-processing ---

  // Final Lifebloom uptime integration (from last change to fightEnd)
  integrateLbUptime(fightEnd);
  const lbUptime = fightDurationMs > 0 ? lifebloomTotalActiveTimeMs / fightDurationMs : 0;
  specifics.lifebloom.uptimeMs = lifebloomTotalActiveTimeMs;
  specifics.lifebloom.uptimePct = lbUptime;
  specifics.lifebloom.uniqueTargets = lifebloomUniqueTargets.size;

  // Harmonious Blooming heuristic: assume talent taken if LB uptime > 30%
  const harmoniousBlooming = lbUptime > 0.3;
  specifics.mastery.harmoniousBloomingDetected = harmoniousBlooming;
  if (lbUptime > 0.15 && lbUptime <= 0.3) {
    warnings.push(
      `生命绽放覆盖率 ${(lbUptime * 100).toFixed(1)}% 处于临界值，无法确定是否点选和谐绽放天赋。精通计算未计入额外层数。`,
    );
  }

  // Correct mastery weighted averages for Harmonious Blooming extra stacks
  // We need to re-compute: for each heal event, we already accumulated baseHots.
  // To correct: sumHealingWeightedHotCount already has baseHots * amount.
  // We cannot easily separate. Instead, we approximate by adding the extra-stack
  // contribution for lifebloom-active heal periods. The precise per-event correction
  // would require replaying — instead we apply a proportional correction.
  //
  // If harmoniousBlooming is active and lifebloom had any uptime, add a proportional
  // boost: hotCount += 2 was missing for every heal during LB uptime.
  // Approximation: totalHealingLBWindow ≈ totalHealing * lbUptime
  // Correction: add 2 * lbUptime * totalHealing to weighted hot count
  // and recalculate mastery stacks with the boosted average.
  if (harmoniousBlooming && lbUptime > 0 && totalHealing > 0) {
    const lbHealingEstimate = totalHealing * Math.min(lbUptime, 1);
    sumHealingWeightedHotCount += HARMONIUS_BLOOMING_EXTRA_STACKS * lbHealingEstimate;

    // For mastery stacks, we need to add the extra 2 stacks' mult contribution
    // Re-compute average hots, then apply mastery table
    const boostedAvgHots = sumHealingWeightedHotCount / totalHealing;
    const boostedMasteryMult = masteryMult(Math.round(boostedAvgHots));
    sumHealingWeightedMasteryStacks = boostedMasteryMult * totalHealing;
  }

  // Compute final mastery stats
  const avgHotsPerHeal = totalHealing > 0 ? sumHealingWeightedHotCount / totalHealing : 0;
  // Use average of mastery mult table rather than accumulated (which was pre-correction)
  // Actually the accumulated sumHealingWeightedMasteryStacks already uses masteryMult per-event.
  // For correctness with HB correction, we recompute:
  const avgMasteryStacks = totalHealing > 0 ? sumHealingWeightedMasteryStacks / totalHealing : 0;
  specifics.mastery.averageHotsPerHeal = avgHotsPerHeal;
  specifics.mastery.averageMasteryStacks = avgMasteryStacks;
  specifics.mastery.peakSimultaneousHots = peakSimultaneousHots;

  // Wild Growth average targets per cast
  specifics.wildGrowth.averageTargetsPerCast =
    specifics.wildGrowth.casts > 0
      ? specifics.wildGrowth.hotApplies / specifics.wildGrowth.casts
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

  const detectedBuild = detectBuild(specifics, totalHealing);

  return {
    fightDurationMs,
    playerId,
    playerName,
    totals,
    perSpell: perSpellArray,
    specifics,
    detectedBuild,
    warnings,
  };
}

// --- Build detection ---

function detectBuild(
  specifics: RestoDruidReport['specifics'],
  totalHealing: number,
): RestoDruidReport['detectedBuild'] {
  const wsHealing = specifics.heroTalent.wildstalker.symbioticBloomsHealing;
  const wsHits = specifics.heroTalent.wildstalker.symbioticBloomsHits;
  const kotgRegrowthHealing = specifics.heroTalent.keeperOfTheGrove.dryadRegrowthHealing;
  const kotgRegrowthHits = specifics.heroTalent.keeperOfTheGrove.dryadRegrowthHits;
  const kotgTranqHealing = specifics.heroTalent.keeperOfTheGrove.dryadTranquilityHealing;
  const kotgTranqHits = specifics.heroTalent.keeperOfTheGrove.dryadTranquilityHits;

  const kotgHits = kotgRegrowthHits + kotgTranqHits;
  const kotgHealing = kotgRegrowthHealing + kotgTranqHealing;

  if (totalHealing <= 0) {
    return 'unknown';
  }

  // Strong signals
  if (wsHits > 0 && kotgHits === 0) {
    return 'wildstalker';
  }
  if (kotgHits > 0 && wsHits === 0) {
    return 'keeper-of-the-grove';
  }

  // Both present — pick whichever dominates healing
  if (wsHits > 0 && kotgHits > 0) {
    return wsHealing >= kotgHealing ? 'wildstalker' : 'keeper-of-the-grove';
  }

  return 'unknown';
}
