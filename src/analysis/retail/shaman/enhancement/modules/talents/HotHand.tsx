import { formatDurationMillisMinSec, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/shaman';
import { SpellIcon, SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  DamageEvent,
  DeathEvent,
  EventType,
  FightEndEvent,
  GetRelatedEvent,
  GlobalCooldownEvent,
  RemoveBuffEvent,
  SpendResourceEvent,
  UpdateSpellUsableEvent,
  UpdateSpellUsableType,
} from 'parser/core/Events';
import Haste from 'parser/shared/modules/Haste';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { Intervals } from '../core/Intervals';
import { ReactNode } from 'react';
import TalentSpellText from 'parser/ui/TalentSpellText';
import {
  QualitativePerformance,
  evaluateQualitativePerformanceByThreshold,
  getAveragePerf,
  getLowestPerf,
} from 'parser/ui/QualitativePerformance';
import { getApplicableRules, HighPriorityAbilities, isHighPriorityAbility } from '../../common';
import {
  EnhancementEventLinks,
  GCD_TOLERANCE,
  MAELSTROM_WEAPON_ELIGIBLE_SPELL_IDS,
} from '../../constants';
import {
  addAdditionalCastInformation,
  addEnhancedCastReason,
  addInefficientCastReason,
} from 'parser/core/EventMetaLib';
import NPCS from 'common/NPCS';
import Earthsurge from '../hero/totemic/Earthsurge';
import MaelstromWeaponTracker from '../resourcetracker/MaelstromWeaponTracker';
import SpellUsable from '../core/SpellUsable';
import GuideSection from 'interface/guide/components/GuideSection';
import CastOverview from 'interface/guide/components/CastOverview';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import { SpellSequence, type CastInSequence } from 'interface/guide/components/CastSequence';
import RESOURCE_TYPES, { getResourceCost } from 'game/RESOURCE_TYPES';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

class HotHandRank {
  modRate: number;
  increase: number;

  constructor(modRate: number, increase: number) {
    this.modRate = modRate;
    this.increase = increase;
  }

  get rate() {
    return 1 / (1 - this.modRate);
  }
}

const HOT_HAND: Record<number, HotHandRank> = {
  1: new HotHandRank(0.6, 0.2),
  2: new HotHandRank(0.75, 0.4),
};

/**
 * These abilities are higher priority than casting Lava Lash even during
 * a Hot Hand window so we don't want to unfairly punish the performance if
 * any of these are used  */
const HIGH_PRIORITY_ABILITIES: HighPriorityAbilities = [
  SPELLS.SURGING_TOTEM.id,
  TALENTS.SUNDERING_TALENT.id,
];

interface HotHandWindow {
  event: ApplyBuffEvent;
  casts: CastEvent[];
  globalCooldowns: number[];
  lavaLashAvailabilityTimestamps: number[];
  lavaLashCooldownDurations: number[];
  start: number;
  end: number;
  gcdRemainingAtEnd: number;
  lavaLashCooldownRemainingAtEnd: number;
  totemicMomentumExtension: number;
  thorimsActiveRanges: { start: number; end: number }[];
  idleGapDurations: number[];
}

interface TotemicMomentumBreakdown {
  spentStacks: number;
  avoidableWasteStacks: number;
  remainingSpendableStacks: number;
  efficiency: number;
  performance: QualitativePerformance;
}

interface HotHandWindowBreakdown {
  lavaLashCasts: number;
  missedLavaLashes: number;
  splitstreamLinkedLavaLashes: number;
  usagePerformance: QualitativePerformance;
  gcdPerformance: QualitativePerformance;
  totemicMomentumBreakdown: TotemicMomentumBreakdown;
  splitstreamPerformance: QualitativePerformance | null;
  unusedGlobalCooldowns: number;
  averageGcd: number;
  sequence: CastInSequence[];
  performance: QualitativePerformance;
}

const TOTEMIC_MOMENTUM_EXTENSION_MS_PER_STACK = 200;
const HOT_HAND_DURATION_MS = 8000;

/**
 * Melee auto-attacks with Flametongue Weapon active have a 5% chance to
 * reduce the cooldown of Lava Lash by [25/50]% and increase the damage of
 * Lava Lash by [20/40]% for 8 sec.
 *
 * May not occur during an active Hot Hand.
 *
 * Example Log:
 *
 */
class HotHand extends Analyzer.withDependencies({
  spellUsable: SpellUsable,
  haste: Haste,
  earthsurge: Earthsurge,
  maelstromWeaponTracker: MaelstromWeaponTracker,
}) {
  private windows: HotHandWindow[] = [];
  private readonly highPriorityAbilities: HighPriorityAbilities = [...HIGH_PRIORITY_ABILITIES];

  private activeWindow: HotHandWindow | null = null;
  private globalCooldownEnds = 0;

  private hotHand!: HotHandRank;
  private buffedLavaLashDamage = 0;
  private hotHandActive: Intervals = new Intervals();
  private buffedCasts = 0;

  private hasTotemicMomentum = false;
  private hasSurgingTotem = false;
  private totemicMomentumTotalExtension = 0;
  private totemicMomentumProcsForStats = 0;

  private hasThorims = false;
  private thorimsBuffCount = 0;
  private thorimsActiveStart: number | null = null;

  private hasEarthsurge = false;
  private surgingTotemActive = false;
  private surgingTotemNpcId?: number;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.HOT_HAND_TALENT);
    if (!this.active) {
      return;
    }

    this.hasEarthsurge = this.selectedCombatant.hasTalent(TALENTS.EARTHSURGE_TALENT);
    this.hasTotemicMomentum = this.selectedCombatant.hasTalent(TALENTS.TOTEMIC_MOMENTUM_TALENT);
    this.hasSurgingTotem = this.selectedCombatant.hasTalent(TALENTS.SURGING_TOTEM_TALENT);
    this.hasThorims = this.selectedCombatant.hasTalent(TALENTS.THORIMS_INVOCATION_TALENT);
    this.hotHand = HOT_HAND[this.selectedCombatant.getTalentRank(TALENTS.HOT_HAND_TALENT)];

    if (this.selectedCombatant.hasTalent(TALENTS.VOLTAIC_BLAZE_TALENT)) {
      this.highPriorityAbilities.push(SPELLS.VOLTAIC_BLAZE_CAST.id);
    }

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.HOT_HAND_BUFF),
      this.onHotHandApply,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.HOT_HAND_BUFF),
      this.onHotHandExpire,
    );
    this.addEventListener(Events.fightend, this.onHotHandExpire);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this.onCast);
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(TALENTS.LAVA_LASH_TALENT),
      this.onLavaLashDamage,
    );
    this.addEventListener(Events.GlobalCooldown.by(SELECTED_PLAYER), this.onGlobalCooldown);
    this.addEventListener(
      Events.UpdateSpellUsable.by(SELECTED_PLAYER).spell(TALENTS.LAVA_LASH_TALENT),
      this.onLavaLashUsableUpdate,
    );

    if (this.hasEarthsurge) {
      this.surgingTotemNpcId = this.owner.playerPets.find(
        (x) => x.guid === NPCS.SURGING_TOTEM.id,
      )?.id;

      this.addEventListener(
        Events.cast.by(SELECTED_PLAYER).spell(TALENTS.LAVA_LASH_TALENT),
        this.onLavaLashCast,
      );
      this.addEventListener(
        Events.summon.by(SELECTED_PLAYER).spell(SPELLS.SURGING_TOTEM),
        this.onSurgingTotemSummon,
      );
      this.addEventListener(Events.death.to(SELECTED_PLAYER_PET), this.onPetDeath);
    }

    if (this.hasTotemicMomentum) {
      this.addEventListener(Events.SpendResource.by(SELECTED_PLAYER), this.onSpendMaelstromWeapon);
    }

    if (this.hasThorims) {
      this.addEventListener(
        Events.applybuff
          .by(SELECTED_PLAYER)
          .spell([SPELLS.DOOM_WINDS_BUFF, TALENTS.ASCENDANCE_ENHANCEMENT_TALENT]),
        this.onThorimsBuffApply,
      );
      this.addEventListener(
        Events.removebuff
          .by(SELECTED_PLAYER)
          .spell([SPELLS.DOOM_WINDS_BUFF, TALENTS.ASCENDANCE_ENHANCEMENT_TALENT]),
        this.onThorimsBuffRemove,
      );
    }
  }

  private onSpendMaelstromWeapon(event: SpendResourceEvent) {
    if (MAELSTROM_WEAPON_ELIGIBLE_SPELL_IDS.includes(event.ability.guid) && this.activeWindow) {
      this.activeWindow.totemicMomentumExtension +=
        event.resourceChange * TOTEMIC_MOMENTUM_EXTENSION_MS_PER_STACK;
    }
  }

  private onLavaLashUsableUpdate(event: UpdateSpellUsableEvent) {
    if (!this.activeWindow || event.timestamp <= this.activeWindow.start) {
      return;
    }

    if (event.updateType === UpdateSpellUsableType.EndCooldown) {
      this.activeWindow.lavaLashAvailabilityTimestamps.push(event.timestamp);
    } else if (event.updateType === UpdateSpellUsableType.BeginCooldown) {
      this.activeWindow.lavaLashCooldownDurations.push(event.expectedRechargeDuration);
    }
  }

  private onThorimsBuffApply(event: ApplyBuffEvent) {
    this.thorimsBuffCount += 1;
    if (this.thorimsBuffCount === 1 && this.activeWindow) {
      this.thorimsActiveStart = event.timestamp;
    }
  }

  private onThorimsBuffRemove(event: RemoveBuffEvent) {
    this.thorimsBuffCount = Math.max(0, this.thorimsBuffCount - 1);
    if (this.thorimsBuffCount === 0 && this.activeWindow && this.thorimsActiveStart !== null) {
      this.activeWindow.thorimsActiveRanges.push({
        start: this.thorimsActiveStart,
        end: event.timestamp,
      });
      this.thorimsActiveStart = null;
    }
  }

  private onGlobalCooldown(event: GlobalCooldownEvent) {
    if (this.activeWindow) {
      const gapStart = Math.max(this.globalCooldownEnds, this.activeWindow.start);
      const idleGap = event.timestamp - gapStart;
      if (idleGap > 0) {
        this.activeWindow.idleGapDurations.push(idleGap);
      }
      this.activeWindow.globalCooldowns.push(event.duration);
    }
    this.globalCooldownEnds = event.duration + event.timestamp;
  }

  private onHotHandApply(event: ApplyBuffEvent) {
    const whirlingFireRemovedEvent = GetRelatedEvent<RemoveBuffEvent>(
      event,
      EnhancementEventLinks.WHIRLING_FIRE_HOT_HAND_LINK,
      (e) => e.type === EventType.RemoveBuff,
    );

    if (!whirlingFireRemovedEvent) {
      this.deps.spellUsable.endCooldown(TALENTS.LAVA_LASH_TALENT.id, event.timestamp);
    }

    if (this.activeWindow) {
      return;
    }

    const lavaLashCastEvent = this.getWhirlingFireLavaLashCast(whirlingFireRemovedEvent);
    this.activeWindow = this.createWindow(event, lavaLashCastEvent);

    this.deps.spellUsable.applyCooldownRateChange(TALENTS.LAVA_LASH_TALENT.id, this.hotHand.rate);
    this.hotHandActive.startInterval(event.timestamp);

    if (this.hasThorims && this.thorimsBuffCount > 0) {
      this.thorimsActiveStart = event.timestamp;
    }
  }

  private onHotHandExpire(event: RemoveBuffEvent | FightEndEvent) {
    this.deps.spellUsable.removeCooldownRateChange(TALENTS.LAVA_LASH_TALENT.id, this.hotHand.rate);
    this.hotHandActive.endInterval(event.timestamp);

    if (this.activeWindow) {
      this.finalizeWindow(this.activeWindow, event);
      this.windows.push(this.activeWindow);
      this.activeWindow = null;
    }
  }

  private onCast(event: CastEvent) {
    if (!this.activeWindow || event.ability.guid === SPELLS.MELEE.id) {
      return;
    }

    const globalCooldown = event.globalCooldown ?? event.channel?.beginChannel.globalCooldown;
    if (!globalCooldown) {
      return;
    }

    if (event.ability.guid !== TALENTS.LAVA_LASH_TALENT.id) {
      this.isValidCastDuringHotHand(event);
    }

    this.activeWindow.casts.push(event);
  }

  private onLavaLashDamage(event: DamageEvent) {
    if (!this.selectedCombatant.hasBuff(SPELLS.HOT_HAND_BUFF.id)) {
      return;
    }

    this.buffedCasts += 1;
    this.buffedLavaLashDamage += calculateEffectiveDamage(event, this.hotHand.increase);
  }

  private onLavaLashCast(event: CastEvent) {
    if (this.selectedCombatant.hasBuff(SPELLS.HOT_HAND_BUFF) && !this.surgingTotemActive) {
      addInefficientCastReason(
        event,
        <>
          <SpellLink spell={SPELLS.SURGING_TOTEM} />{' '}
          {t({
            id: 'shaman.enhancement.hotHand.surgingTotemNotActive',
            message: 'was not active!',
          })}
        </>,
      );
    }
  }

  private onSurgingTotemSummon() {
    this.surgingTotemActive = true;
  }

  private onPetDeath(event: DeathEvent) {
    if (event.targetID === this.surgingTotemNpcId) {
      this.surgingTotemActive = false;
    }
  }

  private getWhirlingFireLavaLashCast(whirlingFireRemovedEvent?: RemoveBuffEvent) {
    if (!whirlingFireRemovedEvent) {
      return undefined;
    }

    const lavaLashCastEvent = GetRelatedEvent<CastEvent>(
      whirlingFireRemovedEvent,
      EnhancementEventLinks.WHIRLING_FIRE_LAVA_LASH_LINK,
      (relatedEvent) => relatedEvent.type === EventType.Cast,
    );

    if (lavaLashCastEvent) {
      addAdditionalCastInformation(
        lavaLashCastEvent,
        <>
          <SpellLink spell={TALENTS.HOT_HAND_TALENT} />{' '}
          {t({
            id: 'shaman.enhancement.hotHand.wasAppliedBy',
            message: 'was applied by',
          })}{' '}
          <SpellLink spell={SPELLS.WHIRLING_FIRE} />
        </>,
      );
    }

    return lavaLashCastEvent;
  }

  private createWindow(event: ApplyBuffEvent, openingLavaLashCast?: CastEvent): HotHandWindow {
    const start =
      openingLavaLashCast?.timestamp ?? Math.max(event.timestamp, this.globalCooldownEnds);
    const globalCooldowns = openingLavaLashCast?.globalCooldown
      ? [openingLavaLashCast.globalCooldown.duration]
      : [];

    return {
      event,
      casts: openingLavaLashCast ? [openingLavaLashCast] : [],
      globalCooldowns,
      lavaLashAvailabilityTimestamps: [start],
      lavaLashCooldownDurations: [],
      start,
      end: event.timestamp,
      gcdRemainingAtEnd: 0,
      lavaLashCooldownRemainingAtEnd: 0,
      idleGapDurations: [],
      totemicMomentumExtension: 0,
      thorimsActiveRanges: [],
    };
  }

  private finalizeWindow(window: HotHandWindow, event: RemoveBuffEvent | FightEndEvent) {
    const tailGapStart = Math.max(this.globalCooldownEnds, window.start);
    const tailIdleGap = event.timestamp - tailGapStart;
    if (tailIdleGap > 0) {
      window.idleGapDurations.push(tailIdleGap);
    }
    window.end = event.timestamp;
    window.gcdRemainingAtEnd = Math.max(this.globalCooldownEnds - event.timestamp, 0);
    window.lavaLashCooldownRemainingAtEnd = this.deps.spellUsable.cooldownRemaining(
      TALENTS.LAVA_LASH_TALENT.id,
      event.timestamp,
    );

    if (this.thorimsActiveStart !== null) {
      window.thorimsActiveRanges.push({
        start: this.thorimsActiveStart,
        end: event.timestamp,
      });
      this.thorimsActiveStart = null;
    }

    this.recordTotemicMomentumStats(window, event.type);
  }

  private recordTotemicMomentumStats(window: HotHandWindow, eventType: EventType) {
    if (!this.hasTotemicMomentum || eventType === EventType.FightEnd) {
      return;
    }

    if (window.totemicMomentumExtension > 0) {
      this.totemicMomentumTotalExtension += window.totemicMomentumExtension;
      this.totemicMomentumProcsForStats += 1;
    }

    const actualDuration = window.end - window.event.timestamp;
    const expectedDuration = HOT_HAND_DURATION_MS + window.totemicMomentumExtension;
    const discrepancy = Math.abs(actualDuration - expectedDuration);
    if (discrepancy > 100) {
      console.warn(
        `[HotHand] Duration discrepancy @ ${this.owner.formatTimestamp(window.event.timestamp)}: ` +
          `actual=${actualDuration}ms, expected=${expectedDuration}ms ` +
          `(base ${HOT_HAND_DURATION_MS} + TM ${window.totemicMomentumExtension}ms), ` +
          `diff=${discrepancy}ms`,
      );
    }
  }

  private get averageTotemicMomentumExtension() {
    return this.totemicMomentumProcsForStats > 0
      ? this.totemicMomentumTotalExtension / this.totemicMomentumProcsForStats
      : 0;
  }

  private get timePercentageHotHandsActive() {
    return this.hotHandActive.totalDuration / this.owner.fightDuration;
  }

  /**
   * Total Hot Hand active duration (ms) that falls inside [start, end].
   * Used by other modules to attribute Hot Hand uptime to their own windows.
   */
  activeDurationDuring(start: number, end: number): number {
    return this.hotHandActive.overlapWith(start, end);
  }

  /**
   * Average Totemic Momentum extension performance across Hot Hand windows
   * whose activity overlaps [start, end]. Returns null when the player isn't
   * talented into Totemic Momentum, or no Hot Hand windows fell in the range.
   */
  extensionPerformanceDuring(start: number, end: number): QualitativePerformance | null {
    if (!this.hasTotemicMomentum) {
      return null;
    }
    const overlapping = this.windows.filter((w) => w.start < end && w.end > start);
    if (overlapping.length === 0) {
      return null;
    }
    return getAveragePerf(overlapping.map((w) => this.getTotemicMomentumBreakdown(w).performance));
  }

  private get averageLavaLashCastsPerProc() {
    return this.hotHandActive.intervalsCount > 0
      ? this.buffedCasts / this.hotHandActive.intervalsCount
      : 0;
  }

  private isValidCastDuringHotHand(event: CastEvent): boolean {
    const firstApplicableRule = getApplicableRules(event, this.highPriorityAbilities)?.at(0);

    if (!firstApplicableRule) {
      return true;
    }

    if (typeof firstApplicableRule === 'object') {
      const isValidCast = !firstApplicableRule.condition || firstApplicableRule.condition(event);
      if (firstApplicableRule.enhancedCastReason) {
        const reason = firstApplicableRule.enhancedCastReason(isValidCast);
        if (reason) {
          const addReason = isValidCast ? addEnhancedCastReason : addInefficientCastReason;
          addReason(event, reason);
        }
      }
      return !isValidCast;
    }

    return firstApplicableRule === event.ability.guid;
  }

  private getAverageGcdOfWindow(cast: HotHandWindow) {
    if (cast.globalCooldowns.length === 0) {
      return 1500 + GCD_TOLERANCE;
    }

    return (
      cast.globalCooldowns.reduce((total, gcdDuration) => total + gcdDuration + GCD_TOLERANCE, 0) /
      cast.globalCooldowns.length
    );
  }

  private getUnusedGlobalCooldowns(cast: HotHandWindow) {
    const avgGcd = this.getAverageGcdOfWindow(cast);
    const totalIdleDuration = cast.idleGapDurations.reduce((total, gap) => total + gap, 0);
    return Math.floor(totalIdleDuration / avgGcd);
  }

  private getThorimsOverlapRatio(cast: HotHandWindow) {
    const thorimsActiveDuration = cast.thorimsActiveRanges.reduce(
      (total, range) => total + (range.end - range.start),
      0,
    );
    const windowDuration = cast.end - cast.start;
    return windowDuration > 0 ? thorimsActiveDuration / windowDuration : 0;
  }

  private getLavaLashCasts(cast: HotHandWindow): number {
    return cast.casts.filter((event) => event.ability.guid === TALENTS.LAVA_LASH_TALENT.id).length;
  }

  private getLastLavaLashTimestamp(cast: HotHandWindow) {
    return cast.casts.filter((event) => event.ability.guid === TALENTS.LAVA_LASH_TALENT.id).at(-1)
      ?.timestamp;
  }

  private getEffectiveLavaLashCooldown(cast: HotHandWindow) {
    if (cast.lavaLashCooldownDurations.length > 0) {
      return (
        cast.lavaLashCooldownDurations.reduce((total, duration) => total + duration, 0) /
        cast.lavaLashCooldownDurations.length
      );
    }

    return this.getAverageGcdOfWindow(cast);
  }

  private getMaximumLavaLashes(cast: HotHandWindow): number {
    const avgGcd = this.getAverageGcdOfWindow(cast);
    const effectiveCooldown = this.getEffectiveLavaLashCooldown(cast);
    const lavaLashCycle = Math.max(effectiveCooldown, avgGcd);
    const lavaLashCastTimestamps = cast.casts
      .filter((event) => event.ability.guid === TALENTS.LAVA_LASH_TALENT.id)
      .map((event) => event.timestamp);

    let totalOpportunities = 0;
    let lavaLashCastIndex = 0;

    for (let i = 0; i < cast.lavaLashAvailabilityTimestamps.length; i++) {
      const availableAt = cast.lavaLashAvailabilityTimestamps[i];
      if (availableAt + avgGcd > cast.end) {
        continue;
      }

      while (
        lavaLashCastIndex < lavaLashCastTimestamps.length &&
        lavaLashCastTimestamps[lavaLashCastIndex]! < availableAt
      ) {
        lavaLashCastIndex += 1;
      }

      const nextLavaLashCast =
        lavaLashCastIndex < lavaLashCastTimestamps.length
          ? lavaLashCastTimestamps[lavaLashCastIndex]
          : undefined;
      const nextAvailabilityTimestamp =
        i + 1 < cast.lavaLashAvailabilityTimestamps.length
          ? cast.lavaLashAvailabilityTimestamps[i + 1]
          : undefined;

      if (
        nextLavaLashCast !== undefined &&
        (nextAvailabilityTimestamp === undefined || nextLavaLashCast <= nextAvailabilityTimestamp)
      ) {
        totalOpportunities += 1;
        lavaLashCastIndex += 1;
        continue;
      }

      const idleEndsAt = Math.min(nextAvailabilityTimestamp ?? cast.end, cast.end);
      const idleDuration = idleEndsAt - availableAt;
      const additionalOpportunities = Math.floor((idleDuration - avgGcd) / lavaLashCycle);
      const displacedByHighPriority = cast.casts.filter(
        (event) =>
          event.timestamp >= availableAt &&
          event.timestamp < idleEndsAt &&
          isHighPriorityAbility(event, this.highPriorityAbilities),
      ).length;
      totalOpportunities += Math.max(
        0,
        1 + Math.max(additionalOpportunities, 0) - displacedByHighPriority,
      );
    }

    if (this.canSpendRemainingMaelstromForExtraLavaLash(cast)) {
      totalOpportunities += 1;
    }

    return totalOpportunities;
  }

  private getMissedLavaLashes(cast: HotHandWindow): number {
    return Math.max(this.getMaximumLavaLashes(cast) - this.getLavaLashCasts(cast), 0);
  }

  private getUsagePerformance(cast: HotHandWindow, lavaLashCasts = this.getLavaLashCasts(cast)) {
    const maximumLavaLashes = lavaLashCasts + this.getMissedLavaLashes(cast);
    if (maximumLavaLashes === 0) {
      return QualitativePerformance.Perfect;
    }

    const castsAsPercentageOfMax = lavaLashCasts / maximumLavaLashes;
    const thorimsOverlapRatio = this.getThorimsOverlapRatio(cast);

    let performance = evaluateQualitativePerformanceByThreshold({
      actual: castsAsPercentageOfMax,
      isGreaterThanOrEqual: {
        perfect: 1,
        good: 0.8,
        ok: 0.6,
      },
    });

    if (
      this.hasThorims &&
      thorimsOverlapRatio > 0.5 &&
      lavaLashCasts > 0 &&
      performance === QualitativePerformance.Fail
    ) {
      performance = QualitativePerformance.Ok;
    }

    return performance;
  }

  private hasSplitstreamLink(event: CastEvent) {
    return Boolean(
      GetRelatedEvent<CastEvent>(event, EnhancementEventLinks.REACTIVITY_LINK, (relatedEvent) => {
        return relatedEvent.type === EventType.Cast;
      }),
    );
  }

  /**
   * Could spending remaining MW stacks during the window have extended it
   * enough to fit one more Lava Lash? Uses the actionable stack count
   * (stacks available at least one GCD before window end).
   */
  private canSpendRemainingMaelstromForExtraLavaLash(cast: HotHandWindow): boolean {
    const segment = this.deps.maelstromWeaponTracker.generateSegmentData(cast.start, cast.end);
    return this.getActionableRemainingStacks(segment, cast) > 0;
  }

  /**
   * Find the MW stack count the player had at least one GCD before the window
   * ended. Stacks generated after this point could not realistically be spent
   * because there was no time to start a spender and have it complete.
   */
  private getActionableRemainingStacks(
    segment: ReturnType<MaelstromWeaponTracker['generateSegmentData']>,
    cast: HotHandWindow,
  ): number {
    const avgGcd = this.getAverageGcdOfWindow(cast);
    const cutoff = cast.end - avgGcd;

    let stacksAtCutoff = 0;
    for (const update of segment.updates) {
      if (update.timestamp > cutoff) {
        break;
      }
      stacksAtCutoff = update.current;
    }

    const stacks = Math.floor(stacksAtCutoff);
    if (stacks < 5 || stacks * TOTEMIC_MOMENTUM_EXTENSION_MS_PER_STACK < avgGcd) {
      return 0;
    }

    return stacks;
  }

  private getTotemicMomentumBreakdown(cast: HotHandWindow): TotemicMomentumBreakdown {
    if (!this.hasTotemicMomentum) {
      return {
        spentStacks: 0,
        avoidableWasteStacks: 0,
        remainingSpendableStacks: 0,
        efficiency: 1,
        performance: QualitativePerformance.Perfect,
      };
    }

    const segment = this.deps.maelstromWeaponTracker.generateSegmentData(cast.start, cast.end);
    const spentStacks = segment.spent;
    const avoidableWasteStacks = segment.avoidableWaste;
    const remainingSpendableStacks = this.getActionableRemainingStacks(segment, cast);
    const totalPotential = spentStacks + avoidableWasteStacks + remainingSpendableStacks;
    const efficiency = totalPotential > 0 ? spentStacks / totalPotential : 1;

    return {
      spentStacks,
      avoidableWasteStacks,
      remainingSpendableStacks,
      efficiency,
      performance: evaluateQualitativePerformanceByThreshold({
        actual: efficiency,
        isGreaterThanOrEqual: {
          perfect: 0.9,
          good: 0.75,
          ok: 0.6,
        },
      }),
    };
  }

  private getSplitstreamLinkedLavaLashes(cast: HotHandWindow) {
    if (!this.hasSurgingTotem) {
      return 0;
    }

    return cast.casts.filter(
      (event) =>
        event.ability.guid === TALENTS.LAVA_LASH_TALENT.id && this.hasSplitstreamLink(event),
    ).length;
  }

  private getGcdPerformance(cast: HotHandWindow) {
    const avgGcd = this.getAverageGcdOfWindow(cast);
    const unusedGlobalCooldowns = this.getUnusedGlobalCooldowns(cast);
    const estimatedPotentialCasts = (cast.end - cast.start) / avgGcd;
    if (estimatedPotentialCasts <= 0) {
      return QualitativePerformance.Perfect;
    }

    const gcdPerfCalc = (unusedGlobalCooldowns / estimatedPotentialCasts) * 100;

    return evaluateQualitativePerformanceByThreshold({
      actual: gcdPerfCalc,
      isLessThanOrEqual: {
        perfect: 7.5,
        good: 15,
        ok: 25,
      },
    });
  }

  private getSplitstreamPerformance(
    cast: HotHandWindow,
    lavaLashCasts = this.getLavaLashCasts(cast),
    splitstreamLinkedLavaLashes = this.getSplitstreamLinkedLavaLashes(cast),
  ) {
    if (!this.hasSurgingTotem) {
      return null;
    }

    if (lavaLashCasts === 0) {
      return null;
    }

    const splitstreamMisses = lavaLashCasts - splitstreamLinkedLavaLashes;

    if (splitstreamMisses === 0) {
      return null;
    }

    return evaluateQualitativePerformanceByThreshold({
      actual: splitstreamMisses,
      isLessThanOrEqual: {
        perfect: 0,
        ok: 1,
      },
    });
  }

  private description(): ReactNode {
    const hotHandLink = <SpellLink spell={TALENTS.HOT_HAND_TALENT} />;
    const lavaLashLink = <SpellLink spell={TALENTS.LAVA_LASH_TALENT} />;

    return (
      <>
        <p>
          {t({
            id: 'shaman.enhancement.hotHand.description.p1a',
            message: 'When ',
          })}
          <strong>{hotHandLink}</strong>
          {t({
            id: 'shaman.enhancement.hotHand.description.p1b',
            message: ' triggers, you can usually cast ',
          })}
          {lavaLashLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p1c',
            message: ' in a 1 → 2 → 2 → 1 like sequence. Casting ',
          })}
          {lavaLashLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p1d',
            message: ' → consuming 10 stacks of ',
          })}
          <SpellLink spell={SPELLS.MAELSTROM_WEAPON} />
          {t({
            id: 'shaman.enhancement.hotHand.description.p1e',
            message: ' can allow you to cast ',
          })}
          {lavaLashLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p1f',
            message: ' without an additional filler spell.',
          })}
        </p>
        <p>
          {t({
            id: 'shaman.enhancement.hotHand.description.p2a',
            message: 'The section to the right shows breakdown of each time ',
          })}
          {hotHandLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p2b',
            message: ' procced, and how well you utilised the window.',
          })}
        </p>
        <p>
          {t({
            id: 'shaman.enhancement.hotHand.description.p3a',
            message: 'Each ',
          })}
          {lavaLashLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p3b',
            message: ' cast while ',
          })}
          {hotHandLink}
          {t({
            id: 'shaman.enhancement.hotHand.description.p3c',
            message: ' is active will cast a ',
          })}
          <SpellLink spell={TALENTS.SUNDERING_TALENT} />
          {t({
            id: 'shaman.enhancement.hotHand.description.p3d',
            message: ' in the direction you are facing. ',
          })}
          {this.selectedCombatant.hasTalent(TALENTS.EARTHSURGE_TALENT) ? (
            <>
              <SpellLink spell={TALENTS.SUNDERING_TALENT} />
              {t({
                id: 'shaman.enhancement.hotHand.description.earthsurge.a',
                message: ' cast by ',
              })}
              {lavaLashLink}
              {t({
                id: 'shaman.enhancement.hotHand.description.earthsurge.b',
                message: ' will also trigger an ',
              })}
              <SpellLink spell={TALENTS.EARTHSURGE_TALENT} />
              {t({
                id: 'shaman.enhancement.hotHand.description.earthsurge.c',
                message: ' half way along ',
              })}
              <SpellLink spell={TALENTS.SUNDERING_TALENT} />
              {t({
                id: 'shaman.enhancement.hotHand.description.earthsurge.d',
                message: "'s path.",
              })}
            </>
          ) : null}
        </p>
        <p>
          {t({
            id: 'shaman.enhancement.hotHand.description.example',
            message: 'An example sequence may look something like this:',
          })}
        </p>
        <p>
          {lavaLashLink} &rarr;
          <SpellIcon spell={SPELLS.LIGHTNING_BOLT} /> &rarr;
          <SpellIcon spell={SPELLS.STORMSTRIKE} /> &rarr;
          {lavaLashLink} &rarr;
          <SpellIcon spell={TALENTS.CRASH_LIGHTNING_TALENT} /> &rarr;
          <SpellIcon spell={SPELLS.LIGHTNING_BOLT} /> &rarr;
          {lavaLashLink}
        </p>
        {(this.selectedCombatant.hasTalent(TALENTS.ASCENDANCE_ENHANCEMENT_TALENT) ||
          this.selectedCombatant.hasTalent(TALENTS.DEEPLY_ROOTED_ELEMENTS_TALENT)) && (
          <p>
            {t({
              id: 'shaman.enhancement.hotHand.description.ascendance.a',
              message: 'During ',
            })}
            <SpellLink spell={TALENTS.ASCENDANCE_ENHANCEMENT_TALENT} />
            {t({
              id: 'shaman.enhancement.hotHand.description.ascendance.b',
              message: ', due to the short cooldown of ',
            })}
            <SpellLink spell={SPELLS.WINDSTRIKE_CAST} />
            {t({
              id: 'shaman.enhancement.hotHand.description.ascendance.c',
              message: ' and the flood of maelstrom, you may find you are unable to cast ',
            })}
            {lavaLashLink}
            {t({
              id: 'shaman.enhancement.hotHand.description.ascendance.d',
              message: ' much or even at all.',
            })}
          </p>
        )}
      </>
    );
  }

  private buildOverviewStats() {
    const stats = [
      {
        value: `${this.windows.length}`,
        label: t({ id: 'shaman.enhancement.hothand.total_procs', message: 'Total Procs' }),
        tooltip: (
          <>{t({ id: 'shaman.enhancement.hothand.total_procs_tooltip.p1', message: 'Total ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.total_procs_tooltip.p2', message: ' windows recorded during the encounter.' })}</>
        ),
      },
      {
        value: `${formatPercentage(this.timePercentageHotHandsActive)}%`,
        label: t({ id: 'shaman.enhancement.hothand.buff_uptime', message: 'Buff Uptime' }),
        tooltip: (
          <>{t({ id: 'shaman.enhancement.hothand.buff_uptime_tooltip.p1', message: 'Percentage of the fight spent with ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.buff_uptime_tooltip.p2', message: ' active.' })}</>
        ),
      },
      {
        value: this.averageLavaLashCastsPerProc.toFixed(2),
        label: t({ id: 'shaman.enhancement.hothand.avg_lava_lashes', message: 'Avg Lava Lashes' }),
        tooltip: (
          <>{t({ id: 'shaman.enhancement.hothand.avg_lava_lashes_tooltip.p1', message: 'Average number of ' })}<SpellLink spell={TALENTS.LAVA_LASH_TALENT} />{t({ id: 'shaman.enhancement.hothand.avg_lava_lashes_tooltip.p2', message: ' casts made during each ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.avg_lava_lashes_tooltip.p3', message: ' proc.' })}</>
        ),
      },
    ];

    if (this.hasTotemicMomentum) {
      stats.push({
        value: formatDurationMillisMinSec(this.averageTotemicMomentumExtension, 1),
        label: t({ id: 'shaman.enhancement.hothand.avg_tm_extension', message: 'Avg TM Extension' }),
        tooltip: (
          <>{t({ id: 'shaman.enhancement.hothand.avg_tm_extension_tooltip.p1', message: 'Average ' })}<SpellLink spell={TALENTS.TOTEMIC_MOMENTUM_TALENT} />{t({ id: 'shaman.enhancement.hothand.avg_tm_extension_tooltip.p2', message: ' extension gained during completed ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.avg_tm_extension_tooltip.p3', message: ' windows.' })}</>
        ),
      });
    }

    return stats;
  }

  private getMaelstromWeaponSpent(event: CastEvent) {
    if (!MAELSTROM_WEAPON_ELIGIBLE_SPELL_IDS.includes(event.ability.guid)) {
      return undefined;
    }

    const stacksSpent = getResourceCost(event.resourceCost, RESOURCE_TYPES.MAELSTROM_WEAPON.id);
    return stacksSpent && stacksSpent > 0 ? stacksSpent : undefined;
  }

  private buildSpellSequence(cast: HotHandWindow): CastInSequence[] {
    return cast.casts.map((event) => {
      const maelstromSpent = this.getMaelstromWeaponSpent(event);

      return {
        timestamp: event.timestamp,
        spellId: event.ability.guid,
        spellName: event.ability.name,
        icon: event.ability.abilityIcon.replace('.jpg', ''),
        tooltip: (
          <>
            <strong>{event.ability.name}</strong>
            <div>
              {t({
                id: 'shaman.enhancement.hotHand.castAt',
                message: '@',
              })}{' '}
              {this.owner.formatTimestamp(event.timestamp)}
            </div>
            {maelstromSpent !== undefined ? (
              <div>
                {t({
                  id: 'shaman.enhancement.hotHand.maelstromWeaponSpent',
                  message: 'Maelstrom Weapon spent:',
                })}{' '}
                {maelstromSpent}
              </div>
            ) : null}
          </>
        ),
      };
    });
  }

  private buildWindowBreakdown(cast: HotHandWindow): HotHandWindowBreakdown {
    const lavaLashCasts = this.getLavaLashCasts(cast);
    const missedLavaLashes = this.getMissedLavaLashes(cast);
    const usagePerformance = this.getUsagePerformance(cast, lavaLashCasts);
    const gcdPerformance = this.getGcdPerformance(cast);
    const totemicMomentumBreakdown = this.getTotemicMomentumBreakdown(cast);
    const splitstreamLinkedLavaLashes = this.getSplitstreamLinkedLavaLashes(cast);
    const splitstreamPerformance = this.getSplitstreamPerformance(
      cast,
      lavaLashCasts,
      splitstreamLinkedLavaLashes,
    );
    const unusedGlobalCooldowns = this.getUnusedGlobalCooldowns(cast);
    const averageGcd = this.getAverageGcdOfWindow(cast);
    const sequence = this.buildSpellSequence(cast);
    const performances = [usagePerformance, gcdPerformance, totemicMomentumBreakdown.performance];

    if (splitstreamPerformance !== null) {
      performances.push(splitstreamPerformance);
    }

    const performance = getLowestPerf([usagePerformance, getAveragePerf(performances)]);

    return {
      lavaLashCasts,
      missedLavaLashes,
      splitstreamLinkedLavaLashes,
      usagePerformance,
      gcdPerformance,
      totemicMomentumBreakdown,
      splitstreamPerformance,
      unusedGlobalCooldowns,
      averageGcd,
      sequence,
      performance,
    };
  }

  private buildPerCastData(): PerCastData[] {
    return this.windows.map((cast) => {
      const breakdown = this.buildWindowBreakdown(cast);
      const showTotemicMomentumDetails =
        this.hasTotemicMomentum && breakdown.totemicMomentumBreakdown.efficiency < 0.9;
      const lostTotemicMomentumDuration =
        (breakdown.totemicMomentumBreakdown.avoidableWasteStacks +
          breakdown.totemicMomentumBreakdown.remainingSpendableStacks) *
        TOTEMIC_MOMENTUM_EXTENSION_MS_PER_STACK;

      return {
        performance: breakdown.performance,
        timestamp: this.owner.formatTimestamp(cast.event.timestamp),
        detailsIcon: null,
        stats: [
          {
            value: `${breakdown.lavaLashCasts}/${breakdown.lavaLashCasts + breakdown.missedLavaLashes}`,
            label: t({ id: 'shaman.enhancement.hothand.lava_lash_label', message: 'Lava Lash' }),
            tooltip: (
              <><SpellLink spell={TALENTS.LAVA_LASH_TALENT} />{t({ id: 'shaman.enhancement.hothand.lava_lash_tooltip.p1', message: ' casts during this ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.lava_lash_tooltip.p2', message: ' window compared with the estimated maximum.' })}</>
            ),
            performance: breakdown.usagePerformance,
          },
          {
            value: `${breakdown.unusedGlobalCooldowns}`,
            label: t({ id: 'shaman.enhancement.hothand.unused_gcds', message: 'Unused GCDs' }),
            tooltip: (
              <>{t({ id: 'shaman.enhancement.hothand.unused_gcds_tooltip.p1', message: 'Estimated unused global cooldowns during this ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.unused_gcds_tooltip.p2', message: ' window. Longer windows allow for more unused GCDs.' })}</>
            ),
            performance: breakdown.gcdPerformance,
          },
          {
            value: formatDurationMillisMinSec(cast.totemicMomentumExtension, 1),
            label: t({ id: 'shaman.enhancement.hothand.extension_time', message: 'Extension Time' }),
            tooltip: showTotemicMomentumDetails ? (
              <>{t({ id: 'shaman.enhancement.hothand.extension_time_tooltip.p1', message: 'An estimated ' })}<strong>{formatDurationMillisMinSec(lostTotemicMomentumDuration, 1)}</strong>{t({ id: 'shaman.enhancement.hothand.extension_time_tooltip.p2', message: ' were lost due to wasted / unused ' })}<SpellLink spell={SPELLS.MAELSTROM_WEAPON} />{t({ id: 'shaman.enhancement.hothand.extension_time_tooltip.p3', message: ' stacks.' })}</>
            ) : undefined,
            performance: breakdown.totemicMomentumBreakdown.performance,
          },
          ...(breakdown.splitstreamPerformance !== null
            ? [
                {
                  value: `${breakdown.splitstreamLinkedLavaLashes}/${breakdown.lavaLashCasts}`,
                  label: t({ id: 'shaman.enhancement.hothand.splitstream_label', message: 'Splitstream' }),
                  tooltip: (
                  <><SpellLink spell={TALENTS.LAVA_LASH_TALENT} />{t({ id: 'shaman.enhancement.hothand.splitstream_tooltip.p1', message: ' casts during this ' })}<SpellLink spell={TALENTS.HOT_HAND_TALENT} />{t({ id: 'shaman.enhancement.hothand.splitstream_tooltip.p2', message: ' window with an associated ' })}<SpellLink spell={TALENTS.SPLITSTREAM_TALENT} />{t({ id: 'shaman.enhancement.hothand.splitstream_tooltip.p3', message: ' / ' })}<SpellLink spell={TALENTS.EARTHSURGE_TALENT} />{t({ id: 'shaman.enhancement.hothand.splitstream_tooltip.p4', message: ' link.' })}</>
                  ),
                  performance: breakdown.splitstreamPerformance,
                },
              ]
            : []),
        ],
        additionalContent:
          breakdown.sequence.length > 0
            ? {
                title: t({ id: 'shaman.enhancement.hothand.cast_sequence', message: 'Cast Sequence' }),
                content: <SpellSequence casts={breakdown.sequence} iconSize={40} />,
              }
            : undefined,
      };
    });
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL()}
        size="flexible"
        tooltip={
          <ul>
            <li>
              <Trans id="shaman.enhancement.hothand.stat_gained_buff">
                Gained buff {this.hotHandActive.intervalsCount} times (
                {formatPercentage(this.timePercentageHotHandsActive)}% uptime)
              </Trans>
            </li>
            <li>
              <>{this.buffedCasts}{t({ id: 'shaman.enhancement.hothand.stat_total_casts.p1', message: ' total ' })}<SpellLink spell={TALENTS.LAVA_LASH_TALENT} />{t({ id: 'shaman.enhancement.hothand.stat_total_casts.p2', message: ' casts with Hot Hand buff' })}</>
            </li>
            {this.hasTotemicMomentum && this.totemicMomentumProcsForStats > 0 && (
              <li>
                <><SpellLink spell={TALENTS.TOTEMIC_MOMENTUM_TALENT} />{t({ id: 'shaman.enhancement.hothand.stat_avg_extension.p1', message: ' average extension: ' })}{formatDurationMillisMinSec(this.averageTotemicMomentumExtension, 1)}{t({ id: 'shaman.enhancement.hothand.stat_avg_extension.p2', message: ' per proc' })}</>
              </li>
            )}
          </ul>
        }
        category={STATISTIC_CATEGORY.TALENTS}
      >
        <TalentSpellText talent={TALENTS.HOT_HAND_TALENT}>
          <div>
            <ItemDamageDone amount={this.buffedLavaLashDamage} />
          </div>
          <div>
            {this.averageLavaLashCastsPerProc.toFixed(2)}{' '}
            <small>{t({ id: 'shaman.enhancement.hothand.avg_casts_per_proc', message: 'average casts per proc' })}</small>
          </div>
          {this.hasTotemicMomentum && this.totemicMomentumProcsForStats > 0 && (
            <div>
              {formatDurationMillisMinSec(this.averageTotemicMomentumExtension, 1)}{' '}
              <small>{t({ id: 'shaman.enhancement.hothand.avg_extension_per_proc', message: 'average extension per proc' })}</small>
            </div>
          )}
        </TalentSpellText>
      </Statistic>
    );
  }

  get guideSubsection() {
    if (!this.active) {
      return null;
    }

    return (
      <GuideSection spell={TALENTS.HOT_HAND_TALENT} explanation={this.description()}>
        <CastOverview spell={TALENTS.HOT_HAND_TALENT} stats={this.buildOverviewStats()} />
        <CastDetail title={t({ id: 'shaman.enhancement.hothand.windows_title', message: 'Hot Hand Windows' })} casts={this.buildPerCastData()} />
      </GuideSection>
    );
  }
}

export default HotHand;
