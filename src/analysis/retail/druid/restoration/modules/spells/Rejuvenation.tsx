import type { JSX } from 'react';
import { formatPercentage } from 'common/format';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import { SpellIcon, SpellLink } from 'interface';
import { PerformanceMark } from 'interface/guide';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  ApplyBuffStackEvent,
  EventType,
  RefreshBuffEvent,
  RemoveBuffEvent,
} from 'parser/core/Events';
import Combatants from 'parser/shared/modules/Combatants';
import { RefreshInfo } from 'parser/shared/modules/HotTracker';
import BoringValue from 'parser/ui/BoringValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { TALENTS_DRUID } from 'common/TALENTS';

import {
  getHardcast,
  getHeals,
  isFromHardcast,
} from 'analysis/retail/druid/restoration/normalizers/CastLinkNormalizer';
import { buffedBySotf } from 'analysis/retail/druid/restoration/normalizers/SoulOfTheForestLinkNormalizer';
import HotTrackerRestoDruid from 'analysis/retail/druid/restoration/modules/core/hottracking/HotTrackerRestoDruid';
import Lifebloom from 'analysis/retail/druid/restoration/modules/spells/Lifebloom';
import { GUIDE_CORE_EXPLANATION_PERCENT } from 'analysis/retail/druid/restoration/Guide';
import {
  QualitativePerformance,
  evaluateQualitativePerformanceByThreshold,
} from 'parser/ui/QualitativePerformance';
import GuideSection from 'interface/guide/components/GuideSection';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import CastOverview from 'interface/guide/components/CastOverview';
import { TipBox } from 'interface/guide/components';

const REJUV_SPELLS = [SPELLS.REJUVENATION, SPELLS.REJUVENATION_GERMINATION];
/** Abundance requires at least this many Rejuvenations across the raid (Germination counts) */
const ABUNDANCE_REJUV_THRESHOLD = 5;
/** SotF is removed on consume; allow a short post-expire window as fallback */
const SOTF_BUFF_BUFFER_MS = 150;

interface RejuvCastRecord {
  timestamp: number;
  performance: QualitativePerformance;
  targetName: string;
  clipped: boolean;
  clippedMs: number;
  duringSoulOfTheForest: boolean;
  onLifebloomTarget: boolean;
  /** Rejuv + Germination on the cast target only (0–2) */
  rejuvsOnTarget: number;
}

/**
 * Tracks Rejuvenation usage for the 12.1 playstyle: maintain Abundance with ~5 Rejuvs,
 * spend SotF into Rejuv, and never clip duration.
 */
class Rejuvenation extends Analyzer {
  static dependencies = {
    combatants: Combatants,
    hotTracker: HotTrackerRestoDruid,
    lifebloom: Lifebloom,
  };

  protected combatants!: Combatants;
  protected hotTracker!: HotTrackerRestoDruid;
  protected lifebloom!: Lifebloom;

  hasAbundance: boolean;
  hasSoulOfTheForest: boolean;
  hasPhotosynthesis: boolean;
  hasGermination: boolean;

  /** One entry per hardcast GCD (primary target only — skip SotF/PotA extras) */
  casts: RejuvCastRecord[] = [];
  earlyRefreshments = 0;
  timeLost = 0;

  /** Live raid-wide Rejuv+Germ count from HotTracker, used for average */
  private lastCountTimestamp = 0;
  private lastSampledCount = 0;
  private rejuvCountTimeIntegral = 0;

  constructor(options: Options) {
    super(options);

    this.hasAbundance = this.selectedCombatant.hasTalent(TALENTS_DRUID.ABUNDANCE_TALENT);
    this.hasSoulOfTheForest = this.selectedCombatant.hasTalent(
      TALENTS_DRUID.SOUL_OF_THE_FOREST_RESTORATION_TALENT,
    );
    this.hasPhotosynthesis = this.selectedCombatant.hasTalent(TALENTS_DRUID.PHOTOSYNTHESIS_TALENT);
    this.hasGermination = this.selectedCombatant.hasTalent(TALENTS_DRUID.GERMINATION_TALENT);
    this.lastCountTimestamp = this.owner.fight.start_time;

    // `this.hotTracker` is wiped by class fields until after construction — use options.
    // On apply we subtract the just-applied HoT for pre-cast On Target. Clips from refresh hook.
    const hotTracker = options.hotTracker as HotTrackerRestoDruid;
    hotTracker.addRefreshHook(SPELLS.REJUVENATION.id, this.onRefreshRejuv.bind(this));
    hotTracker.addRefreshHook(SPELLS.REJUVENATION_GERMINATION.id, this.onRefreshRejuv.bind(this));

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(REJUV_SPELLS),
      this.onApplyRejuv,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(REJUV_SPELLS),
      this.onRejuvPresenceChange,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(REJUV_SPELLS),
      this.onRejuvPresenceChange,
    );
    this.addEventListener(Events.fightend, this.onFightEnd);
  }

  /** Raid-wide active Rejuvenation effects (Rejuv + Germination), from HotTracker */
  private getLiveRejuvCount(): number {
    return (
      this.hotTracker.getHotCount(SPELLS.REJUVENATION.id) +
      this.hotTracker.getHotCount(SPELLS.REJUVENATION_GERMINATION.id)
    );
  }

  private flushRejuvCount(timestamp: number) {
    const elapsed = Math.max(0, timestamp - this.lastCountTimestamp);
    this.rejuvCountTimeIntegral += this.lastSampledCount * elapsed;
    this.lastCountTimestamp = timestamp;
  }

  private sampleRejuvCount(timestamp: number) {
    this.flushRejuvCount(timestamp);
    this.lastSampledCount = this.getLiveRejuvCount();
  }

  onRejuvPresenceChange(event: ApplyBuffEvent | RefreshBuffEvent | RemoveBuffEvent) {
    // HotTracker already updated for this event
    this.sampleRejuvCount(event.timestamp);
  }

  onFightEnd() {
    this.flushRejuvCount(this.owner.fight.end_time);
  }

  /**
   * True for the hardcast's primary-target HoT only (skips SotF / PotA bounce applies).
   */
  private isPrimaryHardcast(
    event: ApplyBuffEvent | RefreshBuffEvent | ApplyBuffStackEvent,
  ): boolean {
    if (!isFromHardcast(event as ApplyBuffEvent | RefreshBuffEvent)) {
      return false;
    }
    const cast = getHardcast(event as ApplyBuffEvent | RefreshBuffEvent);
    return cast !== undefined && cast.targetID === event.targetID;
  }

  /** Rejuv + Germination currently tracked on a target (HotTracker state) */
  private countRejuvsOnTarget(targetId: number): number {
    const bySpell = this.hotTracker.hots[targetId];
    if (!bySpell) {
      return 0;
    }
    return (
      (bySpell[SPELLS.REJUVENATION.id] ? 1 : 0) +
      (bySpell[SPELLS.REJUVENATION_GERMINATION.id] ? 1 : 0)
    );
  }

  onApplyRejuv(event: ApplyBuffEvent) {
    this.sampleRejuvCount(event.timestamp);

    if (!this.isPrimaryHardcast(event)) {
      return;
    }

    // HotTracker already registered this apply — subtract it for the pre-cast count
    const rejuvsOnTargetBefore = Math.max(0, this.countRejuvsOnTarget(event.targetID) - 1);
    this.recordCast(event, false, 0, rejuvsOnTargetBefore);
  }

  onRefreshRejuv(event: RefreshBuffEvent | ApplyBuffStackEvent, info: RefreshInfo) {
    if (!this.isPrimaryHardcast(event)) {
      return;
    }

    // Refresh only when that HoT was already present; with Germination both were up
    // (game refreshes the shorter one). Post-refresh HotTracker count equals pre-cast.
    const rejuvsOnTargetBefore = this.countRejuvsOnTarget(event.targetID);
    const clipped = info.clipped > 0;
    this.recordCast(
      event as RefreshBuffEvent,
      clipped,
      Math.max(0, info.clipped),
      rejuvsOnTargetBefore,
    );
  }

  private recordCast(
    event: ApplyBuffEvent | RefreshBuffEvent,
    clipped: boolean,
    clippedMs: number,
    rejuvsOnTargetBefore: number,
  ) {
    if (clipped) {
      this.earlyRefreshments += 1;
      this.timeLost += clippedMs;
    }

    const onLifebloomTarget = event.targetID === this.lifebloom.activeLifebloomTarget;
    let performance = QualitativePerformance.Good;
    if (clipped) {
      performance =
        this.hasPhotosynthesis && onLifebloomTarget
          ? QualitativePerformance.Ok
          : QualitativePerformance.Fail;
    }

    const target = this.combatants.getEntity(event);
    this.casts.push({
      timestamp: event.timestamp,
      performance,
      targetName: target?.name ?? this.owner.getTargetName(event) ?? 'unknown',
      clipped,
      clippedMs,
      duringSoulOfTheForest: this.wasBuffedBySoulOfTheForest(event),
      onLifebloomTarget,
      rejuvsOnTarget: rejuvsOnTargetBefore,
    });
  }

  /**
   * Prefer SotF event links on the HoT apply/refresh; fall back to hasBuff with expire buffer.
   */
  private wasBuffedBySoulOfTheForest(event: ApplyBuffEvent | RefreshBuffEvent): boolean {
    if (!this.hasSoulOfTheForest) {
      return false;
    }
    if (buffedBySotf(event) !== undefined) {
      return true;
    }
    // PotA extras / edge timing: check the hardcast's linked applies
    const cast = getHardcast(event);
    if (cast) {
      const fromCast = getHeals(cast);
      if (
        fromCast.some(
          (e) =>
            (e.type === EventType.ApplyBuff || e.type === EventType.RefreshBuff) &&
            buffedBySotf(e as ApplyBuffEvent | RefreshBuffEvent) !== undefined,
        )
      ) {
        return true;
      }
    }
    return this.selectedCombatant.hasBuff(
      SPELLS.SOUL_OF_THE_FOREST_BUFF.id,
      event.timestamp,
      SOTF_BUFF_BUFFER_MS,
    );
  }

  get totalRejuvsCasts() {
    return this.casts.length;
  }

  get timeLostInSeconds() {
    return this.timeLost / 1000;
  }

  get timeLostPerMinute() {
    return this.timeLost / (this.owner.fightDuration / 1000 / 60);
  }

  get timeLostInSecondsPerMinute() {
    return this.timeLostPerMinute / 1000;
  }

  get earlyRefreshmentsPerMinute() {
    return this.earlyRefreshments / (this.owner.fightDuration / 1000 / 60);
  }

  get abundanceUptime() {
    if (!this.hasAbundance) {
      return 0;
    }
    return (
      this.selectedCombatant.getBuffUptime(SPELLS.ABUNDANCE_BUFF.id) / this.owner.fightDuration
    );
  }

  get averageActiveRejuvs() {
    if (this.owner.fightDuration <= 0) {
      return 0;
    }
    return this.rejuvCountTimeIntegral / this.owner.fightDuration;
  }

  get possiblePerformances(): QualitativePerformance[] {
    const grades = [QualitativePerformance.Good, QualitativePerformance.Fail];
    if (this.hasPhotosynthesis) {
      grades.splice(1, 0, QualitativePerformance.Ok);
    }
    return grades;
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={SPELLS.REJUVENATION} />
          </b>{' '}
          {t({ id: 'restoration.rejuv.explanation_p1', message: 'is mainly used to' })}
          {this.hasAbundance ? (
            <>
              {' '}
              {t({ id: 'restoration.rejuv.explanation_maintain', message: ' maintain ' })}
              <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />
            </>
          ) : null}
          {this.hasAbundance &&
          this.hasSoulOfTheForest &&
          t({ id: 'restoration.rejuv.explanation_and', message: ' and' })}
          {this.hasSoulOfTheForest ? (
            <>
              {' '}
              {t({ id: 'restoration.rejuv.explanation_spend', message: ' spend ' })}
              <SpellLink spell={TALENTS_DRUID.SOUL_OF_THE_FOREST_RESTORATION_TALENT} />
            </>
          ) : null}
          {!this.hasAbundance &&
          !this.hasSoulOfTheForest &&
          t({ id: 'restoration.rejuv.explanation_spread', message: ' spread HoT coverage' })}
          {this.hasAbundance ? (
            <>
              {t({
                id: 'restoration.rejuv.explanation_abundance_p1',
                message: '. Keep around ',
              })}
              {ABUNDANCE_REJUV_THRESHOLD}
              {t({
                id: 'restoration.rejuv.explanation_abundance_p2',
                message:
                  ' Rejuvenations active to maintain Abundance, then spend the rest of your GCDs on ',
              })}
              <SpellLink spell={SPELLS.REGROWTH} />
              {t({
                id: 'restoration.rejuv.explanation_abundance_p3',
                message:
                  '. Batch Rejuvenation casts together rather than topping them up one at a time',
              })}
              {this.hasSoulOfTheForest ? (
                <>
                  {t({
                    id: 'restoration.rejuv.explanation_abundance_sotf',
                    message: '. Pressing ',
                  })}
                  <SpellLink spell={SPELLS.SWIFTMEND} />
                  {t({
                    id: 'restoration.rejuv.explanation_abundance_sotf_p2',
                    message:
                      ' before Rejuvenation spreads three HoTs instead of one, which is the cheapest way to rebuild Abundance',
                  })}
                </>
              ) : null}
            </>
          ) : this.hasSoulOfTheForest ? (
            <>
              {t({ id: 'restoration.rejuv.explanation_sotf_p1', message: '. Spend every ' })}
              <SpellLink spell={TALENTS_DRUID.SOUL_OF_THE_FOREST_RESTORATION_TALENT} />
              {t({
                id: 'restoration.rejuv.explanation_sotf_p2',
                message: ' on Rejuvenation whenever possible',
              })}
            </>
          ) : null}
          .
        </p>
        <p>
          {t({
            id: 'restoration.rejuv.explanation_p2',
            message:
              'Avoid refreshing Rejuvenation early. You can refresh any HoT with about 5–6 seconds left with no penalty, but clipping duration is usually a wasted cast',
          })}
          {this.hasPhotosynthesis ? (
            <>
              {t({
                id: 'restoration.rejuv.explanation_p2_photosynthesis',
                message: '. The only exception is your ',
              })}
              <SpellLink spell={SPELLS.LIFEBLOOM_HOT_HEAL} />
              {t({
                id: 'restoration.rejuv.explanation_p2_photosynthesis_p2',
                message:
                  " target. Clipping a Rejuvenation there is still not ideal, but it's a smaller loss since keeping HoTs on that target increases ",
              })}
              <SpellLink spell={TALENTS_DRUID.PHOTOSYNTHESIS_TALENT} />
              {t({ id: 'restoration.rejuv.explanation_p2_photosynthesis_p3', message: ' proc rate' })}
            </>
          ) : null}
          .
        </p>
        {this.hasPhotosynthesis && (
          <p>
            {t({ id: 'restoration.rejuv.photosynthesis_p1', message: "If you're playing " })}
            <SpellLink spell={TALENTS_DRUID.PHOTOSYNTHESIS_TALENT} />
            {t({ id: 'restoration.rejuv.photosynthesis_p2', message: ', try to keep Rejuvenation' })}
            {this.hasGermination ? (
              <>
                {t({ id: 'restoration.rejuv.photosynthesis_and', message: ' and ' })}
                <SpellLink spell={TALENTS_DRUID.GERMINATION_TALENT} />
              </>
            ) : null}
            {t({
              id: 'restoration.rejuv.photosynthesis_p3',
              message: ' on your Lifebloom target to maximize Everbloom procs.',
            })}
          </p>
        )}
        <TipBox hideIcon>
          <div>
            <PerformanceMark perf={QualitativePerformance.Good} />
            {t({
              id: 'restoration.rejuv.tip_good',
              message: ' Good - Applied or refreshed in the pandemic window',
            })}
          </div>
          {this.hasPhotosynthesis && (
            <div>
              <PerformanceMark perf={QualitativePerformance.Ok} />
              {t({ id: 'restoration.rejuv.tip_ok', message: ' Ok - Early refresh on your ' })}
              <SpellLink spell={SPELLS.LIFEBLOOM_HOT_HEAL} />
              {t({ id: 'restoration.rejuv.tip_ok_target', message: ' target' })}
            </div>
          )}
          <div>
            <PerformanceMark perf={QualitativePerformance.Fail} />
            {t({
              id: 'restoration.rejuv.tip_fail',
              message: ' Bad - Early refresh that clipped duration',
            })}
            {this.hasPhotosynthesis &&
            t({ id: 'restoration.rejuv.tip_fail_elsewhere', message: ' elsewhere' })}
          </div>
        </TipBox>
      </>
    );

    const stats = [];
    if (this.hasAbundance) {
      stats.push({
        value: `${formatPercentage(this.abundanceUptime, 0)}%`,
        label: t({ id: 'restoration.rejuv.stat_abundance_uptime', message: 'Abundance Uptime' }),
        tooltip: (
          <>
            {t({ id: 'restoration.rejuv.stat_abundance_uptime_tt_p1', message: ' Aim for near 100% ' })}
            <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />
            {t({ id: 'restoration.rejuv.stat_abundance_uptime_tt_p2', message: ' uptime by keeping at least ' })}
            {ABUNDANCE_REJUV_THRESHOLD}
            {t({
              id: 'restoration.rejuv.stat_abundance_uptime_tt_p3',
              message: ' Rejuvenations active across the raid (Germination counts)',
            })}
          </>
        ),
        performance: evaluateQualitativePerformanceByThreshold({
          actual: this.abundanceUptime,
          isGreaterThanOrEqual: { perfect: 0.95, good: 0.85, ok: 0.7 },
        }),
      });
      stats.push({
        value: this.averageActiveRejuvs.toFixed(1),
        label: t({ id: 'restoration.rejuv.stat_avg_active', message: 'Avg Active Rejuvs' }),
        tooltip: (
          <>
            {t({ id: 'restoration.rejuv.stat_avg_active_tt_p1', message: ' Average number of ' })}
            <SpellLink spell={SPELLS.REJUVENATION} />
            {t({
              id: 'restoration.rejuv.stat_avg_active_tt_p2',
              message:
                ' effects active across the raid (including Germination). Abundance needs ',
            })}
            {ABUNDANCE_REJUV_THRESHOLD}+
          </>
        ),
        performance: evaluateQualitativePerformanceByThreshold({
          actual: this.averageActiveRejuvs,
          isGreaterThanOrEqual: {
            perfect: ABUNDANCE_REJUV_THRESHOLD,
            good: ABUNDANCE_REJUV_THRESHOLD - 0.5,
            ok: 3,
          },
        }),
      });
    }
    stats.push({
      value: `${formatPercentage(
        this.casts.length === 0 ? 0 : this.earlyRefreshments / this.casts.length,
        0,
      )}%`,
      label: t({ id: 'restoration.rejuv.stat_clipped', message: 'Clipped Casts' }),
      tooltip: t({
        id: 'restoration.rejuv.stat_clipped_tt',
        message: 'Share of Rejuvenation hardcasts that clipped remaining duration',
      }),
      performance: evaluateQualitativePerformanceByThreshold({
        actual: this.casts.length === 0 ? 0 : this.earlyRefreshments / this.casts.length,
        isLessThanOrEqual: { perfect: 0.02, good: 0.05, ok: 0.1 },
      }),
    });

    return (
      <GuideSection explanation={explanation} explanationPercent={GUIDE_CORE_EXPLANATION_PERCENT}>
        <CastOverview
          spell={SPELLS.REJUVENATION}
          title={
            <>
              <SpellLink spell={SPELLS.REJUVENATION} />
              {t({ id: 'restoration.rejuv.overview_title', message: ' Overview' })}
            </>
          }
          stats={stats}
        />
        <CastDetail
          title={t({ id: 'restoration.rejuv.casts_title', message: 'Rejuvenation Casts' })}
          casts={this.buildCastDetails()}
          possiblePerformances={this.possiblePerformances}
        />
      </GuideSection>
    );
  }

  private buildCastDetails(): PerCastData[] {
    return this.casts.map((cast) => {
      const reasonParts: string[] = [];
      if (cast.clipped) {
        reasonParts.push(
          this.hasPhotosynthesis && cast.onLifebloomTarget
            ? t({ id: 'restoration.rejuv.reason_clipped_lb', message: 'Clipped ' }) +
                (cast.clippedMs / 1000).toFixed(1) +
                t({ id: 'restoration.rejuv.reason_clipped_lb_suffix', message: 's (Lifebloom target)' })
            : t({ id: 'restoration.rejuv.reason_clipped', message: 'Clipped ' }) +
                (cast.clippedMs / 1000).toFixed(1) +
                t({ id: 'restoration.rejuv.reason_clipped_suffix', message: 's' }),
        );
      } else {
        reasonParts.push(t({ id: 'restoration.rejuv.reason_no_clip', message: 'No clip' }));
      }
      if (cast.duringSoulOfTheForest) {
        reasonParts.push(t({ id: 'restoration.rejuv.reason_sotf', message: 'Soul of the Forest' }));
      }

      return {
        performance: cast.performance,
        timestamp: this.owner.formatTimestamp(cast.timestamp),
        stats: [
          {
            value: cast.clipped ? 'Yes' : 'No',
            label: t({ id: 'restoration.rejuv.stat_clipped_label', message: 'Clipped' }),
            performance: cast.clipped
              ? this.hasPhotosynthesis && cast.onLifebloomTarget
                ? QualitativePerformance.Ok
                : QualitativePerformance.Fail
              : QualitativePerformance.Good,
          },
          {
            value: `${cast.rejuvsOnTarget}`,
            label: 'On Target',
            tooltip: (
              <>
                <SpellLink spell={SPELLS.REJUVENATION} />
                {this.hasGermination &&
                t({ id: 'restoration.rejuv.stat_on_target_germ', message: ' + Germination' })}
                {t({
                  id: 'restoration.rejuv.stat_on_target_tt',
                  message: ' on this target before the cast (max ',
                })}
                {this.hasGermination ? 2 : 1})
                {t({ id: 'restoration.rejuv.stat_on_target_tt_end', message: ')' })}
              </>
            ),
            ungraded: true,
          },
          ...(this.hasSoulOfTheForest
            ? [
                cast.duringSoulOfTheForest
                  ? {
                      value: 'Yes',
                      label: t({ id: 'restoration.rejuv.stat_sotf_label', message: 'SotF' }),
                      performance: QualitativePerformance.Good,
                    }
                  : {
                      value: 'No',
                      label: t({ id: 'restoration.rejuv.stat_sotf_label', message: 'SotF' }),
                      ungraded: true,
                    },
              ]
            : []),
        ],
        details: (
          <>
            {cast.performance}: {reasonParts.join(' · ')}
            {t({ id: 'restoration.rejuv.details_on', message: ' on ' })}
            <strong>{cast.targetName}</strong>
          </>
        ),
      };
    });
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(18)}
        size="flexible"
        tooltip={
          <>
            {t({ id: 'restoration.rejuv.stat_tooltip_p1', message: 'You refreshed Rejuvenation early ' })}
            <strong>
              {this.earlyRefreshments}
              {t({ id: 'restoration.rejuv.stat_times', message: ' times' })}
            </strong>
            {t({ id: 'restoration.rejuv.stat_tooltip_p2', message: ', losing a total of ' })}
            <strong>{this.timeLostInSeconds.toFixed(1)}s</strong>
            {t({ id: 'restoration.rejuv.stat_tooltip_p3', message: ' of HoT duration (' })}
            {this.timeLostInSecondsPerMinute.toFixed(1)}s
            {t({ id: 'restoration.rejuv.stat_tooltip_p4', message: ' per minute).' })}
          </>
        }
      >
        <BoringValue
          label={
            <>
              <SpellIcon spell={SPELLS.REJUVENATION} />
              {t({ id: 'restoration.rejuv.stat_label', message: ' Early Rejuvenation refreshes' })}
            </>
          }
        >
          <>
            {this.earlyRefreshmentsPerMinute.toFixed(1)}
            <small>{t({ id: 'restoration.rejuv.stat_per_minute', message: 'per minute' })}</small>
          </>
        </BoringValue>
      </Statistic>
    );
  }
}

export default Rejuvenation;
