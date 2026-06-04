import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummary, { type CastEvaluation } from 'interface/guide/components/CastSummary';
import GuideSection from 'interface/guide/components/GuideSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import HeatingUp, { HeatingUpCrits } from '../core/HeatingUp';
import Spell from 'common/SPELLS/Spell';
import { CastOverview } from 'interface/guide/components';
import { formatPercentage } from 'common/format';

const CAPPED_MS_THRESHOLD = 5000;

class HeatingUpGuide extends Analyzer {
  static dependencies = {
    heatingUp: HeatingUp,
  };
  protected heatingUp!: HeatingUp;

  private buildStats() {
    const stats = [];

    stats.push({
      value: `${formatPercentage(this.heatingUp.fireBlastUtilPercent, 1)}%`,
      label: t({ id: 'mage.fire.heatingUpGuide.fireBlastUtilization', message: 'Fire Blast Utilization' }),
      tooltip: (
        <Trans id="mage.fire.heatingUpGuide.fireBlastUtilizationTooltip">
          Fire Blast Utilization Percent.
        </Trans>
      ),
      performance: this.heatingUp.fireBlastUtilPerformance,
    });
    stats.push({
      value: `${formatPercentage(this.heatingUp.convertedHeatingUpPercent, 1)}%`,
      label: t({
        id: 'mage.fire.heatingUpGuide.convertedHeatingUpBuffs',
        message: 'Converted Heating Up Buffs',
      }),
      tooltip: (
        <Trans id="mage.fire.heatingUpGuide.convertedHeatingUpBuffsTooltip">
          Percent of Heating Up buffs that were converted into Hot Streak.
        </Trans>
      ),
      performance: this.heatingUp.convertedBuffPerformance,
    });

    return stats;
  }

  private evaluateHeatingUpCrit(hu: HeatingUpCrits): CastEvaluation {
    const maxFireBlastCharges =
      1 +
      this.selectedCombatant.getTalentRank(TALENTS.FERVENT_FLICKERING_TALENT) +
      this.selectedCombatant.getTalentRank(TALENTS.FLAME_ON_TALENT);
    const fireBlastCapped =
      hu.cast.ability.guid === SPELLS.FIRE_BLAST.id &&
      hu.charges >= maxFireBlastCharges - 1 &&
      hu.timeTillCapped < CAPPED_MS_THRESHOLD;

    const castWithoutHeatingUp =
      hu.activeBuffs.length === 0 && !hu.hasHotStreak && !hu.hasHeatingUp;

    // FAIL CONDITIONS
    if (!fireBlastCapped && castWithoutHeatingUp) {
      return {
        timestamp: hu.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.heatingUpGuide.fireBlastWithoutHeatingUp',
          message: 'Fire Blast cast without Heating Up or a crit buff',
        }),
      };
    }

    if (hu.hasHotStreak) {
      return {
        timestamp: hu.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.heatingUpGuide.fireBlastDuringHotStreak',
          message: 'Fire Blast cast while Hot Streak was active.',
        }),
      };
    }

    // GOOD CONDITIONS
    if (fireBlastCapped) {
      return {
        timestamp: hu.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.fire.heatingUpGuide.fireBlastCapped',
          message: 'Fire Blast cast while capped, or close to capped, on charges',
        }),
      };
    }

    if (hu.activeBuffs.length > 0) {
      const buffs = hu.activeBuffs.map((buff: Spell) => buff.name);
      return {
        timestamp: hu.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Fire Blast cast with guaranteed crit buff (${buffs})`,
      };
    }

    if (hu.hasHeatingUp) {
      return {
        timestamp: hu.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.fire.heatingUpGuide.fireBlastWithHeatingUp',
          message: 'Fire Blast cast with Heating Up.',
        }),
      };
    }

    // DEFAULT
    return {
      timestamp: hu.cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: t({
        id: 'mage.fire.heatingUpGuide.unknownPerformance',
        message: 'Unknown Performance Condition (Please report this).',
      }),
    };
  }

  get guideSubsection(): JSX.Element {
    const fireBlast = <SpellLink spell={SPELLS.FIRE_BLAST} />;
    const combustion = <SpellLink spell={TALENTS.COMBUSTION_TALENT} />;
    const heatingUp = <SpellLink spell={SPELLS.HEATING_UP} />;
    const hotStreak = <SpellLink spell={SPELLS.HOT_STREAK} />;
    const firestarter = <SpellLink spell={TALENTS.FIRESTARTER_TALENT} />;
    const scorch = <SpellLink spell={TALENTS.SCORCH_TALENT} />;

    const explanation = (
      <Trans id="mage.fire.heatingUpGuide.explanation">
        Managing your <b>{heatingUp}</b> procs and your {fireBlast} charges are very important to{' '}
        ensure you are converting as many procs into {hotStreak} as possible throughout the fight.
        <ul>
          <li>
            Use {fireBlast} to convert {heatingUp} into {hotStreak}.
          </li>
          <li>
            Unless you are guaranteed to crit ({combustion}, {firestarter}, {scorch} during execute,{' '}
            etc.), or are capped/about to cap on charges, don't use {fireBlast} without {heatingUp}.
          </li>
        </ul>
      </Trans>
    );

    return (
      <GuideSection spell={SPELLS.HEATING_UP} explanation={explanation}>
        <CastOverview spell={SPELLS.HEATING_UP} stats={this.buildStats()} />
        <CastSummary
          spell={SPELLS.HEATING_UP}
          casts={this.heatingUp.heatingUpCrits.map((crit) => this.evaluateHeatingUpCrit(crit))}
          showBreakdown
        />
      </GuideSection>
    );
  }
}

export default HeatingUpGuide;
