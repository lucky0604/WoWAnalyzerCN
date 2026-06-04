import SPELLS from 'common/SPELLS/evoker';
import TALENTS from 'common/TALENTS/evoker';
import { formatNumber } from 'common/format';

import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Events, { ApplyBuffStackEvent, DamageEvent } from 'parser/core/Events';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import { REACTIVE_HIDE_MULTIPLIER, REGENERATIVE_CHITIN_MULTIPLIER } from '../../constants';

import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import TalentSpellText from 'parser/ui/TalentSpellText';
import { t } from '@lingui/core/macro';

/**
 * Blistering Scales is essentially Augmentations external
 * it provides your target with 30% of your armor along with doing AoE
 * to nearby enemies when said target is meleed. Consuming 1 stack.
 * This effect has an ICD of ~2s
 *
 * There are three supporting talents to Blistering Scales:
 * 1. Reactive Hide:
 * Each time Blistering Scales explodes it deals 10% more damage for 12 sec, stacking 10 times.
 *
 * 2. Regenerative Chitin:
 * Blistering Scales no longer loses stacks and deals 20% additional damage.
 *
 * 3. Molten Blood:
 * When cast, Blistering Scales grants the target a shield that absorbs damage for 30 sec
 * based on their missing health. Lower health targets gain a larger shield.
 */
class BlisteringScales extends Analyzer {
  blisteringScalesDamage = 0;

  hasReactiveHide = false;
  reactiveHideStacks = 0;
  reactiveHideDamage = 0;
  regenerativeChitinDamage = 0;
  totalStacks = 0;
  onHitCount = 0;

  hasRegenerativeChitin = false;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.BLISTERING_SCALES_TALENT);
    this.hasReactiveHide = this.selectedCombatant.hasTalent(TALENTS.REACTIVE_HIDE_TALENT);
    this.hasRegenerativeChitin = this.selectedCombatant.hasTalent(
      TALENTS.REGENERATIVE_CHITIN_TALENT,
    );

    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.BLISTERING_SCALES_DAM),
      this.onHit,
    );
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.REACTIVE_HIDE_BUFF),
      this.onApply,
    );
    this.addEventListener(
      Events.applybuffstack.by(SELECTED_PLAYER).spell(SPELLS.REACTIVE_HIDE_BUFF),
      this.onStackGain,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.REACTIVE_HIDE_BUFF),
      this.onRemove,
    );
  }

  onApply() {
    this.reactiveHideStacks = 1;
  }

  onRemove() {
    this.reactiveHideStacks = 0;
  }

  onStackGain(event: ApplyBuffStackEvent) {
    this.reactiveHideStacks = event.stack;
  }

  onHit(event: DamageEvent) {
    this.reactiveHideDamage += calculateEffectiveDamage(
      event,
      this.reactiveHideStacks * REACTIVE_HIDE_MULTIPLIER,
    );
    if (this.hasRegenerativeChitin) {
      this.regenerativeChitinDamage += calculateEffectiveDamage(
        event,
        REGENERATIVE_CHITIN_MULTIPLIER,
      );
    }
    this.blisteringScalesDamage += event.amount + (event.absorbed ?? 0);
    this.onHitCount += 1;
    this.totalStacks += this.reactiveHideStacks;
  }

  statistic() {
    const averageStacks = this.totalStacks / this.onHitCount;
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(13)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            <li>{t({ id: 'evoker.augmentation.blisteringScales.damage', message: 'Damage' })}: {formatNumber(this.reactiveHideDamage + this.blisteringScalesDamage)}</li>
            {this.hasReactiveHide && <li>{t({ id: 'evoker.augmentation.blisteringScales.averageStacks', message: 'Average Stacks' })}: {averageStacks.toFixed(2)}</li>}
          </>
        }
      >
        <TalentSpellText talent={TALENTS.BLISTERING_SCALES_TALENT}>
          <ItemDamageDone amount={this.blisteringScalesDamage - this.reactiveHideDamage} />
        </TalentSpellText>

        {this.hasRegenerativeChitin && (
          <TalentSpellText talent={TALENTS.REGENERATIVE_CHITIN_TALENT}>
            <ItemDamageDone amount={this.regenerativeChitinDamage} />
          </TalentSpellText>
        )}

        {this.hasReactiveHide && (
          <TalentSpellText talent={TALENTS.REACTIVE_HIDE_TALENT}>
            <ItemDamageDone amount={this.reactiveHideDamage} />
          </TalentSpellText>
        )}
      </Statistic>
    );
  }
}

export default BlisteringScales;
