import type { JSX, ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS/rogue';
import { SpellLink } from 'interface';
import { Options } from 'parser/core/Analyzer';
import Enemies from 'parser/shared/modules/Enemies';
import DotSnapshots, { SnapshotSpec } from 'parser/core/DotSnapshots';
import { ApplyDebuffEvent, RefreshDebuffEvent } from 'parser/core/Events';
import {
  animachargedCheckedUsageInfo,
  getRuptureDuration,
  getRuptureFullDuration,
  isInOpener,
  RUPTURE_BASE_DURATION,
  SNAPSHOT_DOWNGRADE_BUFFER,
} from 'analysis/retail/rogue/assassination/constants';
import {
  QualitativePerformance,
  getPerformanceExplanation,
} from 'parser/ui/QualitativePerformance';
import uptimeBarSubStatistic, { SubPercentageStyle } from 'parser/ui/UptimeBarSubStatistic';
import { formatDurationMillisMinSec } from 'common/format';
import { SpellUse } from 'parser/core/SpellUsage/core';

import { getHardcast } from '../../normalizers/CastLinkNormalizer';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { RoundedPanelWithBottomMargin } from 'analysis/retail/rogue/shared/styled-components';

export default class RuptureUptimeAndSnapshots extends DotSnapshots {
  static dependencies = {
    ...DotSnapshots.dependencies,
    enemies: Enemies,
  };

  cooldownUses: SpellUse[] = [];

  protected enemies!: Enemies;

  constructor(options: Options) {
    super(SPELLS.RUPTURE, SPELLS.RUPTURE, [], options);
  }

  getDotExpectedDuration(event: ApplyDebuffEvent | RefreshDebuffEvent): number {
    const fromHardcast = getHardcast(event);
    if (fromHardcast) {
      return getRuptureDuration(this.selectedCombatant, fromHardcast);
    }

    console.warn(
      "Couldn't find what cast produced Rupture application - assuming base duration",
      event,
    );
    return RUPTURE_BASE_DURATION;
  }

  getDotFullDuration(): number {
    return getRuptureFullDuration(this.selectedCombatant);
  }

  getTotalDotUptime(): number {
    return this.enemies.getBuffUptime(SPELLS.RUPTURE.id);
  }

  handleApplication(
    application: ApplyDebuffEvent | RefreshDebuffEvent,
    snapshots: SnapshotSpec[],
    prevSnapshots: SnapshotSpec[] | null,
    power: number,
    prevPower: number,
    remainingOnPrev: number,
    clipped: number,
  ): void {
    const cast = getHardcast(application);
    if (!cast) {
      return;
    }

    // log the cast
    const wasUnacceptableDowngrade =
      prevPower > power && remainingOnPrev > SNAPSHOT_DOWNGRADE_BUFFER;
    const wasUpgrade = prevPower < power;

    let snapshotPerformance: QualitativePerformance = QualitativePerformance.Good;
    let snapshotSummary: ReactNode = (
      <div>
        {t({
          id: 'rogue.assassination.rupture.goodSnapshotUsage',
          message: 'Good snapshot usage',
        })}
      </div>
    );
    let snapshotDetails: ReactNode = (
      <div>
        {t({
          id: 'rogue.assassination.rupture.goodSnapshotUsageDetail',
          message: 'Good snapshot usage.',
        })}
      </div>
    );
    if (wasUnacceptableDowngrade) {
      snapshotPerformance = QualitativePerformance.Fail;
      snapshotSummary = (
        <div>
          {t({
            id: 'rogue.assassination.rupture.unacceptableDowngrade',
            message: 'Unacceptable downgrade of snapshot',
          })}
        </div>
      );
      snapshotDetails = (
        <div>
          <Trans id="rogue.assassination.rupture.unacceptableDowngradeDetail">
            Unacceptable downgrade of snapshot. Try not to overwrite your snapshotted Rupture unless
            it's within the last {formatDurationMillisMinSec(SNAPSHOT_DOWNGRADE_BUFFER)}.
          </Trans>
        </div>
      );
    }
    if (clipped > 0) {
      if (isInOpener(cast, this.owner.fight)) {
        snapshotPerformance = QualitativePerformance.Ok;
        snapshotSummary = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clippedUpgraded',
              message: 'Clipped but upgraded existing snapshotted Rupture',
            })}
          </div>
        );
        snapshotDetails = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clippedOpener',
              message: "Clipped existing Rupture. It was during your opener so it's okay.",
            })}
          </div>
        );
      } else if (wasUpgrade) {
        snapshotPerformance = QualitativePerformance.Ok;
        snapshotSummary = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clippedUpgraded',
              message: 'Clipped but upgraded existing snapshotted Rupture',
            })}
          </div>
        );
        snapshotDetails = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clippedUpgradedDetail',
              message:
                'Clipped but upgraded existing snapshotted Rupture. Try not to clip your snapshotted Rupture.',
            })}
          </div>
        );
      } else {
        snapshotPerformance = QualitativePerformance.Fail;
        snapshotSummary = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clipped',
              message: 'Clipped existing Rupture',
            })}
          </div>
        );
        snapshotDetails = (
          <div>
            {t({
              id: 'rogue.assassination.rupture.clippedDetail',
              message: 'Clipped existing Rupture. Try not to clip your Rupture.',
            })}
          </div>
        );
      }
    }

    const actualChecklistItems = animachargedCheckedUsageInfo(this.selectedCombatant, cast, [
      {
        check: 'snapshot',
        timestamp: cast.timestamp,
        performance: snapshotPerformance,
        summary: snapshotSummary,
        details: snapshotDetails,
      },
    ]);
    const actualPerformance = combineQualitativePerformances(
      actualChecklistItems.map((it) => it.performance),
    );

    this.cooldownUses.push({
      event: cast,
      performance: actualPerformance,
      checklistItems: actualChecklistItems,
      performanceExplanation: getPerformanceExplanation(actualPerformance),
    });

    // TODO also highlight 'bad' Ruptures in the timeline
  }

  get uptimeHistory() {
    return this.enemies.getDebuffHistory(SPELLS.RUPTURE.id);
  }

  /** Subsection explaining the use of Rupture and providing performance statistics */
  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <>
          <strong>
            <SpellLink spell={SPELLS.RUPTURE} />
          </strong>{' '}
          {t({
            id: 'rogue.assassination.rupture.explanation.text',
            message:
              "is your highest damage-per-energy spender. Try to maintain 100% uptime. Don't refresh early.",
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
                  {t({
                    id: 'rogue.assassination.rupture.uptimeHeader.bold',
                    message: 'Rupture uptime',
                  })}
                </strong>
                <small>
                  {t({
                    id: 'rogue.assassination.rupture.uptimeHeader.text',
                    message: ' - Try to get as close to 100% as the encounter allows!',
                  })}
                </small>
              </>
            </div>
            {this.subStatistic()}
          </RoundedPanelWithBottomMargin>
        }
        castBreakdownSmallText={
          <Trans id="rogue.assassination.rupture.castBreakdownLegend">
            {' '}
            - Blue is an Animacharged cast, Green is a good cast, Yellow is an ok cast (clipped
            duration but upgraded snapshot), Red is a bad cast (clipped duration or downgraded
            snapshot w/ &gt;
            {formatDurationMillisMinSec(SNAPSHOT_DOWNGRADE_BUFFER)} remaining).
          </Trans>
        }
      />
    );
  }

  subStatistic() {
    return uptimeBarSubStatistic(
      this.owner.fight,
      {
        spells: [SPELLS.RUPTURE],
        uptimes: this.uptimeHistory,
      },
      this.snapshotUptimes,
      SubPercentageStyle.RELATIVE,
    );
  }
}
