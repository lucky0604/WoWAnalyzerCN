import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from 'common/format';
import TALENTS from 'common/TALENTS/mage';
import { SELECTED_PLAYER, Options } from 'parser/core/Analyzer';
import Analyzer from 'parser/core/Analyzer';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import Events, { CastEvent, DamageEvent, EventType, GetRelatedEvents } from 'parser/core/Events';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import { MageStatistic } from '../../shared/components/statistics';

export default class ArcaneEcho extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };
  protected abilityTracker!: AbilityTracker;

  arcaneEchoes: ArcaneEchoData[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.ARCANE_ECHO_TALENT);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.TOUCH_OF_THE_MAGI_TALENT),
      this.onTouchMagiCast,
    );
  }

  onTouchMagiCast(event: CastEvent) {
    const damageEvents: DamageEvent[] = GetRelatedEvents(event, EventType.Damage);

    this.arcaneEchoes.push({
      touchMagiCast: event.timestamp,
      damageEvents: damageEvents || [],
      totalDamage: this.getTotalDamage(damageEvents),
    });
  }

  private getTotalDamage(damageEvents: DamageEvent[]): number {
    let damage = 0;
    damageEvents.forEach((a) => (damage += a.amount + (a.absorbed || 0)));
    return damage;
  }

  get averageDamagePerTouch() {
    let totalDamage = 0;
    this.arcaneEchoes.forEach((a) => (totalDamage += a.totalDamage));
    return totalDamage / this.abilityTracker.getAbility(TALENTS.TOUCH_OF_THE_MAGI_TALENT.id).casts;
  }

  statistic() {
    return (
      <MageStatistic
        spell={TALENTS.ARCANE_ECHO_TALENT}
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <Trans id="mage.arcane.arcaneEcho.tooltip">
            On average you did {formatNumber(this.averageDamagePerTouch)} damage per Touch of the
            Magi cast.
          </Trans>
        }
      >
        <MageStatistic.Number
          value={this.averageDamagePerTouch}
          label={t({ id: 'mage.arcane.arcaneEcho.label', message: 'Average Damage' })}
        />
      </MageStatistic>
    );
  }
}

export interface ArcaneEchoData {
  touchMagiCast: number;
  damageEvents?: DamageEvent[];
  totalDamage: number;
}
