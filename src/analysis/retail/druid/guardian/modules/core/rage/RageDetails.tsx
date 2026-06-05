import { t, defineMessage } from '@lingui/core/macro';
import Analyzer from 'parser/core/Analyzer';
import RageTracker, {
  RAGE_SCALE_FACTOR,
} from 'analysis/retail/druid/guardian/modules/core/rage/RageTracker';
import { Panel } from 'interface';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';

export default class RageDetails extends Analyzer {
  static dependencies = {
    rageTracker: RageTracker,
  };

  rageTracker!: RageTracker;

  tab() {
    return {
      title: t({ id: 'guardian.rage_details.title', message: 'Rage usage' }),
      url: 'rage-usage',
      render: () => (
        <Panel>
          <ResourceBreakdown
            tracker={this.rageTracker}
            showSpenders
            scaleFactor={RAGE_SCALE_FACTOR}
          />
        </Panel>
      ),
    };
  }
}
