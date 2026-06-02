import { formatNumber, formatPercentage } from 'common/format';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink, TooltipElement } from 'interface';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import Statistic from 'parser/ui/Statistic';
import StatisticListBoxItem from 'parser/ui/StatisticListBoxItem';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import TalentSpellText from 'parser/ui/TalentSpellText';
import Events, { RemoveBuffEvent, RemoveBuffStackEvent, CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS';
import SheilunsGift from './SheilunsGift';
import { getSheilunsGiftHits } from '../../normalizers/CastLinkNormalizer';
import { effectiveHealing } from 'parser/shared/modules/HealingValue';
import { SHEILUNS_GIFT_MAX_CLOUDS } from '../../constants';

class TranquilTea extends Analyzer.withDependencies({
  sheilunsGift: SheilunsGift,
}) {
  totalExtraClouds = 0;
  totalSGCasts = 0;
  totalHealing = 0;
  extraCloudsAtLastCast = 0;
  wastedClouds = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.TRANQUIL_TEA_TALENT);

    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.MANA_TEA_STACK),
      this.onManaTeaStackRemove,
    );
    this.addEventListener(
      Events.removebuffstack.by(SELECTED_PLAYER).spell(SPELLS.MANA_TEA_STACK),
      this.onManaTeaStackRemove,
    );

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_MONK.SHEILUNS_GIFT_TALENT),
      this.onSheilunsGiftCast,
    );
  }

  onManaTeaStackRemove(event: RemoveBuffEvent | RemoveBuffStackEvent) {
    if (this.selectedCombatant.hasBuff(SPELLS.MANA_TEA_CAST.id, event.timestamp, 50)) {
      const currentClouds = this.selectedCombatant.getBuffStacks(SPELLS.SHEILUN_CLOUD_BUFF.id);

      if (currentClouds === SHEILUNS_GIFT_MAX_CLOUDS) {
        this.wastedClouds += 1;
      } else {
        this.extraCloudsAtLastCast += 1;
        this.totalExtraClouds += 1;
      }
    }
  }

  onSheilunsGiftCast(event: CastEvent) {
    this.totalSGCasts += 1;

    const totalClouds = this.selectedCombatant.getBuffStacks(SPELLS.SHEILUN_CLOUD_BUFF.id);
    const extraClouds = Math.min(this.extraCloudsAtLastCast, totalClouds);

    const healEvents = getSheilunsGiftHits(event);
    if (healEvents && healEvents.length > 0 && totalClouds > 0) {
      const totalCastHealing = healEvents.reduce((sum, heal) => sum + effectiveHealing(heal), 0);

      const tranquilTeaPortion = extraClouds / totalClouds;
      this.totalHealing += totalCastHealing * tranquilTeaPortion;
    }

    this.extraCloudsAtLastCast = 0;
  }

  subStatistic() {
    return (
      <StatisticListBoxItem
        title={<SpellLink spell={TALENTS_MONK.TRANQUIL_TEA_TALENT} />}
        value={`${formatPercentage(
          this.owner.getPercentageOfTotalHealingDone(this.totalHealing),
        )} %`}
      />
    );
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(4)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={(() => {
          const total = formatNumber(this.totalHealing);
          const wasted = this.wastedClouds;
          return (
            <>
              <div>
                <Trans id="monk.mistweaver.tranquil_tea.total_healing">
                  Total healing from extra clouds: {total}
                </Trans>
              </div>
              <div>
                <Trans id="monk.mistweaver.tranquil_tea.wasted">
                  Wasted clouds from overdrinking: {wasted}
                </Trans>
              </div>
            </>
          );
        })()}
      >
        <TalentSpellText talent={TALENTS_MONK.TRANQUIL_TEA_TALENT}>
          <ItemHealingDone amount={this.totalHealing} />
          <div>
            <TooltipElement
              content={(() => {
                const avg = (this.totalExtraClouds / this.totalSGCasts || 0).toFixed(1);
                return (
                  <Trans id="monk.mistweaver.tranquil_tea.avg_extra">
                    {avg} <small>average extra clouds per cast</small>
                  </Trans>
                );
              })()}
            >
              {this.totalExtraClouds}{' '}
              <small>
                {t({ id: 'monk.mistweaver.tranquil_tea.extra_clouds', message: 'extra clouds' })}
              </small>
            </TooltipElement>
          </div>
        </TalentSpellText>
      </Statistic>
    );
  }
}

export default TranquilTea;
