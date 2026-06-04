import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Events, { CastEvent } from 'parser/core/Events';
import { BadColor, GoodColor, OkColor } from 'interface/guide';
import { ResourceLink, SpellLink } from 'interface';
import DonutChart from 'parser/ui/DonutChart';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import getResourceSpent from 'parser/core/getResourceSpent';
import TALENTS from 'common/TALENTS/rogue';
import { formatDurationMillisMinSec } from 'common/format';

import {
  FINISHERS,
  getTargetComboPoints,
  isAnimachargedFinisherCast,
  isInOpener,
  OPENER_MAX_DURATION_MS,
} from '../../constants';

export default class FinisherUse extends Analyzer {
  totalFinisherCasts = 0;
  animachargedCasts = 0;
  lowCpFinisherCasts = 0;
  openerLowCpFinisherCasts = 0;

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(FINISHERS), this.onCast);
  }

  get maxCpFinishers() {
    return (
      this.totalFinisherCasts -
      this.animachargedCasts -
      this.lowCpFinisherCasts -
      this.openerLowCpFinisherCasts
    );
  }

  get chart() {
    const items = [
      {
        color: GoodColor,
        label: t({
          id: 'rogue.assassination.finisher.maxCpFinishers',
          message: 'Max CP Finishers',
        }),
        value: this.maxCpFinishers,
        tooltip: (
          <Trans id="rogue.assassination.finisher.maxCpFinishersTooltip">
            This includes finishers cast at {getTargetComboPoints(this.selectedCombatant)}+ CPs.
          </Trans>
        ),
      },
      {
        color: OkColor,
        label: t({
          id: 'rogue.assassination.finisher.lowCpOpenerFinishers',
          message: 'Low CP Opener Finishers',
        }),
        value: this.openerLowCpFinisherCasts,
        tooltip: (
          <Trans id="rogue.assassination.finisher.lowCpOpenerFinishersTooltip">
            This includes low CP finisher casts in the first{' '}
            {formatDurationMillisMinSec(OPENER_MAX_DURATION_MS)} of an encounter.
          </Trans>
        ),
      },
      {
        color: BadColor,
        label: t({
          id: 'rogue.assassination.finisher.lowCpFinishers',
          message: 'Low CP Finishers',
        }),
        value: this.lowCpFinisherCasts,
      },
    ];

    if (this.selectedCombatant.hasTalent(TALENTS.ECHOING_REPRIMAND_TALENT)) {
      items.push({
        color: '#40DDF9',
        label: t({
          id: 'rogue.assassination.finisher.animachargedFinishers',
          message: 'Animacharged Finishers',
        }),
        value: this.animachargedCasts,
        tooltip: (
          <Trans id="rogue.assassination.finisher.animachargedFinishersTooltip">
            This includes finishers cast using an Animacharged CP from{' '}
            <SpellLink spell={TALENTS.ECHOING_REPRIMAND_TALENT} />.
          </Trans>
        ),
      });
    }

    return <DonutChart items={items} />;
  }

  statistic() {
    return (
      <Statistic position={STATISTIC_ORDER.CORE(6)}>
        <div className="pad">
          <label>
            <ResourceLink id={RESOURCE_TYPES.COMBO_POINTS.id} />{' '}
            {t({
              id: 'rogue.assassination.finisher.spenderUsage',
              message: 'spender usage',
            })}
          </label>
          {this.chart}
        </div>
      </Statistic>
    );
  }

  private onCast(event: CastEvent) {
    const cpsSpent = getResourceSpent(event, RESOURCE_TYPES.COMBO_POINTS);
    if (cpsSpent === 0) {
      return;
    }

    this.totalFinisherCasts += 1;
    if (isAnimachargedFinisherCast(this.selectedCombatant, event)) {
      this.animachargedCasts += 1;
    } else if (cpsSpent < getTargetComboPoints(this.selectedCombatant)) {
      if (isInOpener(event, this.owner.fight)) {
        this.openerLowCpFinisherCasts += 1;
      } else {
        this.lowCpFinisherCasts += 1;
      }
    }
  }
}
