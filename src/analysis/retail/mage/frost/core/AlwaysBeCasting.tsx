import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatPercentage } from 'common/format';
import { ThresholdStyle } from 'parser/core/ParseResults';
import CoreAlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import Gauge from 'parser/ui/Gauge';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

class AlwaysBeCasting extends CoreAlwaysBeCasting {
  get deadTimePercentage() {
    return this.totalTimeWasted / this.owner.fightDuration;
  }

  get overrideDowntimeSuggestionThresholds() {
    return {
      style: ThresholdStyle.PERCENTAGE,
      actual: this.downtimePercentage,
      isGreaterThan: {
        minor: 0.05,
        average: 0.15,
        major: 0.25,
      },
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(10)}
        tooltip={
          <>
            <p>
              {t({
                id: 'mage.frost.alwaysBeCasting.statistic.tooltip.p1',
                message: 'Downtime is available time not used to cast anything (including not having your GCD rolling). This can be caused by delays between casting spells, latency, cast interrupting or just simply not casting anything (e.g. due to movement/stunned).',
              })}
            </p>
            <ul>
              <li>
                {t({
                  id: 'mage.frost.alwaysBeCasting.statistic.tooltip.li1',
                  message: 'You spent ',
                })}
                <strong>{formatPercentage(this.activeTimePercentage)}%</strong>
                {t({
                  id: 'mage.frost.alwaysBeCasting.statistic.tooltip.li1a',
                  message: ' of your time casting something.',
                })}
              </li>
              <li>
                {t({
                  id: 'mage.frost.alwaysBeCasting.statistic.tooltip.li2',
                  message: 'You spent ',
                })}
                <strong>{formatPercentage(this.downtimePercentage)}%</strong>
                {t({
                  id: 'mage.frost.alwaysBeCasting.statistic.tooltip.li2a',
                  message: ' of your time casting nothing at all.',
                })}
              </li>
            </ul>
          </>
        }
      >
        <div className="pad">
          <label>
            {t({ id: 'mage.frost.alwaysBeCasting.statistic.label', message: 'Active time' })}
          </label>
          <Gauge value={this.activeTimePercentage} />
        </div>
      </Statistic>
    );
  }
}

export default AlwaysBeCasting;
