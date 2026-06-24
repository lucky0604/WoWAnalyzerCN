import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/deathknight';
import { SpellLink } from 'interface';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { Options, SELECTED_PLAYER, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  DamageEvent,
  FightEndEvent,
  RemoveBuffEvent,
} from 'parser/core/Events';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Enemies from 'parser/shared/modules/Enemies';
import ExecuteHelper from 'parser/shared/modules/helpers/ExecuteHelper';
import Abilities from 'parser/core/modules/Abilities';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
// oxlint-disable wowanalyzer/lingui-t-macro-outside-jsx
import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import SpellUsable from '../core/SpellUsable';

const SOUL_REAPER_EXECUTE_THRESHOLD = 0.35;
const SOUL_REAPER_COOLDOWN_MS = 15_000;
const SOUL_REAPER_NEXT_DT_BAD_WINDOW_MS = 15_000;
const ATTRIBUTED_PLAYER_DAMAGE_SPELL_IDS = new Set([
  SPELLS.DREAD_PLAGUE.id,
  SPELLS.VIRULENT_PLAGUE.id,
]);

interface SoulReaperCastRecord {
  timestamp: number;
  darkTransformationWindowId: number | null;
  putrefyChargesAtCast: number;
}

interface MissedFreeSoulReaperRecord {
  timestamp: number;
  darkTransformationWindowId: number;
}

class SoulReaper extends ExecuteHelper.withDependencies({
  spellUsable: SpellUsable,
  enemies: Enemies,
  abilities: Abilities,
}) {
  public static readonly executeSources = SELECTED_PLAYER;
  public static readonly lowerThreshold = SOUL_REAPER_EXECUTE_THRESHOLD;
  public static readonly executeSpells = [TALENTS.SOUL_REAPER_TALENT];
  public static readonly countCooldownAsExecuteTime = false;

  maxCasts = 0;

  private dtWindowOpen = false;
  private debuffWindowDamage = 0;
  private currentDarkTransformationWindowId: number | null = null;
  private currentDarkTransformationStartedAt: number | null = null;
  private darkTransformationWindowIdCounter = 0;
  private readonly darkTransformationStartTimestamps: number[] = [];
  private readonly soulReaperCasts: SoulReaperCastRecord[] = [];
  private readonly missedFreeSoulReaperWindows: MissedFreeSoulReaperRecord[] = [];

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.SOUL_REAPER_TALENT);
    if (!this.active) {
      return;
    }

    // Dark Transformation window tracking — DT resets SR's cooldown and allows
    // one free cast on any target
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.DARK_TRANSFORMATION_BUFF),
      this.onDTApply,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.DARK_TRANSFORMATION_BUFF),
      this.onDTRemove,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.SOUL_REAPER_TALENT),
      this.onSRCast,
    );

    // Caster-only sources for debuff attribution.
    this.addEventListener(Events.damage.by(SELECTED_PLAYER), this.onPlayerDamage);

    // Include all pet damage in debuff attribution.
    this.addEventListener(Events.damage.by(SELECTED_PLAYER_PET), this.onPetDamage);
  }

  /**
   * Only consider a target "in execute range" for maxCasts purposes if the
   * player has Dread Plague applied to it.  This keeps trash adds — which may
   * spend their whole life below 35% HP — from inflating the execute window.
   */
  isTargetInHealthExecuteWindow(event: DamageEvent): boolean {
    if (!this.deps.enemies.getEntity(event)?.hasBuff(SPELLS.DREAD_PLAGUE.id)) {
      return false;
    }
    return super.isTargetInHealthExecuteWindow(event);
  }

  private onDTApply(_event: ApplyBuffEvent) {
    const darkTransformationWindowId = this.darkTransformationWindowIdCounter + 1;

    this.darkTransformationWindowIdCounter = darkTransformationWindowId;
    this.currentDarkTransformationWindowId = darkTransformationWindowId;
    this.currentDarkTransformationStartedAt = _event.timestamp;
    this.darkTransformationStartTimestamps.push(_event.timestamp);
    this.dtWindowOpen = true;
    this.maxCasts += 1;
  }

  private onDTRemove(event: RemoveBuffEvent) {
    this.closeDarkTransformationWindow(event.timestamp);
  }

  private getPutrefyChargesBeforeCast(timestamp: number): number {
    const putrefyStateBeforeCast = this.deps.spellUsable
      .history(TALENTS.PUTREFY_TALENT.id)
      .getBefore(timestamp, true);

    if (putrefyStateBeforeCast) {
      return putrefyStateBeforeCast.chargesAvailable;
    }

    return this.deps.abilities.getMaxCharges(TALENTS.PUTREFY_TALENT.id) || 1;
  }

  private onSRCast(event: CastEvent) {
    this.soulReaperCasts.push({
      timestamp: event.timestamp,
      darkTransformationWindowId: this.currentDarkTransformationWindowId,
      putrefyChargesAtCast: this.getPutrefyChargesBeforeCast(event.timestamp),
    });

    if (this.dtWindowOpen) {
      this.dtWindowOpen = false;
    }
  }

  private onPlayerDamage(event: DamageEvent) {
    if (
      this.deps.enemies.getEntity(event)?.hasBuff(SPELLS.SOUL_REAPER_DEBUFF.id) &&
      this.isAttributedPlayerDamage(event)
    ) {
      this.addDebuffWindowDamage(event);
    }
  }

  private onPetDamage(event: DamageEvent) {
    if (this.deps.enemies.getEntity(event)?.hasBuff(SPELLS.SOUL_REAPER_DEBUFF.id)) {
      this.addDebuffWindowDamage(event);
    }
  }

  private addDebuffWindowDamage(event: DamageEvent) {
    this.debuffWindowDamage += calculateEffectiveDamage(event, 0.2);
  }

  private isAttributedPlayerDamage(event: DamageEvent): boolean {
    if (ATTRIBUTED_PLAYER_DAMAGE_SPELL_IDS.has(event.ability.guid)) {
      return true;
    }

    // Putrefy can appear with multiple damage IDs; match by spell name.
    return event.ability.name === TALENTS.PUTREFY_TALENT.name;
  }

  private closeDarkTransformationWindow(fallbackTimestamp: number) {
    const darkTransformationWindowId = this.currentDarkTransformationWindowId;
    const darkTransformationStartedAt = this.currentDarkTransformationStartedAt;
    this.currentDarkTransformationWindowId = null;
    this.currentDarkTransformationStartedAt = null;
    if (!this.dtWindowOpen || darkTransformationWindowId === null) {
      return;
    }

    this.missedFreeSoulReaperWindows.push({
      darkTransformationWindowId,
      timestamp: darkTransformationStartedAt ?? fallbackTimestamp,
    });
    this.dtWindowOpen = false;
  }

  private isTimestampDuringExecute(timestamp: number): boolean {
    return this.executeRanges.some(
      (range) => range.startEvent.timestamp <= timestamp && timestamp <= range.endEvent.timestamp,
    );
  }

  private getFreeDarkTransformationCastsDuringExecute(): number {
    const countedWindows = new Set<number>();

    for (const cast of this.soulReaperCasts) {
      if (cast.darkTransformationWindowId === null) {
        continue;
      }

      if (countedWindows.has(cast.darkTransformationWindowId)) {
        continue;
      }

      if (!this.isTimestampDuringExecute(cast.timestamp)) {
        continue;
      }

      countedWindows.add(cast.darkTransformationWindowId);
    }

    return countedWindows.size;
  }

  onFightEnd(event: FightEndEvent) {
    super.onFightEnd(event);
    this.maxCasts += Math.ceil(this.totalExecuteDuration / SOUL_REAPER_COOLDOWN_MS);
    this.maxCasts -= this.getFreeDarkTransformationCastsDuringExecute();
    this.closeDarkTransformationWindow(event.timestamp);
  }

  private getNextDarkTransformationTimestamp(
    castTimestamp: number,
    nextDarkTransformationIndex: number,
  ): { nextDarkTransformationIndex: number; nextDarkTransformationTimestamp: number | null } {
    let nextIndex = nextDarkTransformationIndex;
    while (
      nextIndex < this.darkTransformationStartTimestamps.length &&
      this.darkTransformationStartTimestamps[nextIndex] <= castTimestamp
    ) {
      nextIndex += 1;
    }

    return {
      nextDarkTransformationIndex: nextIndex,
      nextDarkTransformationTimestamp: this.darkTransformationStartTimestamps[nextIndex] ?? null,
    };
  }

  private formatSeconds(durationMs: number): string {
    return (durationMs / 1000).toFixed(1);
  }

  private getDarkTransformationCooldownRemaining(
    castTimestamp: number,
    nextDarkTransformationTimestamp: number | null,
  ): string {
    const darkTransformationCooldownState = this.deps.spellUsable
      .history(TALENTS.DARK_TRANSFORMATION_TALENT.id)
      .getBefore(castTimestamp, true);

    const remainingMs = darkTransformationCooldownState?.isOnCooldown
      ? darkTransformationCooldownState.expectedRechargeTimestamp - castTimestamp
      : nextDarkTransformationTimestamp === null
        ? 0
        : Math.min(
            SOUL_REAPER_COOLDOWN_MS,
            Math.max(0, nextDarkTransformationTimestamp - castTimestamp),
          );

    return `${this.formatSeconds(Math.max(0, remainingMs))}s`;
  }

  private getDarkTransformationAssessment(
    darkTransformationWindowId: number,
    firstCastInDarkTransformationWindows: Set<number>,
  ): { assessment: JSX.Element; performance: QualitativePerformance } {
    const firstCastInWindow = !firstCastInDarkTransformationWindows.has(darkTransformationWindowId);
    firstCastInDarkTransformationWindows.add(darkTransformationWindowId);

    return {
      performance: QualitativePerformance.Good,
      assessment: firstCastInWindow ? (
        <>
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.firstFreeCast.p1',
            message: 'You used your free ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.firstFreeCast.p2',
            message: ' during ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
        </>
      ) : (
        <>
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.cooldownCast.p1',
            message: 'You used ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.cooldownCast.p2',
            message: ' on cooldown during ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
        </>
      ),
    };
  }

  private getOutsideDarkTransformationAssessment(
    cast: SoulReaperCastRecord,
    nextDarkTransformationTimestamp: number | null,
  ): { assessment: JSX.Element; performance: QualitativePerformance } {
    const usedWithinNextDarkTransformationWindow =
      nextDarkTransformationTimestamp !== null &&
      nextDarkTransformationTimestamp - cast.timestamp <= SOUL_REAPER_NEXT_DT_BAD_WINDOW_MS;
    const usedWithPutrefyStacks = cast.putrefyChargesAtCast > 0;

    if (!usedWithPutrefyStacks && !usedWithinNextDarkTransformationWindow) {
      return {
        performance: QualitativePerformance.Good,
        assessment: (
          <>
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.noStacksNoDt.p1',
              message: 'You used ',
            })}
            <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.noStacksNoDt.p2',
              message: ' without Putrefy stacks outside ',
            })}
            <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
          </>
        ),
      };
    }

    if (usedWithPutrefyStacks && usedWithinNextDarkTransformationWindow) {
      return {
        performance: QualitativePerformance.Fail,
        assessment: (
          <>
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksAndDtSoon.p1',
              message: 'You used ',
            })}
            <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksAndDtSoon.p2',
              message: ' outside ',
            })}
            <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksAndDtSoon.p3',
              message: ' with available ',
            })}
            <SpellLink spell={TALENTS.PUTREFY_TALENT} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksAndDtSoon.p4',
              message: ' stacks and less than 15s until your next ',
            })}
            <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
          </>
        ),
      };
    }

    if (usedWithPutrefyStacks) {
      return {
        performance: QualitativePerformance.Fail,
        assessment: (
          <>
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksOutsideDt.p1',
              message: 'You used ',
            })}
            <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksOutsideDt.p2',
              message: ' with stacks from ',
            })}
            <SpellLink spell={TALENTS.PUTREFY_TALENT} />
            {t({
              id: 'deathknight.unholy.soulReaper.assessment.stacksOutsideDt.p3',
              message: ' outside ',
            })}
            <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
          </>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      assessment: (
        <>
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.dtSoon.p1',
            message: 'You used ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.assessment.dtSoon.p2',
            message: ' within 15s of your next ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
        </>
      ),
    };
  }

  private getCastAssessment(
    cast: SoulReaperCastRecord,
    firstCastInDarkTransformationWindows: Set<number>,
    nextDarkTransformationTimestamp: number | null,
  ): { assessment: JSX.Element; performance: QualitativePerformance } {
    if (cast.darkTransformationWindowId !== null) {
      return this.getDarkTransformationAssessment(
        cast.darkTransformationWindowId,
        firstCastInDarkTransformationWindows,
      );
    }

    return this.getOutsideDarkTransformationAssessment(cast, nextDarkTransformationTimestamp);
  }

  private buildCastStats(
    windowLabel: string,
    putrefyStacks: number | '-',
    darkTransformationCooldownRemaining: string,
    putrefyTooltip: JSX.Element = (
      <>
        {t({
          id: 'deathknight.unholy.soulReaper.stats.putrefyTooltip.p1',
          message: 'Estimated ',
        })}
        <SpellLink spell={TALENTS.PUTREFY_TALENT} />
        {t({
          id: 'deathknight.unholy.soulReaper.stats.putrefyTooltip.p2',
          message: ' charges available when ',
        })}
        <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
        {t({
          id: 'deathknight.unholy.soulReaper.stats.putrefyTooltip.p3',
          message: ' was cast.',
        })}
      </>
    ),
  ) {
    return [
      {
        value: windowLabel,
        label: t({
          id: 'deathknight.unholy.soulReaper.stats.window',
          message: 'Window',
        }),
      },
      {
        value: putrefyStacks,
        label: t({
          id: 'deathknight.unholy.soulReaper.stats.putrefyStacks',
          message: 'Putrefy stacks',
        }),
        tooltip: putrefyTooltip,
      },
      {
        value: darkTransformationCooldownRemaining,
        label: t({
          id: 'deathknight.unholy.soulReaper.stats.dtCdRemaining',
          message: 'DT CD remaining',
        }),
      },
    ];
  }

  private buildCastDetails(): PerCastData[] {
    const details: { timestamp: number; data: PerCastData }[] = [];
    const firstCastInDarkTransformationWindows = new Set<number>();

    let nextDarkTransformationIndex = 0;
    for (const cast of this.soulReaperCasts) {
      const darkTransformationContext = this.getNextDarkTransformationTimestamp(
        cast.timestamp,
        nextDarkTransformationIndex,
      );
      nextDarkTransformationIndex = darkTransformationContext.nextDarkTransformationIndex;

      const castAssessment = this.getCastAssessment(
        cast,
        firstCastInDarkTransformationWindows,
        darkTransformationContext.nextDarkTransformationTimestamp,
      );
      const inDarkTransformation = cast.darkTransformationWindowId !== null;
      const darkTransformationCooldownRemaining = inDarkTransformation
        ? t({
            id: 'deathknight.unholy.soulReaper.casts.active',
            message: 'Active',
          })
        : this.getDarkTransformationCooldownRemaining(
            cast.timestamp,
            darkTransformationContext.nextDarkTransformationTimestamp,
          );

      details.push({
        timestamp: cast.timestamp,
        data: {
          performance: castAssessment.performance,
          timestamp: this.owner.formatTimestamp(cast.timestamp),
          stats: this.buildCastStats(
            inDarkTransformation
              ? t({
                  id: 'deathknight.unholy.soulReaper.casts.duringDt',
                  message: 'During DT',
                })
              : t({
                  id: 'deathknight.unholy.soulReaper.casts.outsideDt',
                  message: 'Outside DT',
                }),
            cast.putrefyChargesAtCast,
            darkTransformationCooldownRemaining,
          ),
          details: castAssessment.assessment,
        },
      });
    }

    for (const missedFreeSoulReaperWindow of this.missedFreeSoulReaperWindows) {
      details.push({
        timestamp: missedFreeSoulReaperWindow.timestamp,
        data: {
          performance: QualitativePerformance.Fail,
          timestamp: this.owner.formatTimestamp(missedFreeSoulReaperWindow.timestamp),
          stats: this.buildCastStats(
            t({
              id: 'deathknight.unholy.soulReaper.casts.duringDt',
              message: 'During DT',
            }),
            '-',
            t({
              id: 'deathknight.unholy.soulReaper.casts.active',
              message: 'Active',
            }),
            <>
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedTooltip.p1',
                message: 'No ',
              })}
              <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedTooltip.p2',
                message: ' cast happened in this ',
              })}
              <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedTooltip.p3',
                message: ' window.',
              })}
            </>,
          ),
          details: (
            <>
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedDetails.p1',
                message: 'You did not cast your free ',
              })}
              <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedDetails.p2',
                message: ' during this ',
              })}
              <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
              {t({
                id: 'deathknight.unholy.soulReaper.casts.missedDetails.p3',
                message: ' window.',
              })}
            </>
          ),
        },
      });
    }

    details.sort((a, b) => a.timestamp - b.timestamp);

    return details.map((entry) => entry.data);
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <strong>
            <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          </strong>{' '}
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p1',
            message: 'should be prioritized during ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p1.p2',
            message: ' and managed carefully outside of it.',
          })}
        </p>
        <p>
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p2.p1',
            message: 'During each ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p2.p2',
            message: ' window, always spend the free ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p2.p3',
            message: ' cast, then continue using ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p2.p4',
            message: ' on cooldown while the window remains active.',
          })}
        </p>
        <p>
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p3.p1',
            message: 'Outside ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p3.p2',
            message: ', use ',
          })}
          <SpellLink spell={TALENTS.SOUL_REAPER_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p3.p3',
            message: ' only when you do not have stacks from ',
          })}
          <SpellLink spell={TALENTS.PUTREFY_TALENT} />
          {t({
            id: 'deathknight.unholy.soulReaper.guide.explanation.p3.p4',
            message: ' available and you are not within 15 seconds of your next ',
          })}
          <SpellLink spell={SPELLS.DARK_TRANSFORMATION_BUFF} />.
        </p>
      </>
    );

    const data = (
      <CastDetail
        title={t({
          id: 'deathknight.unholy.soulReaper.guide.castDetailTitle',
          message: 'Soul Reaper Casts',
        })}
        casts={this.buildCastDetails()}
      />
    );

    return explanationAndDataSubsection(explanation, data, 40);
  }

  statistic() {
    const debuffBonus = this.debuffWindowDamage;
    const directDamage = this.executeDamage;
    const totalGain = directDamage + debuffBonus;

    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(30)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
      >
        <BoringSpellValueText spell={TALENTS.SOUL_REAPER_TALENT}>
          <div>
            <ItemDamageDone amount={totalGain} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <small style={{ display: 'block' }}>
              {t({
                id: 'deathknight.unholy.soulReaper.statistic.breakdown',
                message: 'Breakdown',
              })}
            </small>
            <small style={{ display: 'block' }}>
              <ItemDamageDone amount={directDamage} displayPercentage={false} />{' '}
              {t({
                id: 'deathknight.unholy.soulReaper.statistic.abilityDamage',
                message: 'ability damage',
              })}
            </small>
            <small style={{ display: 'block' }}>
              <ItemDamageDone amount={debuffBonus} displayPercentage={false} />{' '}
              {t({
                id: 'deathknight.unholy.soulReaper.statistic.debuffBonus',
                message: 'debuff bonus (est.)',
              })}
            </small>
          </div>
          {this.missedFreeSoulReaperWindows.length > 0 && (
            <div>
              <span style={{ color: 'red' }}>{this.missedFreeSoulReaperWindows.length}</span>{' '}
              <small>
                {t({
                  id: 'deathknight.unholy.soulReaper.statistic.wastedDtWindow',
                  message: 'wasted Dark Transformation window',
                })}
                {this.missedFreeSoulReaperWindows.length > 1 ? 's' : ''}
              </small>
            </div>
          )}
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default SoulReaper;
