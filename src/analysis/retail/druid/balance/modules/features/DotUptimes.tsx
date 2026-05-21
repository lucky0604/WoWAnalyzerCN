import UptimeIcon from 'interface/icons/Uptime';
import { Trans } from '@lingui/react/macro';
import Analyzer from 'parser/core/Analyzer';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import UptimeMultiBarStatistic from 'parser/ui/UptimeMultiBarStatistic';

import MoonfireUptime from 'analysis/retail/druid/balance/modules/spells/MoonfireUptime';
import SunfireUptime from 'analysis/retail/druid/balance/modules/spells/SunfireUptime';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';

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
      <p>
        <Trans id="balance.dotUptimes.explanation">
          <b>
            <SpellLink spell={SPELLS.MOONFIRE_CAST} />
          </b>{' '}
          and{' '}
          <b>
            <SpellLink spell={SPELLS.SUNFIRE} />
          </b>{' '}
          are high damage-per-cast-time DoTs that further boost your spell damage via Mastery.
          Maintaining 100% uptime is your highest priority.
        </Trans>
      </p>
    );

    const data = (
      <RoundedPanel>
        <strong>
          <Trans id="balance.dotUptimes.rounded_panel_title">DoT Uptimes</Trans>
        </strong>
        {this.moonfireUptime.subStatistic()}
        {this.sunfireUptime.subStatistic()}
      </RoundedPanel>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <UptimeMultiBarStatistic
        title={
          <>
            <UptimeIcon />{' '}
            <Trans id="balance.dotUptimes.title">DoT Uptimes</Trans>
          </>
        }
        position={STATISTIC_ORDER.CORE(1)}
        tooltip={
          <Trans id="balance.dotUptimes.tooltip">
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
