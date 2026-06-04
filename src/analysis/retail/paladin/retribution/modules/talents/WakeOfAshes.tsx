import { SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import SPELLS from 'common/SPELLS/paladin';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import Enemies from 'parser/shared/modules/Enemies';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import MajorCooldown, { CooldownTrigger } from 'parser/core/MajorCooldowns/MajorCooldown';
import { ExplanationSection } from 'analysis/retail/demonhunter/shared/guide/CommonComponents';
import { TALENTS_PALADIN } from 'common/TALENTS';
import { getCastsDuringWake } from '../../normalizers/WakeOfAshesNormalizer';
import { TIERS } from 'game/TIERS';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
interface WakeOfAshesCooldownCast extends CooldownTrigger<CastEvent> {
  hammerOfLightCasts: number;
  targetHasExecutionSentenceOnCast: boolean;
}

class WakeOfAshes extends MajorCooldown<WakeOfAshesCooldownCast> {
  static dependencies = {
    ...MajorCooldown.dependencies,
    enemies: Enemies,
  };

  protected enemies!: Enemies;
  hasExecutionSentenceTalented = this.selectedCombatant.hasTalent(
    TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT,
  );
  isTemplar = this.selectedCombatant.hasTalent(TALENTS_PALADIN.LIGHTS_GUIDANCE_TALENT);

  constructor(options: Options) {
    super({ spell: TALENTS_PALADIN.WAKE_OF_ASHES_TALENT }, options);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_PALADIN.WAKE_OF_ASHES_TALENT),
      this.onCast,
    );
  }

  description() {
    const playerHasTWW3_4Piece = this.selectedCombatant.has4PieceByTier(TIERS.TWW3);

    return (
      <>
        <ExplanationSection>
          <p>
            <Trans id="paladin.retribution.wakeOfAshes.description1">
              Thanks to <SpellLink spell={TALENTS_PALADIN.RADIANT_GLORY_TALENT} />,{' '}
              <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} /> becomes your main offensive
              cooldown.
            </Trans>
          </p>
          {this.hasExecutionSentenceTalented && (
            <p>
              <Trans id="paladin.retribution.wakeOfAshes.executionSentenceDescription">
                You want to press <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />{' '}
                before <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} /> and fit as much
                damage as possible during that window.
              </Trans>
            </p>
          )}
          {this.isTemplar && (
            <p>
              <Trans id="paladin.retribution.wakeOfAshes.templarDescription">
                <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} /> is your highest damage ability. It is
                available right after every <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} />{' '}
                casts.
              </Trans>
              {playerHasTWW3_4Piece && (
                <>
                  {' '}
                  <Trans id="paladin.retribution.wakeOfAshes.tierSetDescription">
                    With the season 3 Tier Set, you will be able to use it a second time each{' '}
                    <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} /> cast.
                  </Trans>
                </>
              )}
            </p>
          )}
        </ExplanationSection>
      </>
    );
  }

  explainPerformance(cast: WakeOfAshesCooldownCast): SpellUse {
    const executionSentencePerformance = this.executionSentencePerformance(cast);
    const hammerOfLightPerformance = this.hammerOfLightPerformance(cast);

    const checklistItems = [];

    if (this.isTemplar) {
      checklistItems.push({
        check: 'hol',
        timestamp: cast.event.timestamp,
        ...hammerOfLightPerformance,
      });
    }
    if (this.hasExecutionSentenceTalented) {
      checklistItems.push({
        check: 'exec',
        timestamp: cast.event.timestamp,
        ...executionSentencePerformance,
      });
    }

    const combinedPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );

    return {
      event: cast.event,
      performance: combinedPerformance,
      performanceExplanation:
        combinedPerformance !== QualitativePerformance.Fail
          ? `${combinedPerformance} ${t({ id: 'paladin.retribution.wakeOfAshes.usage', message: 'Usage' })}`
          : t({ id: 'paladin.retribution.wakeOfAshes.badUsage', message: 'Bad Usage' }),
      checklistItems: checklistItems,
    };
  }

  private executionSentencePerformance(cast: WakeOfAshesCooldownCast): UsageInfo {
    let performance = QualitativePerformance.Perfect;
    const summary = (
      <Trans id="paladin.retribution.wakeOfAshes.targetHadExecutionSentence">
        Target had <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} /> applied.
      </Trans>
    );
    let details = (
      <Trans id="paladin.retribution.wakeOfAshes.targetAlreadyHadExecutionSentence">
        Target already had <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} /> applied.
      </Trans>
    );

    if (!cast.targetHasExecutionSentenceOnCast) {
      performance = QualitativePerformance.Fail;
      details = (
        <Trans id="paladin.retribution.wakeOfAshes.targetDidNotHaveExecutionSentence">
          Target did not have <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />{' '}
          applied.
        </Trans>
      );
    }

    return {
      performance: performance,
      summary: summary,
      details: details,
    };
  }

  private hammerOfLightPerformance(cast: WakeOfAshesCooldownCast): UsageInfo {
    const numberOfHammerOfLightCast = cast.hammerOfLightCasts;
    const playerHasTWW3_4Piece = this.selectedCombatant.has4PieceByTier(TIERS.TWW3);
    const expectedNumberOfHammerOfLightCast = playerHasTWW3_4Piece ? 2 : 1;

    const summary = (
      <>
        {expectedNumberOfHammerOfLightCast}+ <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />
      </>
    );

    if (numberOfHammerOfLightCast >= expectedNumberOfHammerOfLightCast) {
      return {
        performance: QualitativePerformance.Good,
        summary: summary,
        details: (
          <Trans id="paladin.retribution.wakeOfAshes.hammerOfLightGood">
            You cast <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} /> {numberOfHammerOfLightCast} time
            {numberOfHammerOfLightCast > 1 ? 's' : ''} during your cooldowns, nice !
          </Trans>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary: summary,
      details: (
        <>
          {numberOfHammerOfLightCast === 0 ? (
            <Trans id="paladin.retribution.wakeOfAshes.hammerOfLightNone">
              You did not cast {<SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />} during your cooldowns.
              Expected casts : {expectedNumberOfHammerOfLightCast}+
            </Trans>
          ) : (
            <Trans id="paladin.retribution.wakeOfAshes.hammerOfLightFew">
              You only cast {<SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />}{' '}
              {numberOfHammerOfLightCast} time{numberOfHammerOfLightCast > 1 ? 's' : ''} during your
              cooldowns. Expected casts : {expectedNumberOfHammerOfLightCast}+
            </Trans>
          )}
        </>
      ),
    };
  }

  onCast(event: CastEvent) {
    this.recordCooldown({
      event,
      hammerOfLightCasts: getCastsDuringWake(event).filter(
        (castEvent) => castEvent.ability.guid === SPELLS.HAMMER_OF_LIGHT.id,
      ).length,
      targetHasExecutionSentenceOnCast: this.enemies.hasBuffOnAny(
        TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT.id,
      ),
    });
  }
}

export default WakeOfAshes;
