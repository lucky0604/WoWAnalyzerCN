import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { SpellLink, SpellIcon } from 'interface';
import SPELLS from 'common/SPELLS';
import { TALENTS_DRUID } from 'common/TALENTS';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';
import { encodeEventTargetString } from 'parser/shared/modules/Enemies';
import { currentEclipse, ASTRAL_POWER_SCALE_FACTOR } from 'analysis/retail/druid/balance/constants';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import { mergeTimePeriods, ClosedTimePeriod } from 'parser/core/mergeTimePeriods';
import { cdSpell } from 'analysis/retail/druid/balance/constants';
import UptimeBar, { Uptime } from 'parser/ui/UptimeBar';
import { Highlight } from 'interface/Highlight';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

const MIN_STARFALL_TARGETS = 3;
// TODO: placeholder thresholds — tune with Balance Discord
const NEAR_CAP_AP_THRESHOLD = 80; // Spend AP at or above this threshold to avoid capping
const GOOD_SPENDERS_PER_ECLIPSE = 4; // 4+ = good (green)
const OK_SPENDERS_PER_ECLIPSE = 3; // 3 = ok (yellow)
// below OK = bad (red)

const GOOD_WINDOW_COLOR = '#15b025'; // green
const OK_WINDOW_COLOR = '#e8bb17'; // yellow
const BAD_WINDOW_COLOR = '#d32117'; // red

export default class SpenderUsage extends Analyzer {
  totalStarsurges = 0;
  noEclipseStarsurges = 0;

  totalStarfalls = 0;
  lowTargetStarfalls = 0;
  noEclipseStarfalls = 0;

  // populate with targetIDs recently hit
  lastStarfallCast: CastEvent | undefined = undefined;
  recentlyHitStarfallTargets: Set<string> = new Set<string>();
  spenderCasts: Array<{ timestamp: number }> = [];

  constructor(options: Options) {
    super(options);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.STARSURGE_MOONKIN),
      this.onStarsurge,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.STARFALL_CAST),
      this.onStarfall,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.STARFALL),
      this.onStarfallDamage,
    );
    this.addEventListener(Events.fightend, this.onFightEnd);
  }

  onStarsurge(event: CastEvent) {
    if (currentEclipse(this.selectedCombatant) === 'none' && !this.lastCastNearCap(event)) {
      this.noEclipseStarsurges += 1;
      addInefficientCastReason(
        event,
        defineMessage({
          id: 'druid.balance.spender.starsurge_outside_eclipse',
          message: 'Starsurge cast outside eclipse without being near AP cap.',
        }),
      );
    }
    this.totalStarsurges += 1;
    this.spenderCasts.push({ timestamp: event.timestamp });
  }

  onStarfall(event: CastEvent) {
    if (currentEclipse(this.selectedCombatant) === 'none' && !this.lastCastNearCap(event)) {
      this.noEclipseStarfalls += 1;
      addInefficientCastReason(
        event,
        defineMessage({
          id: 'druid.balance.spender.starfall_outside_eclipse',
          message: 'Starfall cast outside eclipse without being near AP cap.',
        }),
      );
    }
    this.totalStarfalls += 1;
    this.spenderCasts.push({ timestamp: event.timestamp });

    this._tallyLastStarfall();
    this.lastStarfallCast = event;
  }

  onStarfallDamage(event: DamageEvent) {
    const targetString = encodeEventTargetString(event);
    if (targetString) {
      this.recentlyHitStarfallTargets.add(targetString);
    }
  }

  onFightEnd() {
    this._tallyLastStarfall();
  }

  // check all unique targets hit since last starfall cast, use to check for 'too few targets' case
  _tallyLastStarfall() {
    if (this.recentlyHitStarfallTargets.size < MIN_STARFALL_TARGETS && this.lastStarfallCast) {
      this.lowTargetStarfalls += 1;
      addInefficientCastReason(
        this.lastStarfallCast,
        defineMessage({
          id: 'druid.balance.spender.starfall_too_few_targets',
          message: 'This Starfall hit too few targets!',
        }),
      );

      this.recentlyHitStarfallTargets.clear();
      this.lastStarfallCast = undefined;
    }
  }

  /** Returns true if the player's AP before this cast was above spending threshold */
  lastCastNearCap(event: CastEvent): boolean {
    const resource = event.classResources?.find((r) => r.type === RESOURCE_TYPES.ASTRAL_POWER.id);
    if (!resource) {
      return false; // if we can't tell, assume it was bad
    }
    const ap = resource.amount * ASTRAL_POWER_SCALE_FACTOR;
    return ap >= NEAR_CAP_AP_THRESHOLD;
  }

  get eclipseWindows(): ClosedTimePeriod[] {
    const solarHistory = this.selectedCombatant.getBuffHistory(SPELLS.ECLIPSE_SOLAR.id);
    const lunarHistory = this.selectedCombatant.getBuffHistory(SPELLS.ECLIPSE_LUNAR.id);
    const caHistory = this.selectedCombatant.getBuffHistory(cdSpell(this.selectedCombatant).id);

    const allUptimes = [...solarHistory, ...lunarHistory, ...caHistory].map((h) => ({
      start: h.start,
      end: h.end ?? this.owner.fight.end_time,
    }));

    return mergeTimePeriods(allUptimes, this.owner.fight.end_time);
  }

  /** Shared: compute spender count per Eclipse window once */
  get perWindowResults(): Array<{ start: number; end: number; count: number }> {
    return this.eclipseWindows.map((window) => ({
      start: window.start,
      end: window.end,
      count: this.spenderCasts.filter(
        (c) => c.timestamp >= window.start && c.timestamp <= window.end,
      ).length,
    }));
  }

  /** For aggregate GradiatedPerformanceBar */
  get windowPerformance() {
    const results = this.perWindowResults;
    return {
      GOOD: results.filter((w) => w.count >= GOOD_SPENDERS_PER_ECLIPSE).length,
      OK: results.filter(
        (w) => w.count >= OK_SPENDERS_PER_ECLIPSE && w.count < GOOD_SPENDERS_PER_ECLIPSE,
      ).length,
      BAD: results.filter((w) => w.count < OK_SPENDERS_PER_ECLIPSE).length,
    };
  }

  /** For UptimeBar timeline */
  get spenderWindowUptimes(): Uptime[] {
    return this.perWindowResults.map((w) => ({
      start: w.start,
      end: w.end,
      customColor:
        w.count >= GOOD_SPENDERS_PER_ECLIPSE
          ? GOOD_WINDOW_COLOR
          : w.count >= OK_SPENDERS_PER_ECLIPSE
            ? OK_WINDOW_COLOR
            : BAD_WINDOW_COLOR,
    }));
  }

  get guideSubsection() {
    const explanation = (
      <>
        <p>
          <Trans id="druid.balance.spender.explanation_p1">
            <strong>Spender spells</strong> are{' '}
            <strong>
              <SpellLink spell={SPELLS.STARSURGE_MOONKIN} />
            </strong>{' '}
            and{' '}
            <strong>
              <SpellLink spell={SPELLS.STARFALL} />
            </strong>
            .
          </Trans>
        </p>
        <p>
          <Trans id="druid.balance.spender.explanation_p2">
            Aim to cast as many spenders as possible during each{' '}
            <SpellLink spell={TALENTS_DRUID.ECLIPSE_TALENT} /> window. Use{' '}
            <SpellLink spell={SPELLS.STARSURGE_MOONKIN} /> against 1 or 2 targets, and{' '}
            <SpellLink spell={SPELLS.STARFALL} /> against 3 or more targets.
          </Trans>
        </p>
        <p>
          <Trans id="druid.balance.spender.explanation_p3">
            Avoid using spenders outside of <SpellLink spell={TALENTS_DRUID.ECLIPSE_TALENT} />{' '}
            except to prevent overcapping Astral Power.
          </Trans>
        </p>
      </>
    );

    const { GOOD, OK, BAD } = this.windowPerformance;
    const noEclipseTotal = this.noEclipseStarsurges + this.noEclipseStarfalls;

    const data = (
      <div>
        {/* Aggregate bar */}
        <div>
          <strong>
            <Trans id="druid.balance.spender.spenders_per_eclipse">Spenders per Eclipse</Trans>
          </strong>
          <small>
            {' '}
            <Trans id="druid.balance.spender.spenders_per_eclipse_desc">
              - Green is {GOOD_SPENDERS_PER_ECLIPSE}+, Yellow is {OK_SPENDERS_PER_ECLIPSE}, Red is
              fewer.
            </Trans>
          </small>
          <GradiatedPerformanceBar
            good={{
              count: GOOD,
              label: t({ id: 'druid.balance.spender.good_bar_label', message: '4+ spenders' }),
            }}
            ok={{
              count: OK,
              label: t({ id: 'druid.balance.spender.ok_bar_label', message: '3 spenders' }),
            }}
            bad={{
              count: BAD,
              label: t({ id: 'druid.balance.spender.bad_bar_label', message: 'Fewer than 3 spenders' }),
            }}
          />
        </div>

        <RoundedPanel>
          <div>
            <strong>
              <Trans id="druid.balance.spender.per_eclipse_perf">Per-Eclipse Performance</Trans>
            </strong>{' '}
            -{' '}
            <Highlight color={GOOD_WINDOW_COLOR} textColor="black">
              <Trans id="druid.balance.spender.good_legend">Good ({GOOD_SPENDERS_PER_ECLIPSE}+)</Trans>
            </Highlight>{' '}
            <Highlight color={OK_WINDOW_COLOR} textColor="black">
              <Trans id="druid.balance.spender.ok_legend">OK ({OK_SPENDERS_PER_ECLIPSE})</Trans>
            </Highlight>{' '}
            <Highlight color={BAD_WINDOW_COLOR} textColor="white">
              <Trans id="druid.balance.spender.bad_legend">Bad (&lt;{OK_SPENDERS_PER_ECLIPSE})</Trans>
            </Highlight>
          </div>
          <div className="flex-main multi-uptime-bar">
            <div className="flex main-bar">
              <div className="flex-sub bar-label">
                <SpellIcon spell={TALENTS_DRUID.ECLIPSE_TALENT} />
              </div>
              <div className="flex-main chart">
                <UptimeBar
                  aria-label={t({
                    id: 'druid.balance.spender.aria_label',
                    message:
                      'Spender usage per Eclipse Window (green = good, yellow = ok, red = bad)',
                  })}
                  uptimeHistory={this.spenderWindowUptimes}
                  start={this.owner.fight.start_time}
                  end={this.owner.fight.end_time}
                />
              </div>
            </div>
          </div>
        </RoundedPanel>

        {/* Outside-Eclipse warning */}
        {noEclipseTotal > 0 && (
          <p>
            <strong>
              <Trans id="druid.balance.spender.outside_eclipse_warning">
                {noEclipseTotal} spender(s) cast outside Eclipse not near AP cap.
              </Trans>
            </strong>
          </p>
        )}
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}
