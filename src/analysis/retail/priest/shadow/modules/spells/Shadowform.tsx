import { t } from '@lingui/core/macro';
import TALENTS from 'common/TALENTS/priest';
import Analyzer from 'parser/core/Analyzer';
import SPELLS from 'common/SPELLS';
import Enemies from 'parser/shared/modules/Enemies';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import { formatPercentage } from 'common/format';
import { SpellLink } from 'interface';
import { Section } from 'interface/guide';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { PerformanceStrong } from 'analysis/retail/priest/shadow/modules/guide/ExtraComponents';

class Shadowform extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };
  protected enemies!: Enemies;

  damage = 0;
  buffduration = 0;

  get uptime() {
    this.buffduration =
      this.selectedCombatant.getBuffUptime(SPELLS.SHADOWFORM.id) +
      this.selectedCombatant.getBuffUptime(SPELLS.VOIDFORM_BUFF.id); //Voidform removes Shadowform, but still gives the damage increase.

    //If the player is in shadowform before combat, and never leaves shadowform, then the log does not show any uptime of the buff.
    //We can check if this is the case by casts of Devouring Plague, as it is only castable in shadowform.
    //So if there are any casts of Devouring Plague, then it must have been active the entire combat.

    const dpUptime = this.enemies.getBuffUptime(TALENTS.SHADOW_WORD_MADNESS_TALENT.id);

    if (this.buffduration === 0 && dpUptime !== 0) {
      return 1;
    }

    return this.buffduration / this.owner.fightDuration;
  }

  get DowntimePerformance(): QualitativePerformance {
    const downtime = 1 - this.uptime;
    if (downtime <= 0.001) {
      return QualitativePerformance.Perfect;
    }
    if (downtime <= 0.01) {
      return QualitativePerformance.Good;
    }
    return QualitativePerformance.Fail;
  }

  get guideSubsection() {
    if (this.uptime < 0.99) {
      //show this info in guide view if out of form for more than 1% of the fight.
      return (
        <Section
          title={t({
            id: 'priest.shadow.shadowform.title',
            message: 'Shadowform',
          })}
        >
          <p>
            <b>
              {t({
                id: 'priest.shadow.shadowform.stayInForm',
                message: 'Stay in',
              })}{' '}
              <SpellLink spell={SPELLS.SHADOWFORM} />{' '}
              {t({ id: 'priest.shadow.shadowform.or', message: 'or' })}{' '}
              <SpellLink spell={SPELLS.VOIDFORM} />. <div />
            </b>
            {t({
              id: 'priest.shadow.shadowform.damageIncrease',
              message: 'These forms increase your shadow damage by 10%.',
            })}{' '}
            <div />
            <b>
              {t({
                id: 'priest.shadow.shadowform.outOfFormPrefix',
                message: 'You were out of shadowform for',
              })}{' '}
              <PerformanceStrong performance={this.DowntimePerformance}>
                {formatPercentage(1 - this.uptime, 1)}%
              </PerformanceStrong>{' '}
              {t({
                id: 'priest.shadow.shadowform.ofTheFight',
                message: 'of the fight.',
              })}
            </b>
          </p>
        </Section>
      );
    }
  }

  statistic() {
    return (
      <Statistic
        category={STATISTIC_CATEGORY.GENERAL}
        size="flexible"
        tooltip={t({
          id: 'priest.shadow.shadowform.alwaysInForm',
          message: 'You should always be in shadowform (or voidform)',
        })}
      >
        <BoringSpellValueText spell={SPELLS.SHADOWFORM}>
          <div>
            {formatPercentage(this.uptime, 1)}%{' '}
            <small>
              {t({ id: 'priest.shadow.shadowform.uptime', message: 'uptime' })}
            </small>
          </div>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default Shadowform;
