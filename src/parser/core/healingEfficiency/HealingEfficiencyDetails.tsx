import { t } from '@lingui/core/macro';
import Analyzer from 'parser/core/Analyzer';
import Panel from 'parser/ui/Panel';

import HealingEfficiencyBreakdown from './HealingEfficiencyBreakdown';
import HealingEfficiencyTracker from './HealingEfficiencyTracker';

class HealingEfficiencyDetails extends Analyzer {
  static dependencies = {
    healingEfficiencyTracker: HealingEfficiencyTracker,
  };

  protected healingEfficiencyTracker!: HealingEfficiencyTracker;

  statistic() {
    return (
      <Panel
        title={t({ id: 'shared.healingEfficiency.title', message: 'Mana Efficiency' })}
        position={120}
      >
        <HealingEfficiencyBreakdown tracker={this.healingEfficiencyTracker} />
      </Panel>
    );
  }
}

export default HealingEfficiencyDetails;
