import { t } from '@lingui/core/macro';
import { formatThousands } from 'common/format';
import TALENTS from 'common/TALENTS/warrior';
import { SpellLink } from 'interface';
import Analyzer, { Options } from 'parser/core/Analyzer';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import StatisticListBoxItem from 'parser/ui/StatisticListBoxItem';

/**
 * Strikes all enemies in front of you with a sweeping attack for [ 45% of Attack Power ] Physical damage.
 * Hitting 3 or more targets inflicts Deep Wounds.
 */

class Cleave extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };

  protected abilityTracker!: AbilityTracker;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.CLEAVE_TALENT);
  }

  subStatistic() {
    const Cleave = this.abilityTracker.getAbility(TALENTS.CLEAVE_TALENT.id);
    const total = Cleave.damageVal.effective;
    const avg = total / (Cleave.casts || 1);
    const totalFormatted = formatThousands(total);
    return (
      <StatisticListBoxItem
        title={
          <>
            {t({
              id: 'warrior.arms.cleave.average',
              message: 'Average',
            })}{' '}
            <SpellLink spell={TALENTS.CLEAVE_TALENT} />{' '}
            {t({
              id: 'warrior.arms.cleave.damage',
              message: 'damage',
            })}
          </>
        }
        value={formatThousands(avg)}
        valueTooltip={t({
          id: 'warrior.arms.cleave.totalDamage',
          message: 'Total Cleave damage: {total}',
          values: { total: totalFormatted },
        })}
      />
    );
  }
}

export default Cleave;
