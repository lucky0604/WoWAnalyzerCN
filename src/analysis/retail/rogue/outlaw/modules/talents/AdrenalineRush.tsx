import type { JSX } from 'react';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import TALENTS from 'common/TALENTS/rogue';
import { SpellLink } from 'interface';
import { SpellUse, ChecklistUsageInfo } from 'parser/core/SpellUsage/core';
import { createChecklistItem, createSpellUse } from 'parser/core/MajorCooldowns/MajorCooldown';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { HideGoodCastsSpellUsageSubSection } from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import ComboPointTracker from 'analysis/retail/rogue/shared/ComboPointTracker';
import { getGeneratedAdrenalineRushComboPoints } from '../../normalizers/CastLinkNormalizer';
import uptimeBarSubStatistic, { UptimeBarSpec } from 'parser/ui/UptimeBarSubStatistic';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

const MAX_GOOD_CP = 2;

export default class AdrenalineRush extends Analyzer {
  static dependencies = {
    comboPointTracker: ComboPointTracker,
  };

  private cooldownUses: SpellUse[] = [];
  private comboPointTracker!: ComboPointTracker;

  hasImprovedAdrenalineRush = this.selectedCombatant.hasTalent(
    TALENTS.IMPROVED_ADRENALINE_RUSH_TALENT,
  );

  constructor(options: Options) {
    super(options);

    // Currently you just want to avoid overcapping, and that can only happen if you have Improved Adrenaline Rush
    this.active =
      this.selectedCombatant.hasTalent(TALENTS.ADRENALINE_RUSH_TALENT) &&
      this.hasImprovedAdrenalineRush;

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.ADRENALINE_RUSH_TALENT),
      this.onCast,
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <Trans id="rogue.outlaw.adrenalineRush.explanation1">
            <strong>
              <SpellLink spell={TALENTS.ADRENALINE_RUSH_TALENT} />
            </strong>{' '}
            is an important buff to maintain high uptime on, and should be used on cooldown.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.outlaw.adrenalineRush.explanation2">
            When playing with <SpellLink spell={TALENTS.IMPROVED_ADRENALINE_RUSH_TALENT} /> you should
            use it at <strong>{MAX_GOOD_CP} or less</strong> Combo Points to avoid overcapping.
          </Trans>
        </p>
      </>
    );

    const goodCasts = this.cooldownUses.filter(
      (it) => it.performance === QualitativePerformance.Good,
    ).length;
    const totalCasts = this.cooldownUses.length;

    const adrenalineRushBarSpec: UptimeBarSpec = {
      spells: [TALENTS.ADRENALINE_RUSH_TALENT],
      uptimes: this.selectedCombatant
        .getBuffHistory(TALENTS.ADRENALINE_RUSH_TALENT)
        .map((buff) => ({
          start: buff.start,
          end: buff.end ?? this.owner.currentTimestamp,
        })),
    };

    return (
      <HideGoodCastsSpellUsageSubSection
        hideGoodCasts={false}
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={
          <Trans id="rogue.outlaw.adrenalineRush.castBreakdownLegend">
            - Red indicates bad Adrenaline Rush usage.
          </Trans>
        }
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            {uptimeBarSubStatistic(this.owner.fight, adrenalineRushBarSpec)}
            <CastPerformanceSummary
              spell={TALENTS.ADRENALINE_RUSH_TALENT}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: t({
            id: 'rogue.outlaw.adrenalineRush.noCasts',
            message: 'No Adrenaline Rush casts detected! This is a major mistake.',
          }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    const comboPointsAtCast =
      this.comboPointTracker.maxResource - getGeneratedAdrenalineRushComboPoints(event);

    this.cooldownUses.push(
      createSpellUse({ event }, [this.comboPointPerformance(event, comboPointsAtCast)]),
    );
  }

  private comboPointPerformance(
    event: CastEvent,
    comboPointsAtCast: number,
  ): ChecklistUsageInfo | undefined {
    const isGoodCP = comboPointsAtCast <= MAX_GOOD_CP;

    return createChecklistItem(
      'adrenaline_rush_cp',
      { event },
      {
        performance: isGoodCP ? QualitativePerformance.Good : QualitativePerformance.Fail,
        summary: (
          <div>
            <Trans id="rogue.outlaw.adrenalineRush.comboPointManagement">
              Combo Point Management
            </Trans>
          </div>
        ),
        details: isGoodCP ? (
          <div>
            <Trans id="rogue.outlaw.adrenalineRush.optimalUsage">
              You used <SpellLink spell={TALENTS.ADRENALINE_RUSH_TALENT} /> optimally with{' '}
              <strong>{comboPointsAtCast}</strong> combo points.
            </Trans>
          </div>
        ) : (
          <div>
            <Trans id="rogue.outlaw.adrenalineRush.badUsage">
              You used <SpellLink spell={TALENTS.ADRENALINE_RUSH_TALENT} /> at{' '}
              <strong>{comboPointsAtCast}</strong> combo points. Try to use it at{' '}
              <strong>{MAX_GOOD_CP} or less</strong> CP to avoid overcapping.
            </Trans>
          </div>
        ),
      },
    );
  }
}
