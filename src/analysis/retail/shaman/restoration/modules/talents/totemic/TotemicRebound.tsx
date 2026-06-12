import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import TALENTS from 'common/TALENTS/shaman';
import SPELLS from 'common/SPELLS';
import Events, { HealEvent } from 'parser/core/Events';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import TalentSpellText from 'parser/ui/TalentSpellText';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import { formatNumber } from 'common/format';

export default class TotemicRebound extends Analyzer {
  healingDoneFromTalent = 0;
  overhealingDoneFromTalent = 0;
  chainHealCasts = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.TOTEMIC_REBOUND_TALENT);
    if (!this.active) {
      return;
    }
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER_PET).spell(SPELLS.TOTEMIC_REBOUND_CHAIN_HEAL),
      this.onChainHeal,
    );
  }

  onChainHeal(event: HealEvent) {
    this.healingDoneFromTalent += event.amount;
    this.overhealingDoneFromTalent += event.overheal ?? 0;
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.HERO_TALENTS}
        tooltip={
          <strong>
            {t({
              id: 'shaman.restoration.totemicRebound.tooltip',
              message: '{0} bonus healing ({1} overhealing)',
              values: {
                0: formatNumber(this.healingDoneFromTalent),
                1: formatNumber(this.overhealingDoneFromTalent),
              },
            })}
          </strong>
        }
      >
        <TalentSpellText talent={TALENTS.TOTEMIC_REBOUND_TALENT}>
          <div>
            <ItemHealingDone amount={this.healingDoneFromTalent} />{' '}
          </div>
        </TalentSpellText>
      </Statistic>
    );
  }
}
