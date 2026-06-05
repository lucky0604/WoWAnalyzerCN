import { t } from '@lingui/core/macro';
import { Panel } from 'interface';
import Analyzer from 'parser/core/Analyzer';

import ComboPointTracker from 'analysis/retail/druid/feral/modules/core/combopoints/ComboPointTracker';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';

class ComboPointDetails extends Analyzer {
  static dependencies = {
    comboPointTracker: ComboPointTracker,
  };

  comboPointTracker!: ComboPointTracker;

  tab() {
    return {
      title: t({ id: 'druid.feral.combo_point_details.title', message: 'Combo Point usage' }),
      url: 'combo-points',
      render: () => (
        <Panel>
          <ResourceBreakdown tracker={this.comboPointTracker} showSpenders showMaxSpenders />
        </Panel>
      ),
    };
  }
}

export default ComboPointDetails;
