import type { JSX } from 'react';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, HasAbility } from 'parser/core/Events';
import { BadColor, GoodColor } from 'interface/guide';
import { SpellLink } from 'interface';
import DonutChart from 'parser/ui/DonutChart';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import getResourceSpent from 'parser/core/getResourceSpent';
import { FINISHERS } from '../../constants';
import Finishers from '../features/Finishers';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/rogue';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import BetweenTheEyes from '../spells/BetweenTheEyes';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { ChecklistUsageInfo, SpellUse, spellUseToBoxRowEntry } from 'parser/core/SpellUsage/core';
import SpellUsageSubSection from 'parser/core/SpellUsage/SpellUsageSubSection';
import { createChecklistItem, createSpellUse } from 'parser/core/MajorCooldowns/MajorCooldown';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default class FinisherUse extends Analyzer {
  static dependencies = {
    finishers: Finishers,
    spellUsable: SpellUsable,
    betweenTheEyes: BetweenTheEyes,
  };

  protected finishers!: Finishers;
  protected spellUsable!: SpellUsable;
  protected betweenTheEyes!: BetweenTheEyes;

  totalFinisherCasts = 0;
  lowCpFinisherCasts = 0;
  spellUses: SpellUse[] = [];

  hasHiddenOpportunity = this.selectedCombatant.hasTalent(TALENTS.HIDDEN_OPPORTUNITY_TALENT);
  hasKeepItRolling = this.selectedCombatant.hasTalent(TALENTS.KEEP_IT_ROLLING_TALENT);

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(FINISHERS), this.onCast);
  }

  get maxCpFinishers() {
    return this.totalFinisherCasts - this.lowCpFinisherCasts;
  }

  get chart() {
    const items = [
      {
        color: GoodColor,
        label: t({ id: 'rogue.outlaw.finisherUse.maxCPFinishers', message: 'Max CP Finishers' }),
        value: this.maxCpFinishers,
      },
      {
        color: BadColor,
        label: t({ id: 'rogue.outlaw.finisherUse.lowCPFinishers', message: 'Low CP Finishers' }),
        value: this.lowCpFinisherCasts,
      },
    ];

    return <DonutChart items={items} />;
  }

  private onCast(event: CastEvent) {
    const cpsSpent = getResourceSpent(event, RESOURCE_TYPES.COMBO_POINTS);
    const spellId = event.ability.guid;

    if (cpsSpent === 0) {
      return;
    }

    this.totalFinisherCasts += 1;

    // TODO: Finisher choice performance
    // Determine if the proper finisher was used according to a priority list
    // Can mostly just rely on the APLCheck for that for now

    const comboPointPerformance = this.comboPointPerformance(
      event,
      cpsSpent,
      this.finishers.recommendedFinisherPoints(),
    );

    switch (spellId) {
      case TALENTS.KILLING_SPREE_TALENT.id:
        this.spellUses.push(
          createSpellUse({ event }, [comboPointPerformance, this.stealthPerformance(event)]),
        );
        break;
      case SPELLS.COUP_DE_GRACE_CAST.id:
        this.spellUses.push(
          createSpellUse({ event }, [comboPointPerformance, this.stealthPerformance(event)]),
        );
        break;
      default:
        this.spellUses.push(createSpellUse({ event }, [comboPointPerformance]));
        break;
    }
  }

  private stealthPerformance(event: CastEvent, shouldBeInStealth?: boolean) {
    const isInStealth = this.finishers.isInStealth();

    if (shouldBeInStealth) {
      return createChecklistItem(
        `${event.ability.name}_stealth`,
        { event },
        {
          performance: isInStealth ? QualitativePerformance.Good : QualitativePerformance.Fail,
          summary: <div>{t({ id: 'rogue.outlaw.finisherUse.stealth.usedInside', message: 'Used inside of Stealth' })}</div>,
          details: isInStealth ? (
            <div>{t({ id: 'rogue.outlaw.finisherUse.stealth.wereInStealth', message: 'You were in stealth.' })}</div>
          ) : (
            <div>
              <>
                {t({
                  id: 'rogue.outlaw.finisherUse.stealth.outsideShouldBeInside.p1',
                  message: 'You were outside of stealth, ',
                })}
                <SpellLink spell={event.ability.guid} />
                {t({
                  id: 'rogue.outlaw.finisherUse.stealth.outsideShouldBeInside.p2',
                  message: ' should only be used inside of stealth.',
                })}
              </>
            </div>
          ),
        },
      );
    }

    return createChecklistItem(
      `${event.ability.name}_stealth`,
      { event },
      {
        performance: !isInStealth ? QualitativePerformance.Good : QualitativePerformance.Fail,
        summary: <div>{t({ id: 'rogue.outlaw.finisherUse.stealth.usedOutside', message: 'Used outside of Stealth' })}</div>,
        details: !isInStealth ? (
          <div>{t({ id: 'rogue.outlaw.finisherUse.stealth.wereOutsideStealth', message: 'You were outside of stealth.' })}</div>
        ) : (
          <div>
            <>
              {t({
                id: 'rogue.outlaw.finisherUse.stealth.insideShouldBeOutside.p1',
                message: 'You were inside of stealth, ',
              })}
              <SpellLink spell={event.ability.guid} />
              {t({
                id: 'rogue.outlaw.finisherUse.stealth.insideShouldBeOutside.p2',
                message: ' should only be used outside of stealth.',
              })}
            </>
          </div>
        ),
      },
    );
  }

  private hiddenOpportunityComboPointPerformance(
    event: CastEvent,
    cpsSpent: number,
    targetCps: number,
  ): ChecklistUsageInfo | undefined {
    // Finisher was cast at the general target cp and not the lower one
    if (cpsSpent > targetCps) {
      return;
    }

    const isGoodCP = cpsSpent >= targetCps;

    let castSummary: JSX.Element = (
      <>
        {t({
          id: 'rogue.outlaw.finisherUse.spentCasting.p1',
          message: 'You spent ',
        })}
        {cpsSpent}
        {t({
          id: 'rogue.outlaw.finisherUse.spentCasting.p2',
          message: ' CPs casting ',
        })}
        <SpellLink spell={event.ability.guid} />.
      </>
    );
    let badCastExplanation: JSX.Element = (
      <>
        {t({
          id: 'rogue.outlaw.finisherUse.outsideStealthMissingBothBuffs.p1',
          message: 'outside of stealth, and with both ',
        })}
        <SpellLink spell={SPELLS.AUDACITY_TALENT_BUFF} />
        {t({
          id: 'rogue.outlaw.finisherUse.outsideStealthMissingBothBuffs.p2',
          message: ' and ',
        })}
        <SpellLink spell={SPELLS.OPPORTUNITY} />
        {t({
          id: 'rogue.outlaw.finisherUse.outsideStealthMissingBothBuffs.p3',
          message: ' missing',
        })}
      </>
    );

    if (this.finishers.hasHOLowCPFinisherCondition()) {
      const activeBuff =
        this.selectedCombatant.getBuff(SPELLS.AUDACITY_TALENT_BUFF.id) ||
        this.selectedCombatant.getBuff(SPELLS.OPPORTUNITY.id);

      if (activeBuff) {
        castSummary = (
          <>
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingWithBuffActive.p1',
              message: 'You spent ',
            })}
            {cpsSpent}
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingWithBuffActive.p2',
              message: ' CPs casting ',
            })}
            <SpellLink spell={event.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingWithBuffActive.p3',
              message: ' with ',
            })}
            <SpellLink spell={activeBuff.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingWithBuffActive.p4',
              message: ' active.',
            })}
          </>
        );
        badCastExplanation = (
          <>
            <SpellLink spell={activeBuff.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.buffIsActive.text',
              message: ' is active',
            })}
          </>
        );
      } else {
        castSummary = (
          <>
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingInStealth.p1',
              message: 'You spent ',
            })}
            {cpsSpent}
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingInStealth.p2',
              message: ' CPs casting ',
            })}
            <SpellLink spell={event.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.spentCastingInStealth.p3',
              message: ' in stealth.',
            })}
          </>
        );
        badCastExplanation = t({ id: 'rogue.outlaw.finisherUse.inStealth', message: 'in stealth' });
      }
    }

    return createChecklistItem(
      `${event.ability.name}_cp`,
      { event },
      {
        performance: isGoodCP ? QualitativePerformance.Good : QualitativePerformance.Fail,
        summary: (
          <div>
            <SpellLink spell={event.ability.guid} />{' '}
            {t({ id: 'rogue.outlaw.finisherUse.comboPointManagement', message: 'Combo Point Management' })}
          </div>
        ),
        details: isGoodCP ? (
          castSummary
        ) : (
          <>
            {castSummary}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreCPs.text',
              message: ' Try to always spend at least ',
            })}
            {targetCps}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreCPs.suffix',
              message: ' CPs when ',
            })}
            {badCastExplanation}.
          </>
        ),
      },
    );
  }

  private comboPointPerformance(
    event: CastEvent,
    cpsSpent: number,
    targetCps: number,
  ): ChecklistUsageInfo | undefined {
    const isGoodCP = cpsSpent >= targetCps;
    if (!isGoodCP) {
      this.lowCpFinisherCasts += 1;
    }

    if (this.hasHiddenOpportunity) {
      const hiddenOpportunityPerformance = this.hiddenOpportunityComboPointPerformance(
        event,
        cpsSpent,
        targetCps,
      );

      if (hiddenOpportunityPerformance) {
        return hiddenOpportunityPerformance;
      }
    }

    const isInStealth = this.finishers.isInStealth();
    const standardDetails = isInStealth ? (
      <>
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPStealth.p1',
          message: 'You spent ',
        })}
        {cpsSpent}
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPStealth.p2',
          message: ' CPs casting ',
        })}
        <SpellLink spell={event.ability.guid} />
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPStealth.p3',
          message: ' in stealth.',
        })}
      </>
    ) : (
      <>
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPOutsideStealth.p1',
          message: 'You spent ',
        })}
        {cpsSpent}
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPOutsideStealth.p2',
          message: ' CPs casting ',
        })}
        <SpellLink spell={event.ability.guid} />
        {t({
          id: 'rogue.outlaw.finisherUse.spentCPOutsideStealth.p3',
          message: ' outside of stealth.',
        })}
      </>
    );

    return createChecklistItem(
      `${event.ability.name}_cp`,
      { event },
      {
        performance: isGoodCP ? QualitativePerformance.Good : QualitativePerformance.Fail,
        summary: (
          <div>
            <SpellLink spell={event.ability.guid} />{' '}
            {t({ id: 'rogue.outlaw.finisherUse.comboPointManagement', message: 'Combo Point Management' })}
          </div>
        ),
        details: isGoodCP ? (
          standardDetails
        ) : isInStealth ? (
          <>
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreInStealth.p1',
              message: 'You spent ',
            })}
            {cpsSpent}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreInStealth.p2',
              message: ' CPs casting ',
            })}
            <SpellLink spell={event.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreInStealth.p3',
              message: ' in stealth. Try to always spend at least ',
            })}
            {targetCps}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreInStealth.p4',
              message: ' CPs when in stealth.',
            })}
          </>
        ) : (
          <>
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreOutsideStealth.p1',
              message: 'You spent ',
            })}
            {cpsSpent}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreOutsideStealth.p2',
              message: ' CPs casting ',
            })}
            <SpellLink spell={event.ability.guid} />
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreOutsideStealth.p3',
              message: ' outside of stealth. Try to always spend at least ',
            })}
            {targetCps}
            {t({
              id: 'rogue.outlaw.finisherUse.tryToSpendMoreOutsideStealth.p4',
              message: ' CPs when not in stealth.',
            })}
          </>
        ),
      },
    );
  }

  get guide(): JSX.Element {
    const explanation = (
      <>
        <p>
          <>
            <strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersBaseline.bold',
                message: 'Finishers',
              })}
            </strong>
            {t({
              id: 'rogue.outlaw.finisherUse.finishersBaseline.text',
              message: ' should typically be used at ',
            })}
            <strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersBaseline.bold2',
                message: '6 or more',
              })}
            </strong>
            {t({
              id: 'rogue.outlaw.finisherUse.finishersBaseline.suffix',
              message: ' combo points.',
            })}
          </>{' '}
          {this.selectedCombatant.hasTalent(TALENTS.SUBTERFUGE_TALENT) && (
            <>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersSubterfuge.p1',
                message: 'When inside of ',
              })}
              <SpellLink spell={SPELLS.SUBTERFUGE_BUFF} />,{' '}
              <strong>
                {t({
                  id: 'rogue.outlaw.finisherUse.finishersSubterfuge.bold',
                  message: 'Finishers',
                })}
              </strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersSubterfuge.p2',
                message: ' should be used at ',
              })}
              <strong>
                {t({
                  id: 'rogue.outlaw.finisherUse.finishersSubterfuge.bold2',
                  message: '5 or more',
                })}
              </strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersSubterfuge.suffix',
                message: ' combo points.',
              })}
            </>
          )}
        </p>
        {this.hasHiddenOpportunity && (
          <p>
            <>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.p1',
                message: 'When playing ',
              })}
              <SpellLink spell={TALENTS.HIDDEN_OPPORTUNITY_TALENT} />{' '}
              <strong>
                {t({
                  id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.bold',
                  message: 'Finishers',
                })}
              </strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.p2',
                message: ' should be used at ',
              })}
              <strong>
                {t({
                  id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.bold2',
                  message: '5 or more',
                })}
              </strong>
              {t({
                id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.p3',
                message: ' combo points when either ',
              })}
              <SpellLink spell={SPELLS.AUDACITY_TALENT_BUFF} />
              {t({
                id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.p4',
                message: ' or ',
              })}
              <SpellLink spell={SPELLS.OPPORTUNITY} />
              {t({
                id: 'rogue.outlaw.finisherUse.finishersHiddenOpportunity.p5',
                message: ' is active.',
              })}
            </>
          </p>
        )}
      </>
    );

    const performances = this.spellUses.map((it) =>
      spellUseToBoxRowEntry(it, this.owner.fight.start_time),
    );

    const spellUsesPerSpell = this.spellUses.reduce<
      Record<number, { goodCasts: number; totalCasts: number }>
    >((acc, cur) => {
      // Technically not possible but the type is AnyEvent
      if (!HasAbility(cur.event)) {
        return acc;
      }

      const spellId = cur.event.ability.guid;
      if (!acc[spellId]) {
        acc[spellId] = { goodCasts: 0, totalCasts: 0 };
      }

      acc[spellId].totalCasts += 1;
      if (cur.performance === QualitativePerformance.Good) {
        acc[spellId].goodCasts += 1;
      }

      return acc;
    }, {});

    const castPerformances = Object.entries(spellUsesPerSpell)
      .sort((a, b) => b[1].totalCasts - a[1].totalCasts)
      .map(([spellId, casts]) => (
        <CastPerformanceSummary
          key={`${spellId}_cast_performance`}
          spell={parseInt(spellId)}
          casts={casts.goodCasts}
          performance={QualitativePerformance.Good}
          totalCasts={casts.totalCasts}
        />
      ));

    return (
      <SpellUsageSubSection
        explanation={explanation}
        performances={performances}
        uses={this.spellUses}
        castBreakdownSmallText={
          <Trans id="rogue.outlaw.finisherUse.castBreakdownLegend">
            - Green is a good cast, Yellow is an ok cast, Red is a bad cast.
          </Trans>
        }
        abovePerformanceDetails={castPerformances}
      />
    );
  }
}
