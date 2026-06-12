import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import TALENTS from 'common/TALENTS/demonhunter';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS/demonhunter';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Enemies from 'parser/shared/modules/Enemies';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import VulnerabilityExplanation from 'analysis/retail/demonhunter/vengeance/modules/core/VulnerabilityExplanation';
import FieryDemiseExplanation from 'analysis/retail/demonhunter/vengeance/modules/core/FieryDemiseExplanation';
import { ChecklistUsageInfo, SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import MajorCooldown, {
  CooldownTrigger,
  createChecklistItem,
  createSpellUse,
} from 'parser/core/MajorCooldowns/MajorCooldown';
import { getDamageEvents } from 'analysis/retail/demonhunter/vengeance/normalizers/FelDevastationLinkNormalizer';
import { isDefined } from 'common/typeGuards';
import { t } from '@lingui/core/macro';

interface FelDevastationDamage {
  targetStacksOfFrailty: number;
  hasFieryBrandDebuff: boolean;
}

interface FelDevastationCooldownCast extends CooldownTrigger<CastEvent> {
  damage: FelDevastationDamage[];
}

export default class FelDevastation extends MajorCooldown<FelDevastationCooldownCast> {
  static dependencies = {
    ...MajorCooldown.dependencies,
    enemies: Enemies,
  };

  protected enemies!: Enemies;

  constructor(options: Options) {
    super({ spell: TALENTS.FEL_DEVASTATION_TALENT }, options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.FEL_DEVASTATION_TALENT);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.FEL_DEVASTATION_TALENT),
      this.onCast,
    );
  }

  description() {
    return (
      <>
        <section style={{ marginBottom: 20 }}>
          <strong><SpellLink spell={TALENTS.FEL_DEVASTATION_TALENT} /></strong>
          {t({ id: 'guide.demonhunter.vengeance.felDevastation.description.p1', message: ' is a large burst of damage and healing.' })}
        </section>
        <section>
          <VulnerabilityExplanation lineBreak />
          <FieryDemiseExplanation includeDownInFlames lineBreak />
        </section>
      </>
    );
  }

  explainPerformance(cast: FelDevastationCooldownCast): SpellUse {
    if (cast.damage.length === 0) {
      return createSpellUse(cast, [
        createChecklistItem('hit-targets', cast, {
          performance: QualitativePerformance.Fail,
          summary: (
            <div>
              {t({ id: 'demonhunter.vengeance.felDevastation.hitTargets', message: 'Hit 1+ target' })}
            </div>
          ),
          details: (
            <div>
              {t({ id: 'demonhunter.vengeance.felDevastation.hitZeroTargets.p1', message: 'You hit 0 targets with your ' })}
              <SpellLink spell={TALENTS.FEL_DEVASTATION_TALENT} />
              {t({ id: 'demonhunter.vengeance.felDevastation.hitZeroTargets.p2', message: '. To maximize damage, always try to hit targets with it.' })}
            </div>
          ),
        }),
      ]);
    }

    const {
      performance: frailtyPerf,
      summary: frailtyLabel,
      details: frailtyDetails,
    } = this.frailtyPerformance(cast) ?? {};
    const {
      performance: fieryDemisePerf,
      summary: fieryDemiseLabel,
      details: fieryDemiseDetails,
    } = this.fieryDemisePerformance(cast) ?? {};

    const overallPerf = combineQualitativePerformances(
      [frailtyPerf, fieryDemisePerf].filter(isDefined),
    );
    const checklistItems: ChecklistUsageInfo[] = [];
    if (frailtyPerf && frailtyLabel && frailtyDetails) {
      checklistItems.push({
        check: 'frailty',
        timestamp: cast.event.timestamp,
        performance: frailtyPerf,
        summary: frailtyLabel,
        details: frailtyDetails,
      });
    }
    if (fieryDemisePerf && fieryDemiseLabel && fieryDemiseDetails) {
      checklistItems.push({
        check: 'fiery-demise',
        timestamp: cast.event.timestamp,
        performance: fieryDemisePerf,
        summary: fieryDemiseLabel,
        details: fieryDemiseDetails,
      });
    }

    return {
      event: cast.event,
      checklistItems: checklistItems,
      performance: overallPerf,
      performanceExplanation:
        overallPerf !== QualitativePerformance.Fail
          ? `${overallPerf} ${t({ id: 'demonhunter.vengeance.shared.usage', message: 'Usage' })}`
          : t({ id: 'demonhunter.vengeance.shared.badUsage', message: 'Bad Usage' }),
    };
  }

  private onCast(event: CastEvent) {
    this.recordCooldown({
      event,
      damage: getDamageEvents(event).map((event) => ({
        targetStacksOfFrailty: this.getTargetStacksOfFrailty(event),
        hasFieryBrandDebuff: this.doesTargetHaveFieryBrand(event),
      })),
    });
  }

  private getTargetStacksOfFrailty(event: DamageEvent | undefined) {
    if (!event) {
      return 0;
    }
    const enemy = this.enemies.getEntity(event);
    if (!enemy) {
      return 0;
    }
    return enemy.getBuffStacks(SPELLS.FRAILTY.id, event.timestamp);
  }

  private doesTargetHaveFieryBrand(event: DamageEvent | undefined) {
    if (!event) {
      return false;
    }
    const enemy = this.enemies.getEntity(event);
    if (!enemy) {
      return false;
    }
    return enemy.hasBuff(SPELLS.FIERY_BRAND_DOT.id, event.timestamp);
  }

  private fieryDemisePerformance(cast: FelDevastationCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.FIERY_DEMISE_TALENT)) {
      return undefined;
    }
    if (!cast.damage.some((it) => it.hasFieryBrandDebuff)) {
      return {
        performance: QualitativePerformance.Fail,
        summary: (
          <div>
            <SpellLink spell={TALENTS.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandNotApplied.p1', message: ' not applied to target' })}
          </div>
        ),
        details: (
          <div>
            <SpellLink spell={TALENTS.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandNotAppliedDetail.p1', message: ' not applied to target. Make sure to apply ' })}
            <SpellLink spell={TALENTS.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandNotAppliedDetail.p2', message: ' before casting ' })}
            <SpellLink spell={TALENTS.FEL_DEVASTATION_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandNotAppliedDetail.p3', message: ' so that you benefit from ' })}
            <SpellLink spell={TALENTS.FIERY_DEMISE_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandNotAppliedDetail.p4', message: '.' })}
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Perfect,
      summary: (
        <div>
          <SpellLink spell={TALENTS.FIERY_BRAND_TALENT} />
          {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandApplied.p1', message: ' applied to target' })}
        </div>
      ),
      details: (
        <div>
          <SpellLink spell={TALENTS.FIERY_BRAND_TALENT} />
          {t({ id: 'demonhunter.vengeance.felDevastation.fieryBrandAppliedDetail.p1', message: ' applied to target.' })}
        </div>
      ),
    };
  }

  private frailtyPerformance(cast: FelDevastationCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.VULNERABILITY_TALENT)) {
      return undefined;
    }

    const atLeastOneTargetHasFrailty = cast.damage.some((it) => it.targetStacksOfFrailty > 0);

    if (!atLeastOneTargetHasFrailty) {
      return {
        performance: QualitativePerformance.Fail,
        summary: (
          <div>
            <SpellLink spell={SPELLS.FRAILTY} />
            {t({ id: 'demonhunter.vengeance.felDevastation.frailtyNotApplied.p1', message: ' not applied to target(s)' })}
          </div>
        ),
        details: (
          <div>
            <SpellLink spell={SPELLS.FRAILTY} />
            {t({ id: 'demonhunter.vengeance.felDevastation.frailtyNotAppliedDetail.p1', message: ' not applied to target(s). Make sure to apply ' })}
            <SpellLink spell={SPELLS.FRAILTY} />
            {t({ id: 'demonhunter.vengeance.felDevastation.frailtyNotAppliedDetail.p2', message: ' before casting ' })}
            <SpellLink spell={TALENTS.FEL_DEVASTATION_TALENT} />
            {t({ id: 'demonhunter.vengeance.felDevastation.frailtyNotAppliedDetail.p3', message: '.' })}
          </div>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Perfect,
      summary: (
        <div>
          <SpellLink spell={SPELLS.FRAILTY} />
          {t({ id: 'demonhunter.vengeance.felDevastation.frailtyApplied.p1', message: ' applied to target(s)' })}
        </div>
      ),
      details: (
        <div>
          <SpellLink spell={SPELLS.FRAILTY} />
          {t({ id: 'demonhunter.vengeance.felDevastation.frailtyAppliedDetail.p1', message: ' applied to target(s).' })}
        </div>
      ),
    };
  }
}
