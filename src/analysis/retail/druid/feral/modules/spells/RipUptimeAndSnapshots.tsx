import type { JSX } from 'react';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS';
import { Options } from 'parser/core/Analyzer';
import { ApplyDebuffEvent, RefreshDebuffEvent } from 'parser/core/Events';
import Enemies from 'parser/shared/modules/Enemies';
import uptimeBarSubStatistic, { SubPercentageStyle } from 'parser/ui/UptimeBarSubStatistic';

import {
  CLIP_BUFFER,
  getAcceptableCps,
  getPrimalWrathDuration,
  getRipDuration,
  getRipFullDuration,
  RIP_DURATION_BASE,
} from 'analysis/retail/druid/feral/constants';
import {
  getHardcast,
  getPrimalWrath,
} from 'analysis/retail/druid/feral/normalizers/CastLinkNormalizer';
import Snapshots, {
  SnapshotSpec,
  TIGERS_FURY_SPEC,
} from 'analysis/retail/druid/feral/modules/core/Snapshots';
import { TALENTS_DRUID } from 'common/TALENTS';
import getResourceSpent from 'parser/core/getResourceSpent';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { SpellLink } from 'interface';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { BadColor, OkColor } from 'interface/guide';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';

class RipUptimeAndSnapshots extends Snapshots {
  static dependencies = {
    ...Snapshots.dependencies,
    enemies: Enemies,
  };

  protected enemies!: Enemies;

  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(SPELLS.RIP, SPELLS.RIP, [TIGERS_FURY_SPEC], options);
  }

  getDotExpectedDuration(event: ApplyDebuffEvent | RefreshDebuffEvent): number {
    const fromHardcast = getHardcast(event);
    if (fromHardcast) {
      return getRipDuration(fromHardcast, this.selectedCombatant);
    }
    const fromPrimalWrath = getPrimalWrath(event);
    if (fromPrimalWrath) {
      return getPrimalWrathDuration(fromPrimalWrath, this.selectedCombatant);
    }

    console.warn(
      "Couldn't find what cast produced Rip application - assuming base duration",
      event,
    );
    return RIP_DURATION_BASE;
  }

  getDotFullDuration(): number {
    return getRipFullDuration(this.selectedCombatant);
  }

  getTotalDotUptime(): number {
    return this.enemies.getBuffUptime(SPELLS.RIP.id);
  }

  handleApplication(
    application: ApplyDebuffEvent | RefreshDebuffEvent,
    snapshots: SnapshotSpec[],
    prevSnapshots: SnapshotSpec[] | null,
    power: number,
    prevPower: number,
    remainingOnPrev: number,
    clipped: number,
  ) {
    const ripCast = getHardcast(application);
    const pwCast = getPrimalWrath(application);
    if (ripCast) {
      // log the cast
      const timestamp = ripCast.timestamp;
      const targetName = this.owner.getTargetName(ripCast);
      const cpsUsed = getResourceSpent(ripCast, RESOURCE_TYPES.COMBO_POINTS);
      const wasNewApplication = prevSnapshots === null;

      /** Perf logic:
       *  Low CPs, but is initial Rip -> Green (getting it up matters more)
       *  Low CPs on refresh -> Red
       *  Refreshed outside pandemic -> Red
       *  Refreshed slightly early (within clip buffer) -> Ok
       *  None of the Above -> Green
       */
      let value: QualitativePerformance = QualitativePerformance.Good;
      let perfExplanation: React.ReactNode = undefined;
      const currAcceptableCps = getAcceptableCps(this.selectedCombatant, ripCast.timestamp);
      if (cpsUsed < currAcceptableCps && !wasNewApplication) {
        value = QualitativePerformance.Fail;
        perfExplanation = (
          <h5 style={{ color: BadColor }}>
            <Trans id="druid.feral.rip.low_cps_bad">
              Bad because you used only {cpsUsed} CPs (need at least {currAcceptableCps})
            </Trans>
          </h5>
        );
      } else if (clipped > CLIP_BUFFER) {
        value = QualitativePerformance.Fail;
        perfExplanation = (
          <h5 style={{ color: BadColor }}>
            <Trans id="druid.feral.rip.early_refresh_bad">
              Bad because you refreshed too early
            </Trans>
          </h5>
        );
      } else if (clipped > 0) {
        value = QualitativePerformance.Ok;
        perfExplanation = (
          <h5 style={{ color: OkColor }}>
            <Trans id="druid.feral.rip.early_refresh_warning">
              Careful, you refreshed this a little early
            </Trans>
          </h5>
        );
      }

      const tooltip = (
        <>
          {perfExplanation}
          <div>
            @ <strong>{this.owner.formatTimestamp(timestamp)}</strong>{' '}
            <Trans id="druid.feral.rip.targeting_with_cps">
              targetting{' '}
              <strong>{targetName || t({ id: 'druid.shared.unknown', message: 'unknown' })}</strong>{' '}
              using <strong>{cpsUsed} CPs</strong>
            </Trans>
          </div>
          {!wasNewApplication && (
            <div>
              <Trans id="druid.feral.moonfire.refreshed_on_target">
                Refreshed on target w/ {(remainingOnPrev / 1000).toFixed(1)}s remaining{' '}
              </Trans>
              {clipped > 0 && (
                <strong>
                  <Trans id="druid.feral.moonfire.clipped">
                    - Clipped {(clipped / 1000).toFixed(1)}s!
                  </Trans>
                </strong>
              )}
            </div>
          )}
          <div>
            <Trans id="druid.feral.moonfire.snapshots">
              Snapshots: <strong>{snapshots.map((ss) => ss.name).join(', ')}</strong>
            </Trans>
          </div>
        </>
      );
      this.castEntries.push({ value, tooltip });
    } else if (pwCast) {
      // TODO handle PW cast
    } else {
      console.warn("Couldn't find cast linked to Rip application", application);
    }

    if (prevPower >= power && clipped > 0) {
      const cast = getHardcast(application);
      if (cast) {
        addInefficientCastReason(
          cast,
          defineMessage({
            id: 'druid.feral.rip.clipped_inefficient_reason_prefix',
            message: 'This cast clipped ',
          }) +
            (clipped / 1000).toFixed(1) +
            defineMessage({
              id: 'druid.feral.rip.clipped_inefficient_reason_suffix',
              message:
                " seconds of Rip time without upgrading the snapshot. Try to wait until the last 30% of Rip's duration before refreshing",
            }),
        );
      }
    }
  }

  /** Subsection explaining the use of Rip and providing performance statistics */
  get guideSubsection(): JSX.Element {
    const hasPw = this.selectedCombatant.hasTalent(TALENTS_DRUID.PRIMAL_WRATH_TALENT);
    const explanation = (
      <p>
        <Trans id="druid.feral.rip.explanation">
          <b>
            <SpellLink spell={SPELLS.RIP} />
          </b>{' '}
          is your highest damage-per-energy single target spender. Try to maintain 100% uptime.{' '}
          {hasPw ? (
            <>
              Use <SpellLink spell={TALENTS_DRUID.PRIMAL_WRATH_TALENT} /> to apply it when you can
              hit more than one target.
            </>
          ) : (
            <>
              You can even keep it active on multiple targets, though if a fight will frequently
              have multiple targets consider speccing for{' '}
              <SpellLink spell={TALENTS_DRUID.PRIMAL_WRATH_TALENT} />.
            </>
          )}{' '}
          Only refresh in the pandemic window (last 30% of duration).
        </Trans>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <div>
            <strong>
              <Trans id="druid.feral.rip.uptime_snapshots_title">Rip uptime / snapshots</Trans>
            </strong>
            <small>
              <Trans id="druid.feral.moonfire.uptime_snapshots_sub">
                {' '}
                - Try to get as close to 100% as the encounter allows!
              </Trans>
            </small>
          </div>
          {this.subStatistic()}
        </RoundedPanel>
        <CastSummaryAndBreakdown
          spell={SPELLS.RIP}
          castEntries={this.castEntries}
          okExtraExplanation={<Trans id="druid.feral.rip.ok_reason">slightly early refresh</Trans>}
          badExtraExplanation={
            <Trans id="druid.feral.rip.bad_reason">refreshed outside pandemic or low CPs</Trans>
          }
        />
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  get uptimeHistory() {
    return this.combinedUptimeHistory;
  }

  subStatistic() {
    return uptimeBarSubStatistic(
      this.owner.fight,
      {
        spells: [SPELLS.RIP],
        uptimes: this.uptimeHistory,
      },
      this.snapshotUptimes,
      SubPercentageStyle.RELATIVE,
    );
  }
}

export default RipUptimeAndSnapshots;
