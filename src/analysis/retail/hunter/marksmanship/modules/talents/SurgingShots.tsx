import { SURGING_SHOTS_RESET_CHANCE } from 'analysis/retail/hunter/marksmanship/constants';
import SpellUsable from 'analysis/retail/hunter/marksmanship/modules/core/SpellUsable';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events from 'parser/core/Events';
import { plotOneVariableBinomChart } from 'parser/shared/modules/helpers/Probability';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

/**
 * Rapid Fire deals 25% additional damage, and Aimed Shot has a 15% chance to reset the cooldown of Rapid Fire.
 *
 * Example log:
 *
 */
class SurgingShots extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  aimedShotCasts = 0;

  protected spellUsable!: SpellUsable;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.SURGING_SHOTS_TALENT);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.AIMED_SHOT_TALENT),
      this.onAimedShotCast,
    );
  }

  onAimedShotCast() {
    this.aimedShotCasts += 1;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE()}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        dropdown={
          <>
            <div style={{ padding: '8px' }}>
              {plotOneVariableBinomChart(
                this.spellUsable.rapidFireResets,
                this.aimedShotCasts,
                SURGING_SHOTS_RESET_CHANCE,
              )}
              <>
                {t({
                  id: 'hunter.marksmanship.surgingShots.procLikelihood.p1',
                  message: 'Likelihood of getting ',
                })}
                <em>
                  {t({
                    id: 'hunter.marksmanship.surgingShots.procLikelihood.em',
                    message: 'exactly',
                  })}
                </em>
                {t({
                  id: 'hunter.marksmanship.surgingShots.procLikelihood.p2',
                  message: ' as many procs as estimated on a fight given your number of ',
                })}
                <SpellLink spell={TALENTS.AIMED_SHOT_TALENT} />
                {t({
                  id: 'hunter.marksmanship.surgingShots.procLikelihood.p3',
                  message: ' casts.',
                })}
              </>
            </div>
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS.SURGING_SHOTS_TALENT}>
          <>
            {this.spellUsable.rapidFireResets} <small>Rapid Fire resets</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default SurgingShots;
