import UptimeIcon from 'interface/icons/Uptime';
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro';
import Analyzer from 'parser/core/Analyzer';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import UptimeMultiBarStatistic from 'parser/ui/UptimeMultiBarStatistic';

import MoonfireUptime from 'analysis/retail/druid/balance/modules/spells/DoTs/MoonfireUptime';
import SunfireUptime from 'analysis/retail/druid/balance/modules/spells/DoTs/SunfireUptime';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { ResourceLink, SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import { TALENTS_DRUID } from 'common/TALENTS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

/**
 * Wide statistics box for tracking the most important Balance DoT uptimes
 */
class DotUptimes extends Analyzer {
  static dependencies = {
    moonfireUptime: MoonfireUptime,
    sunfireUptime: SunfireUptime,
  };

  protected moonfireUptime!: MoonfireUptime;
  protected sunfireUptime!: SunfireUptime;

  get guideSubsection() {
    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={SPELLS.MOONFIRE_CAST} />
          </b>{' '}
          {t({ id: 'druid.balance.dotUptimes.explanation.p1', message: 'and ' })}
          <b>
            <SpellLink spell={SPELLS.SUNFIRE} />
          </b>{' '}
          {t({
            id: 'druid.balance.dotUptimes.explanation.p2',
            message:
              'are high damage-per-cast-time DoTs that synergize well with many talents like ',
          })}
          <SpellLink spell={TALENTS_DRUID.SHOOTING_STARS_TALENT} />.
        </p>
        <ul>
          <li>
            <strong>
              {t({
                id: 'druid.balance.dotUptimes.priority',
                message: 'Priority:',
              })}
            </strong>{' '}
            {t({
              id: 'druid.balance.dotUptimes.priority.p2',
              message:
                'Maintain 100% uptime, but only if the target will live long enough for the DoT to deal more damage than a cast of ',
            })}
            <SpellLink spell={SPELLS.WRATH} />
            {t({ id: 'druid.balance.dotUptimes.priority.p3', message: ' or ' })}
            <SpellLink spell={SPELLS.STARFIRE} />.
          </li>
          <li>
            <strong>
              {t({
                id: 'druid.balance.dotUptimes.efficiency',
                message: 'Efficiency:',
              })}
            </strong>{' '}
            {t({
              id: 'druid.balance.dotUptimes.efficiency.p2',
              message:
                'Refresh DoTs during the Pandemic window (last 30%) to extend the duration without wasting Global Cooldowns. If your Useful Casts score is low, you may be over-refreshing DoTs while moving. To optimize movement, pool ',
            })}
            <ResourceLink id={RESOURCE_TYPES.ASTRAL_POWER.id} />
            {t({
              id: 'druid.balance.dotUptimes.efficiency.p3',
              message: ' ahead of time and cast ',
            })}
            <SpellLink spell={TALENTS_DRUID.STARSURGE_SHARED_TALENT} />
            {t({ id: 'druid.balance.dotUptimes.efficiency.p4', message: ' or ' })}
            <SpellLink spell={SPELLS.STARFALL_CAST} />
            {t({ id: 'druid.balance.dotUptimes.efficiency.p5', message: ' while moving.' })}
          </li>
          <li>
            <strong>
              {t({
                id: 'druid.balance.dotUptimes.benchmark',
                message: 'Uptime benchmark:',
              })}
            </strong>{' '}
            {t({
              id: 'druid.balance.dotUptimes.benchmark.p2',
              message:
                'Total uptime often drops during transitions or intermissions. Use top-ranking reports as a benchmark for what is realistic on a per-fight basis.',
            })}
          </li>
        </ul>
      </>
    );

    const data = (
      <div>
        <RoundedPanel>{this.moonfireUptime.castOverviewAndSummary()}</RoundedPanel>
        <div className="row" style={{ height: '20px' }} />
        <RoundedPanel>{this.sunfireUptime.castOverviewAndSummary()}</RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <UptimeMultiBarStatistic
        title={
          <>
            <UptimeIcon />{' '}
            {t({ id: 'druid.balance.dotUptimes.title', message: 'DoT Uptimes' })}
          </>
        }
        position={STATISTIC_ORDER.CORE(1)}
        tooltip={
          <Trans id="druid.balance.dotUptimes.tooltip">
            These uptime bars show the times your DoT was active on at least one target.
          </Trans>
        }
      >
        {this.moonfireUptime.subStatistic()}
        {this.sunfireUptime.subStatistic()}
      </UptimeMultiBarStatistic>
    );
  }
}

export default DotUptimes;
