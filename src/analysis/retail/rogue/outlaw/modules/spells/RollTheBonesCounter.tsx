import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import DonutChart from 'parser/ui/DonutChart';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import SPELLS from 'common/SPELLS/rogue';
import { t } from '@lingui/core/macro';

import RollTheBonesCastTracker, { RTBCast } from '../features/RollTheBonesCastTracker';

class RollTheBonesCounter extends Analyzer {
  static dependencies = {
    rollTheBonesCastTracker: RollTheBonesCastTracker,
  };
  protected rollTheBonesCastTracker!: RollTheBonesCastTracker;

  rolltheBonesBuffDistributionChart() {
    const castTracker = this.rollTheBonesCastTracker;

    const distributionObj = castTracker.rolltheBonesCastEvents.reduce(
      (buffLevel: Record<number, number>, cast: RTBCast) => {
        buffLevel[cast.appliedBuffs.length] = (buffLevel[cast.appliedBuffs.length] || 0) + 1;
        return buffLevel;
      },
      {},
    );

    const items = [
      {
        color: '#00b159',
        label: <>{t({ id: 'rogue.outlaw.rollTheBonesCounter.oneBuff', message: '1 Buff' })}</>,
        value: distributionObj[1] || 0,
      },
      {
        color: '#db00db',
        label: <>{t({ id: 'rogue.outlaw.rollTheBonesCounter.twoBuffs', message: '2 Buffs' })}</>,
        value: distributionObj[2] || 0,
      },
      {
        color: '#f37735',
        label: <>{t({ id: 'rogue.outlaw.rollTheBonesCounter.fiveBuffs', message: '5 Buffs' })}</>,
        value: distributionObj[5] || 0,
      },
    ];

    return <DonutChart items={items} />;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL()}
        tooltip={t({
          id: 'rogue.outlaw.rollTheBonesCounter.tooltip',
          message:
            'Simulated averages are approximately 80% chance for 1 buff, 19% chance for 2 buffs, 1% chance for 5 buffs',
        })}
      >
        <div className="pad">
          <label>
            <SpellLink spell={SPELLS.ROLL_THE_BONES} />{' '}
            {t({
              id: 'rogue.outlaw.rollTheBonesCounter.distribution',
              message: 'distribution',
            })}
          </label>
          {this.rolltheBonesBuffDistributionChart()}
        </div>
      </Statistic>
    );
  }
}

export default RollTheBonesCounter;
