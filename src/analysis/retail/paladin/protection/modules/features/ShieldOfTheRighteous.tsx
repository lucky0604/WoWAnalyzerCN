import { t } from '@lingui/core/macro';
import { formatPercentage, formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellIcon } from 'interface';
import Analyzer, { SELECTED_PLAYER, Options } from 'parser/core/Analyzer';
import Events, { DamageEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import Enemies from 'parser/shared/modules/Enemies';
import { shouldIgnore, magic } from 'parser/shared/modules/hit-tracking/utilities';
import StatisticBox, { STATISTIC_ORDER } from 'parser/ui/StatisticBox';

class ShieldOfTheRighteous extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };

  protected enemies!: Enemies;

  totalHits = 0;
  sotrHits = 0;
  totalDamageTaken = 0;
  sotrDamageTaken = 0;

  constructor(options: Options) {
    super(options);
    // M+ doesn't have a boss prop
    this.addEventListener(Events.damage.to(SELECTED_PLAYER), this.trackHits);
  }

  trackHits(event: DamageEvent) {
    if (shouldIgnore(this.enemies, event) || magic(event)) {
      return;
    }

    const amount = event.amount + (event.absorbed || 0) + (event.overkill || 0);

    this.totalHits += 1;
    this.totalDamageTaken += amount;
    if (this.selectedCombatant.hasBuff(SPELLS.SHIELD_OF_THE_RIGHTEOUS_BUFF.id)) {
      this.sotrHits += 1;
      this.sotrDamageTaken += amount;
    }
  }

  get hitsMitigatedThreshold() {
    return {
      actual: this.sotrHits / this.totalHits,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.85,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  statistic() {
    return (
      <StatisticBox
        position={STATISTIC_ORDER.CORE(10)}
        icon={<SpellIcon spell={SPELLS.SHIELD_OF_THE_RIGHTEOUS} />}
        value={`${formatPercentage(this.sotrHits / this.totalHits)}%`}
        label={t({
          id: 'paladin.protection.shieldOfTheRighteous.physicalHitsMitigated',
          message: 'Physical Hits Mitigated',
        })}
          tooltip={
            <>
              {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p1', message: 'Shield of the Righteous usage breakdown:' })}
              <ul>
                <li>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p2', message: 'You were hit ' })}
                  <strong>{t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.hits', message: '{count}', values: { count: this.sotrHits }})}</strong>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p3', message: ' times with your Shield of the Righteous buff (' })}
                  <strong>{t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.damage', message: '{damage}', values: { damage: formatThousands(this.sotrDamageTaken) }})}</strong>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p4', message: ' damage).' })}
                </li>
                <li>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p5', message: 'You were hit ' })}
                  <strong>{t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.hitsWo', message: '{count}', values: { count: this.totalHits - this.sotrHits }})}</strong>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p6', message: ' times ' })}
                  <strong>
                    <em>{t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.without', message: 'without' })}</em>
                  </strong>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p7', message: ' your Shield of the Righteous buff (' })}
                  <strong>
                    {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.damage2', message: '{damage}', values: { damage: formatThousands(this.totalDamageTaken - this.sotrDamageTaken) }})}
                  </strong>
                  {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p8', message: ' damage).' })}
                </li>
              </ul>
              <strong>{t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.pct', message: '{pct}%', values: { pct: formatPercentage(this.sotrHits / this.totalHits) }})}</strong>
              {t({ id: 'paladin.protection.shieldOfTheRighteous.tooltip.p9', message: ' of physical attacks were mitigated with Shield of the Righteous.' })}
              <br />
            </>
          }
      />
    );
  }
}

export default ShieldOfTheRighteous;
