import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS/rogue';
import Events, { CastEvent, HasTarget } from 'parser/core/Events';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import getResourceSpent from 'parser/core/getResourceSpent';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import RuptureUptimeAndSnapshots from 'analysis/retail/rogue/assassination/modules/spells/RuptureUptimeAndSnapshots';
import {
  QualitativePerformance,
  getPerformanceExplanation,
} from 'parser/ui/QualitativePerformance';
import { formatDurationMillisMinSec } from 'common/format';
import { ReactNode, type JSX } from 'react';
import SpellLink from 'interface/SpellLink';
import {
  animachargedCheckedUsageInfo,
  getTargetComboPoints,
} from 'analysis/retail/rogue/assassination/constants';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import Enemies from 'parser/shared/modules/Enemies';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import { RoundedPanelWithBottomMargin } from 'analysis/retail/rogue/shared/styled-components';

const MIN_ACCEPTABLE_TIME_LEFT_ON_RUPTURE_MS = 3000;

export default class Envenom extends Analyzer {
  static dependencies = {
    enemies: Enemies,
    ruptureUptimeAndSnapshots: RuptureUptimeAndSnapshots,
  };

  cooldownUses: SpellUse[] = [];

  protected enemies!: Enemies;
  protected ruptureUptimeAndSnapshots!: RuptureUptimeAndSnapshots;

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.ENVENOM), this.onCast);
  }

  /** Subsection explaining the use of Envenom and providing performance statistics */
  get guideSubsection(): JSX.Element {
    const targetCps = getTargetComboPoints(this.selectedCombatant);
    const explanation = (
      <p>
        <>
          <strong>
            <SpellLink spell={SPELLS.ENVENOM} />
          </strong>{' '}
          {t({
            id: 'rogue.assassination.envenom.explanation.p1',
            message: 'is your direct damage finisher. Use it when you already have a ',
          })}
          <SpellLink spell={SPELLS.RUPTURE} />
          {t({
            id: 'rogue.assassination.envenom.explanation.p2',
            message: ' applied to your target. Always use ',
          })}
          <SpellLink spell={SPELLS.ENVENOM} />
          {t({
            id: 'rogue.assassination.envenom.explanation.p3',
            message: ' at ',
          })}
          {targetCps}
          {t({
            id: 'rogue.assassination.envenom.explanation.p4',
            message: '+ CPs.',
          })}
        </>
      </p>
    );

    return (
      <ContextualSpellUsageSubSection
        explanation={explanation}
        uses={this.cooldownUses}
        abovePerformanceDetails={
          <RoundedPanelWithBottomMargin>
            <div>
              <>
                <strong>
                  <SpellLink spell={SPELLS.ENVENOM} />
                  {t({
                    id: 'rogue.assassination.envenom.uptimeHeader.bold',
                    message: ' uptime',
                  })}
                </strong>
                <small>
                  {t({
                    id: 'rogue.assassination.envenom.uptimeHeader.text',
                    message: ' - Try to get as close to 100% as the encounter allows!',
                  })}
                </small>
              </>
            </div>
            {uptimeBarSubStatistic(this.owner.fight, {
              spells: [SPELLS.ENVENOM],
              uptimes: this.envenomBuffUptimes,
            })}
          </RoundedPanelWithBottomMargin>
        }
        castBreakdownSmallText={
          <Trans id="rogue.assassination.envenom.castBreakdownLegend">
            {' '}
            - Blue is an Animacharged cast, Green is a good cast, Yellow is an ok cast, Red is a bad
            cast.
          </Trans>
        }
      />
    );
  }

  private get envenomBuffUptimes() {
    return this.selectedCombatant.getBuffHistory(SPELLS.ENVENOM.id).map((buff) => ({
      start: buff.start,
      end: buff.end ?? this.owner.fight.end_time,
    }));
  }

  private onCast(event: CastEvent) {
    const checklistItems: ChecklistUsageInfo[] = [
      this.determineEnvenomDuringRupturePerformance(event),
      this.determineComboPointsPerformance(event),
    ];

    const actualChecklistItems = animachargedCheckedUsageInfo(
      this.selectedCombatant,
      event,
      checklistItems,
    );
    const actualPerformance = combineQualitativePerformances(
      actualChecklistItems.map((it) => it.performance),
    );

    this.cooldownUses.push({
      event,
      performance: actualPerformance,
      checklistItems: actualChecklistItems,
      performanceExplanation: getPerformanceExplanation(actualPerformance),
    });
  }

  private determineEnvenomDuringRupturePerformance(event: CastEvent): ChecklistUsageInfo {
    let timeLeftOnRupture = 0;
    // target is optional in cast event, but we know Envenom cast will always have it
    if (HasTarget(event)) {
      timeLeftOnRupture = this.ruptureUptimeAndSnapshots.getTimeRemaining(event);
    }
    const acceptableTimeLeftOnRupture = timeLeftOnRupture >= MIN_ACCEPTABLE_TIME_LEFT_ON_RUPTURE_MS;

    const performance = acceptableTimeLeftOnRupture
      ? QualitativePerformance.Good
      : QualitativePerformance.Fail;
    const summary = (
      <div>
        {t({
          id: 'rogue.assassination.envenom.dontNeedRupture',
          message: "Don't need to pandemic Rupture",
        })}
      </div>
    );
    let details: ReactNode;
    if (acceptableTimeLeftOnRupture) {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.envenom.detailsGoodRupture.p1',
              message: 'You cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsGoodRupture.p2',
              message: ' with ',
            })}
            {formatDurationMillisMinSec(timeLeftOnRupture)}
            {t({
              id: 'rogue.assassination.envenom.detailsGoodRupture.p3',
              message: ' left on ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />.
          </>
        </div>
      );
    } else if (timeLeftOnRupture > 1000) {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p1',
              message: 'You cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p2',
              message: ' with ',
            })}
            {formatDurationMillisMinSec(timeLeftOnRupture)}
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p3',
              message: ' left on ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />.
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p4',
              message: ' Try not to cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p5',
              message: ' with less than ',
            })}
            {formatDurationMillisMinSec(MIN_ACCEPTABLE_TIME_LEFT_ON_RUPTURE_MS)}
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p6',
              message: ' left on ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />,
            {t({
              id: 'rogue.assassination.envenom.detailsBadRupture.p7',
              message: ' as it may cause you to miss pandemic-ing ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />.
          </>
        </div>
      );
    } else if (timeLeftOnRupture > 0) {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p1',
              message: 'You cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p2',
              message: ' with less than 1s left on ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />.
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p3',
              message: ' Try not to cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p4',
              message: ' with less than ',
            })}
            {formatDurationMillisMinSec(MIN_ACCEPTABLE_TIME_LEFT_ON_RUPTURE_MS)}
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p5',
              message: ' left on ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />,
            {t({
              id: 'rogue.assassination.envenom.detailsBadRuptureShort.p6',
              message: ' as it may cause you to miss pandemic-ing ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />.
          </>
        </div>
      );
    } else {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.envenom.detailsNoRupture.p1',
              message: 'You cast ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />
            {t({
              id: 'rogue.assassination.envenom.detailsNoRupture.p2',
              message: ' with no ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />
            {t({
              id: 'rogue.assassination.envenom.detailsNoRupture.p3',
              message: ' applied to the target. Always ensure that your target has ',
            })}
            <SpellLink spell={SPELLS.RUPTURE} />
            {t({
              id: 'rogue.assassination.envenom.detailsNoRupture.p4',
              message: ' applied before casting ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />.
          </>
        </div>
      );
    }

    if (performance === QualitativePerformance.Fail) {
      addInefficientCastReason(event, details);
    }

    return {
      check: 'rupture',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  private determineComboPointsPerformance(event: CastEvent): ChecklistUsageInfo {
    const cpsSpent = getResourceSpent(event, RESOURCE_TYPES.COMBO_POINTS);
    const targetCps = getTargetComboPoints(this.selectedCombatant);
    const appropriateCpsSpent = cpsSpent >= targetCps;
    const performance = appropriateCpsSpent
      ? QualitativePerformance.Good
      : QualitativePerformance.Fail;
    const summary: ReactNode = (
      <div>
        <Trans id="rogue.assassination.envenom.spendCps">Spend {targetCps}+ CPs</Trans>
      </div>
    );
    let details: ReactNode;
    if (appropriateCpsSpent) {
      details = (
        <div>
          <Trans id="rogue.assassination.envenom.spentCpsGood">
            You spent {cpsSpent} CPs.
          </Trans>
        </div>
      );
    } else {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.envenom.spentCpsBad.p1',
              message: 'You spent ',
            })}
            {cpsSpent}
            {t({
              id: 'rogue.assassination.envenom.spentCpsBad.p2',
              message: ' CPs. Try to always spend ',
            })}
            {targetCps}
            {t({
              id: 'rogue.assassination.envenom.spentCpsBad.p3',
              message: '+ CPs when casting ',
            })}
            <SpellLink spell={SPELLS.ENVENOM} />.
          </>
        </div>
      );
    }

    if (performance === QualitativePerformance.Fail) {
      addInefficientCastReason(event, details);
    }

    return {
      check: 'cps',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }
}
