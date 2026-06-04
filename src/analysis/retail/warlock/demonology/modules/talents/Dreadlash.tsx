import { t } from '@lingui/core/macro';
import { formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import Analyzer, { Options, SELECTED_PLAYER, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import { encodeTargetString } from 'parser/shared/modules/Enemies';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

const DREADLASH_BONUS_DAMAGE = 0.25;
const debug = false;

class Dreadlash extends Analyzer {
  _primaryTarget: string | null = null;
  cleavedDamage = 0;
  bonusDamage = 0; // only from primary target

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.DREADLASH_TALENT);
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER_PET).spell(SPELLS.DREADBITE),
      this.handleDreadbite,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.CALL_DREADSTALKERS),
      this.handleDreadstalkerCast,
    );
  }

  handleDreadbite(event: DamageEvent) {
    const target = encodeTargetString(event.targetID, event.targetInstance);
    if (this._primaryTarget === target) {
      debug && this.log(`Dreadbite damage on ${target}, primary`);
      this.bonusDamage += calculateEffectiveDamage(event, DREADLASH_BONUS_DAMAGE);
    } else {
      debug && this.log(`Dreadbite damage on ${target}, cleaved`);
      this.cleavedDamage += event.amount + (event.absorbed || 0);
    }
  }

  handleDreadstalkerCast(event: CastEvent) {
    if (!event.targetID) {
      debug && this.log('Dreadstalkers cast had no targetID', event);
      return;
    }
    this._primaryTarget = encodeTargetString(event.targetID, event.targetInstance);
    debug && this.log(`Dreadstalkers cast on ${this._primaryTarget}`);
  }

  statistic() {
    const total = this.cleavedDamage + this.bonusDamage;
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <>
            {(() => {
              const damage = formatThousands(total);
              return t({
                id: 'warlock.demonology.dreadlash.bonusDamage',
                message: `${{ damage }} bonus damage`,
              });
            })()}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            {(() => {
              const damage = formatThousands(this.bonusDamage);
              const percent = this.owner.formatItemDamageDone(this.bonusDamage);
              return t({
                id: 'warlock.demonology.dreadlash.primaryTarget',
                message: `Bonus damage on primary target hits: ${{ damage }} (${{ percent }})`,
              });
            })()}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            {(() => {
              const damage = formatThousands(this.cleavedDamage);
              const percent = this.owner.formatItemDamageDone(this.cleavedDamage);
              return t({
                id: 'warlock.demonology.dreadlash.cleavedDamage',
                message: `Bonus cleaved damage: ${{ damage }} (${{ percent }})`,
              });
            })()}
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS.DREADLASH_TALENT}>
          <ItemDamageDone amount={total} />
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default Dreadlash;
