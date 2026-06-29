// Path-A holy priest extractor: direct event-stream aggregation.
//
// Walks the normalized event list and produces:
//   - per-spell summary (casts / healing / overhealing / manaSpent / hits / crits / ticks)
//   - holy-priest-specific metrics (Prayer of Mending bounces, Renew HoT, Holy Words,
//     CDR estimation, procs, mastery: Echo of Light, hero talent detection)
//
// No analyzer DI; no JSX; deterministic and trivially testable.

import type {
  AnyEvent,
  CastEvent,
  HealEvent,
  ApplyBuffEvent,
  RemoveBuffEvent,
  RefreshBuffEvent,
  ChangeBuffStackEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';

// --- Holy Priest spell IDs (WoW 12.x / TWW Midnight, patch 11.2+) ---
export const HOLY_SPELLS = {
  // Direct heals — cast & heal share ID unless noted
  FLASH_HEAL: 2061,
  BINDING_HEALS_HEAL: 368276,
  RENEW: 139, // cast / apply / refresh / tick — distinguished via event.tick + event.type
  EMPOWERED_RENEW_HEAL: 391359,
  HEAL: 2060, // may be absent in TWW — track if present
  PRAYER_OF_HEALING: 596, // cast & heal share ID
  DIVINE_HYMN_CAST: 64843,
  DIVINE_HYMN_HEAL: 64844,
  HALO_HEAL: 120692,
  HOLY_NOVA_HEAL: 281265,

  // Prayer of Mending — cast / heal / buff are separate IDs
  PRAYER_OF_MENDING_CAST: 33076,
  PRAYER_OF_MENDING_HEAL: 33110, // each bounce heal
  PRAYER_OF_MENDING_BUFF: 41635, // buff on current carrier

  // Holy Words — cast & heal share ID for Serenity; track separately
  HOLY_WORD_SERENITY: 2050,
  HOLY_WORD_SANCTIFY: 34861,
  HOLY_WORD_CHASTISE: 88625,
  SERENDIPITY: 63733,
  ULTIMATE_SERENITY: 1246517,

  // Cooldowns
  APOTHEOSIS: 200183,
  GUARDIAN_SPIRIT_CAST: 47788,
  GUARDIAN_SPIRIT_HEAL: 48153,
  POWER_INFUSION: 10060,

  // Talent procs / passives
  SURGE_OF_LIGHT_BUFF: 114255,
  TRAIL_OF_LIGHT_HEAL: 234946,
  LIGHTWELL_HEAL: 372847,
  LIGHTWEAVER_BUFF: 390993,
  COSMIC_RIPPLE_HEAL: 243241,
  DIVINE_IMAGE_HEALS: [196909, 196810, 196813, 196816],
  EPIPHANY_BUFF: 414556,

  // Damage spells (for Chastise CDR estimation)
  SMITE: 585,
  HOLY_FIRE: 14914,

  // Mastery: Echo of Light
  ECHO_OF_LIGHT_HEAL: 77489,

  // Hero talent detection — Archon
  RESONANT_ENERGY_BUFF: 453846,
  PERFECTED_FORM_BUFF: 453983,

  // Hero talent detection — Oracle
  PIETY_BUFF: 428930,
  PREMONITION_OF_INSIGHT: 428933,
  PREMONITION_OF_SOLACE: 443526,
};

// --- Chinese names ---
const HOLY_SPELLS_TO_HUMAN: Record<number, string> = {
  [HOLY_SPELLS.FLASH_HEAL]: '快速治疗',
  [HOLY_SPELLS.BINDING_HEALS_HEAL]: '共愈合',
  [HOLY_SPELLS.RENEW]: '恢复',
  [HOLY_SPELLS.EMPOWERED_RENEW_HEAL]: '强化恢复',
  [HOLY_SPELLS.HEAL]: '治疗术',
  [HOLY_SPELLS.PRAYER_OF_HEALING]: '治疗祷言',
  [HOLY_SPELLS.DIVINE_HYMN_CAST]: '神圣赞美诗',
  [HOLY_SPELLS.DIVINE_HYMN_HEAL]: '神圣赞美诗(治疗)',
  [HOLY_SPELLS.HALO_HEAL]: '光环',
  [HOLY_SPELLS.HOLY_NOVA_HEAL]: '神圣新星',
  [HOLY_SPELLS.PRAYER_OF_MENDING_CAST]: '愈合祷言',
  [HOLY_SPELLS.PRAYER_OF_MENDING_HEAL]: '愈合祷言(弹跳)',
  [HOLY_SPELLS.PRAYER_OF_MENDING_BUFF]: '愈合祷言(增益)',
  [HOLY_SPELLS.HOLY_WORD_SERENITY]: '圣言术：静',
  [HOLY_SPELLS.HOLY_WORD_SANCTIFY]: '圣言术：净',
  [HOLY_SPELLS.HOLY_WORD_CHASTISE]: '圣言术：罚',
  [HOLY_SPELLS.SERENDIPITY]: '机缘',
  [HOLY_SPELLS.ULTIMATE_SERENITY]: '究极静念',
  [HOLY_SPELLS.APOTHEOSIS]: '化身',
  [HOLY_SPELLS.GUARDIAN_SPIRIT_CAST]: '守护之魂',
  [HOLY_SPELLS.GUARDIAN_SPIRIT_HEAL]: '守护之魂(治疗)',
  [HOLY_SPELLS.POWER_INFUSION]: '能量灌注',
  [HOLY_SPELLS.SURGE_OF_LIGHT_BUFF]: '光明涌现',
  [HOLY_SPELLS.TRAIL_OF_LIGHT_HEAL]: '圣光足迹',
  [HOLY_SPELLS.LIGHTWELL_HEAL]: '光井',
  [HOLY_SPELLS.LIGHTWEAVER_BUFF]: '织光者',
  [HOLY_SPELLS.COSMIC_RIPPLE_HEAL]: '宇宙涟漪',
  [HOLY_SPELLS.EPIPHANY_BUFF]: '顿悟',
  [HOLY_SPELLS.SMITE]: '真言术：惩',
  [HOLY_SPELLS.HOLY_FIRE]: '神圣灼烧',
  [HOLY_SPELLS.ECHO_OF_LIGHT_HEAL]: '精通：光之回响',
  [HOLY_SPELLS.RESONANT_ENERGY_BUFF]: '共鸣能量',
  [HOLY_SPELLS.PERFECTED_FORM_BUFF]: '完美形态',
  [HOLY_SPELLS.PIETY_BUFF]: '虔诚',
  [HOLY_SPELLS.PREMONITION_OF_INSIGHT]: '预感',
  [HOLY_SPELLS.PREMONITION_OF_SOLACE]: '预感(慰藉)',
  // Divine Image heal variants
  196909: '神圣形象(治疗)',
  196810: '神圣形象(治疗)',
  196813: '神圣形象(治疗)',
  196816: '神圣形象(治疗)',
};

const DIVINE_IMAGE_SET = new Set(HOLY_SPELLS.DIVINE_IMAGE_HEALS);

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

export interface HolyPriestReport {
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
    prayerOfMending: {
      casts: number;
      bounces: number;
      totalHealing: number;
      totalOverhealing: number;
      averageBouncesPerCast: number;
    };
    renew: {
      casts: number;
      hotApplies: number;
      hotRefreshes: number;
      hotTicks: number;
      hotHealing: number;
      hotOverhealing: number;
      empoweredRenewHits: number;
      empoweredRenewHealing: number;
    };
    holyWords: {
      serenityCasts: number;
      sanctifyCasts: number;
      chastiseCasts: number;
      serenityHealing: number;
      sanctifyHealing: number;
      ultimateSerenityCasts: number;
    };
    holyWordCDR: {
      flashHealCasts: number;
      prayerOfHealingCasts: number;
      prayerOfMendingCasts: number;
      smiteCasts: number;
      holyFireCasts: number;
      holyNovaCasts: number;
      estimatedSerenityCDR: number;
      estimatedSanctifyCDR: number;
      estimatedChastiseCDR: number;
    };
    aoeHeals: {
      prayerOfHealingCasts: number;
      prayerOfHealingHealing: number;
      divineHymnCasts: number;
      divineHymnTicks: number;
      divineHymnHealing: number;
      haloHits: number;
      haloHealing: number;
      holyNovaHits: number;
      holyNovaHealing: number;
    };
    cooldowns: {
      apotheosisCasts: number;
      guardianSpiritCasts: number;
      powerInfusionCasts: number;
    };
    procs: {
      surgeOfLightProcs: number;
      surgeOfLightConsumed: number;
      trailOfLightHits: number;
      trailOfLightHealing: number;
      lightwellHits: number;
      lightwellHealing: number;
      cosmicRippleHits: number;
      cosmicRippleHealing: number;
      bindingHealsHits: number;
      bindingHealsHealing: number;
      divineImageHits: number;
      divineImageHealing: number;
      epiphanyConsumed: number;
    };
    mastery: {
      echoOfLightHits: number;
      echoOfLightHealing: number;
      echoOfLightOverhealing: number;
    };
    heroTalent: {
      archon: {
        haloHits: number;
        haloHealing: number;
        resonantEnergyMaxStacks: number;
      };
      oracle: {
        piety: number;
        premonitionUses: number;
      };
    };
  };
  detectedBuild: 'archon' | 'oracle' | 'unknown';
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

export function extractHolyPriestReport(input: ExtractInput): HolyPriestReport {
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
        spellNameCN: HOLY_SPELLS_TO_HUMAN[spellId] ?? fallbackName,
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

  // Holy-Priest-specific accumulators
  const specifics: HolyPriestReport['specifics'] = {
    prayerOfMending: {
      casts: 0,
      bounces: 0,
      totalHealing: 0,
      totalOverhealing: 0,
      averageBouncesPerCast: 0,
    },
    renew: {
      casts: 0,
      hotApplies: 0,
      hotRefreshes: 0,
      hotTicks: 0,
      hotHealing: 0,
      hotOverhealing: 0,
      empoweredRenewHits: 0,
      empoweredRenewHealing: 0,
    },
    holyWords: {
      serenityCasts: 0,
      sanctifyCasts: 0,
      chastiseCasts: 0,
      serenityHealing: 0,
      sanctifyHealing: 0,
      ultimateSerenityCasts: 0,
    },
    holyWordCDR: {
      flashHealCasts: 0,
      prayerOfHealingCasts: 0,
      prayerOfMendingCasts: 0,
      smiteCasts: 0,
      holyFireCasts: 0,
      holyNovaCasts: 0,
      estimatedSerenityCDR: 0,
      estimatedSanctifyCDR: 0,
      estimatedChastiseCDR: 0,
    },
    aoeHeals: {
      prayerOfHealingCasts: 0,
      prayerOfHealingHealing: 0,
      divineHymnCasts: 0,
      divineHymnTicks: 0,
      divineHymnHealing: 0,
      haloHits: 0,
      haloHealing: 0,
      holyNovaHits: 0,
      holyNovaHealing: 0,
    },
    cooldowns: {
      apotheosisCasts: 0,
      guardianSpiritCasts: 0,
      powerInfusionCasts: 0,
    },
    procs: {
      surgeOfLightProcs: 0,
      surgeOfLightConsumed: 0,
      trailOfLightHits: 0,
      trailOfLightHealing: 0,
      lightwellHits: 0,
      lightwellHealing: 0,
      cosmicRippleHits: 0,
      cosmicRippleHealing: 0,
      bindingHealsHits: 0,
      bindingHealsHealing: 0,
      divineImageHits: 0,
      divineImageHealing: 0,
      epiphanyConsumed: 0,
    },
    mastery: {
      echoOfLightHits: 0,
      echoOfLightHealing: 0,
      echoOfLightOverhealing: 0,
    },
    heroTalent: {
      archon: {
        haloHits: 0,
        haloHealing: 0,
        resonantEnergyMaxStacks: 0,
      },
      oracle: {
        piety: 0,
        premonitionUses: 0,
      },
    },
  };

  let totalCasts = 0;
  let totalHealing = 0;
  let totalOverhealing = 0;
  let totalManaSpent = 0;

  // Hero talent detection accumulators (not part of per-spell)
  let archonSignal = 0;
  let oracleSignal = 0;

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

        // Spell-specific cast counters
        switch (id) {
          case HOLY_SPELLS.RENEW:
            specifics.renew.casts += 1;
            break;
          case HOLY_SPELLS.PRAYER_OF_MENDING_CAST:
            specifics.prayerOfMending.casts += 1;
            break;
          case HOLY_SPELLS.HOLY_WORD_SERENITY:
            specifics.holyWords.serenityCasts += 1;
            break;
          case HOLY_SPELLS.HOLY_WORD_SANCTIFY:
            specifics.holyWords.sanctifyCasts += 1;
            break;
          case HOLY_SPELLS.HOLY_WORD_CHASTISE:
            specifics.holyWords.chastiseCasts += 1;
            break;
          case HOLY_SPELLS.ULTIMATE_SERENITY:
            specifics.holyWords.ultimateSerenityCasts += 1;
            break;
          case HOLY_SPELLS.PRAYER_OF_HEALING:
            specifics.aoeHeals.prayerOfHealingCasts += 1;
            break;
          case HOLY_SPELLS.DIVINE_HYMN_CAST:
            specifics.aoeHeals.divineHymnCasts += 1;
            break;
          case HOLY_SPELLS.APOTHEOSIS:
            specifics.cooldowns.apotheosisCasts += 1;
            break;
          case HOLY_SPELLS.GUARDIAN_SPIRIT_CAST:
            specifics.cooldowns.guardianSpiritCasts += 1;
            break;
          case HOLY_SPELLS.POWER_INFUSION:
            specifics.cooldowns.powerInfusionCasts += 1;
            break;
        }

        // CDR contributor tracking (count casts of CDR-driving spells)
        switch (id) {
          case HOLY_SPELLS.FLASH_HEAL:
            specifics.holyWordCDR.flashHealCasts += 1;
            break;
          case HOLY_SPELLS.PRAYER_OF_HEALING:
            specifics.holyWordCDR.prayerOfHealingCasts += 1;
            break;
          case HOLY_SPELLS.PRAYER_OF_MENDING_CAST:
            specifics.holyWordCDR.prayerOfMendingCasts += 1;
            break;
          case HOLY_SPELLS.SMITE:
            specifics.holyWordCDR.smiteCasts += 1;
            break;
          case HOLY_SPELLS.HOLY_FIRE:
            specifics.holyWordCDR.holyFireCasts += 1;
            break;
          // Holy Nova heal is 281265; the cast ID for Holy Nova may differ but
          // if we see any Holy Nova heal events we know it was cast.
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

        // Holy-Priest-specific heal-event handling
        switch (id) {
          case HOLY_SPELLS.RENEW: {
            // Renew 139 shared ID — distinguish via event.tick
            if (h.tick) {
              specifics.renew.hotTicks += 1;
              specifics.renew.hotHealing += amount;
              specifics.renew.hotOverhealing += overheal;
            }
            // Non-tick Renew heals are rare direct hits (Empyrean Renew instant heal);
            // counted as renew.directHits — we don't have a dedicated field, skip
            break;
          }
          case HOLY_SPELLS.EMPOWERED_RENEW_HEAL:
            specifics.renew.empoweredRenewHits += 1;
            specifics.renew.empoweredRenewHealing += amount;
            break;
          case HOLY_SPELLS.PRAYER_OF_MENDING_HEAL:
            specifics.prayerOfMending.bounces += 1;
            specifics.prayerOfMending.totalHealing += amount;
            specifics.prayerOfMending.totalOverhealing += overheal;
            break;
          case HOLY_SPELLS.HOLY_WORD_SERENITY:
            specifics.holyWords.serenityHealing += amount;
            break;
          case HOLY_SPELLS.HOLY_WORD_SANCTIFY:
            specifics.holyWords.sanctifyHealing += amount;
            break;
          case HOLY_SPELLS.PRAYER_OF_HEALING:
            specifics.aoeHeals.prayerOfHealingHealing += amount;
            break;
          case HOLY_SPELLS.DIVINE_HYMN_HEAL:
            specifics.aoeHeals.divineHymnTicks += 1;
            specifics.aoeHeals.divineHymnHealing += amount;
            break;
          case HOLY_SPELLS.HALO_HEAL:
            specifics.aoeHeals.haloHits += 1;
            specifics.aoeHeals.haloHealing += amount;
            specifics.heroTalent.archon.haloHits += 1;
            specifics.heroTalent.archon.haloHealing += amount;
            break;
          case HOLY_SPELLS.HOLY_NOVA_HEAL:
            specifics.aoeHeals.holyNovaHits += 1;
            specifics.aoeHeals.holyNovaHealing += amount;
            specifics.holyWordCDR.holyNovaCasts += 1;
            break;
          case HOLY_SPELLS.TRAIL_OF_LIGHT_HEAL:
            specifics.procs.trailOfLightHits += 1;
            specifics.procs.trailOfLightHealing += amount;
            break;
          case HOLY_SPELLS.LIGHTWELL_HEAL:
            specifics.procs.lightwellHits += 1;
            specifics.procs.lightwellHealing += amount;
            break;
          case HOLY_SPELLS.COSMIC_RIPPLE_HEAL:
            specifics.procs.cosmicRippleHits += 1;
            specifics.procs.cosmicRippleHealing += amount;
            break;
          case HOLY_SPELLS.BINDING_HEALS_HEAL:
            specifics.procs.bindingHealsHits += 1;
            specifics.procs.bindingHealsHealing += amount;
            break;
          case HOLY_SPELLS.ECHO_OF_LIGHT_HEAL:
            specifics.mastery.echoOfLightHits += 1;
            specifics.mastery.echoOfLightHealing += amount;
            specifics.mastery.echoOfLightOverhealing += overheal;
            break;
          default: {
            // Check Divine Image heal IDs (dynamic set)
            if (DIVINE_IMAGE_SET.has(id)) {
              specifics.procs.divineImageHits += 1;
              specifics.procs.divineImageHealing += amount;
            }
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
        const id = b.ability.guid;
        switch (id) {
          case HOLY_SPELLS.RENEW:
            specifics.renew.hotApplies += 1;
            break;
          case HOLY_SPELLS.RESONANT_ENERGY_BUFF:
            archonSignal += 1;
            break;
          case HOLY_SPELLS.PERFECTED_FORM_BUFF:
            archonSignal += 1;
            break;
          case HOLY_SPELLS.PIETY_BUFF:
            oracleSignal += 1;
            break;
          case HOLY_SPELLS.PREMONITION_OF_INSIGHT:
            oracleSignal += 1;
            break;
          case HOLY_SPELLS.PREMONITION_OF_SOLACE:
            oracleSignal += 1;
            break;
        }
        break;
      }

      case EventType.RefreshBuff: {
        const r = ev as RefreshBuffEvent;
        if (r.sourceID !== playerId) {
          break;
        }
        if (r.ability.guid === HOLY_SPELLS.RENEW) {
          specifics.renew.hotRefreshes += 1;
        }
        break;
      }

      case EventType.ChangeBuffStack: {
        const cs = ev as ChangeBuffStackEvent;
        if (cs.sourceID !== playerId) {
          break;
        }
        const id = cs.ability.guid;
        switch (id) {
          case HOLY_SPELLS.SURGE_OF_LIGHT_BUFF: {
            // stacksGained > 0 → proc gained; stacksGained < 0 → consumed
            if (cs.stacksGained > 0) {
              specifics.procs.surgeOfLightProcs += cs.stacksGained;
            } else if (cs.stacksGained < 0) {
              specifics.procs.surgeOfLightConsumed += Math.abs(cs.stacksGained);
            }
            break;
          }
          case HOLY_SPELLS.RESONANT_ENERGY_BUFF: {
            // Track max stacks for Archon detection
            if (cs.newStacks > specifics.heroTalent.archon.resonantEnergyMaxStacks) {
              specifics.heroTalent.archon.resonantEnergyMaxStacks = cs.newStacks;
            }
            archonSignal += 1;
            break;
          }
          case HOLY_SPELLS.PIETY_BUFF:
            specifics.heroTalent.oracle.piety += 1;
            oracleSignal += 1;
            break;
        }
        break;
      }

      case EventType.RemoveBuff: {
        const rb = ev as RemoveBuffEvent;
        if (rb.sourceID !== playerId) {
          break;
        }
        if (rb.ability.guid === HOLY_SPELLS.EPIPHANY_BUFF) {
          // Epiphany consumed (free PoM proc)
          specifics.procs.epiphanyConsumed += 1;
        }
        // Archon signal from Perfected Form
        if (rb.ability.guid === HOLY_SPELLS.PERFECTED_FORM_BUFF) {
          archonSignal += 1;
        }
        break;
      }

      default:
        break;
    }
  }

  // Compute averages & derived fields
  specifics.prayerOfMending.averageBouncesPerCast =
    specifics.prayerOfMending.casts > 0
      ? specifics.prayerOfMending.bounces / specifics.prayerOfMending.casts
      : 0;

  // CDR estimation
  // Serenity CDR: Flash Heal (-6s), Prayer of Mending (-4s), Prayer of Healing (-6s)
  specifics.holyWordCDR.estimatedSerenityCDR =
    specifics.holyWordCDR.flashHealCasts * 6 +
    specifics.holyWordCDR.prayerOfMendingCasts * 4 +
    specifics.holyWordCDR.prayerOfHealingCasts * 6;

  // Sanctify CDR: Prayer of Healing (-6s)
  specifics.holyWordCDR.estimatedSanctifyCDR = specifics.holyWordCDR.prayerOfHealingCasts * 6;

  // Chastise CDR: Smite (-4s), Holy Fire (-4s), Holy Nova (-4s if present)
  specifics.holyWordCDR.estimatedChastiseCDR =
    specifics.holyWordCDR.smiteCasts * 4 +
    specifics.holyWordCDR.holyFireCasts * 4 +
    (specifics.holyWordCDR.holyNovaCasts > 0 ? specifics.holyWordCDR.holyNovaCasts * 4 : 0);

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
    detectedBuild: detectBuild(archonSignal, oracleSignal, specifics),
    warnings,
  };
}

function detectBuild(
  archonSignal: number,
  oracleSignal: number,
  specifics: HolyPriestReport['specifics'],
): HolyPriestReport['detectedBuild'] {
  // Archon: Halo is a key indicator + Resonant Energy / Perfected Form buffs
  if (archonSignal >= 3 || specifics.aoeHeals.haloHits >= 5) {
    return 'archon';
  }
  // Oracle: Piety / Premonition buff events
  if (oracleSignal >= 2 || specifics.procs.epiphanyConsumed >= 1) {
    return 'oracle';
  }
  // If both have weak signals, lean toward the one with more
  if (archonSignal > oracleSignal && archonSignal > 0) {
    return 'archon';
  }
  if (oracleSignal > archonSignal && oracleSignal > 0) {
    return 'oracle';
  }
  return 'unknown';
}
