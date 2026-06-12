import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  CastEvent,
  DamageEvent,
  EndChannelEvent,
  GetRelatedEvent,
  HasAbility,
} from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import DonutChart from 'parser/ui/DonutChart';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';

// Inspired by the penance bolt counter module from Discipline Priest

// Same-tick FoF hits can fan out across multiple targets over more than one frame, but legitimate
// next-tick hits will repeat previously hit targets. Keep a modest idle buffer for new targets and
// use repeated targets to detect the next real tick without collapsing high-haste channels.
const FISTS_OF_FURY_SAME_TICK_BUFFER_MS = 200;
const BASE_FISTS_OF_FURY_TICKS = 5;
const MAX_FISTS_OF_FURY_TICKS = 5;

class FistsofFury extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };
  previousDamageTimestamp = 0;
  fistsTicks = 0;
  casts = 0;

  currentChannelTicks = 0;
  currentTickTargets = new Set<number>();

  // FoF will always hit at least one time, so this is ultimately a 1-indexed array of [1,maxTicks]
  ticksHit = [0, 0, 0, 0, 0, 0];
  colors = ['#666', '#1eff00', '#0070ff', '#a435ee', '#ff8000', '#e6cc80'];

  clipped: Record<number, number> = {};

  protected abilityTracker!: AbilityTracker;

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.FISTS_OF_FURY_CAST),
      this.onFistsCast,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.FISTS_OF_FURY_DAMAGE),
      this.onFistsDamage,
    );
    this.addEventListener(
      Events.EndChannel.by(SELECTED_PLAYER).spell(SPELLS.FISTS_OF_FURY_CAST),
      this.onChannelEnd,
    );
  }

  get expectedTicks() {
    return BASE_FISTS_OF_FURY_TICKS;
  }

  isNewFistsTick(event: DamageEvent) {
    return (
      !this.previousDamageTimestamp ||
      this.currentTickTargets.has(event.targetID) ||
      event.timestamp - this.previousDamageTimestamp > FISTS_OF_FURY_SAME_TICK_BUFFER_MS
    );
  }

  onFistsDamage(event: DamageEvent) {
    if (this.isNewFistsTick(event)) {
      this.currentChannelTicks = Math.min(this.currentChannelTicks + 1, MAX_FISTS_OF_FURY_TICKS);
      this.currentTickTargets.clear();
    }

    this.currentTickTargets.add(event.targetID);
    this.previousDamageTimestamp = event.timestamp;
  }

  finalizeChannel() {
    if (this.currentChannelTicks <= 0) {
      return;
    }

    const finalizedTicks = Math.min(this.currentChannelTicks, this.expectedTicks);
    this.fistsTicks += finalizedTicks;
    this.ticksHit[finalizedTicks - 1] += 1;
  }

  onChannelEnd(event: EndChannelEvent) {
    this.finalizeChannel();
    const nextAbility = GetRelatedEvent(event, 'fof-cast');
    if (
      nextAbility !== undefined &&
      HasAbility(nextAbility) &&
      this.currentChannelTicks < this.expectedTicks
    ) {
      // FoF has 5 total damage events. Fewer than that means it was clipped.
      this.clipped[nextAbility.ability.guid] = (this.clipped[nextAbility.ability.guid] || 0) + 1;
    }
  }

  onFistsCast(event: CastEvent) {
    this.currentChannelTicks = 0;
    this.previousDamageTimestamp = 0;
    this.currentTickTargets.clear();
    this.casts += 1;
  }

  get averageTicks() {
    return this.fistsTicks / this.casts;
  }

  get suggestionThresholds() {
    const expectedTicks = this.expectedTicks;
    return {
      actual: this.averageTicks,
      isLessThan: {
        minor: expectedTicks,
        average: expectedTicks - 0.25,
        major: expectedTicks - 0.5,
      },
      style: ThresholdStyle.DECIMAL,
    };
  }

  donutChart(ticks: number[]) {
    return Object.values(ticks)
      .slice(0, this.expectedTicks)
      .map((val, idx) => {
        return { label: idx + 1, color: this.colors[idx], value: val };
      });
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(4)}
        size="flexible"
        tooltip={(() => {
          const expectedTicks = this.expectedTicks;
          return (
            <Trans id="monk.windwalker.fof.ticks_tooltip">
              Fists of Fury ticks {expectedTicks} times over the duration of the channel.
            </Trans>
          );
        })()}
        dropdown={
          <div className="pad">
            <DonutChart items={this.donutChart(this.ticksHit)} />
          </div>
        }
      >
        <BoringSpellValueText spell={SPELLS.FISTS_OF_FURY_CAST}>
          {this.averageTicks.toFixed(2)}{' '}
          <small>
            {t({ id: 'monk.windwalker.fof.avg_ticks', message: 'Average ticks per cast' })}
          </small>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <>
            <strong>
              <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            </strong>{' '}
            {t({
              id: 'monk.windwalker.fof.explanation1.p1',
              message:
                'is one of your primary dps skills, and should be channeled to completion. It ticks ',
            })}
            {BASE_FISTS_OF_FURY_TICKS}
            {t({
              id: 'monk.windwalker.fof.explanation1.p2',
              message: ' times over the duration of the channel. ',
            })}
            <SpellLink spell={TALENTS_MONK.CRASHING_FISTS_TALENT} />
            {t({
              id: 'monk.windwalker.fof.explanation1.p3',
              message: ' now increases its damage rather than extending the channel.',
            })}
          </>
        </p>
        <p>
          <>
            {t({
              id: 'monk.windwalker.fof.explanation2.p1',
              message: 'With ',
            })}
            <SpellLink spell={TALENTS_MONK.MOMENTUM_BOOST_TALENT} />
            {t({
              id: 'monk.windwalker.fof.explanation2.p2',
              message: ', each tick of ',
            })}
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            {t({
              id: 'monk.windwalker.fof.explanation2.p3',
              message:
                ' ramps the damage of the next tick. That means the back half of the channel is worth significantly more than the front half, so clipping it early is especially punishing.',
            })}
          </>
        </p>
      </>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />{' '}
            {t({
              id: 'monk.windwalker.fof.cast_efficiency',
              message: 'cast efficiency',
            })}
          </strong>
          {this.guideSubStatistic()}
          <hr />
          <strong>
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />{' '}
            {t({
              id: 'monk.windwalker.fof.clip_analysis',
              message: 'clip analysis',
            })}
          </strong>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: '1', marginRight: '4rem' }}>
              {/* TODO: I broke something here, now shows NaN for 5-tick casts out of SER */}
              <DonutChart items={this.donutChart(this.ticksHit)} />
            </div>
            <table className="table table-condensed" style={{ flex: 1 }}>
              <thead>
                <tr>
                  <th>{t({ id: 'monk.windwalker.fof.ability', message: 'Ability' })}</th>
                  <th>
                    {t({ id: 'monk.windwalker.fof.times_clipped', message: 'Times Clipped' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(this.clipped).map(([key, value], idx) => (
                  <tr key={idx}>
                    <th>
                      <SpellLink spell={Number(key)} />
                    </th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  guideSubStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS_MONK.FISTS_OF_FURY_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default FistsofFury;
