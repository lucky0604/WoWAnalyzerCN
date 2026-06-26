// Path-A mistweaver extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / manaSpent / hits / crits / ticks)
//   - mistweaver-specific metrics (REM applies, EvM applies, Vivify cleave, RSK casts,
//     Soothing Mist channel windows, Revival/Restoral burst healing, Mana Tea spent)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  CastEvent,
  HealEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
  RefreshBuffEvent,
  ResourceChangeEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';

// --- Mistweaver spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
// Calibrated against real CN WCL event stream (报告 9hTqzGHt46W73jYB, 2026-06-25).
// Sources: src/common/SPELLS/monk.ts, src/common/TALENTS/monk.ts, raw event probing.
export const MW_SPELLS = {
  // Core casts (heals)
  RENEWING_MIST_CAST: 115151, // 复苏之雾 cast
  RENEWING_MIST_HEAL: 119611, // 复苏之雾 HoT tick
  ENVELOPING_MIST: 124682, // 包裹之雾 (氤氲之雾)
  ENVELOPING_MIST_TFT: 231633, // (legacy buff variant — may not appear in 12.x)
  VIVIFY: 116670, // 焕活 cast — note: 12.x meta-builds (Ancient Teachings/Crane Style) often have zero Vivify casts
  VIVIFY_DIRECT_HEAL: 116670,
  VIVIFY_CLEAVE_HEAL: 116995,
  SOOTHING_MIST: 115175, // 安神之雾 (抚慰之雾)
  SOOTHING_BREATH: 343737, // Yu'lon soothing mist tick
  SHEILUNS_GIFT: 399491, // 舍龙之赐 (神龙之赐)
  REVIVAL: 115310, // 复苏 (还魂术)
  RESTORAL: 388615, // 复元
  LIFE_COCOON: 116849, // 生命之茧 (作茧缚命)
  ESSENCE_FONT: 191837, // (legacy / data-stage) - kept for completeness
  EXPEL_HARM: 322101, // 驱散邪能 (清创生血)
  EXPEL_HARM_TARGET_HEAL: 366960,
  RUSHING_WIND_KICK_HEAL: 1269159,
  RISING_SUN_KICK: 107428, // 飞身踢 (旭日东升踢)
  TIGER_PALM: 100780, // 猛虎掌 — drives Crane Style/Ancient Teachings procs

  // Cooldowns / buffs
  THUNDER_FOCUS_TEA: 116680, // 雷霆专注茶 (雷光聚神茶)
  MANA_TEA_CAST: 115294, // 法力茶 — TWW 12.x ID (legacy 197908 is the buff stack only)
  MANA_TEA_STACK_BUFF: 197908, // talent buff stack — different from cast ability
  INVOKE_CHI_JI: 325197, // 召唤朱红仙鹤·赤霓 (朱鹤下凡)
  INVOKE_YULON: 322118, // 召唤翡翠玉龙
  JADEFIRE_STOMP: 457974, // 玉火践踏
  JADEFIRE_STOMP_HEAL: 388207,
  ZEN_PULSE: 116844, // 平心之环 (talent)

  // TWW 12.x meta-build cornerstones (Ancient Teachings + Crane Style)
  CRANE_STYLE_HEAL: 389325, // 仙鹤之道 (主治疗 proc)
  CRANE_STYLE_CRIT_HEAL: 389328, // 仙鹤之道 (暴击衍生)
  ANCIENT_TEACHINGS_HEAL: 388024, // 谆谆古训 (Tiger Palm/Blackout Kick 治疗转化)
  ANCIENT_TEACHINGS_CRIT_HEAL: 388025, // 谆谆古训 (暴击衍生)
  MISTS_OF_LIFE: 191894, // 迷雾之风 (Mists of Life passive heal)
  MISTS_OF_LIFE_ALT: 343819, // 迷雾之风 (变体)
  CELESTIAL_CONDUIT: 443028, // 天神御身 (Celestial Conduit channel)
  UNITY_WITHIN: 443591, // 众神聚心 (Unity Within)

  // Talent passives we observe via heal events / buffs
  VIVIFICATION_BUFF: 392883,
  MISTY_PEAKS: 388682,
  RISING_MIST: 274909,
  RAPID_DIFFUSION: 388847,
  DANCING_MISTS: 388701,
} as const;

const MW_SPELLS_TO_HUMAN: Record<number, string> = {
  [MW_SPELLS.RENEWING_MIST_CAST]: '复苏之雾',
  [MW_SPELLS.RENEWING_MIST_HEAL]: '复苏之雾(治疗)',
  [MW_SPELLS.ENVELOPING_MIST]: '包裹之雾',
  [MW_SPELLS.ENVELOPING_MIST_TFT]: '包裹之雾(雷霆茶)',
  [MW_SPELLS.VIVIFY]: '焕活',
  [MW_SPELLS.VIVIFY_CLEAVE_HEAL]: '焕活(溅射)',
  [MW_SPELLS.SOOTHING_MIST]: '安神之雾',
  [MW_SPELLS.SOOTHING_BREATH]: '安神之息(玉龙)',
  [MW_SPELLS.SHEILUNS_GIFT]: '舍龙之赐',
  [MW_SPELLS.REVIVAL]: '复苏',
  [MW_SPELLS.RESTORAL]: '复元',
  [MW_SPELLS.LIFE_COCOON]: '生命之茧',
  [MW_SPELLS.EXPEL_HARM]: '驱散邪能',
  [MW_SPELLS.EXPEL_HARM_TARGET_HEAL]: '驱散邪能(治疗)',
  [MW_SPELLS.RUSHING_WIND_KICK_HEAL]: '疾风踢(治疗)',
  [MW_SPELLS.RISING_SUN_KICK]: '飞身踢',
  [MW_SPELLS.TIGER_PALM]: '猛虎掌',
  [MW_SPELLS.THUNDER_FOCUS_TEA]: '雷霆专注茶',
  [MW_SPELLS.MANA_TEA_CAST]: '法力茶',
  [MW_SPELLS.INVOKE_CHI_JI]: '召唤朱红仙鹤·赤霓',
  [MW_SPELLS.INVOKE_YULON]: '召唤翡翠玉龙·玉珑',
  [MW_SPELLS.JADEFIRE_STOMP]: '玉火践踏',
  [MW_SPELLS.JADEFIRE_STOMP_HEAL]: '玉火践踏(治疗)',
  [MW_SPELLS.ZEN_PULSE]: '平心之环',
  [MW_SPELLS.CRANE_STYLE_HEAL]: '仙鹤之道',
  [MW_SPELLS.CRANE_STYLE_CRIT_HEAL]: '仙鹤之道(暴击)',
  [MW_SPELLS.ANCIENT_TEACHINGS_HEAL]: '谆谆古训',
  [MW_SPELLS.ANCIENT_TEACHINGS_CRIT_HEAL]: '谆谆古训(暴击)',
  [MW_SPELLS.MISTS_OF_LIFE]: '迷雾之风',
  [MW_SPELLS.MISTS_OF_LIFE_ALT]: '迷雾之风(变体)',
  [MW_SPELLS.CELESTIAL_CONDUIT]: '天神御身',
  [MW_SPELLS.UNITY_WITHIN]: '众神聚心',
  [MW_SPELLS.VIVIFICATION_BUFF]: '焕活强化',
  [MW_SPELLS.MISTY_PEAKS]: '雾岭',
  [MW_SPELLS.RISING_MIST]: '飞身之雾',
  [MW_SPELLS.RAPID_DIFFUSION]: '迅速扩散',
  [MW_SPELLS.DANCING_MISTS]: '舞动之雾',
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

export interface MistweaverReport {
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
    renewingMist: {
      casts: number;
      hotApplies: number;
      hotRefreshes: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
    };
    envelopingMist: {
      casts: number;
      hardCasts: number;
      tftCasts: number;
      buffApplies: number;
      buffRefreshes: number;
      directHealing: number;
      directOverhealing: number;
    };
    vivify: {
      casts: number;
      directHits: number;
      cleaveHits: number;
      totalHealing: number;
      totalOverhealing: number;
      averageTargetsPerCast: number;
    };
    soothingMist: {
      channelStarts: number;
      ticks: number;
      healing: number;
      overhealing: number;
    };
    revivalRestoral: {
      casts: number;
      totalHealing: number;
      totalOverhealing: number;
      uniqueTargetsHealed: number;
    };
    manaTea: {
      casts: number;
      manaSavedEstimate: number;
    };
    cooldowns: {
      thunderFocusTeaCasts: number;
      lifeCocoonCasts: number;
      sheilunsGiftCasts: number;
      invokeChiJiCasts: number;
      invokeYulonCasts: number;
    };
    risingSunKick: {
      casts: number;
    };
    tigerPalm: {
      casts: number;
    };
    /** TWW 12.x meta-build (Ancient Teachings + Crane Style) — Tiger Palm / RSK
     *  proc passive healing. When these dominate and vivify.casts === 0, the
     *  player is running an AoE-cleave build that intentionally skips Vivify. */
    metaBuild: {
      craneStyleHits: number;
      craneStyleHealing: number;
      craneStyleOverhealing: number;
      ancientTeachingsHits: number;
      ancientTeachingsHealing: number;
      ancientTeachingsOverhealing: number;
      celestialConduitHits: number;
      celestialConduitHealing: number;
      celestialConduitOverhealing: number;
    };
  };
  /** Auto-detected meta-build label — surfaces context for downstream LLMs.
   *  - "ancient-teachings-crane": dominant Crane Style + Ancient Teachings healing, zero Vivify casts
   *  - "vivify-spam":              dominant Vivify casts
   *  - "mixed":                    both significant
   *  - "unknown":                  insufficient data */
  detectedBuild: 'ancient-teachings-crane' | 'vivify-spam' | 'mixed' | 'unknown';
  warnings: string[];
}

const MANA_RESOURCE_TYPE = 0;
// HIT_TYPES.CRIT from src/parser/core/HIT_TYPES.ts = 2
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

export function extractMistweaverReport(input: ExtractInput): MistweaverReport {
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
        spellNameCN: MW_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // Mistweaver-specific accumulators
  const remHotActive = new Set<number>(); // targetIDs currently carrying REM HoT
  const evmActive = new Set<number>();
  const soothingMistActive = new Set<number>(); // targets in soothing mist channel

  const specifics: MistweaverReport['specifics'] = {
    renewingMist: {
      casts: 0,
      hotApplies: 0,
      hotRefreshes: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
    },
    envelopingMist: {
      casts: 0,
      hardCasts: 0,
      tftCasts: 0,
      buffApplies: 0,
      buffRefreshes: 0,
      directHealing: 0,
      directOverhealing: 0,
    },
    vivify: {
      casts: 0,
      directHits: 0,
      cleaveHits: 0,
      totalHealing: 0,
      totalOverhealing: 0,
      averageTargetsPerCast: 0,
    },
    soothingMist: { channelStarts: 0, ticks: 0, healing: 0, overhealing: 0 },
    revivalRestoral: { casts: 0, totalHealing: 0, totalOverhealing: 0, uniqueTargetsHealed: 0 },
    manaTea: { casts: 0, manaSavedEstimate: 0 },
    cooldowns: {
      thunderFocusTeaCasts: 0,
      lifeCocoonCasts: 0,
      sheilunsGiftCasts: 0,
      invokeChiJiCasts: 0,
      invokeYulonCasts: 0,
    },
    risingSunKick: { casts: 0 },
    tigerPalm: { casts: 0 },
    metaBuild: {
      craneStyleHits: 0,
      craneStyleHealing: 0,
      craneStyleOverhealing: 0,
      ancientTeachingsHits: 0,
      ancientTeachingsHealing: 0,
      ancientTeachingsOverhealing: 0,
      celestialConduitHits: 0,
      celestialConduitHealing: 0,
      celestialConduitOverhealing: 0,
    },
  };

  // Vivify cleave heuristic: WCL cleave heals share timestamp with the direct heal.
  // 250ms window covers same-tick clusters without colliding with the next cast (1.5s base).
  const vivifyCastWindow = 250;
  let lastVivifyCastAt: number | null = null;
  let lastVivifyHits = 0;
  const vivifyCastHits: number[] = [];

  // Tracking for Revival/Restoral aggregated burst window
  const revivalTargets = new Set<number>();

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

        // Mana spent on this cast.
        // WCL CN raw event shape: classResources: [{ amount, max, type, cost }] where type===0 is mana.
        // parser/core may normalize this into `resourceCost`/`rawResourceCost`, so we try all three paths.
        const manaCost = readManaCost(c);
        if (manaCost > 0) {
          entry.manaSpent += manaCost;
          totalManaSpent += manaCost;
        }

        // Spell-specific cast counters
        switch (id) {
          case MW_SPELLS.RENEWING_MIST_CAST:
            specifics.renewingMist.casts += 1;
            break;
          case MW_SPELLS.ENVELOPING_MIST:
          case MW_SPELLS.ENVELOPING_MIST_TFT:
            specifics.envelopingMist.casts += 1;
            if (id === MW_SPELLS.ENVELOPING_MIST_TFT) {
              specifics.envelopingMist.tftCasts += 1;
            } else {
              specifics.envelopingMist.hardCasts += 1;
            }
            break;
          case MW_SPELLS.VIVIFY:
            specifics.vivify.casts += 1;
            // flush previous window
            if (lastVivifyCastAt !== null) {
              vivifyCastHits.push(lastVivifyHits);
            }
            lastVivifyCastAt = c.timestamp;
            lastVivifyHits = 0;
            break;
          case MW_SPELLS.SOOTHING_MIST:
            specifics.soothingMist.channelStarts += 1;
            break;
          case MW_SPELLS.SHEILUNS_GIFT:
            specifics.cooldowns.sheilunsGiftCasts += 1;
            break;
          case MW_SPELLS.REVIVAL:
          case MW_SPELLS.RESTORAL:
            specifics.revivalRestoral.casts += 1;
            break;
          case MW_SPELLS.THUNDER_FOCUS_TEA:
            specifics.cooldowns.thunderFocusTeaCasts += 1;
            break;
          case MW_SPELLS.LIFE_COCOON:
            specifics.cooldowns.lifeCocoonCasts += 1;
            break;
          case MW_SPELLS.INVOKE_CHI_JI:
            specifics.cooldowns.invokeChiJiCasts += 1;
            break;
          case MW_SPELLS.INVOKE_YULON:
            specifics.cooldowns.invokeYulonCasts += 1;
            break;
          case MW_SPELLS.MANA_TEA_CAST:
            specifics.manaTea.casts += 1;
            break;
          case MW_SPELLS.RISING_SUN_KICK:
            specifics.risingSunKick.casts += 1;
            break;
          case MW_SPELLS.TIGER_PALM:
            specifics.tigerPalm.casts += 1;
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

        // Mistweaver-specific heal-event handling
        switch (id) {
          case MW_SPELLS.RENEWING_MIST_HEAL:
            specifics.renewingMist.hotTicks += 1;
            specifics.renewingMist.hotHealing += amount;
            specifics.renewingMist.hotOverhealing += overheal;
            break;
          case MW_SPELLS.ENVELOPING_MIST:
          case MW_SPELLS.ENVELOPING_MIST_TFT:
            specifics.envelopingMist.directHealing += amount;
            specifics.envelopingMist.directOverhealing += overheal;
            break;
          case MW_SPELLS.VIVIFY:
          case MW_SPELLS.VIVIFY_CLEAVE_HEAL: {
            // Heuristic: vivify direct hit lands on cast target; cleave hits land on REM-hot targets.
            // 12.x may emit a separate cleave-heal spell ID (116995) — count both here.
            if (id === MW_SPELLS.VIVIFY_CLEAVE_HEAL) {
              specifics.vivify.cleaveHits += 1;
            } else if (
              lastVivifyCastAt !== null &&
              h.timestamp - lastVivifyCastAt <= vivifyCastWindow
            ) {
              if (lastVivifyHits === 0) {
                specifics.vivify.directHits += 1;
              } else {
                specifics.vivify.cleaveHits += 1;
              }
              lastVivifyHits += 1;
            } else {
              specifics.vivify.directHits += 1;
            }
            specifics.vivify.totalHealing += amount;
            specifics.vivify.totalOverhealing += overheal;
            break;
          }
          case MW_SPELLS.SOOTHING_MIST:
            specifics.soothingMist.ticks += 1;
            specifics.soothingMist.healing += amount;
            specifics.soothingMist.overhealing += overheal;
            break;
          case MW_SPELLS.REVIVAL: {
            specifics.revivalRestoral.totalHealing += amount;
            specifics.revivalRestoral.totalOverhealing += overheal;
            revivalTargets.add(h.targetID);
            break;
          }
          case MW_SPELLS.RESTORAL: {
            specifics.revivalRestoral.totalHealing += amount;
            specifics.revivalRestoral.totalOverhealing += overheal;
            revivalTargets.add(h.targetID);
            break;
          }
          case MW_SPELLS.CRANE_STYLE_HEAL:
          case MW_SPELLS.CRANE_STYLE_CRIT_HEAL: {
            specifics.metaBuild.craneStyleHits += 1;
            specifics.metaBuild.craneStyleHealing += amount;
            specifics.metaBuild.craneStyleOverhealing += overheal;
            break;
          }
          case MW_SPELLS.ANCIENT_TEACHINGS_HEAL:
          case MW_SPELLS.ANCIENT_TEACHINGS_CRIT_HEAL: {
            specifics.metaBuild.ancientTeachingsHits += 1;
            specifics.metaBuild.ancientTeachingsHealing += amount;
            specifics.metaBuild.ancientTeachingsOverhealing += overheal;
            break;
          }
          case MW_SPELLS.CELESTIAL_CONDUIT: {
            specifics.metaBuild.celestialConduitHits += 1;
            specifics.metaBuild.celestialConduitHealing += amount;
            specifics.metaBuild.celestialConduitOverhealing += overheal;
            break;
          }
        }
        break;
      }

      case EventType.ApplyBuff: {
        const b = ev as ApplyBuffEvent;
        if (b.sourceID !== playerId) {
          break;
        }
        switch (b.ability.guid) {
          case MW_SPELLS.RENEWING_MIST_HEAL:
            specifics.renewingMist.hotApplies += 1;
            remHotActive.add(b.targetID);
            break;
          case MW_SPELLS.ENVELOPING_MIST:
          case MW_SPELLS.ENVELOPING_MIST_TFT:
            specifics.envelopingMist.buffApplies += 1;
            evmActive.add(b.targetID);
            break;
          case MW_SPELLS.SOOTHING_MIST:
            soothingMistActive.add(b.targetID);
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
          case MW_SPELLS.RENEWING_MIST_HEAL:
            specifics.renewingMist.hotRefreshes += 1;
            break;
          case MW_SPELLS.ENVELOPING_MIST:
          case MW_SPELLS.ENVELOPING_MIST_TFT:
            specifics.envelopingMist.buffRefreshes += 1;
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
          case MW_SPELLS.RENEWING_MIST_HEAL:
            remHotActive.delete(rb.targetID);
            break;
          case MW_SPELLS.ENVELOPING_MIST:
          case MW_SPELLS.ENVELOPING_MIST_TFT:
            evmActive.delete(rb.targetID);
            break;
          case MW_SPELLS.SOOTHING_MIST:
            soothingMistActive.delete(rb.targetID);
            break;
        }
        break;
      }

      case EventType.ResourceChange: {
        // Mana Tea: estimate mana refunded from manaTea-flagged ResourceChange waste
        const rc = ev as ResourceChangeEvent;
        if (rc.sourceID === playerId && rc.ability?.guid === MW_SPELLS.MANA_TEA_CAST) {
          // ResourceChange gives `resourceChange` field; we don't have field aliasing here
          // so we just bump a hit-count; precise mana saved requires reading cost reductions
          // from cast events while Mana Tea was active (out of scope for v1).
          specifics.manaTea.manaSavedEstimate += 0;
        }
        break;
      }

      default:
        break;
    }
  }

  // Flush last vivify window
  if (lastVivifyCastAt !== null) {
    vivifyCastHits.push(lastVivifyHits);
  }
  specifics.vivify.averageTargetsPerCast =
    specifics.vivify.casts > 0
      ? vivifyCastHits.reduce((a, b) => a + b, 0) / specifics.vivify.casts
      : 0;
  specifics.revivalRestoral.uniqueTargetsHealed = revivalTargets.size;

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
    detectedBuild: detectBuild(specifics, totalHealing),
    warnings,
  };
}

function detectBuild(
  specifics: MistweaverReport['specifics'],
  totalHealing: number,
): MistweaverReport['detectedBuild'] {
  if (totalHealing <= 0) {
    return 'unknown';
  }
  const metaHealing =
    specifics.metaBuild.craneStyleHealing + specifics.metaBuild.ancientTeachingsHealing;
  const metaShare = metaHealing / totalHealing;
  const vivifyShare = specifics.vivify.totalHealing / totalHealing;
  const vivifyCasts = specifics.vivify.casts;
  if (metaShare >= 0.25 && vivifyCasts === 0) {
    return 'ancient-teachings-crane';
  }
  if (vivifyCasts >= 20 && vivifyShare >= 0.15) {
    return 'vivify-spam';
  }
  if (metaShare >= 0.15 && vivifyCasts >= 5) {
    return 'mixed';
  }
  if (metaShare >= 0.25) {
    return 'ancient-teachings-crane';
  }
  return 'unknown';
}
