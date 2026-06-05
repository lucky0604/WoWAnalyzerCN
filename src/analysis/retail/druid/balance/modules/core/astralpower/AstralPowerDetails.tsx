import { formatPercentage } from 'common/format';
import { t, defineMessage } from '@lingui/core/macro';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Panel } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';
import BoringResourceValue from 'parser/ui/BoringResourceValue';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import AstralPowerTracker from 'analysis/retail/druid/balance/modules/core/astralpower/AstralPowerTracker';
import { ASTRAL_POWER_SCALE_FACTOR } from '../../../constants';

/**
 * Tracks Astral Power usage / overcap.
 */
class AstralPowerDetails extends Analyzer {
  static dependencies = {
    astralPowerTracker: AstralPowerTracker,
  };
  protected astralPowerTracker!: AstralPowerTracker;

  get wasted() {
    return this.astralPowerTracker.wasted || 0;
  }

  get total() {
    return this.astralPowerTracker.wasted + this.astralPowerTracker.generated || 0;
  }

  get wastedPercent() {
    return this.wasted / this.total || 0;
  }

  // TODO alter stat to show specifically wasted during Eclipse?
  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(1)}
        size="small"
        tooltip={
          t({
            id: 'druid.balance.astralPower.wasted_prefix',
            message: 'Wasted ',
          }) +
          this.wasted * ASTRAL_POWER_SCALE_FACTOR +
          t({
            id: 'druid.balance.astralPower.wasted_middle',
            message: ' out of ',
          }) +
          this.total * ASTRAL_POWER_SCALE_FACTOR +
          t({
            id: 'druid.balance.astralPower.wasted_suffix',
            message: ' Astral Power.',
          })
        }
      >
        <BoringResourceValue
          resource={RESOURCE_TYPES.ASTRAL_POWER}
          value={`${formatPercentage(this.wastedPercent)} %`}
          label={t({
            id: 'druid.balance.astralPower.overcapped_label',
            message: 'Overcapped Astral Power',
          })}
        />
      </Statistic>
    );
  }

  tab() {
    return {
      title: defineMessage({
        id: 'druid.balance.astralPower.usage_title',
        message: 'Astral Power usage',
      }),
      url: 'astral-power-usage',
      render: () => (
        <Panel>
          <ResourceBreakdown
            tracker={this.astralPowerTracker}
            showSpenders
            scaleFactor={ASTRAL_POWER_SCALE_FACTOR}
          />
        </Panel>
      ),
    };
  }
}

export default AstralPowerDetails;
