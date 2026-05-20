import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { HasHitpoints, HealEvent } from 'parser/core/Events';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { TALENTS_MONK } from 'common/TALENTS';
import TalentSpellText from 'parser/ui/TalentSpellText';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import { formatNumber, formatPercentage } from 'common/format';
import { calculateEffectiveHealing } from 'parser/core/EventCalculateLib';
import { SpellLink } from 'interface';
import StatisticListBoxItem from 'parser/ui/StatisticListBoxItem';
import { SAVE_THEM_ALL_MAX_INCREASE } from '../mistweaver/constants';
import { Trans } from '@lingui/react/macro';

class SaveThemAll extends Analyzer {
  totalHealed = 0;
  excludedHealing = 0;
  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.SAVE_THEM_ALL_TALENT);

    this.addEventListener(Events.heal.by(SELECTED_PLAYER), this.onHeal);
  }

  onHeal(event: HealEvent) {
    const healAmount = event.amount || 0;

    if (!HasHitpoints(event)) {
      this.excludedHealing += healAmount;
      return;
    }

    const hpBeforeHeal = event.hitPoints - healAmount;
    const healingIncrease = (1 - hpBeforeHeal / event.maxHitPoints) * SAVE_THEM_ALL_MAX_INCREASE;

    this.totalHealed += calculateEffectiveHealing(event, healingIncrease);
  }

  subStatistic() {
    return (
      <StatisticListBoxItem
        title={<SpellLink spell={TALENTS_MONK.SAVE_THEM_ALL_TALENT} />}
        value={`${formatPercentage(
          this.owner.getPercentageOfTotalHealingDone(this.totalHealed),
        )} %`}
      />
    );
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(12)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            <div>
              {(() => {
                const amount = formatNumber(this.totalHealed);
                return (
                  <Trans id="monk.shared.save_them_all.total_healed">
                    Total Healed: {amount}
                  </Trans>
                );
              })()}
            </div>
            {this.excludedHealing > 0 && (
              <div>
                {(() => {
                  const pct = formatPercentage(this.owner.getPercentageOfTotalHealingDone(this.excludedHealing));
                  return (
                    <Trans id="monk.shared.save_them_all.excluded_healing">
                      Excluded healing with incomplete data: {pct}% of total
                    </Trans>
                  );
                })()}
              </div>
            )}
          </>
        }
      >
        <TalentSpellText talent={TALENTS_MONK.SAVE_THEM_ALL_TALENT}>
          <ItemHealingDone amount={this.totalHealed} />
        </TalentSpellText>
      </Statistic>
    );
  }
}

export default SaveThemAll;
