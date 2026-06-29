// Path-A Discipline Priest extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / manaSpent / hits / crits / ticks)
//   - discipline-specific metrics (Atonement healing by source, Penance bolt breakdown,
//     cooldown usage, shield tracking, Voidweaver/Oracle hero talent detection)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  AbsorbedEvent,
  CastEvent,
  HealEvent,
  DamageEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
  RefreshBuffEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';

// --- Discipline Priest spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
// Verified against known spell IDs. Sources: src/common/SPELLS/priest.ts,
// src/common/TALENTS/priest.ts, raw event probing.
export const DISC_SPELLS = {
  // Atonement core
  ATONEMENT_BUFF: 194384,
  ATONEMENT_HEAL_NON_CRIT: 81751,
  ATONEMENT_HEAL_CRIT: 94472,
  GRACE_MASTERY: 271534,

  // Atonement applicators
  POWER_WORD_SHIELD: 17,
  PLEA: 200829,
  FLASH_HEAL: 2061,
  PENANCE_CAST: 47540,
  POWER_WORD_RADIANCE: 194509,

  // Atonement damage sources
  SMITE: 585,
  PENANCE_BOLT_DAMAGE: 47666,
  PENANCE_TWINSIGHT_BOLT_DAMAGE: 1232571,
  SHADOW_WORD_PAIN: 589,
  HOLY_NOVA: 132157,
  MIND_BLAST: 8092,
  SHADOW_WORD_DEATH: 32379,
  SHADOWFIEND: 34433,
  MIND_SEAR: 48045,
  EXPIATION_DAMAGE: 390844,
  INESCAPABLE_TORMENT: 373442,
  ULTIMATE_PENITENCE_DAMAGE: 421543,
  ENTROPIC_RIFT_DAMAGE: 447448,
  COLLAPSING_VOID_DAMAGE: 448405,
  VOID_BLAST_DAMAGE: 450215,
  VOID_FLAY_DAMAGE: 451435,

  // Direct heals
  PENANCE_BOLT_HEAL: 47750,
  PENANCE_TWINSIGHT_BOLT_HEAL: 1232567,
  SHADOW_MEND: 1252215,
  RENEW_HEAL: 139,

  // Cooldowns
  EVANGELISM: 472433,
  POWER_WORD_BARRIER_CAST: 62618,
  PAIN_SUPPRESSION: 33206,
  ULTIMATE_PENITENCE: 421453,
  MINDBENDER_DISC: 1280137,
  POWER_INFUSION: 10060,
  VAMPIRIC_EMBRACE: 15286,

  // Hero talent detection
  ENTROPIC_RIFT_TALENT: 447444,
  TWINSIGHT_TALENT: 440742,
} as const;

const DISC_SPELLS_TO_HUMAN: Record<number, string> = {
  [DISC_SPELLS.ATONEMENT_BUFF]: '救赎',
  [DISC_SPELLS.ATONEMENT_HEAL_NON_CRIT]: '救赎',
  [DISC_SPELLS.ATONEMENT_HEAL_CRIT]: '救赎(暴击)',
  [DISC_SPELLS.GRACE_MASTERY]: '精通：宽恕',
  [DISC_SPELLS.POWER_WORD_SHIELD]: '真言术：盾',
  [DISC_SPELLS.PLEA]: '请求',
  [DISC_SPELLS.FLASH_HEAL]: '快速治疗',
  [DISC_SPELLS.PENANCE_CAST]: '苦修',
  [DISC_SPELLS.POWER_WORD_RADIANCE]: '真言术：光辉',
  [DISC_SPELLS.SMITE]: '真言术：惩',
  [DISC_SPELLS.PENANCE_BOLT_DAMAGE]: '苦修(伤害)',
  [DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_DAMAGE]: '苦修(双重视界·伤害)',
  [DISC_SPELLS.SHADOW_WORD_PAIN]: '暗言术：痛',
  [DISC_SPELLS.HOLY_NOVA]: '神圣新星',
  [DISC_SPELLS.MIND_BLAST]: '心灵震爆',
  [DISC_SPELLS.SHADOW_WORD_DEATH]: '暗言术：灭',
  [DISC_SPELLS.SHADOWFIEND]: '暗影魔(攻击)',
  [DISC_SPELLS.MIND_SEAR]: '心灵灼烧',
  [DISC_SPELLS.EXPIATION_DAMAGE]: '赎罪',
  [DISC_SPELLS.INESCAPABLE_TORMENT]: '难逃之痛',
  [DISC_SPELLS.ULTIMATE_PENITENCE_DAMAGE]: '终极忏悔(伤害)',
  [DISC_SPELLS.ENTROPIC_RIFT_DAMAGE]: '熵能裂隙',
  [DISC_SPELLS.COLLAPSING_VOID_DAMAGE]: '坍缩虚空',
  [DISC_SPELLS.VOID_BLAST_DAMAGE]: '虚空爆发',
  [DISC_SPELLS.VOID_FLAY_DAMAGE]: '虚空剥蚀',
  [DISC_SPELLS.PENANCE_BOLT_HEAL]: '苦修(治疗)',
  [DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_HEAL]: '苦修(双重视界·治疗)',
  [DISC_SPELLS.SHADOW_MEND]: '暗影修补',
  [DISC_SPELLS.RENEW_HEAL]: '恢复',
  [DISC_SPELLS.EVANGELISM]: '福音',
  [DISC_SPELLS.POWER_WORD_BARRIER_CAST]: '真言术：盾障',
  [DISC_SPELLS.PAIN_SUPPRESSION]: '痛苦压制',
  [DISC_SPELLS.ULTIMATE_PENITENCE]: '终极忏悔',
  [DISC_SPELLS.MINDBENDER_DISC]: '神志屈服',
  [DISC_SPELLS.POWER_INFUSION]: '能量灌注',
  [DISC_SPELLS.VAMPIRIC_EMBRACE]: '吸血鬼之拥',
  [DISC_SPELLS.ENTROPIC_RIFT_TALENT]: '熵能裂隙(天赋)',
  [DISC_SPELLS.TWINSIGHT_TALENT]: '双重视界(天赋)',
};

// Atonement damage source spell IDs — these are the damage spells that
// trigger atonement healing.
const ATONEMENT_DAMAGE_IDS = new Set<number>([
  DISC_SPELLS.SMITE,
  DISC_SPELLS.PENANCE_BOLT_DAMAGE,
  DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_DAMAGE,
  DISC_SPELLS.SHADOW_WORD_PAIN,
  DISC_SPELLS.HOLY_NOVA,
  DISC_SPELLS.MIND_BLAST,
  DISC_SPELLS.SHADOW_WORD_DEATH,
  DISC_SPELLS.SHADOWFIEND,
  DISC_SPELLS.MIND_SEAR,
  DISC_SPELLS.EXPIATION_DAMAGE,
  DISC_SPELLS.INESCAPABLE_TORMENT,
  DISC_SPELLS.ULTIMATE_PENITENCE_DAMAGE,
  DISC_SPELLS.ENTROPIC_RIFT_DAMAGE,
  DISC_SPELLS.COLLAPSING_VOID_DAMAGE,
  DISC_SPELLS.VOID_BLAST_DAMAGE,
  DISC_SPELLS.VOID_FLAY_DAMAGE,
]);

// Atonement heal IDs
const ATONEMENT_HEAL_IDS = new Set<number>([
  DISC_SPELLS.ATONEMENT_HEAL_NON_CRIT,
  DISC_SPELLS.ATONEMENT_HEAL_CRIT,
]);

// Pet summon spell IDs (Shadowfiend / Mindbender)
const PET_SUMMON_IDS = new Set<number>([DISC_SPELLS.SHADOWFIEND, DISC_SPELLS.MINDBENDER_DISC]);

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

export interface DisciplineReport {
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
    atonement: {
      totalAtonementHealing: number;
      totalAtonementOverhealing: number;
      bySource: Array<{ spellId: number; spellNameCN: string; healing: number; hits: number }>;
      applicators: {
        powerWordShield: number;
        plea: number;
        flashHeal: number;
        penance: number;
        powerWordRadiance: number;
      };
      averageAtonements: number;
      peakAtonements: number;
    };
    penance: {
      casts: number;
      offensiveBolts: number;
      defensiveBolts: number;
      totalDamage: number;
      totalHealing: number;
    };
    cooldowns: {
      evangelismCasts: number;
      powerWordBarrierCasts: number;
      painSuppressionCasts: number;
      ultimatePenitenceCasts: number;
      shadowfiendCasts: number;
      mindbenderCasts: number;
      powerInfusionCasts: number;
    };
    shields: {
      powerWordShieldCasts: number;
      shieldAbsorbed: number;
    };
    voidweaver?: {
      voidBlastDamage: number;
      voidFlayDamage: number;
      entropicRiftDamage: number;
      collapsingVoidDamage: number;
    };
  };
  detectedBuild: 'voidweaver' | 'oracle' | 'mixed' | 'unknown';
  warnings: string[];
}

const MANA_RESOURCE_TYPE = 0;
const HIT_TYPE_CRIT = 2;

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

export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

interface RecentDamage {
  timestamp: number;
  spellId: number;
  amount: number;
}

interface TimelineEntry {
  ts: number;
  count: number;
}

export function extractDisciplineReport(input: ExtractInput): DisciplineReport {
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
        spellNameCN: DISC_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // ── Discipline-specific accumulators ──────────────────────────────

  // Atonement: rolling buffer of recent player damage events for heal attribution
  const recentDamageEvents: RecentDamage[] = [];
  const MAX_DAMAGE_AGE_MS = 1000;
  const ATONEMENT_ATTRIBUTION_WINDOW_MS = 500;

  // Atonement buff target tracking
  const currentAtonementTargets = new Set<number>();
  const atonementTimeline: TimelineEntry[] = [];
  let atonementLastCount = 0;

  // Initialize timeline at fight start
  atonementTimeline.push({ ts: fightStart, count: 0 });

  // Atonement source attribution map: spellId → { healing, hits }
  const atonementBySource = new Map<number, { healing: number; hits: number }>();

  // Pet active tracking (Shadowfiend / Mindbender)
  const PET_DURATION_MS = 20000;
  let petActiveUntil = 0;

  // Penance tracking
  let penanceCasts = 0;
  let offensiveBolts = 0;
  let defensiveBolts = 0;
  let penanceTotalDamage = 0;
  let penanceTotalHealing = 0;

  // Applicator cast counters
  let pwsCasts = 0;
  let pleaCasts = 0;
  let flashHealCasts = 0;
  let pwrCasts = 0;

  // Cooldown cast counters
  let evangelismCasts = 0;
  let pwBarrierCasts = 0;
  let painSuppressionCasts = 0;
  let ultimatePenitenceCasts = 0;
  let shadowfiendCasts = 0;
  let mindbenderCasts = 0;
  let powerInfusionCasts = 0;

  // Shield tracking
  let shieldAbsorbed = 0;

  // Voidweaver tracking
  let voidBlastDamage = 0;
  let voidFlayDamage = 0;
  let entropicRiftDamage = 0;
  let collapsingVoidDamage = 0;
  let hasVoidweaverEvent = false;

  // Hero talent detection
  let hasOracleEvent = false;

  let totalCasts = 0;
  let totalHealing = 0;
  let totalOverhealing = 0;
  let totalManaSpent = 0;
  let totalAtonementHealing = 0;
  let totalAtonementOverhealing = 0;

  for (const ev of events) {
    switch (ev.type) {
      // ── Cast ──────────────────────────────────────────────────────
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
        if (id === DISC_SPELLS.PENANCE_CAST) {
          penanceCasts += 1;
        } else if (id === DISC_SPELLS.EVANGELISM) {
          evangelismCasts += 1;
        } else if (id === DISC_SPELLS.POWER_WORD_BARRIER_CAST) {
          pwBarrierCasts += 1;
        } else if (id === DISC_SPELLS.PAIN_SUPPRESSION) {
          painSuppressionCasts += 1;
        } else if (id === DISC_SPELLS.ULTIMATE_PENITENCE) {
          ultimatePenitenceCasts += 1;
        } else if (id === DISC_SPELLS.POWER_INFUSION) {
          powerInfusionCasts += 1;
        } else if (id === DISC_SPELLS.VAMPIRIC_EMBRACE) {
          // tracked but not surfaced as a standalone metric
        }

        // Applicator counters
        if (id === DISC_SPELLS.POWER_WORD_SHIELD) {
          pwsCasts += 1;
        } else if (id === DISC_SPELLS.PLEA) {
          pleaCasts += 1;
        } else if (id === DISC_SPELLS.FLASH_HEAL) {
          flashHealCasts += 1;
        } else if (id === DISC_SPELLS.POWER_WORD_RADIANCE) {
          pwrCasts += 1;
        }

        // Pet summon tracking
        if (PET_SUMMON_IDS.has(id)) {
          petActiveUntil = c.timestamp + PET_DURATION_MS;
          if (id === DISC_SPELLS.SHADOWFIEND) {
            shadowfiendCasts += 1;
          } else if (id === DISC_SPELLS.MINDBENDER_DISC) {
            mindbenderCasts += 1;
          }
        }

        // Hero talent detection via cast
        if (id === DISC_SPELLS.ENTROPIC_RIFT_TALENT) {
          hasVoidweaverEvent = true;
        } else if (id === DISC_SPELLS.TWINSIGHT_TALENT) {
          hasOracleEvent = true;
        }
        break;
      }

      // ── Heal ───────────────────────────────────────────────────────
      case EventType.Heal: {
        const h = ev as HealEvent;
        if (h.sourceID !== playerId) break;

        const id = h.ability.guid;
        const amount = h.amount;
        const overheal = h.overheal ?? 0;

        // Atonement heal attribution: find the latest damage event within 500ms.
        // NOTE: This is a "last recent" heuristic — when one damage event heals
        // multiple atonement targets simultaneously, all are attributed to the
        // most recent damage source, not the actual per-target source.
        if (ATONEMENT_HEAL_IDS.has(id)) {
          totalAtonementHealing += amount;
          totalAtonementOverhealing += overheal;

          // Walk backward through recent damage events
          for (let i = recentDamageEvents.length - 1; i >= 0; i--) {
            const dmg = recentDamageEvents[i];
            if (h.timestamp - dmg.timestamp <= ATONEMENT_ATTRIBUTION_WINDOW_MS) {
              // Attribute this atonement heal to the damage source
              const src = atonementBySource.get(dmg.spellId);
              if (src) {
                src.healing += amount;
                src.hits += 1;
              } else {
                atonementBySource.set(dmg.spellId, { healing: amount, hits: 1 });
              }
              break;
            }
          }

          // Also track atonement heals in perSpell
          const entry = ensure(id, h.ability.name);
          entry.healing += amount;
          entry.overhealing += overheal;
          entry.hits += 1;
          if (h.hitType === HIT_TYPE_CRIT) entry.crits += 1;
          entry._targets.add(h.targetID);
          totalHealing += amount;
          totalOverhealing += overheal;
          break;
        }

        // Regular heal tracking
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

        // Penance healing bolts
        if (id === DISC_SPELLS.PENANCE_BOLT_HEAL) {
          defensiveBolts += 1;
          penanceTotalHealing += amount;
        } else if (id === DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_HEAL) {
          defensiveBolts += 1;
          penanceTotalHealing += amount;
        }
        break;
      }

      // ── Damage ─────────────────────────────────────────────────────
      case EventType.Damage: {
        const d = ev as DamageEvent;
        const id = d.ability.guid;
        if (!ATONEMENT_DAMAGE_IDS.has(id)) break;

        const isPlayerDamage = d.sourceID === playerId;
        const isPetDamage = id === DISC_SPELLS.SHADOWFIEND && d.timestamp <= petActiveUntil;

        if (!isPlayerDamage && !isPetDamage) break;

        // Prune stale damage events from buffer
        while (
          recentDamageEvents.length > 0 &&
          d.timestamp - recentDamageEvents[0].timestamp > MAX_DAMAGE_AGE_MS
        ) {
          recentDamageEvents.shift();
        }

        recentDamageEvents.push({
          timestamp: d.timestamp,
          spellId: id,
          amount: d.amount,
        });

        // Penance offensive bolts
        if (id === DISC_SPELLS.PENANCE_BOLT_DAMAGE) {
          offensiveBolts += 1;
          penanceTotalDamage += d.amount;
        } else if (id === DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_DAMAGE) {
          offensiveBolts += 1;
          penanceTotalDamage += d.amount;
        }

        // Voidweaver damage tracking
        if (id === DISC_SPELLS.VOID_BLAST_DAMAGE) {
          voidBlastDamage += d.amount;
          hasVoidweaverEvent = true;
        } else if (id === DISC_SPELLS.VOID_FLAY_DAMAGE) {
          voidFlayDamage += d.amount;
          hasVoidweaverEvent = true;
        } else if (id === DISC_SPELLS.ENTROPIC_RIFT_DAMAGE) {
          entropicRiftDamage += d.amount;
          hasVoidweaverEvent = true;
        } else if (id === DISC_SPELLS.COLLAPSING_VOID_DAMAGE) {
          collapsingVoidDamage += d.amount;
          hasVoidweaverEvent = true;
        }

        // Oracle detection via Twinsight damage
        if (id === DISC_SPELLS.PENANCE_TWINSIGHT_BOLT_DAMAGE) {
          hasOracleEvent = true;
        }
        break;
      }

      // ── ApplyBuff ──────────────────────────────────────────────────
      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) break;

        const id = b.ability.guid;

        if (id === DISC_SPELLS.ATONEMENT_BUFF) {
          currentAtonementTargets.add(b.targetID);
          atonementLastCount = currentAtonementTargets.size;
          atonementTimeline.push({ ts: b.timestamp, count: atonementLastCount });
        }
        break;
      }

      // ── RefreshBuff ────────────────────────────────────────────────
      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) break;

        if (r.ability.guid === DISC_SPELLS.ATONEMENT_BUFF) {
          // Refresh doesn't change the count but we note it
        }
        break;
      }

      // ── RemoveBuff ─────────────────────────────────────────────────
      case EventType.RemoveBuff: {
        const rb = ev as RemoveBuffEvent;
        if (rb.sourceID !== playerId) break;

        if (rb.ability.guid === DISC_SPELLS.ATONEMENT_BUFF) {
          currentAtonementTargets.delete(rb.targetID);
          atonementLastCount = currentAtonementTargets.size;
          atonementTimeline.push({ ts: rb.timestamp, count: atonementLastCount });
        }
        break;
      }

      // ── Absorbed ───────────────────────────────────────────────────
      case EventType.Absorbed: {
        const a = ev as AbsorbedEvent;
        if (a.sourceID !== playerId) break;

        if (a.ability.guid === DISC_SPELLS.POWER_WORD_SHIELD) {
          shieldAbsorbed += a.amount;
        }
        break;
      }

      default:
        break;
    }
  }

  // ── Post-loop calculations ────────────────────────────────────────

  // Finalize atonement timeline
  atonementTimeline.push({ ts: fightEnd, count: atonementLastCount });

  let totalAtonementMs = 0;
  let peakAtonements = 0;
  for (let i = 0; i < atonementTimeline.length - 1; i++) {
    const duration = atonementTimeline[i + 1].ts - atonementTimeline[i].ts;
    totalAtonementMs += atonementTimeline[i].count * duration;
    if (atonementTimeline[i].count > peakAtonements) {
      peakAtonements = atonementTimeline[i].count;
    }
  }
  const averageAtonements = fightDurationMs > 0 ? totalAtonementMs / fightDurationMs : 0;

  // Build bySource array sorted descending by healing
  const bySource = Array.from(atonementBySource.entries())
    .map(([spellId, data]) => ({
      spellId,
      spellNameCN: DISC_SPELLS_TO_HUMAN[spellId] ?? `spell-${spellId}`,
      healing: data.healing,
      hits: data.hits,
    }))
    .sort((a, b) => b.healing - a.healing);

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

  const specifics: DisciplineReport['specifics'] = {
    atonement: {
      totalAtonementHealing,
      totalAtonementOverhealing,
      bySource,
      applicators: {
        powerWordShield: pwsCasts,
        plea: pleaCasts,
        flashHeal: flashHealCasts,
        penance: penanceCasts,
        powerWordRadiance: pwrCasts,
      },
      averageAtonements,
      peakAtonements,
    },
    penance: {
      casts: penanceCasts,
      offensiveBolts,
      defensiveBolts,
      totalDamage: penanceTotalDamage,
      totalHealing: penanceTotalHealing,
    },
    cooldowns: {
      evangelismCasts,
      powerWordBarrierCasts: pwBarrierCasts,
      painSuppressionCasts,
      ultimatePenitenceCasts,
      shadowfiendCasts,
      mindbenderCasts,
      powerInfusionCasts,
    },
    shields: {
      powerWordShieldCasts: pwsCasts,
      shieldAbsorbed,
    },
  };

  // Voidweaver specifics (only if detected)
  const detectedBuild = detectBuild(hasVoidweaverEvent, hasOracleEvent);
  if (detectedBuild === 'voidweaver' || detectedBuild === 'mixed') {
    specifics.voidweaver = {
      voidBlastDamage,
      voidFlayDamage,
      entropicRiftDamage,
      collapsingVoidDamage,
    };
  }

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

function detectBuild(
  hasVoidweaver: boolean,
  hasOracle: boolean,
): DisciplineReport['detectedBuild'] {
  if (hasVoidweaver && hasOracle) return 'mixed';
  if (hasVoidweaver) return 'voidweaver';
  if (hasOracle) return 'oracle';
  return 'unknown';
}
