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
import { t } from '@lingui/core/macro';
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
    return (
      <>
        <ExplanationSection>
          <p>
            <>
              {t({ id: 'paladin.retribution.wakeOfAshes.description1.p1', message: 'Thanks to ' })}
              <SpellLink spell={TALENTS_PALADIN.RADIANT_GLORY_TALENT} />
              {t({ id: 'paladin.retribution.wakeOfAshes.description1.p2', message: ', ' })}
              <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} />
              {t({ id: 'paladin.retribution.wakeOfAshes.description1.p3', message: ' becomes your main offensive cooldown.' })}
            </>
          </p>
          {this.hasExecutionSentenceTalented && (
            <p>
              <>
                {t({ id: 'paladin.retribution.wakeOfAshes.executionSentenceDescription.p1', message: 'You want to press ' })}
                <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />
                {t({ id: 'paladin.retribution.wakeOfAshes.executionSentenceDescription.p2', message: ' before ' })}
                <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} />
                {t({ id: 'paladin.retribution.wakeOfAshes.executionSentenceDescription.p3', message: ' and fit as much damage as possible during that window.' })}
              </>
            </p>
          )}
          {this.isTemplar && (
            <p>
              <>
                <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />
                {t({ id: 'paladin.retribution.wakeOfAshes.templarDescription.p1', message: ' is your highest damage ability. It is available right after every ' })}
                <SpellLink spell={TALENTS_PALADIN.WAKE_OF_ASHES_TALENT} />
                {t({ id: 'paladin.retribution.wakeOfAshes.templarDescription.p2', message: ' casts.' })}
              </>
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
      <>
        {t({ id: 'paladin.retribution.wakeOfAshes.targetHadExecutionSentence.p1', message: 'Target had ' })}
        <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />
        {t({ id: 'paladin.retribution.wakeOfAshes.targetHadExecutionSentence.p2', message: ' applied.' })}
      </>
    );
    let details = (
      <>
        {t({ id: 'paladin.retribution.wakeOfAshes.targetAlreadyHadExecutionSentence.p1', message: 'Target already had ' })}
        <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />
        {t({ id: 'paladin.retribution.wakeOfAshes.targetAlreadyHadExecutionSentence.p2', message: ' applied.' })}
      </>
    );

    if (!cast.targetHasExecutionSentenceOnCast) {
      performance = QualitativePerformance.Fail;
      details = (
        <>
          {t({ id: 'paladin.retribution.wakeOfAshes.targetDidNotHaveExecutionSentence.p1', message: 'Target did not have ' })}
          <SpellLink spell={TALENTS_PALADIN.EXECUTION_SENTENCE_TALENT} />
          {t({ id: 'paladin.retribution.wakeOfAshes.targetDidNotHaveExecutionSentence.p2', message: ' applied.' })}
        </>
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
    const expectedNumberOfHammerOfLightCast = 1;

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
          <>
            {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightGood.p1', message: 'You cast ' })}
            <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />
            {' '}
            {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightGood.p2', message: '{count} time{s} during your cooldowns, nice !', values: { count: numberOfHammerOfLightCast, s: numberOfHammerOfLightCast > 1 ? 's' : '' }})}
          </>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary: summary,
      details: (
        <>
          {numberOfHammerOfLightCast === 0 ? (
            <>
              {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightNone.p1', message: 'You did not cast ' })}
              <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />
              {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightNone.p2', message: ' during your cooldowns. Expected casts : {expected}+', values: { expected: expectedNumberOfHammerOfLightCast }})}
            </>
          ) : (
            <>
              {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightFew.p1', message: 'You only cast ' })}
              <SpellLink spell={SPELLS.HAMMER_OF_LIGHT} />
              {' '}
              {t({ id: 'paladin.retribution.wakeOfAshes.hammerOfLightFew.p2', message: '{count} time{s} during your cooldowns. Expected casts : {expected}+', values: { count: numberOfHammerOfLightCast, s: numberOfHammerOfLightCast > 1 ? 's' : '', expected: expectedNumberOfHammerOfLightCast }})}
            </>
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
