import { formatPercentage } from 'common/format';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Panel } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { ThresholdStyle } from 'parser/core/ParseResults';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';
import BoringResourceValue from 'parser/ui/BoringResourceValue';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { t, defineMessage } from '@lingui/core/macro';

import RunicPowerTracker from './RunicPowerTracker';

class RunicPowerDetails extends Analyzer {
  static dependencies = {
    runicPowerTracker: RunicPowerTracker,
  };

  protected runicPowerTracker!: RunicPowerTracker;

  get wastedPercent() {
    return (
      this.runicPowerTracker.wasted /
        (this.runicPowerTracker.wasted + this.runicPowerTracker.generated) || 0
    );
  }

  get efficiencySuggestionThresholds() {
    return {
      actual: 1 - this.wastedPercent,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.85,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get suggestionThresholds() {
    return {
      actual: this.wastedPercent,
      isGreaterThan: {
        minor: 0.05,
        average: 0.1,
        major: 0.15,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(3)}
        size="small"
        tooltip={t({
          id: 'deathknight.unholy.runicPowerDetails.tooltipWasted',
          message: '{wasted} out of {total} runic power wasted.',
          values: {
            wasted: this.runicPowerTracker.wasted,
            total: this.runicPowerTracker.wasted + this.runicPowerTracker.generated,
          },
        })}
      >
        <BoringResourceValue
          resource={RESOURCE_TYPES.RUNIC_POWER}
          value={`${formatPercentage(this.wastedPercent)} %`}
          label={t({
            id: 'deathknight.unholy.runicPowerDetails.labelWasted',
            message: 'Runic Power wasted',
          })}
        />
      </Statistic>
    );
  }

  tab() {
    return {
      title: defineMessage({
        id: 'deathknight.unholy.runicPowerDetails.tabTitle',
        message: 'Runic Power usage',
      }),
      url: 'runic-power-usage',
      render: () => (
        <Panel>
          <ResourceBreakdown tracker={this.runicPowerTracker} showSpenders />
        </Panel>
      ),
    };
  }
}

export default RunicPowerDetails;
