import type { JSX, ReactNode } from 'react';
import { Fragment } from 'react';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  ApplyBuffStackEvent,
  CastEvent,
  ChangeBuffStackEvent,
  RefreshBuffEvent,
  RemoveBuffEvent,
} from 'parser/core/Events';
import { mergeTimePeriods, OpenTimePeriod } from 'parser/core/mergeTimePeriods';
import uptimeBarSubStatistic, { SubPercentageStyle } from 'parser/ui/UptimeBarSubStatistic';
import { TALENTS_DRUID } from 'common/TALENTS';
import type { Talent } from 'common/TALENTS/types';
import {
  causedBloom,
  getHardcast,
  isFromOvergrowth,
  isOvergrowthRegrowth,
} from 'analysis/retail/druid/restoration/normalizers/CastLinkNormalizer';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import Combatants from 'parser/shared/modules/Combatants';
import Efflorescence from 'analysis/retail/druid/restoration/modules/spells/Efflorescence';
import HotTrackerRestoDruid from 'analysis/retail/druid/restoration/modules/core/hottracking/HotTrackerRestoDruid';
import { LIFEBLOOM_STACK_AURAS } from 'analysis/retail/druid/restoration/constants';
import { t } from '@lingui/core/macro';

const DEBUG = false;

const LB_COLOR = '#00bb44';
/** Matches HotTrackerRestoDruid Lifebloom duration; pandemic window is the last 30%. */
const LIFEBLOOM_DURATION_MS = 15000;
const LIFEBLOOM_PANDEMIC_MS = LIFEBLOOM_DURATION_MS * 0.3;

/**
 * Components related to Lifebloom and Lifebloom's uptime.
 *
 * Spell ID split (Midnight):
 * - LIFEBLOOM_BUFF (1227806): duration aura used for uptime / pandemic remaining
 * - LIFEBLOOM_HOT_HEAL (33763): cast ID, periodic ticks, and a second stacking aura
 *
 * Grade player Lifebloom casts (33763) and Overgrowth applies, not 1227806/33763
 * refreshbuffs — those include Everbloom stack-timer events that do not line up
 * with casts.
 *
 * When Lifetreading is talented, the guide subsection also covers Efflorescence
 * (Efflo follows the Lifebloom target).
 */
class Lifebloom extends Analyzer {
  static dependencies = {
    combatants: Combatants,
    efflorescence: Efflorescence,
    hotTracker: HotTrackerRestoDruid,
  };

  protected combatants!: Combatants;
  protected efflorescence!: Efflorescence;
  protected hotTracker!: HotTrackerRestoDruid;

  /** list of time periods when lifebloom was active */
  lifebloomUptimes: OpenTimePeriod[] = [];
  private hasEverbloom = false;
  /** Rank 2+ unlocks splash healing that scales from the final bloom */
  private hasEverbloomSplash = false;
  private hasVerdancy = false;
  private hasLifetreading = false;
  private hasForestwalk = false;
  private hasBondWithNature = false;
  private hasVerdantHeart = false;
  private hasPhotosynthesis = false;
  private hasRampantGrowth = false;
  private showCastPanel = false;
  private hasActiveLifebloom = false;
  activeLifebloomTarget: number | undefined = undefined;
  private possibleVerdancyBlooms = 0;
  private actualVerdancyBlooms = 0;
  private currentLifebloomStacks = 0;
  /** True once a Lifebloom duration aura has been applied this fight (including prepull). */
  private hadLifebloomBefore = false;

  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);

    this.hasEverbloom =
      this.selectedCombatant.hasTalent(TALENTS_DRUID.EVERBLOOM_1_RESTORATION_TALENT) ||
      this.selectedCombatant.hasTalent(TALENTS_DRUID.EVERBLOOM_2_RESTORATION_TALENT) ||
      this.selectedCombatant.hasTalent(TALENTS_DRUID.EVERBLOOM_3_RESTORATION_TALENT);
    this.hasEverbloomSplash =
      this.selectedCombatant.hasTalent(TALENTS_DRUID.EVERBLOOM_2_RESTORATION_TALENT) ||
      this.selectedCombatant.hasTalent(TALENTS_DRUID.EVERBLOOM_3_RESTORATION_TALENT);
    this.hasVerdancy = this.selectedCombatant.hasTalent(TALENTS_DRUID.VERDANCY_TALENT);
    this.hasLifetreading = this.selectedCombatant.hasTalent(TALENTS_DRUID.LIFETREADING_TALENT);
    this.hasForestwalk = this.selectedCombatant.hasTalent(TALENTS_DRUID.FORESTWALK_TALENT);
    this.hasBondWithNature = this.selectedCombatant.hasTalent(
      TALENTS_DRUID.BOND_WITH_NATURE_TALENT,
    );
    this.hasVerdantHeart = this.selectedCombatant.hasTalent(TALENTS_DRUID.VERDANT_HEART_TALENT);
    this.hasPhotosynthesis = this.selectedCombatant.hasTalent(TALENTS_DRUID.PHOTOSYNTHESIS_TALENT);
    this.hasRampantGrowth = this.selectedCombatant.hasTalent(TALENTS_DRUID.RAMPANT_GROWTH_TALENT);
    this.showCastPanel = this.hasVerdancy || this.hasEverbloom;

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.LIFEBLOOM_HOT_HEAL),
      this.onLifebloomCast,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH),
      this.onOvergrowthRegrowth,
    );
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.LIFEBLOOM_BUFF),
      this.onApplyLifebloom,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.LIFEBLOOM_BUFF),
      this.onRemoveLifebloom,
    );
    this.addEventListener(
      Events.applybuffstack.by(SELECTED_PLAYER).spell(LIFEBLOOM_STACK_AURAS),
      this.onApplyLifebloomStack,
    );
    this.addEventListener(
      Events.changebuffstack.by(SELECTED_PLAYER).spell(LIFEBLOOM_STACK_AURAS),
      this.onChangeLifebloomStack,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.LIFEBLOOM_BUFF),
      this.onRefreshLifebloom,
    );
  }

  /** Remaining duration of 1227806 on the target at `timestamp`, or null if it is down. */
  private getLifebloomRemainingMs(targetId: number | undefined, timestamp: number): number | null {
    if (targetId === undefined) {
      return null;
    }
    const hot = this.hotTracker.hots[targetId]?.[SPELLS.LIFEBLOOM_BUFF.id];
    if (!hot) {
      return null;
    }
    // HotTracker may already consider the HoT expired a few ms before the removebuff.
    return Math.max(0, hot.end - timestamp);
  }

  onLifebloomCast(event: CastEvent) {
    this.gradeLifebloomUsage(event, false);
  }

  /** Nature's Swiftness + Regrowth applies Lifebloom. That is a refresh only if Lifebloom is already up. */
  onOvergrowthRegrowth(event: CastEvent) {
    if (!isOvergrowthRegrowth(event)) {
      return;
    }
    this.gradeLifebloomUsage(event, true);
  }

  private gradeLifebloomUsage(event: CastEvent, fromOvergrowth: boolean) {
    const castTarget = event.targetID ?? this.activeLifebloomTarget ?? this.selectedCombatant.id;
    // A swap is only when we know both targets and they differ. Missing targetID is common
    // on self-casts and must not be treated as moving Lifebloom.
    const isSwap =
      this.hasActiveLifebloom &&
      this.activeLifebloomTarget !== undefined &&
      event.targetID !== undefined &&
      event.targetID !== this.activeLifebloomTarget;

    let remainingMs = this.getLifebloomRemainingMs(castTarget, event.timestamp);
    if (remainingMs === null && this.hasActiveLifebloom && !isSwap) {
      // Duration aura is still up on this target; treat as a 0s refresh (pandemic), not a swap.
      remainingMs = 0;
    }

    this.recordGradedCast({
      timestamp: event.timestamp,
      targetID: castTarget,
      remainingMs,
      fromOvergrowth,
      isSwap,
    });
  }

  onApplyLifebloom(event: ApplyBuffEvent) {
    this.hadLifebloomBefore = true;
    this.currentLifebloomStacks = 1;
    this.activeLifebloomTarget = event.targetID;

    if (this.hasActiveLifebloom) {
      return;
    }

    this.hasActiveLifebloom = true;
    this.lifebloomUptimes.push({ start: event.timestamp });
  }

  onRemoveLifebloom(event: RemoveBuffEvent) {
    if (!this.hasActiveLifebloom) {
      return;
    }

    // Ignore Remove for a target that is no longer the active Lifebloom target
    // (happens during target swaps when the new Apply arrives before the old Remove)
    if (event.targetID !== this.activeLifebloomTarget) {
      return;
    }

    this.hasActiveLifebloom = false;
    this.activeLifebloomTarget = undefined;
    this.currentLifebloomStacks = 0;
    if (this.lifebloomUptimes.length > 0) {
      this.lifebloomUptimes[this.lifebloomUptimes.length - 1].end = event.timestamp;
    }
  }

  onApplyLifebloomStack(event: ApplyBuffStackEvent) {
    this.currentLifebloomStacks = event.stack;
  }

  onChangeLifebloomStack(event: ChangeBuffStackEvent) {
    this.currentLifebloomStacks = event.newStacks;
  }

  private recordGradedCast({
    timestamp,
    targetID,
    remainingMs,
    fromOvergrowth,
    isSwap,
  }: {
    timestamp: number;
    targetID: number | undefined;
    remainingMs: number | null;
    fromOvergrowth: boolean;
    isSwap: boolean;
  }) {
    if (!this.showCastPanel) {
      return;
    }

    const targetName =
      targetID !== undefined ? (this.combatants.players[targetID]?.name ?? 'unknown') : 'unknown';

    let value: QualitativePerformance;
    let text: string;

    if (isSwap) {
      value = QualitativePerformance.Fail;
      text = t({
        id: 'restoration.lifebloom.target_swap',
        message: 'Moved Lifebloom to a new target',
      });
    } else if (remainingMs === null) {
      // Overgrowth applies Lifebloom when it is down; that is not a failed refresh.
      // A Lifebloom hardcast after a drop is still a miss.
      if (fromOvergrowth || !this.hadLifebloomBefore) {
        value = QualitativePerformance.Good;
        text = fromOvergrowth
          ? t({ id: 'restoration.lifebloom.applied', message: 'Applied Lifebloom' })
          : t({ id: 'restoration.lifebloom.fresh_cast', message: 'Fresh cast' });
      } else {
        value = QualitativePerformance.Fail;
        text = t({
          id: 'restoration.lifebloom.applied_without_maintaining',
          message: 'Reapplied Lifebloom after it faded',
        });
      }
    } else if (remainingMs <= LIFEBLOOM_PANDEMIC_MS) {
      value = QualitativePerformance.Good;
      text = t(
        { id: 'restoration.lifebloom.refreshed_in_pandemic', message: 'Refreshed in pandemic window ({seconds}s remaining)' },
        { seconds: (remainingMs / 1000).toFixed(1) },
      );
    } else {
      value = QualitativePerformance.Ok;
      text = t(
        { id: 'restoration.lifebloom.refreshed_before_pandemic', message: 'Refreshed earlier than pandemic ({seconds}s remaining)' },
        { seconds: (remainingMs / 1000).toFixed(1) },
      );
    }

    if (fromOvergrowth) {
      text += t({ id: 'restoration.lifebloom.overgrowth_suffix', message: ' (Overgrowth)' });
    }

    DEBUG &&
      console.log(
        `LB grade @ ${this.owner.formatTimestamp(timestamp, 1)}: ${text} remaining=${remainingMs}`,
      );

    this.castEntries.push({
      value,
      tooltip: (
        <>
          @ <strong>{this.owner.formatTimestamp(timestamp)}</strong> - {text}
          <br />
          {t({ id: 'restoration.lifebloom.cast_tooltip_targetting', message: 'targetting ' })}
          <strong>{targetName}</strong>
        </>
      ),
    });
  }

  onRefreshLifebloom(event: RefreshBuffEvent) {
    const bloomed = causedBloom(event);

    if (getHardcast(event) || isFromOvergrowth(event)) {
      this.possibleVerdancyBlooms += 1;
      if (bloomed) {
        this.actualVerdancyBlooms += 1;
      }
    }
  }

  /** The time at least one lifebloom was active */
  get lifebloomUptime() {
    return this._getTotalUptime(this.lifebloomUptimes);
  }

  /** Guide subsection describing the proper usage of Lifebloom (and Efflo when Lifetreading) */
  get guideSubsection(): JSX.Element {
    return this.getGuideSubsection(false);
  }

  getGuideSubsection(isAdvanced: boolean): JSX.Element {
    const healingAmps = this.healingReceivedAmpTalents;

    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={SPELLS.LIFEBLOOM_HOT_HEAL} />
          </b>{' '}
          {t({
            id: 'restoration.lifebloom.explanation_p1',
            message: 'belongs on yourself. Aim for 100% uptime, and keep other HoTs stacked with it',
          })}
          {this.hasEverbloom ? (
            <>
              {t({ id: 'restoration.lifebloom.explanation_everbloom', message: '. We do this to maximize ' })}
              <SpellLink
                spell={
                  this.hasEverbloomSplash
                    ? TALENTS_DRUID.EVERBLOOM_2_RESTORATION_TALENT
                    : TALENTS_DRUID.EVERBLOOM_1_RESTORATION_TALENT
                }
              />
              {t({ id: 'restoration.lifebloom.explanation_everbloom_2', message: ' healing' })}
            </>
          ) : null}
          {t({
            id: 'restoration.lifebloom.explanation_p2',
            message:
              ". If uptime is a recurring issue, consider adjusting your UI so it's more obvious when Lifebloom falls off. ",
          })}
          <SpellLink spell={TALENTS_DRUID.OVERGROWTH_TALENT} />
          {t({
            id: 'restoration.lifebloom.explanation_overgrowth',
            message:
              " (Nature's Swiftness + Regrowth) is graded as a Lifebloom refresh when Lifebloom is already up, or as an apply when it is not.",
          })}
        </p>
        {isAdvanced && (
          <p>
            {t({
              id: 'restoration.lifebloom.explanation_advanced_p1',
              message:
                'Refresh Lifebloom (and any other HoT) when it has about 5–6 seconds left. That pandemic window extends the HoT with no duration penalty. Refreshing much earlier or moving Lifebloom to another target skips the bloom',
            })}
            {(this.hasEverbloom || this.hasVerdancy) && (
              <>
                {t({ id: 'restoration.lifebloom.explanation_advanced_costing', message: ', costing' })}
                {this.hasEverbloom && (
                  <>
                    {' '}
                    <SpellLink
                      spell={
                        this.hasEverbloomSplash
                          ? TALENTS_DRUID.EVERBLOOM_2_RESTORATION_TALENT
                          : TALENTS_DRUID.EVERBLOOM_1_RESTORATION_TALENT
                      }
                    />
                  </>
                )}
                {this.hasEverbloom &&
                  this.hasVerdancy &&
                  t({ id: 'restoration.lifebloom.explanation_advanced_and', message: ' and' })}
                {this.hasVerdancy && (
                  <>
                    {this.hasEverbloom ? ' ' : ' '}
                    <SpellLink spell={TALENTS_DRUID.VERDANCY_TALENT} />
                  </>
                )}
                {t({ id: 'restoration.lifebloom.explanation_advanced_value', message: ' value' })}
              </>
            )}
            .
          </p>
        )}
        {isAdvanced && this.hasEverbloom && (
          <p>
            <SpellLink
              spell={
                this.hasEverbloomSplash
                  ? TALENTS_DRUID.EVERBLOOM_2_RESTORATION_TALENT
                  : TALENTS_DRUID.EVERBLOOM_1_RESTORATION_TALENT
              }
            />
            {t({
              id: 'restoration.lifebloom.everbloom_advanced_p1',
              message: ' does AoE healing whenever Lifebloom blooms, and that splash scales with ',
            })}
            <SpellLink spell={SPELLS.MASTERY_HARMONY} />
            {t({
              id: 'restoration.lifebloom.everbloom_advanced_p2',
              message: ' stacks on the Lifebloom target. Keep Lifebloom on yourself',
            })}
            {healingAmps.length > 0 ? (
              <>
                {t({ id: 'restoration.lifebloom.everbloom_advanced_since', message: ', since ' })}
                {this.renderTalentList(healingAmps)}
                {t({
                  id: 'restoration.lifebloom.everbloom_advanced_increase',
                  message: ' all increase the healing you receive',
                })}
                {this.hasEverbloomSplash ? (
                  <>
                    {t({
                      id: 'restoration.lifebloom.everbloom_advanced_splash_strongest',
                      message: ', making the splash strongest when it blooms on you',
                    })}
                  </>
                ) : null}
              </>
            ) : this.hasEverbloomSplash ? (
              <>
                {t({
                  id: 'restoration.lifebloom.everbloom_advanced_splash_strong',
                  message: ' so the splash is as strong as possible',
                })}
              </>
            ) : null}
            {t({
              id: 'restoration.lifebloom.everbloom_advanced_p3',
              message: '. Avoid moving it unless you have to, since swapping also resets its stacks.',
            })}
          </p>
        )}
        {isAdvanced && this.hasPhotosynthesis && (
          <p>
            <SpellLink spell={TALENTS_DRUID.PHOTOSYNTHESIS_TALENT} />
            {t({
              id: 'restoration.lifebloom.photosynthesis_p1',
              message:
                ' gives HoTs on the Lifebloom target an extra chance to cause a bloom, which is another reason to keep Rejuvenation',
            })}
            {this.selectedCombatant.hasTalent(TALENTS_DRUID.GERMINATION_TALENT) ? (
              <>
                {t({ id: 'restoration.lifebloom.photosynthesis_and', message: ' and ' })}
                <SpellLink spell={TALENTS_DRUID.GERMINATION_TALENT} />
              </>
            ) : null}
            {t({ id: 'restoration.lifebloom.photosynthesis_p2', message: ' on yourself.' })}
          </p>
        )}
        {this.hasLifetreading && (
          <p>
            {t({ id: 'restoration.lifebloom.lifetreading_p1', message: 'With ' })}
            <SpellLink spell={TALENTS_DRUID.LIFETREADING_TALENT} />
            {t({ id: 'restoration.lifebloom.lifetreading_p2', message: ', ' })}
            <SpellLink spell={SPELLS.EFFLORESCENCE_CAST} />
            {t({
              id: 'restoration.lifebloom.lifetreading_p3',
              message:
                " follows your Lifebloom target. Since that's usually you, think of your feet as your Efflorescence placement. Stay stacked with the raid so Efflorescence",
            })}
            {this.hasVerdancy ? (
              <>
                {t({ id: 'restoration.lifebloom.lifetreading_and', message: ' and ' })}
                <SpellLink spell={TALENTS_DRUID.VERDANCY_TALENT} />
              </>
            ) : null}{' '}
            {t({ id: 'restoration.lifebloom.lifetreading_p4', message: ' can hit as many players as possible.' })}
          </p>
        )}
      </>
    );

    const data = (
      <div>
        {isAdvanced && this.showCastPanel && this.castEntries.length > 0 && (
          <CastSummaryAndBreakdown
            spell={SPELLS.LIFEBLOOM_HOT_HEAL}
            castEntries={this.castEntries}
            goodExtraExplanation={t({
              id: 'restoration.lifebloom.perf_pandemic_good',
              message: 'refresh Lifebloom in the pandemic window, or apply it with Overgrowth',
            })}
            okExtraExplanation={t({
              id: 'restoration.lifebloom.perf_pandemic_ok',
              message: 'refresh Lifebloom earlier than pandemic',
            })}
            badExtraExplanation={t({
              id: 'restoration.lifebloom.perf_pandemic_bad',
              message: 'hardcast Lifebloom after letting it drop completely',
            })}
          />
        )}
        <RoundedPanel>
          <strong>
            {this.hasLifetreading
              ? t({
                  id: 'restoration.lifebloom.uptimes_title_lifetreading',
                  message: 'Lifebloom and Efflorescence uptimes',
                })
              : t({ id: 'restoration.lifebloom.uptimes_title', message: 'Lifebloom uptimes' })}
          </strong>
          {this.subStatistic()}
          {this.hasLifetreading && this.efflorescence.subStatistic()}
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  get hasEverbloomRank1Effective() {
    return this.hasEverbloom;
  }

  get lifebloomStacks() {
    return this.currentLifebloomStacks;
  }

  _getTotalUptime(uptimes: OpenTimePeriod[]) {
    return uptimes.reduce(
      (acc, ut) => acc + (ut.end === undefined ? this.owner.currentTimestamp : ut.end) - ut.start,
      0,
    );
  }

  hasActiveLifebloomAt(timestamp: number): boolean {
    return this.lifebloomUptimes.some(
      (uptime) =>
        uptime.start <= timestamp && (uptime.end === undefined || uptime.end >= timestamp),
    );
  }

  private get healingReceivedAmpTalents(): Talent[] {
    const amps: Talent[] = [];
    if (this.hasForestwalk) {
      amps.push(TALENTS_DRUID.FORESTWALK_TALENT);
    }
    if (this.hasBondWithNature) {
      amps.push(TALENTS_DRUID.BOND_WITH_NATURE_TALENT);
    }
    if (this.hasVerdantHeart) {
      amps.push(TALENTS_DRUID.VERDANT_HEART_TALENT);
    }
    return amps;
  }

  private renderTalentList(talents: Talent[]): ReactNode {
    return talents.map((spell, index) => (
      <Fragment key={spell.id}>
        {index > 0 &&
          (index === talents.length - 1
            ? talents.length === 2
              ? t({ id: 'restoration.lifebloom.list_and', message: ' and ' })
              : t({ id: 'restoration.lifebloom.list_oxford', message: ', and ' })
            : t({ id: 'restoration.lifebloom.list_comma', message: ', ' }))}
        <SpellLink spell={spell} />
      </Fragment>
    ));
  }

  subStatistic() {
    return uptimeBarSubStatistic(
      this.owner.fight,
      {
        spells: [SPELLS.LIFEBLOOM_BUFF],
        uptimes: mergeTimePeriods(this.lifebloomUptimes, this.owner.currentTimestamp),
        color: LB_COLOR,
      },
      [],
      SubPercentageStyle.ABSOLUTE,
    );
  }
}

export default Lifebloom;
