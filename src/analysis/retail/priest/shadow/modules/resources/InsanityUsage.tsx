import { t } from '@lingui/core/macro';
import { formatPercentage } from 'common/format';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Panel } from 'interface';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';
import Analyzer from 'parser/core/Analyzer';
import BoringResourceValue from 'parser/ui/BoringResourceValue';
import Statistic from 'parser/ui/Statistic';

import InsanityTracker from './InsanityTracker';

class InsanityUsage extends Analyzer {
  static dependencies = {
    insanityTracker: InsanityTracker,
  };
  protected insanityTracker!: InsanityTracker;

  get wasted() {
    return this.insanityTracker.wasted || 0;
  }

  get total() {
    return this.insanityTracker.wasted + this.insanityTracker.generated || 0;
  }

  get wastePercentage() {
    return this.wasted / this.total;
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        tooltip={`${t({ id: 'priest.shadow.insanityUsage.youWasted', message: 'You wasted' })} ${this.wasted} ${t({ id: 'priest.shadow.insanityUsage.outOf', message: 'out of' })} ${this.total} ${t({ id: 'priest.shadow.insanityUsage.insanityDueToOvercapping', message: 'Insanity due to overcapping.' })}`}
      >
        <BoringResourceValue
          resource={RESOURCE_TYPES.INSANITY}
          value={`${formatPercentage(this.wastePercentage)}%`}
          label={t({
            id: 'priest.shadow.insanityUsage.wastedInsanity',
            message: 'Wasted Insanity',
          })}
        />
      </Statistic>
    );
  }

  tab() {
    return {
      title: 'Insanity',
      url: 'insanity-usage',
      render: () => (
        <Panel>
          <ResourceBreakdown tracker={this.insanityTracker} showSpenders={false} />
        </Panel>
      ),
    };
  }
}

export default InsanityUsage;
