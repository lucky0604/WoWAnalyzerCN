import { formatNumber, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import UptimeIcon from 'interface/icons/Uptime';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer, { Options, SELECTED_PLAYER, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Events, { DamageEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';

import { TALENTS_MONK } from 'common/TALENTS';
import { ABILITIES_AFFECTED_BY_DAMAGE_INCREASES } from '../../constants';

const MOD_PER_STACK = 0.01;
const MAX_STACKS = 6;

class HitCombo extends Analyzer {
  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.HIT_COMBO_TALENT);
    if (this.active) {
      this.addEventListener(
        Events.damage
          .by(SELECTED_PLAYER | SELECTED_PLAYER_PET)
          .spell(ABILITIES_AFFECTED_BY_DAMAGE_INCREASES),
        this.onAffectedDamage,
      );
    }
  }
  totalDamage = 0;

  onAffectedDamage(event: DamageEvent) {
    const buffInfo = this.selectedCombatant.getBuff(SPELLS.HIT_COMBO_BUFF.id);
    if (!buffInfo) {
      return;
    }
    const mod = buffInfo.stacks * MOD_PER_STACK;
    const increase = calculateEffectiveDamage(event, mod);
    this.totalDamage += increase;
  }

  get uptime() {
    return (
      this.selectedCombatant.getStackWeightedBuffUptime(SPELLS.HIT_COMBO_BUFF.id) /
      (this.owner.fightDuration * MAX_STACKS)
    );
  }

  get dps() {
    return (this.totalDamage / this.owner.fightDuration) * 1000;
  }

  get suggestionThresholds() {
    return {
      actual: this.uptime,
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
      <Statistic
        position={STATISTIC_ORDER.CORE(11)}
        size="flexible"
        tooltip={
          <>
            <div>
              <Trans id="monk.windwalker.hitcombo.total_dmg_inc">
                Total damage increase: {formatNumber(this.totalDamage)}
              </Trans>
            </div>
            <div>
              <Trans id="monk.windwalker.hitcombo.uptime_weighted">
                Uptime is weighted so less stacks count less towards 100% uptime
              </Trans>
            </div>
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS_MONK.HIT_COMBO_TALENT}>
          <div>
            <UptimeIcon /> {formatPercentage(this.uptime)}%{' '}
            <small>
              <Trans id="monk.windwalker.hitcombo.weighted_uptime">Weighted uptime</Trans>
            </small>
          </div>
          <div>
            <img
              src="/img/sword.png"
              alt={t({ id: 'monk.windwalker.hitcombo.weighted_uptime', message: 'Damage' })}
              className="icon"
            />{' '}
            {formatNumber(this.dps)} DPS{' '}
            <small>
              <Trans id="monk.windwalker.hitcombo.pct_total">
                {formatPercentage(this.owner.getPercentageOfTotalDamageDone(this.totalDamage))} % of
                total
              </Trans>
            </small>
          </div>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default HitCombo;
