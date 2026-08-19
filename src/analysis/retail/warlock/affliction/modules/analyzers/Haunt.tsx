import { t } from '@lingui/core/macro';
import { formatPercentage, formatThousands, formatNumber } from 'common/format';
import TALENTS from 'common/TALENTS/warlock';
import { SpellLink, TooltipElement } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Events, { DamageEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import Enemies from 'parser/shared/modules/Enemies';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import { type JSX } from 'react';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';

const BAR_COLOR = '#00C853';

class Haunt extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };
  protected enemies!: Enemies;

  get shadowOfNathrezaBonus() {
    let bonus = 0;

    bonus +=
      0.02 * this.selectedCombatant.getTalentRank(TALENTS.SHADOW_OF_NATHREZA_2_AFFLICTION_TALENT);
    return bonus;
  }

  get hauntDamageBonus() {
    return 0.16 + this.shadowOfNathrezaBonus;
  }

  get uptime() {
    return this.enemies.getBuffUptime(TALENTS.HAUNT_TALENT.id) / this.owner.fightDuration;
  }

  get dps() {
    return (this.bonusDmg / this.owner.fightDuration) * 1000;
  }

  get uptimeHistory() {
    return this.enemies.getDebuffHistory(TALENTS.HAUNT_TALENT.id);
  }

  get DowntimePerformance() {
    const downtime = 1 - this.uptime;

    if (downtime <= 0.01) return QualitativePerformance.Perfect;
    if (downtime <= 0.05) return QualitativePerformance.Good;
    if (downtime <= 0.1) return QualitativePerformance.Ok;

    return QualitativePerformance.Fail;
  }

  get suggestionThresholds() {
    return {
      actual: this.uptime,
      isLessThan: {
        minor: 0.9,
        average: 0.85,
        major: 0.75,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  bonusDmg = 0;
  totalTicks = 0;
  buffedTicks = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.HAUNT_TALENT);
    this.addEventListener(Events.damage.by(SELECTED_PLAYER), this.onDamage);
  }

  onDamage(event: DamageEvent) {
    const target = this.enemies.getEntity(event);
    if (!target) {
      return;
    }

    const hasHaunt = target.hasBuff(TALENTS.HAUNT_TALENT.id, event.timestamp);

    if (hasHaunt) {
      this.bonusDmg += calculateEffectiveDamage(event, this.hauntDamageBonus);
    }
  }

  statistic() {
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <>
            {formatThousands(this.bonusDmg)}{' '}
            {t({ id: 'warlock.affliction.haunt.bonusDamage', message: 'bonus damage' })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS.HAUNT_TALENT}>
          <div>
            {formatPercentage(this.uptime)} %{' '}
            <small>
              {t({ id: 'warlock.affliction.haunt.uptimeLabel', message: 'uptime' })}
            </small>
          </div>
          <div>
            {formatNumber(this.dps)} DPS{' '}
            <small>
              {formatPercentage(this.owner.getPercentageOfTotalDamageDone(this.bonusDmg))} %
              {t({ id: 'warlock.affliction.haunt.ofTotal', message: 'of total' })}
            </small>
          </div>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  subStatistic() {
    return uptimeBarSubStatistic(this.owner.fight, {
      spells: [TALENTS.HAUNT_TALENT],
      uptimes: this.uptimeHistory,
      color: BAR_COLOR,
      perf: this.DowntimePerformance,
    });
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <b>
            {t({
              id: 'warlock.affliction.haunt.keepActive',
              message: 'Keep Haunt active on your primary target.',
            })}
          </b>
        </p>

        <p>
          {t({
            id: 'warlock.affliction.haunt.increasesDamage',
            message: 'Haunt increases your damage dealt to the target by',
          })}{' '}
          <TooltipElement
            content={
              <>
                {t({
                  id: 'warlock.affliction.haunt.damageBonusBreakdown',
                  message: "Haunt's damage bonus:",
                })}
                <ul>
                  <li>
                    {t({
                      id: 'warlock.affliction.haunt.baselinePlus',
                      message: '+12% baseline',
                    })}
                  </li>
                  {this.shadowOfNathrezaBonus > 0 && (
                    <li>
                      +{formatPercentage(this.shadowOfNathrezaBonus, 0)}%{' '}
                      {t({ id: 'warlock.affliction.haunt.from', message: 'from' })}{' '}
                      <SpellLink spell={TALENTS.SHADOW_OF_NATHREZA_2_AFFLICTION_TALENT} />
                    </li>
                  )}
                </ul>
              </>
            }
          >
            <b>{formatPercentage(this.hauntDamageBonus, 0)}%</b>
          </TooltipElement>{' '}
          {t({
            id: 'warlock.affliction.haunt.forNSeconds',
            message: 'for 18 seconds. You should always reapply it before it falls off.',
          })}
        </p>

        {this.DowntimePerformance === QualitativePerformance.Ok && (
          <p style={{ color: 'orange' }}>
            {t({
              id: 'warlock.affliction.haunt.averageUptime',
              message: 'Your Haunt uptime is average. Try to refresh it more consistently.',
            })}
          </p>
        )}

        {this.DowntimePerformance === QualitativePerformance.Fail && (
          <p style={{ color: 'red' }}>
            {t({
              id: 'warlock.affliction.haunt.lowUptime',
              message: 'Your Haunt uptime is low! Focus on keeping it applied at all times.',
            })}
          </p>
        )}
      </>
    );

    const data = <RoundedPanel>{this.subStatistic()}</RoundedPanel>;

    // ✅ Pass explanation and data as object
    return ExplanationAndDataSubSection({ explanation, data });
  }
}

export default Haunt;
