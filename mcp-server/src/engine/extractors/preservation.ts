// Path-A Preservation Evoker extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / hits / crits / ticks)
//   - preservation-specific metrics (Empower level tracking, Echo replay heals,
//     Reversion HoT, Essence resource, hero talent detection)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  CastEvent,
  DamageEvent,
  HealEvent,
  ApplyBuffEvent,
  RefreshBuffEvent,
  ChangeBuffStackEvent,
  EmpowerEndEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';
import type { BaseSpecReport } from './registry.js';

// --- Preservation Evoker spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
// Calibrated against upstream evoker spell definitions and WCL event streams.
export const PRES_SPELLS = {
  // Empower casts
  DREAM_BREATH_CAST: 355936,
  DREAM_BREATH: 355941, // EmpowerEnd + HoT tick + heal
  DREAM_BREATH_ECHO: 376788, // echo replay
  DREAM_BREATH_FONT: 382614, // Font of Magic variant
  SPIRITBLOOM_CAST: 367230,
  SPIRITBLOOM_FONT: 382731,
  SPIRITBLOOM_SPLIT: 367231, // split heal projectiles
  SPIRITBLOOM_HOT: 409895, // TWW HoT
  FIRE_BREATH_CAST: 357208,
  FIRE_BREATH_DOT: 357209,
  FIRE_BREATH_FONT: 382266,

  // Reversion
  REVERSION_CAST: 366155, // cast / HoT apply / tick
  REVERSION_ECHO: 367364, // echo replay HoT

  // Echo
  ECHO_CAST: 364343, // talent, cast / buff on target
  ECHO_BUFF: 364343, // same ID as cast

  // Living Flame / Emerald Blossom
  LIVING_FLAME_CAST: 361469,
  LIVING_FLAME_HEAL: 361509,
  LIVING_FLAME_DAMAGE: 361500,
  EMERALD_BLOSSOM_CAST: 355913,
  EMERALD_BLOSSOM: 355916, // delayed heal
  EMERALD_BLOSSOM_ECHO: 376832, // echo replay

  // Utility & cooldowns
  VERDANT_EMBRACE_CAST: 360995,
  VERDANT_EMBRACE_HEAL: 361195,
  TIME_DILATION: 357170,
  STASIS_CAST: 370537,
  STASIS_BUFF: 370562,
  REWIND: 363534,
  DREAM_FLIGHT_CAST: 359816,
  DREAM_FLIGHT_HEAL: 363502,
  TIP_THE_SCALES: 370553,
  SOURCE_OF_MAGIC: 369459,
  ZEPHYR: 374227,
  RENEWING_BLAZE_CAST: 374348,
  RENEWING_BLAZE_HEAL: 374349,
  EMERALD_COMMUNION_ALLY: 370984,

  // Procs / buffs
  ESSENCE_BURST_BUFF: 369299,
  TWIN_ECHOES_BUFF: 1242759,
  GOLDEN_HOUR_HEAL: 378213,
  LIFEBIND_HEAL: 373268,
  LIFEBIND_BUFF: 373267,
  TEMPORAL_ANOMALY_SHIELD: 373862,
  CALL_OF_YSERA_BUFF: 373835,
  TEMPORAL_COMPRESSION_BUFF: 362877,

  // Hero talents — Chronowarden
  CHRONO_FLAME_TALENT: 431442,
  CHRONO_FLAME_HEAL_1: 431483,
  CHRONO_FLAME_HEAL_2: 431583,

  // Hero talents — Flameshaper
  ENGULF_HEAL: 443330,
} as const;

const PRES_SPELLS_TO_HUMAN: Record<number, string> = {
  [PRES_SPELLS.DREAM_BREATH_CAST]: '梦境吐息',
  [PRES_SPELLS.DREAM_BREATH]: '梦境吐息(治疗)',
  [PRES_SPELLS.DREAM_BREATH_ECHO]: '梦境吐息(回响)',
  [PRES_SPELLS.DREAM_BREATH_FONT]: '梦境吐息(魔力之源)',
  [PRES_SPELLS.SPIRITBLOOM_CAST]: '灵魄之花',
  [PRES_SPELLS.SPIRITBLOOM_FONT]: '灵魄之花(魔力之源)',
  [PRES_SPELLS.SPIRITBLOOM_SPLIT]: '灵魄之花(投射)',
  [PRES_SPELLS.SPIRITBLOOM_HOT]: '灵魄之花(HoT)',
  [PRES_SPELLS.FIRE_BREATH_CAST]: '火焰吐息',
  [PRES_SPELLS.FIRE_BREATH_DOT]: '火焰吐息(DoT)',
  [PRES_SPELLS.FIRE_BREATH_FONT]: '火焰吐息(魔力之源)',
  [PRES_SPELLS.REVERSION_CAST]: '还原',
  [PRES_SPELLS.REVERSION_ECHO]: '还原(回响)',
  [PRES_SPELLS.ECHO_CAST]: '回响',
  [PRES_SPELLS.LIVING_FLAME_CAST]: '生命烈焰',
  [PRES_SPELLS.LIVING_FLAME_HEAL]: '生命烈焰(治疗)',
  [PRES_SPELLS.LIVING_FLAME_DAMAGE]: '生命烈焰(伤害)',
  [PRES_SPELLS.EMERALD_BLOSSOM_CAST]: '翠绿之芽',
  [PRES_SPELLS.EMERALD_BLOSSOM]: '翠绿之芽(治疗)',
  [PRES_SPELLS.EMERALD_BLOSSOM_ECHO]: '翠绿之芽(回响)',
  [PRES_SPELLS.VERDANT_EMBRACE_CAST]: '翠绿拥抱',
  [PRES_SPELLS.VERDANT_EMBRACE_HEAL]: '翠绿拥抱(治疗)',
  [PRES_SPELLS.TIME_DILATION]: '时间膨胀',
  [PRES_SPELLS.STASIS_CAST]: '静滞',
  [PRES_SPELLS.REWIND]: '倒流',
  [PRES_SPELLS.DREAM_FLIGHT_CAST]: '梦境飞行',
  [PRES_SPELLS.DREAM_FLIGHT_HEAL]: '梦境飞行(治疗)',
  [PRES_SPELLS.TIP_THE_SCALES]: '改换天平',
  [PRES_SPELLS.SOURCE_OF_MAGIC]: '魔力之源',
  [PRES_SPELLS.ZEPHYR]: '微风',
  [PRES_SPELLS.RENEWING_BLAZE_CAST]: '复苏炎息',
  [PRES_SPELLS.RENEWING_BLAZE_HEAL]: '复苏炎息(治疗)',
  [PRES_SPELLS.EMERALD_COMMUNION_ALLY]: '翡翠交融',
  [PRES_SPELLS.ESSENCE_BURST_BUFF]: '精华迸发',
  [PRES_SPELLS.GOLDEN_HOUR_HEAL]: '黄金时刻',
  [PRES_SPELLS.LIFEBIND_HEAL]: '生命缚结(治疗)',
  [PRES_SPELLS.TEMPORAL_ANOMALY_SHIELD]: '时空异象',
  [PRES_SPELLS.CHRONO_FLAME_TALENT]: '时之烈焰',
  [PRES_SPELLS.CHRONO_FLAME_HEAL_1]: '时之烈焰(治疗)',
  [PRES_SPELLS.CHRONO_FLAME_HEAL_2]: '时之烈焰(治疗变体)', // note: 431583 is a damage event, not a heal
  [PRES_SPELLS.ENGULF_HEAL]: '吞噬烈焰(治疗)',
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
  /** healing / (healing + overhealing) — 0..1, undefined if no heal */
  healingEfficiency: number | undefined;
}

export interface PreservationReport extends BaseSpecReport {
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
    empower: {
      dreamBreath: {
        casts: number;
        healingByLevel: number[];
        castsByLevel: number[];
        hotTicks: number;
        totalHealing: number;
      };
      spiritbloom: {
        casts: number;
        healingByLevel: number[];
        castsByLevel: number[];
        totalHealing: number;
      };
      fireBreath: {
        casts: number;
        castsByLevel: number[];
        totalDamage: number;
      };
      cancelledEmpowers: number;
      tipTheScalesCasts: number;
    };
    echo: {
      casts: number;
      buffApplies: number;
      replayHeals: number;
      replayHealing: number;
    };
    reversion: {
      casts: number;
      hotApplies: number;
      hotRefreshes: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
      echoReplayTicks: number;
      echoReplayHealing: number;
    };
    livingFlame: {
      casts: number;
      heals: number;
      totalHealing: number;
      totalOverhealing: number;
      totalDamage: number;
    };
    emeraldBlossom: {
      casts: number;
      hits: number;
      totalHealing: number;
      totalOverhealing: number;
      echoHits: number;
      echoHealing: number;
    };
    cooldowns: {
      rewindCasts: number;
      dreamFlightCasts: number;
      tipTheScalesCasts: number;
      sourceOfMagicCasts: number;
      zephyrCasts: number;
      renewingBlazeCasts: number;
      stasisCasts: number;
      verdantEmbraceCasts: number;
    };
    essence: {
      totalSpent: number;
      essenceBurstProcs: number;
      essenceBurstConsumed: number;
    };
    procs: {
      goldenHourHits: number;
      goldenHourHealing: number;
      lifebindHits: number;
      lifebindHealing: number;
      temporalAnomalyShields: number;
    };
    heroTalent: {
      chronowarden: {
        chronoFlameHealing: number;
      };
      flameshaper: {
        engulfHits: number;
        engulfHealing: number;
      };
    };
  };
  detectedBuild: 'chronowarden' | 'flameshaper' | 'unknown';
  warnings: string[];
}

const ESSENCE_RESOURCE_TYPE = 19;
const HIT_TYPE_CRIT = 2;

function readEssenceCost(c: CastEvent): number {
  const classRes = c.classResources;
  if (Array.isArray(classRes)) {
    const essence = classRes.find((r) => r?.type === ESSENCE_RESOURCE_TYPE);
    if (essence && typeof (essence as { cost?: number }).cost === 'number') {
      return (essence as { cost: number }).cost;
    }
  }
  const cWithLegacy = c as CastEvent & {
    resourceCost?: Record<number, number>;
    rawResourceCost?: Record<number, number>;
  };
  return (
    cWithLegacy.resourceCost?.[ESSENCE_RESOURCE_TYPE] ??
    cWithLegacy.rawResourceCost?.[ESSENCE_RESOURCE_TYPE] ??
    0
  );
}

// Echo spell IDs — heal events with these IDs are ALWAYS echo replays (for v1 without talent info)
const ECHO_REPLAY_IDS = new Set<number>([
  PRES_SPELLS.DREAM_BREATH_ECHO,
  PRES_SPELLS.EMERALD_BLOSSOM_ECHO,
  PRES_SPELLS.REVERSION_ECHO,
]);

// Empower spell groups → used to bucket EmpowerEnd events by logical spell
const EMPOWER_SPELL_GROUPS: Record<number, 'dreamBreath' | 'spiritbloom' | 'fireBreath'> = {
  [PRES_SPELLS.DREAM_BREATH]: 'dreamBreath',
  [PRES_SPELLS.DREAM_BREATH_FONT]: 'dreamBreath',
  [PRES_SPELLS.SPIRITBLOOM_CAST]: 'spiritbloom',
  [PRES_SPELLS.SPIRITBLOOM_FONT]: 'spiritbloom',
  [PRES_SPELLS.FIRE_BREATH_CAST]: 'fireBreath',
  [PRES_SPELLS.FIRE_BREATH_FONT]: 'fireBreath',
};

// Cast IDs whose canonical "cast count" comes from EmpowerEnd, not Cast.
// We skip Cast.entry.casts++ for these to avoid double-counting; essence cost
// is still read from the Cast event.
const EMPOWER_CAST_IDS = new Set<number>([
  PRES_SPELLS.DREAM_BREATH_CAST,
  PRES_SPELLS.DREAM_BREATH,
  PRES_SPELLS.DREAM_BREATH_FONT,
  PRES_SPELLS.SPIRITBLOOM_CAST,
  PRES_SPELLS.SPIRITBLOOM_FONT,
  PRES_SPELLS.FIRE_BREATH_CAST,
  PRES_SPELLS.FIRE_BREATH_FONT,
]);

export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

export function extractPreservationReport(input: ExtractInput): PreservationReport {
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
        spellNameCN: PRES_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // Empowering helpers: indexed by level 0-4
  const makeLevelArray = (): number[] => [0, 0, 0, 0, 0];

  const specifics: PreservationReport['specifics'] = {
    empower: {
      dreamBreath: {
        casts: 0,
        healingByLevel: makeLevelArray(),
        castsByLevel: makeLevelArray(),
        hotTicks: 0,
        totalHealing: 0,
      },
      spiritbloom: {
        casts: 0,
        healingByLevel: makeLevelArray(),
        castsByLevel: makeLevelArray(),
        totalHealing: 0,
      },
      fireBreath: {
        casts: 0,
        castsByLevel: makeLevelArray(),
        totalDamage: 0,
      },
      cancelledEmpowers: 0,
      tipTheScalesCasts: 0,
    },
    echo: {
      casts: 0,
      buffApplies: 0,
      replayHeals: 0,
      replayHealing: 0,
    },
    reversion: {
      casts: 0,
      hotApplies: 0,
      hotRefreshes: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
      echoReplayTicks: 0,
      echoReplayHealing: 0,
    },
    livingFlame: {
      casts: 0,
      heals: 0,
      totalHealing: 0,
      totalOverhealing: 0,
      totalDamage: 0,
    },
    emeraldBlossom: {
      casts: 0,
      hits: 0,
      totalHealing: 0,
      totalOverhealing: 0,
      echoHits: 0,
      echoHealing: 0,
    },
    cooldowns: {
      rewindCasts: 0,
      dreamFlightCasts: 0,
      tipTheScalesCasts: 0,
      sourceOfMagicCasts: 0,
      zephyrCasts: 0,
      renewingBlazeCasts: 0,
      stasisCasts: 0,
      verdantEmbraceCasts: 0,
    },
    essence: {
      totalSpent: 0,
      essenceBurstProcs: 0,
      essenceBurstConsumed: 0,
    },
    procs: {
      goldenHourHits: 0,
      goldenHourHealing: 0,
      lifebindHits: 0,
      lifebindHealing: 0,
      temporalAnomalyShields: 0,
    },
    heroTalent: {
      chronowarden: {
        chronoFlameHealing: 0,
      },
      flameshaper: {
        engulfHits: 0,
        engulfHealing: 0,
      },
    },
  };

  let totalCasts = 0;
  let totalHealing = 0;
  let totalOverhealing = 0;
  // Preservation uses Essence, not Mana — manaSpent stays 0
  const totalManaSpent = 0;

  for (const ev of events) {
    switch (ev.type) {
      // ── Cast ──────────────────────────────────────────────────────
      case EventType.Cast: {
        const c = ev as CastEvent;
        if (c.sourceID !== playerId) {
          break;
        }
        const id = c.ability.guid;
        const entry = ensure(id, c.ability.name);
        if (!EMPOWER_CAST_IDS.has(id)) {
          entry.casts += 1;
          totalCasts += 1;
        }

        // Track essence cost on player casts
        const essenceCost = readEssenceCost(c);
        if (essenceCost > 0) {
          specifics.essence.totalSpent += essenceCost;
        }

        // Spell-specific cast counters
        switch (id) {
          case PRES_SPELLS.ECHO_CAST:
            specifics.echo.casts += 1;
            break;
          case PRES_SPELLS.REVERSION_CAST:
            specifics.reversion.casts += 1;
            break;
          case PRES_SPELLS.LIVING_FLAME_CAST:
            specifics.livingFlame.casts += 1;
            break;
          case PRES_SPELLS.EMERALD_BLOSSOM_CAST:
            specifics.emeraldBlossom.casts += 1;
            break;
          case PRES_SPELLS.REWIND:
            specifics.cooldowns.rewindCasts += 1;
            break;
          case PRES_SPELLS.DREAM_FLIGHT_CAST:
            specifics.cooldowns.dreamFlightCasts += 1;
            break;
          case PRES_SPELLS.TIP_THE_SCALES:
            specifics.cooldowns.tipTheScalesCasts += 1;
            specifics.empower.tipTheScalesCasts += 1;
            break;
          case PRES_SPELLS.SOURCE_OF_MAGIC:
            specifics.cooldowns.sourceOfMagicCasts += 1;
            break;
          case PRES_SPELLS.ZEPHYR:
            specifics.cooldowns.zephyrCasts += 1;
            break;
          case PRES_SPELLS.RENEWING_BLAZE_CAST:
            specifics.cooldowns.renewingBlazeCasts += 1;
            break;
          case PRES_SPELLS.STASIS_CAST:
            specifics.cooldowns.stasisCasts += 1;
            break;
          case PRES_SPELLS.VERDANT_EMBRACE_CAST:
            specifics.cooldowns.verdantEmbraceCasts += 1;
            break;
        }
        break;
      }

      // ── EmpowerEnd ────────────────────────────────────────────────
      case EventType.EmpowerEnd: {
        const ee = ev as EmpowerEndEvent;
        if (ee.sourceID !== playerId) {
          break;
        }
        const id = ee.ability.guid;
        const level = ee.empowermentLevel;
        const entry = ensure(id, ee.ability.name);
        entry.casts += 1;
        totalCasts += 1;

        // Bucket into empower spell group
        const group = EMPOWER_SPELL_GROUPS[id];
        if (group) {
          if (level === 0) {
            specifics.empower.cancelledEmpowers += 1;
          } else if (level >= 1 && level <= 4) {
            switch (group) {
              case 'dreamBreath':
                specifics.empower.dreamBreath.casts += 1;
                specifics.empower.dreamBreath.castsByLevel[level] += 1;
                break;
              case 'spiritbloom':
                specifics.empower.spiritbloom.casts += 1;
                specifics.empower.spiritbloom.castsByLevel[level] += 1;
                break;
              case 'fireBreath':
                specifics.empower.fireBreath.casts += 1;
                specifics.empower.fireBreath.castsByLevel[level] += 1;
                break;
            }
          }
        }
        break;
      }

      // ── Heal ──────────────────────────────────────────────────────
      case EventType.Heal: {
        const h = ev as HealEvent;
        // Heals can come from the player or from buffs applied by the player.
        // For v1, filter sourceID === playerId (this covers most heals).
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

        // Check if this is an echo replay
        const isEchoReplay = ECHO_REPLAY_IDS.has(id);
        if (isEchoReplay) {
          specifics.echo.replayHeals += 1;
          specifics.echo.replayHealing += amount;
        }

        // Spell-specific heal handling
        switch (id) {
          // Dream Breath heals (HoT ticks + initial)
          case PRES_SPELLS.DREAM_BREATH:
          case PRES_SPELLS.DREAM_BREATH_FONT:
            specifics.empower.dreamBreath.totalHealing += amount;
            if (h.tick) {
              specifics.empower.dreamBreath.hotTicks += 1;
            }
            break;

          // Dream Breath echo
          case PRES_SPELLS.DREAM_BREATH_ECHO:
            specifics.empower.dreamBreath.totalHealing += amount;
            break;

          // Spiritbloom heals
          case PRES_SPELLS.SPIRITBLOOM_CAST:
          case PRES_SPELLS.SPIRITBLOOM_FONT:
          case PRES_SPELLS.SPIRITBLOOM_SPLIT:
          case PRES_SPELLS.SPIRITBLOOM_HOT:
            specifics.empower.spiritbloom.totalHealing += amount;
            break;

          // Reversion HoT ticks
          case PRES_SPELLS.REVERSION_CAST:
            if (h.tick) {
              specifics.reversion.hotTicks += 1;
              specifics.reversion.hotHealing += amount;
              specifics.reversion.hotOverhealing += overheal;
            }
            break;

          // Reversion echo replay
          case PRES_SPELLS.REVERSION_ECHO:
            specifics.reversion.echoReplayTicks += 1;
            specifics.reversion.echoReplayHealing += amount;
            break;

          // Living Flame
          case PRES_SPELLS.LIVING_FLAME_HEAL:
            specifics.livingFlame.heals += 1;
            specifics.livingFlame.totalHealing += amount;
            specifics.livingFlame.totalOverhealing += overheal;
            break;

          // Emerald Blossom
          case PRES_SPELLS.EMERALD_BLOSSOM:
            specifics.emeraldBlossom.hits += 1;
            specifics.emeraldBlossom.totalHealing += amount;
            specifics.emeraldBlossom.totalOverhealing += overheal;
            break;

          // Emerald Blossom echo
          case PRES_SPELLS.EMERALD_BLOSSOM_ECHO:
            specifics.emeraldBlossom.echoHits += 1;
            specifics.emeraldBlossom.echoHealing += amount;
            break;

          // Verdant Embrace heal
          case PRES_SPELLS.VERDANT_EMBRACE_HEAL:
            // handled in perSpell only
            break;

          // Renewing Blaze heal
          case PRES_SPELLS.RENEWING_BLAZE_HEAL:
            // handled in perSpell only
            break;

          // Dream Flight heal
          case PRES_SPELLS.DREAM_FLIGHT_HEAL:
            // handled in perSpell only
            break;

          // Emerald Communion
          case PRES_SPELLS.EMERALD_COMMUNION_ALLY:
            // handled in perSpell only
            break;

          // Golden Hour proc
          case PRES_SPELLS.GOLDEN_HOUR_HEAL:
            specifics.procs.goldenHourHits += 1;
            specifics.procs.goldenHourHealing += amount;
            break;

          // Lifebind proc
          case PRES_SPELLS.LIFEBIND_HEAL:
            specifics.procs.lifebindHits += 1;
            specifics.procs.lifebindHealing += amount;
            break;

          // Temporal Anomaly shield
          case PRES_SPELLS.TEMPORAL_ANOMALY_SHIELD:
            specifics.procs.temporalAnomalyShields += 1;
            break;

          // Chronowarden hero talent — Chrono Flame
          case PRES_SPELLS.CHRONO_FLAME_HEAL_1:
          case PRES_SPELLS.CHRONO_FLAME_HEAL_2:
            specifics.heroTalent.chronowarden.chronoFlameHealing += amount;
            break;

          // Flameshaper hero talent — Engulf
          case PRES_SPELLS.ENGULF_HEAL:
            specifics.heroTalent.flameshaper.engulfHits += 1;
            specifics.heroTalent.flameshaper.engulfHealing += amount;
            break;
        }
        break;
      }

      // ── Damage (for Fire Breath DoT) ──────────────────────────────
      case EventType.Damage: {
        const d = ev as DamageEvent;
        if (d.sourceID !== playerId) {
          break;
        }
        const id = d.ability.guid;
        // Only track damage for spells we care about
        if (id === PRES_SPELLS.FIRE_BREATH_DOT || id === PRES_SPELLS.LIVING_FLAME_DAMAGE) {
          const entry = ensure(id, d.ability.name);
          const amount = d.amount;
          entry.healing += amount; // reuse healing field for damage tracking in perSpell
          if (id === PRES_SPELLS.FIRE_BREATH_DOT) {
            specifics.empower.fireBreath.totalDamage += amount;
          } else if (id === PRES_SPELLS.LIVING_FLAME_DAMAGE) {
            specifics.livingFlame.totalDamage += amount;
          }
        }
        break;
      }

      // ── ApplyBuff ─────────────────────────────────────────────────
      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) {
          break;
        }
        switch (b.ability.guid) {
          case PRES_SPELLS.ECHO_BUFF:
            specifics.echo.buffApplies += 1;
            break;
          case PRES_SPELLS.REVERSION_CAST:
            specifics.reversion.hotApplies += 1;
            break;
          case PRES_SPELLS.ESSENCE_BURST_BUFF:
            specifics.essence.essenceBurstProcs += 1;
            break;
        }
        break;
      }

      // ── RefreshBuff ───────────────────────────────────────────────
      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) {
          break;
        }
        if (r.ability.guid === PRES_SPELLS.REVERSION_CAST) {
          specifics.reversion.hotRefreshes += 1;
        }
        break;
      }

      // ── RemoveBuff ────────────────────────────────────────────────
      case EventType.RemoveBuff: {
        // Track nothing on removal for v1 — handled by ChangeBuffStack for Essence Burst
        break;
      }

      // ── ChangeBuffStack ───────────────────────────────────────────
      case EventType.ChangeBuffStack: {
        const cs = ev as ChangeBuffStackEvent;
        if (cs.sourceID !== playerId) {
          break;
        }
        if (cs.ability.guid === PRES_SPELLS.ESSENCE_BURST_BUFF && cs.stacksGained < 0) {
          specifics.essence.essenceBurstConsumed += 1;
        }
        break;
      }

      default:
        break;
    }
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

function detectBuild(
  specifics: PreservationReport['specifics'],
): PreservationReport['detectedBuild'] {
  const chronoHealing = specifics.heroTalent.chronowarden.chronoFlameHealing;
  const engulfHits = specifics.heroTalent.flameshaper.engulfHits;
  if (engulfHits > 0 && chronoHealing === 0) {
    return 'flameshaper';
  }
  if (chronoHealing > 0 && engulfHits === 0) {
    return 'chronowarden';
  }
  if (chronoHealing > 0 && engulfHits > 0) {
    return chronoHealing > specifics.heroTalent.flameshaper.engulfHealing
      ? 'chronowarden'
      : 'flameshaper';
  }
  return 'unknown';
}
