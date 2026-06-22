import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatNumber, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { HealEvent } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

const UNHOLY_STRENGTH_STRENGTH = 0.15; // 15% Str buff while active

class RuneOfTheFallenCrusader extends Analyzer {
  healing = 0;
  overhealing = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasWeaponEnchant(SPELLS.RUNE_OF_THE_FALLEN_CRUSADER);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.heal.to(SELECTED_PLAYER).spell(SPELLS.UNHOLY_STRENGTH_BUFF),
      this._onHeal,
    );
  }

  _onHeal(event: HealEvent) {
    if (event.overheal) {
      this.overhealing += event.overheal;
    }
    this.healing += event.amount + event.absorb;
  }

  get overhealPercentage() {
    return this.overhealing / this.healing;
  }

  get uptime() {
    return (
      this.selectedCombatant.getBuffUptime(SPELLS.UNHOLY_STRENGTH_BUFF.id) /
      this.owner.fightDuration
    );
  }

  get averageStrength() {
    return this.uptime * UNHOLY_STRENGTH_STRENGTH;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(2)}
        category={STATISTIC_CATEGORY.ITEMS}
        size="flexible"
        tooltip={
          <>
            <strong>
              {t({
                id: 'deathknight.shared.runeOfTheFallenCrusader.statistic.tooltip.uptime',
                message: 'Uptime: ',
              })}
            </strong>
            {formatPercentage(this.uptime)}% <br />
            <strong>
              {t({
                id: 'deathknight.shared.runeOfTheFallenCrusader.statistic.tooltip.healing',
                message: 'Healing: ',
              })}
            </strong>
            {formatNumber(this.healing)} <br />
            <strong>
              {t({
                id: 'deathknight.shared.runeOfTheFallenCrusader.statistic.tooltip.overhealing',
                message: 'Overhealing: ',
              })}
            </strong>
            {formatNumber(this.overhealing)} ({formatPercentage(this.overhealPercentage)} %) <br />
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER}>
          <>{formatPercentage(this.averageStrength)}
            {t({ id: 'deathknight.shared.runeOfTheFallenCrusader.statistic.p1', message: '%' })}
            <small>{t({ id: 'deathknight.shared.runeOfTheFallenCrusader.statistic.small', message: 'average Strength' })}</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default RuneOfTheFallenCrusader;
