import { Trans } from '@lingui/react/macro';
import { formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS/demonhunter';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import { SpellLink } from 'interface';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, DamageEvent, HealEvent } from 'parser/core/Events';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import TalentSpellText from 'parser/ui/TalentSpellText';
import Enemies from 'parser/shared/modules/Enemies';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import InitiativeExplanation from 'analysis/retail/demonhunter/havoc/guide/InitiativeExplanation';
import { ChecklistUsageInfo, SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import MajorCooldown, { CooldownTrigger } from 'parser/core/MajorCooldowns/MajorCooldown';
import SPECS from 'game/SPECS';
import { getPreviousVengefulRetreat } from 'analysis/retail/demonhunter/havoc/normalizers/TheHuntVengefulRetreatNormalizer';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import { isDefined } from 'common/typeGuards';
import { Talent } from 'common/TALENTS/types';
import {
  getAppliedDots,
  getChargeImpact,
  getDamageEvents,
} from 'analysis/retail/demonhunter/havoc/normalizers/TheHuntNormalizer';

interface TheHuntCooldownCast extends CooldownTrigger<CastEvent> {
  damage: number;
  hasInitiativeOnCast: boolean;
  primaryTargetStacksOfFrailty: number;
  numberOfDotsApplied: number;
}

class TheHunt extends MajorCooldown<TheHuntCooldownCast> {
  static dependencies = {
    ...MajorCooldown.dependencies,
    enemies: Enemies,
  };

  damage = 0;
  heal = 0;

  protected enemies!: Enemies;
  #talent: Talent;

  constructor(options: Options) {
    super(
      {
        spell:
          options.owner.config.spec === SPECS.HAVOC_DEMON_HUNTER
            ? TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT
            : TALENTS_DEMON_HUNTER.THE_HUNT_DEVOURER_TALENT,
      },
      options,
    );

    this.#talent =
      options.owner.config.spec === SPECS.HAVOC_DEMON_HUNTER
        ? TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT
        : TALENTS_DEMON_HUNTER.THE_HUNT_DEVOURER_TALENT;

    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell([SPELLS.THE_HUNT_HEAL]),
      this.onHeal,
    );
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(this.spell), this.onCast);
  }

  statistic() {
    if (this.damage === 0 && this.heal === 0) {
      return null;
    }
    return (
      <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            {formatThousands(this.damage)} Total damage
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            {formatThousands(this.heal)} Total heal
          </>
        }
      >
        <TalentSpellText talent={this.#talent}>
          <ItemDamageDone amount={this.damage} />
          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
          <br />
          <ItemHealingDone amount={this.heal} />
        </TalentSpellText>
      </Statistic>
    );
  }

  description() {
    const isHavoc = this.owner.config.spec === SPECS.HAVOC_DEMON_HUNTER;
    if (isHavoc) {
      return (
        <>
          <Trans id="demonhunter.havoc.theHunt.description">
            <strong>
              <SpellLink spell={this.spell} />
            </strong>{' '}
            is a powerful burst of damage that also provides some healing with the DoT that it
            applies.
          </Trans>
          <InitiativeExplanation />
        </>
      );
    }
    return (
      <>
        <Trans id="demonhunter.havoc.theHunt.description">
          <strong>
            <SpellLink spell={this.spell} />
          </strong>{' '}
          is a powerful burst of damage that also provides some healing with the DoT that it applies.
        </Trans>
      </>
    );
  }

  explainPerformance(cast: TheHuntCooldownCast): SpellUse {
    const isHavoc = this.owner.config.spec === SPECS.HAVOC_DEMON_HUNTER;
    if (isHavoc) {
      return this.explainHavocPerformance(cast);
    }
    return this.explainDevourerPerformance(cast);
  }

  private explainHavocPerformance(cast: TheHuntCooldownCast): SpellUse {
    const {
      performance: initiativePerf,
      summary: initiativeLabel,
      details: initiativeDetails,
    } = this.initiativePerformance(cast) ?? {};

    const overallPerf = combineQualitativePerformances([initiativePerf].filter(isDefined));
    const checklistItems: ChecklistUsageInfo[] = [];
    if (initiativePerf && initiativeLabel && initiativeDetails) {
      checklistItems.push({
        check: 'initiative',
        timestamp: cast.event.timestamp,
        performance: initiativePerf,
        summary: initiativeLabel,
        details: initiativeDetails,
      });
    }

    return {
      event: cast.event,
      checklistItems: checklistItems,
      performance: overallPerf,
      performanceExplanation:
        overallPerf !== QualitativePerformance.Fail ? `${overallPerf} Usage` : 'Bad Usage',
    };
  }

  private explainDevourerPerformance(cast: TheHuntCooldownCast): SpellUse {
    const overallPerf = combineQualitativePerformances([].filter(isDefined));
    const checklistItems: ChecklistUsageInfo[] = [];

    return {
      event: cast.event,
      checklistItems: checklistItems,
      performance: overallPerf,
      performanceExplanation:
        overallPerf !== QualitativePerformance.Fail ? `${overallPerf} Usage` : 'Bad Usage',
    };
  }

  private onHeal(event: HealEvent) {
    this.heal += event.amount + (event.absorbed || 0);
  }

  private onCast(event: CastEvent) {
    const damage = getDamageEvents(event).reduce(
      (acc, next) => acc + next.amount + (next.absorbed ?? 0),
      0,
    );
    this.damage += damage;
    this.recordCooldown({
      event,
      damage,
      hasInitiativeOnCast: this.selectedCombatant.hasBuff(
        SPELLS.INITIATIVE_BUFF.id,
        event.timestamp,
      ),
      primaryTargetStacksOfFrailty: this.getTargetStacksOfFrailty(getChargeImpact(event)),
      numberOfDotsApplied: getAppliedDots(event).length,
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

  private initiativePerformance(cast: TheHuntCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.INITIATIVE_TALENT)) {
      return undefined;
    }
    const previousVengefulRetreat = getPreviousVengefulRetreat(cast.event);
    if (cast.hasInitiativeOnCast) {
      return {
        performance: QualitativePerformance.Perfect,
        summary: (
          <div>
            <Trans id="demonhunter.havoc.theHunt.hadInitiativeBuff">
              Had <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} /> buff
            </Trans>
          </div>
        ),
        details: (
          <div>
            <Trans id="demonhunter.havoc.theHunt.hadInitiativeBuffDetails">
              Had <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} /> buff.
            </Trans>
          </div>
        ),
      };
    }
    if (previousVengefulRetreat) {
      return {
        performance: QualitativePerformance.Good,
        summary: (
          <div>
            <Trans id="demonhunter.havoc.theHunt.castAfterVR">
              Cast shortly after casting{' '}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
            </Trans>
          </div>
        ),
        details: (
          <div>
            <Trans id="demonhunter.havoc.theHunt.castAfterVRDetails">
              Cast shortly after casting{' '}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />. You might have been
              damaged and lost your <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} /> buff,
              but that's okay, you still did your rotation correctly.
            </Trans>
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary: (
        <div>
          <Trans id="demonhunter.havoc.theHunt.castWithoutVR">
            Cast without previously casting{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
          </Trans>
        </div>
      ),
      details: (
        <div>
          <Trans id="demonhunter.havoc.theHunt.castWithoutVRDetails">
            Cast without previously casting{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />. Try casting{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} /> before casting for the
            critical strike chance buff that it applies (courtesy of{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />
            ).
          </Trans>
        </div>
      ),
    };
  }
}

export default TheHunt;
