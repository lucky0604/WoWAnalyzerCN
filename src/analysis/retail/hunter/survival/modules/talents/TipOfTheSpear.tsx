import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, GetRelatedEvents, ResourceChangeEvent } from 'parser/core/Events';
import { KC_FOCUS_LINK } from '../../normalizers/KillCommandNormalizer';
import BuffStackTracker from 'parser/shared/modules/BuffStackTracker';
import BoringValueText from 'parser/ui/BoringValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import { PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { BadColor, GoodColor, OkColor } from 'interface/guide';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

const MAX_STACKS = 3;
const LOW_FOCUS_THRESHOLD = 30;
const HOWL_BUFFS = [
  SPELLS.HOWL_OF_THE_PACKLEADER_WYVERN,
  SPELLS.HOWL_OF_THE_PACKLEADER_BEAR,
  SPELLS.HOWL_OF_THE_PACKLEADER_BOAR,
];

class TipOfTheSpear extends BuffStackTracker {
  static trackedBuff = SPELLS.TIP_OF_THE_SPEAR_CAST;

  wastedStacks = 0;
  killCommandGenerationEntries: BoxRowEntry[] = [];
  killCommandCasts = 0;
  untippedCastEntries: BoxRowEntry[] = [];
  private firstCastSeen = false;

  private isPackLeader = false;
  private hasPrimalSurge = false;
  private hasTwinFangs = false;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.KILL_COMMAND_SURVIVAL_TALENT);
    if (!this.active) {
      return;
    }

    this.isPackLeader = this.selectedCombatant.hasTalent(TALENTS.HOWL_OF_THE_PACK_LEADER_TALENT);
    this.hasPrimalSurge = this.selectedCombatant.hasTalent(TALENTS.PRIMAL_SURGE_TALENT);
    this.hasTwinFangs = this.selectedCombatant.hasTalent(TALENTS.TWIN_FANGS_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.KILL_COMMAND_SURVIVAL_TALENT),
      this.onKillCommandCast,
    );

    // Build the list of tippable spells to track (only untipped casts will be flagged).
    // Kill Command cannot be tipped. Raptor Strike can go untipped
    // Takedown WITHOUT Twin Fangs should be tipped
    // Takedown WITH Twin Fangs generates tip stacks, so you cast it at 0 tips
    const tippableSpells: Array<{ id: number }> = [TALENTS.WILDFIRE_BOMB_TALENT];
    if (this.selectedCombatant.hasTalent(TALENTS.BOOMSTICK_TALENT)) {
      tippableSpells.push(TALENTS.BOOMSTICK_TALENT);
    }
    if (this.selectedCombatant.hasTalent(TALENTS.RAPTOR_SWIPE_1_SURVIVAL_TALENT)) {
      tippableSpells.push(SPELLS.RAPTOR_SWIPE_DAMAGE);
    }
    if (!this.hasTwinFangs && this.selectedCombatant.hasTalent(TALENTS.TAKEDOWN_TALENT)) {
      tippableSpells.push(TALENTS.TAKEDOWN_TALENT);
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(tippableSpells),
      this.onTippableCast,
    );
  }

  private getFocus(event: CastEvent): number {
    return event.classResources?.find((r) => r.type === RESOURCE_TYPES.FOCUS.id)?.amount ?? 0;
  }

  private onTippableCast = (event: CastEvent) => {
    const wasTipped = this.selectedCombatant.hasBuff(
      SPELLS.TIP_OF_THE_SPEAR_CAST.id,
      event.timestamp,
    );

    // Nothing to flag if tipped
    if (wasTipped) {
      return;
    }

    // Pre-pull WFB: first bomb cast within 5s of fight start is thrown before melee range.
    if (
      event.ability.guid === TALENTS.WILDFIRE_BOMB_TALENT.id &&
      !this.firstCastSeen &&
      event.timestamp - this.owner.fight.start_time <= 5_000
    ) {
      this.firstCastSeen = true;
      return;
    }
    this.firstCastSeen = true;

    // Wildfire Bomb exception for pack leader: low focus is a valid reason to bomb untipped
    // (KC is likely also on cooldown when you're that focus-starved).
    if (event.ability.guid === TALENTS.WILDFIRE_BOMB_TALENT.id && this.isPackLeader) {
      if (this.getFocus(event) < LOW_FOCUS_THRESHOLD) {
        return;
      }
    }

    // Opener Boomstick: cast untipped within the first 10 seconds to buff Mongoose Fury stacks
    // heading into Takedown — this is correct play and should not be flagged.
    if (
      event.ability.guid === TALENTS.BOOMSTICK_TALENT.id &&
      event.timestamp - this.owner.fight.start_time <= 10_000
    ) {
      return;
    }

    const targetName = this.owner.getTargetName(event);
    const tooltip = (
      <div>
        <h5 style={{ color: BadColor }}>
          {t({
            id: 'hunter.survival.tipOfTheSpear.castWithoutTip',
            message: '{abilityName} cast without Tip of the Spear.',
            values: { abilityName: event.ability.name },
          })}
        </h5>
        <>
          <strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
          {t({
            id: 'hunter.survival.tipOfTheSpear.targeting.p1',
            message: ' targeting ',
          })}
          <strong>{targetName || 'unknown'}</strong>
        </>
      </div>
    );

    this.untippedCastEntries.push({ value: QualitativePerformance.Fail, tooltip });
  };

  private onKillCommandCast = (event: CastEvent) => {
    this.killCommandCasts += 1;
    const currentStacks = this.current;
    const stacksGained = this.hasPrimalSurge ? 2 : 1;
    const potentialStacks = currentStacks + stacksGained;

    if (potentialStacks > MAX_STACKS) {
      this.wastedStacks += potentialStacks - MAX_STACKS;
    }

    const focusEvents = GetRelatedEvents(event, KC_FOCUS_LINK) as ResourceChangeEvent[];
    const focusEvent = focusEvents[0];
    // amount is post-generation; subtract effective focus gained to recover pre-cast focus.
    const preCastFocus = focusEvent
      ? this.getFocus(event) - (focusEvent.resourceChange - focusEvent.waste)
      : this.getFocus(event);
    const isLowFocus = preCastFocus < LOW_FOCUS_THRESHOLD;

    const hasHowlBuff = HOWL_BUFFS.some((spell) =>
      this.selectedCombatant.hasBuff(spell.id, event.timestamp),
    );

    let value: QualitativePerformance;
    let header: string;
    let color: string;

    if (isLowFocus) {
      // Low focus is always an acceptable reason to Kill Command regardless of stacks.
      value = QualitativePerformance.Good;
      header = t({
        id: 'hunter.survival.tipOfTheSpear.goodLowFocus',
        message: 'Good: low focus ({focus})',
        values: { focus: preCastFocus },
      });
      color = GoodColor;
    } else if (this.isPackLeader) {
      // Pack Leader rules:
      // With Howl buff active: 0–1 stacks is Good (Primal Surge generates 2, no waste).
      // Without Howl buff: 0–2 stacks is acceptable (without Primal Surge 0-1 with Primal Surge
      if (hasHowlBuff && currentStacks <= 1) {
        value = QualitativePerformance.Good;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.goodHowlActive',
          message: 'Good: Howl of the Pack Leader active, {stacksLabel} stack{suffix}.',
          values: { stacksLabel: currentStacks === 0 ? '0' : '1', suffix: currentStacks !== 1 ? 's' : '' },
        });
        color = GoodColor;
      } else if (!hasHowlBuff && currentStacks === 0) {
        value = QualitativePerformance.Good;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.goodZeroStacks',
          message: 'Good: generated at 0 stacks.',
        });
        color = GoodColor;
      } else if (!hasHowlBuff && currentStacks <= 2) {
        value = QualitativePerformance.Ok;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.okGenerated',
          message: 'Ok: generated at {stacks} stack{suffix}.',
          values: { stacks: currentStacks, suffix: currentStacks !== 1 ? 's' : '' },
        });
        color = OkColor;
      } else {
        value = QualitativePerformance.Fail;
        const wastedAmount = potentialStacks - MAX_STACKS;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.badGeneratedWasted',
          message: 'Bad: generated at {stacks} stacks, wasted {wasted} stack{suffix}.',
          values: { stacks: currentStacks, wasted: wastedAmount, suffix: wastedAmount !== 1 ? 's' : '' },
        });
        color = BadColor;
      }
    } else {
      // Sentinel rules: 0 stacks = Good, 1 stack = Ok, 2+ = Bad (wastage).
      if (currentStacks === 0) {
        value = QualitativePerformance.Good;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.goodZeroStacks',
          message: 'Good: generated at 0 stacks.',
        });
        color = GoodColor;
      } else if (currentStacks === 1) {
        value = QualitativePerformance.Ok;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.okOneStack',
          message: 'Ok: generated at 1 stack.',
        });
        color = OkColor;
      } else {
        value = QualitativePerformance.Fail;
        const wastedAmount = potentialStacks - MAX_STACKS;
        header = t({
          id: 'hunter.survival.tipOfTheSpear.badGeneratedWasted',
          message: 'Bad: generated at {stacks} stacks, wasted {wasted} stack{suffix}.',
          values: { stacks: currentStacks, wasted: wastedAmount, suffix: wastedAmount !== 1 ? 's' : '' },
        });
        color = BadColor;
      }
    }

    const focusGained = focusEvent ? focusEvent.resourceChange - focusEvent.waste : 0;
    const focusWasted = focusEvent ? focusEvent.waste : 0;

    const targetName = this.owner.getTargetName(event);
    const tooltip = (
      <div>
        <h5 style={{ color }}>{header}</h5>
        <>
          <strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
          {t({
            id: 'hunter.survival.tipOfTheSpear.tooltipTargeting.p1',
            message: ' targeting ',
          })}
          <strong>{targetName || 'unknown'}</strong>
        </>
        <div>
          <>
            {t({
              id: 'hunter.survival.tipOfTheSpear.tooltipCurrentStacks.p1',
              message: 'Current stacks: ',
            })}
            <strong>{currentStacks}</strong>
            {t({
              id: 'hunter.survival.tipOfTheSpear.tooltipCurrentStacks.p2',
              message: ' → ',
            })}
            <strong>{Math.min(potentialStacks, MAX_STACKS)}</strong>
          </>
        </div>
        <div>
          <>
            {t({
              id: 'hunter.survival.tipOfTheSpear.tooltipFocus.p1',
              message: 'Focus before cast: ',
            })}
            <strong>{preCastFocus}</strong>
            {t({
              id: 'hunter.survival.tipOfTheSpear.tooltipFocus.p2',
              message: ' | Gained: ',
            })}
            <strong>{focusGained}</strong>
            {focusWasted > 0 && (
              <>
                {t({
                  id: 'hunter.survival.tipOfTheSpear.tooltipFocus.p3',
                  message: ' | Wasted: ',
                })}
                <strong>{focusWasted}</strong>
              </>
            )}
          </>
        </div>
        {this.hasPrimalSurge && (
          <div>
            <small>
              <>
                {t({
                  id: 'hunter.survival.tipOfTheSpear.tooltipPrimalSurge.p1',
                  message: '(With ',
                })}
                <SpellLink spell={TALENTS.PRIMAL_SURGE_TALENT} />
                {t({
                  id: 'hunter.survival.tipOfTheSpear.tooltipPrimalSurge.p2',
                  message: ', generates ',
                })}
                {stacksGained}
                {t({
                  id: 'hunter.survival.tipOfTheSpear.tooltipPrimalSurge.p3',
                  message: ' stacks)',
                })}
              </>
            </small>
          </div>
        )}
        {hasHowlBuff && (
          <div>
            <small>
              <Trans id="hunter.survival.tipOfTheSpear.tooltipHowlBuff">
                Howl of the Pack Leader buff active
              </Trans>
            </small>
          </div>
        )}
      </div>
    );

    this.killCommandGenerationEntries.push({ value, tooltip });
  };

  get guideSubsectionKillCommand() {
    const packLeaderExplanation = (
      <>
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideKcPackLeader.p1',
          message: ' Aim to Kill Command only at 0 stacks, or at most 1 stack if ',
        })}
        <SpellLink spell={TALENTS.HOWL_OF_THE_PACK_LEADER_TALENT} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideKcPackLeader.p2',
          message: ' is ready to spawn a beast.',
        })}
      </>
    );
    const sentinelExplanation = (
      <Trans id="hunter.survival.tipOfTheSpear.guideKcSentinel">
        {' '}
        Aim to Kill Command only at 0 stacks. 1 stack is acceptable; 2+ stacks wastes potential.
      </Trans>
    );

    const explanation = (
      <div>
        <p>
          <strong>
            <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} />
          </strong>
          {t({
            id: 'hunter.survival.tipOfTheSpear.guideKcExplanation.p1',
            message: ' generates ',
          })}
          <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
          {t({
            id: 'hunter.survival.tipOfTheSpear.guideKcExplanation.p2',
            message: ' stacks.',
          })}
          {this.isPackLeader ? packLeaderExplanation : sentinelExplanation}
        </p>
        <p>
          <Trans id="hunter.survival.tipOfTheSpear.guideKcLowFocus">
            {' '}
            Low focus (&lt;
            {LOW_FOCUS_THRESHOLD}) is always an acceptable reason to Kill Command.
          </Trans>
        </p>
      </div>
    );

    const data = (
      <CastSummaryAndBreakdown
        spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT}
        castEntries={this.killCommandGenerationEntries}
        badExtraExplanation={
          <Trans id="hunter.survival.tipOfTheSpear.kcBadExtraExplanation">
            and wasted Tip of the Spear stacks
          </Trans>
        }
      />
    );

    return explanationAndDataSubsection(explanation, data);
  }

  get guideSubsectionUntipped() {
    const takedownNote = this.hasTwinFangs ? (
      <>
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownTwinFangs.p1',
          message: ' With ',
        })}
        <SpellLink spell={TALENTS.TWIN_FANGS_TALENT} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownTwinFangs.p2',
          message: ', ',
        })}
        <SpellLink spell={TALENTS.TAKEDOWN_TALENT} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownTwinFangs.p3',
          message: ' generates ',
        })}
        <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownTwinFangs.p4',
          message: ' stacks but is excluded from this summary as it is often cast in response to an event occurring.',
        })}
      </>
    ) : (
      <>
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownNoTwinFangs.p1',
          message: ' ',
        })}
        <SpellLink spell={TALENTS.TAKEDOWN_TALENT} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedTakedownNoTwinFangs.p2',
          message: ' should be tipped in this build.',
        })}
      </>
    );

    const wfbPackLeaderNote = this.isPackLeader ? (
      <>
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedWfbPackLeader.p1',
          message: ' ',
        })}
        <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedWfbPackLeader.p2',
          message: ' cast with <',
        })}
        {LOW_FOCUS_THRESHOLD}
        {t({
          id: 'hunter.survival.tipOfTheSpear.guideUntippedWfbPackLeader.p3',
          message: ' focus while in Pack Leader is excused (KC is likely unavailable too).',
        })}
      </>
    ) : null;

    const explanation = (
      <>
        <p>
          <>
            {t({
              id: 'hunter.survival.tipOfTheSpear.guideUntippedExplanation.p1',
              message: 'Each entry below is a tippable ability cast ',
            })}
            <strong>
              {t({
                id: 'hunter.survival.tipOfTheSpear.guideUntippedExplanation.bold',
                message: 'without',
              })}
            </strong>
            {t({
              id: 'hunter.survival.tipOfTheSpear.guideUntippedExplanation.p2',
              message: ' ',
            })}
            <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
            {t({
              id: 'hunter.survival.tipOfTheSpear.guideUntippedExplanation.p3',
              message: '. These should be rare. ',
            })}
          </>
        </p>
        <p>
          {takedownNote}
          {wfbPackLeaderNote}
          {this.selectedCombatant.hasTalent(TALENTS.BOOMSTICK_TALENT) && (
            <>
              {t({
                id: 'hunter.survival.tipOfTheSpear.guideUntippedBoomstickOpener.p1',
                message: ' The opener ',
              })}
              <SpellLink spell={TALENTS.BOOMSTICK_TALENT} />
              {t({
                id: 'hunter.survival.tipOfTheSpear.guideUntippedBoomstickOpener.p2',
                message: ' (within the first 10s) is excused. It is cast untipped to build Mongoose Fury stacks before Takedown.',
              })}
            </>
          )}
        </p>
      </>
    );

    const data =
      this.untippedCastEntries.length === 0 ? (
        <p>
          <Trans id="hunter.survival.tipOfTheSpear.noUntippedCasts">
            No untipped casts — nice work!
          </Trans>
        </p>
      ) : (
        <div>
          <p>
            <>
              <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
              {t({
                id: 'hunter.survival.tipOfTheSpear.notActiveWhenCast',
                message: ' not active when cast:',
              })}
            </>
          </p>
          <PerformanceBoxRow values={this.untippedCastEntries} />
        </div>
      );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL()}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
      >
        <BoringValueText
          label={
            <>
              <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
              {t({
                id: 'hunter.survival.tipOfTheSpear.stacksWasted',
                message: ' stacks wasted',
              })}
            </>
          }
        >
          {this.wastedStacks} / {this.killCommandCasts}
        </BoringValueText>
      </Statistic>
    );
  }
}

export default TipOfTheSpear;
