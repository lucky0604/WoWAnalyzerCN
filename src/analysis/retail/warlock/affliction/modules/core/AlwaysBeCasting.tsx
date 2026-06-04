import { t } from '@lingui/core/macro';
import { formatPercentage } from 'common/format';
import { ThresholdStyle } from 'parser/core/ParseResults';
import CoreAlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import Gauge from 'parser/ui/Gauge';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { SubSection } from 'interface/guide';

class AlwaysBeCasting extends CoreAlwaysBeCasting {
  position = STATISTIC_ORDER.CORE(6);

  get suggestionThresholds() {
    return {
      actual: this.downtimePercentage,
      isGreaterThan: {
        minor: 0.1,
        average: 0.15,
        major: 0.2,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(10)}
        tooltip={
          <>
            {t({
              id: 'warlock.affliction.alwaysBeCasting.downtimeExplanation',
              message:
                'Downtime is available time not used to cast anything (including not having your GCD rolling). This can be caused by delays between casting spells, latency, cast interrupting or just simply not casting anything (e.g. due to movement/stunned).',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <ul>
              <li>
                {t({
                  id: 'warlock.affliction.alwaysBeCasting.timeSpentCasting',
                  message:
                    'You spent {activeTimePercentage}% of your time casting something.',
                  values: { activeTimePercentage: formatPercentage(this.activeTimePercentage) },
                })}
              </li>
              <li>
                {t({
                  id: 'warlock.affliction.alwaysBeCasting.timeSpentInactive',
                  message:
                    'You spent {downtimePercentage}% of your time casting nothing at all.',
                  values: { downtimePercentage: formatPercentage(this.downtimePercentage) },
                })}
              </li>
            </ul>
          </>
        }
      >
        <div className="pad">
          <label>
            {t({
              id: 'warlock.affliction.alwaysBeCasting.activeTimeLabel',
              message: 'Active time',
            })}
          </label>
          <Gauge value={this.activeTimePercentage} />
        </div>
      </Statistic>
    );
  }

  get GuideSubSection() {
    return (
      <SubSection
        title={t({
          id: 'warlock.affliction.alwaysBeCasting.title',
          message: 'Always Be Casting',
        })}
      >
        {t({
          id: 'warlock.affliction.alwaysBeCasting.description',
          message: 'Try to minimize downtime between spells. Your active casting time was {activeTimePercentage}%.',
          values: { activeTimePercentage: formatPercentage(this.activeTimePercentage) },
        })}
      </SubSection>
    );
  }
}

export default AlwaysBeCasting;
