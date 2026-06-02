// Heavily inspired by resource breakdown in Feral and Retribution

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatPercentage } from 'common/format';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Panel } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { ThresholdStyle } from 'parser/core/ParseResults';
import ResourceBreakdown from 'parser/shared/modules/resources/resourcetracker/ResourceBreakdown';
import BoringResourceValue from 'parser/ui/BoringResourceValue';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';

import ChiTracker from './ChiTracker';

class ChiDetails extends Analyzer {
  static dependencies = {
    chiTracker: ChiTracker,
  };

  protected chiTracker!: ChiTracker;

  get chiWasted() {
    return this.chiTracker.wasted;
  }

  get chiWastedPercent() {
    return this.chiWasted / (this.chiWasted + this.chiTracker.generated) || 0;
  }

  get chiWastedPerMinute() {
    return (this.chiWasted / this.owner.fightDuration) * 1000 * 60;
  }

  get suggestionThresholds() {
    return {
      actual: this.chiWastedPerMinute,
      isGreaterThan: {
        minor: 0,
        average: 1,
        major: 2,
      },
      style: ThresholdStyle.DECIMAL,
    };
  }

  // eslint-disable-next-line typescript-eslint/no-explicit-any -- dead API, no longer in ParseResults
  suggestions(when: any) {
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- dead API, no longer in ParseResults
    when(this.suggestionThresholds).addSuggestion(
      // eslint-disable-next-line typescript-eslint/no-explicit-any -- dead API
      (suggest: any, actual: number, recommended: number) =>
        suggest(
          t({
            id: 'monk.windwalker.chi_details.suggest',
            message: 'You are wasting Chi. Try to use it and not let it cap and go to waste',
          }),
        )
          .icon('creatureportrait_bubble')
          .actual(
            t({
              id: 'monk.windwalker.suggestions.chi.wastedPerMinute',
              message: '{chiWasted, number} Chi wasted ({perMinute, number} per minute)',
            }),
          )
          .recommended(`${recommended} Chi wasted is recommended`),
    );
  }

  statistic() {
    return (
      <Statistic
        size="small"
        position={STATISTIC_ORDER.CORE(1)}
        tooltip={
          <Trans id="monk.windwalker.chi_details.wasted">
            {formatPercentage(this.chiWastedPercent)}% wasted
          </Trans>
        }
        drilldown="../chi"
      >
        <BoringResourceValue
          resource={RESOURCE_TYPES.CHI}
          value={this.chiWasted}
          label={t({ id: 'monk.windwalker.chi_details.label', message: 'Wasted Chi' })}
        />
      </Statistic>
    );
  }

  tab() {
    return {
      title: t({ id: 'monk.windwalker.chi_details.tab', message: 'Chi' }),
      url: 'chi',
      render: () => (
        <Panel>
          <ResourceBreakdown tracker={this.chiTracker} showSpenders />
        </Panel>
      ),
    };
  }
}

export default ChiDetails;
