import type { JSX, ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS/rogue';
import { SpellLink } from 'interface';
import { Options } from 'parser/core/Analyzer';
import Enemies from 'parser/shared/modules/Enemies';
import DotSnapshots, { SnapshotSpec } from 'parser/core/DotSnapshots';
import { IMPROVED_GARROTE_SPEC } from '../core/Snapshots';
import { ApplyDebuffEvent, RefreshDebuffEvent } from 'parser/core/Events';
import {
  animachargedCheckedUsageInfo,
  getGarroteDuration,
  SNAPSHOT_DOWNGRADE_BUFFER,
} from 'analysis/retail/rogue/assassination/constants';
import { getHardcast } from 'analysis/retail/druid/feral/normalizers/CastLinkNormalizer';
import {
  QualitativePerformance,
  getPerformanceExplanation,
} from 'parser/ui/QualitativePerformance';
import TALENTS from 'common/TALENTS/rogue';
import uptimeBarSubStatistic, { SubPercentageStyle } from 'parser/ui/UptimeBarSubStatistic';
import { formatDurationMillisMinSec } from 'common/format';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { RoundedPanelWithBottomMargin } from 'analysis/retail/rogue/shared/styled-components';

export default class GarroteUptimeAndSnapshots extends DotSnapshots {
  static dependencies = {
    ...DotSnapshots.dependencies,
    enemies: Enemies,
  };

  cooldownUses: SpellUse[] = [];

  protected enemies!: Enemies;

  constructor(options: Options) {
    super(SPELLS.GARROTE, SPELLS.GARROTE, [IMPROVED_GARROTE_SPEC], options);
  }

  getDotExpectedDuration(event: ApplyDebuffEvent | RefreshDebuffEvent): number {
    return getGarroteDuration();
  }

  getDotFullDuration(): number {
    return getGarroteDuration();
  }

  getTotalDotUptime(): number {
    return this.enemies.getBuffUptime(SPELLS.GARROTE.id);
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

    const wasUnacceptableDowngrade =
      prevPower > power && remainingOnPrev > SNAPSHOT_DOWNGRADE_BUFFER;
    const wasUpgrade = prevPower < power;

    let snapshotPerformance: QualitativePerformance = QualitativePerformance.Good;
    let snapshotSummary: ReactNode = (
      <div>
        {t({
          id: 'rogue.assassination.garrote.goodSnapshotUsage',
          message: 'Good snapshot usage',
        })}
      </div>
    );
    let snapshotDetails: ReactNode = (
      <div>
        <p>
          {t({
            id: 'rogue.assassination.garrote.goodSnapshotUsageDetail',
            message: 'Good snapshot usage.',
          })}
        </p>
        <p>
          {t({
            id: 'rogue.assassination.garrote.snapshotsLabel',
            message: 'Snapshots:',
          })}{' '}
          <strong>
            {snapshots.length === 0 ? 'NONE' : snapshots.map((it) => it.name).join(', ')}
          </strong>
        </p>
        {prevSnapshots != null && (
          <p>
            {t({
              id: 'rogue.assassination.garrote.previousSnapshotsLabel',
              message: 'Previous Snapshots:',
            })}{' '}
            <strong>
              {prevSnapshots.length === 0
                ? 'NONE'
                : prevSnapshots.map((it) => it.name).join(', ')}
            </strong>
          </p>
        )}
      </div>
    );
    if (wasUnacceptableDowngrade) {
      snapshotPerformance = QualitativePerformance.Fail;
      snapshotSummary = (
        <div>
          {t({
            id: 'rogue.assassination.garrote.unacceptableDowngrade',
            message: 'Unacceptable downgrade of snapshot',
          })}
        </div>
      );
      snapshotDetails = (
        <div>
          <p>
            <Trans id="rogue.assassination.garrote.unacceptableDowngradeDetail">
              Unacceptable downgrade of snapshot. Try not to overwrite your snapshotted Garrote unless
              it's within the last {formatDurationMillisMinSec(SNAPSHOT_DOWNGRADE_BUFFER)}.
            </Trans>
          </p>
          <p>
            {t({
              id: 'rogue.assassination.garrote.snapshotsLabel',
              message: 'Snapshots:',
            })}{' '}
            <strong>
              {snapshots.length === 0 ? 'NONE' : snapshots.map((it) => it.name).join(', ')}
            </strong>
          </p>
          {prevSnapshots != null && (
            <p>
              {t({
                id: 'rogue.assassination.garrote.previousSnapshotsLabel',
                message: 'Previous Snapshots:',
              })}{' '}
              <strong>
                {prevSnapshots.length === 0
                  ? 'NONE'
                  : prevSnapshots.map((it) => it.name).join(', ')}
              </strong>
            </p>
          )}
        </div>
      );
    }
    if (
      clipped > 0 &&
      !snapshots.some((snapshot) => this.applicableSnapshots.some((e) => e.name === snapshot.name))
    ) {
      snapshotPerformance = wasUpgrade ? QualitativePerformance.Ok : QualitativePerformance.Fail;
      snapshotSummary = wasUpgrade ? (
        <div>
          {t({
            id: 'rogue.assassination.garrote.clippedUpgraded',
            message: 'Clipped but upgraded existing snapshotted Garrote',
          })}
        </div>
      ) : (
        <div>
          {t({
            id: 'rogue.assassination.garrote.clipped',
            message: 'Clipped existing snapshotted Garrote',
          })}
        </div>
      );
      snapshotDetails = wasUpgrade ? (
        <div>
          {t({
            id: 'rogue.assassination.garrote.clippedUpgradedDetail',
            message:
              'Clipped but upgraded existing snapshotted Garrote. Try not to clip your snapshotted Garotte.',
          })}
        </div>
      ) : (
        <div>
          <p>
            {t({
              id: 'rogue.assassination.garrote.clippedDetail',
              message:
                'Clipped existing snapshotted Garrote. Try not to clip your snapshotted Garotte.',
            })}
          </p>
          <p>
            {t({
              id: 'rogue.assassination.garrote.snapshotsLabel',
              message: 'Snapshots:',
            })}{' '}
            <strong>
              {snapshots.length === 0 ? 'NONE' : snapshots.map((it) => it.name).join(', ')}
            </strong>
          </p>
          {prevSnapshots != null && (
            <p>
              {t({
                id: 'rogue.assassination.garrote.previousSnapshotsLabel',
                message: 'Previous Snapshots:',
              })}{' '}
              <strong>
                {prevSnapshots.length === 0
                  ? 'NONE'
                  : prevSnapshots.map((it) => it.name).join(', ')}
              </strong>
            </p>
          )}
        </div>
      );
    }

    const checklistItems: ChecklistUsageInfo[] = [
      {
        check: 'snapshot',
        timestamp: cast.timestamp,
        performance: snapshotPerformance,
        summary: snapshotSummary,
        details: snapshotDetails,
      },
    ];

    const actualChecklistItems = animachargedCheckedUsageInfo(
      this.selectedCombatant,
      cast,
      checklistItems,
    );
    const actualPerformance = combineQualitativePerformances(
      actualChecklistItems.map((it) => it.performance),
    );

    this.cooldownUses.push({
      event: cast,
      performance: actualPerformance,
      checklistItems: actualChecklistItems,
      performanceExplanation: getPerformanceExplanation(actualPerformance),
    });

    // TODO also highlight 'bad' Garrotes in the timeline
  }

  get uptimeHistory() {
    return this.enemies.getDebuffHistory(SPELLS.GARROTE.id);
  }

  /** Subsection explaining the use of Garrote and providing performance statistics */
  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <Trans id="rogue.assassination.garrote.explanation">
          <strong>
            <SpellLink spell={SPELLS.GARROTE} />
          </strong>{' '}
          is your highest damage-per-energy single target builder. Try to keep it active on all
          targets (except when in a many-target AoE situation). Garrote snapshots{' '}
          <SpellLink spell={TALENTS.IMPROVED_GARROTE_TALENT} /> - when forced to refresh with a weaker
          snapshot, try to wait until the last moment in order to overwrite the minimum amount of the
          stronger DoT.
        </Trans>
      </p>
    );

    return (
      <ContextualSpellUsageSubSection
        explanation={explanation}
        uses={this.cooldownUses}
        abovePerformanceDetails={
          <RoundedPanelWithBottomMargin>
            <div>
              <Trans id="rogue.assassination.garrote.uptimeHeader">
                <strong>Garrote uptime / snapshots</strong>
                <small> - Try to get as close to 100% as the encounter allows!</small>
              </Trans>
            </div>
            {this.subStatistic()}
          </RoundedPanelWithBottomMargin>
        }
        castBreakdownSmallText={
          <Trans id="rogue.assassination.garrote.castBreakdownLegend">
            {' '}
            - Green is a good cast, Yellow is an ok cast (clipped duration but upgraded snapshot),
            Red is a bad cast (clipped duration or downgraded snapshot w/ &gt;
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
        spells: [SPELLS.GARROTE],
        uptimes: this.uptimeHistory,
      },
      this.snapshotUptimes,
      SubPercentageStyle.RELATIVE,
      true,
    );
  }
}
