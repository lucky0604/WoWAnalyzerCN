import type { JSX } from 'react';
import SPELLS from 'common/SPELLS/demonhunter';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import Events, { CastEvent } from 'parser/core/Events';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { t } from '@lingui/core/macro';
import {
  MOMENT_OF_CRAVING_ADDITIONAL_SOUL_ABSORB_CAPACITY,
  REAP_CULL_MAX_SOUL_ABSORB_CAPACITY,
  VOID_METAMORPHOSIS_BASE_SOULS_COST,
  VOID_METAMORPHOSIS_SOUL_GLUTTON_SOULS_COST,
} from '../../constants';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';

class Reap extends Analyzer {
  #reapEntries: BoxRowEntry[] = [];

  #hasSoulGluttonTalent = this.selectedCombatant.hasTalent(
    TALENTS_DEMON_HUNTER.SOUL_GLUTTON_TALENT,
  );
  #hasScythesEmbraceTalent = this.selectedCombatant.hasTalent(
    TALENTS_DEMON_HUNTER.SCYTHES_EMBRACE_TALENT,
  );

  constructor(options: Options) {
    super(options);

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.REAP), this.#onReapCast);
  }

  #onReapCast(event: CastEvent) {
    const soulsRequiredVoidMeta = this.#hasSoulGluttonTalent
      ? VOID_METAMORPHOSIS_SOUL_GLUTTON_SOULS_COST
      : VOID_METAMORPHOSIS_BASE_SOULS_COST;
    const availableSouls = this.selectedCombatant.getBuffStacks(SPELLS.SOUL_FRAGMENT_DEVOUR);
    const hasMomentOfCravingBuff = this.selectedCombatant.hasBuff(SPELLS.MOMENT_OF_CRAVING_BUFF);
    const soulsPreCast = this.selectedCombatant.getBuffStacks(SPELLS.VOID_METAMORPHOSIS_SOULS);

    const soulsPostCast =
      soulsPreCast +
      Math.min(
        availableSouls,
        hasMomentOfCravingBuff
          ? REAP_CULL_MAX_SOUL_ABSORB_CAPACITY + MOMENT_OF_CRAVING_ADDITIONAL_SOUL_ABSORB_CAPACITY
          : REAP_CULL_MAX_SOUL_ABSORB_CAPACITY,
      );

    let value = QualitativePerformance.Good;
    let tooltip = (
      <>
        {t({ id: 'guide.demonhunter.devourer.reap.goodCast.p1', message: 'Great! This cast gave you enough souls to access ' })}
        <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
        {t({ id: 'guide.demonhunter.devourer.reap.goodCast.p2', message: '.' })}
      </>
    );

    if (soulsPreCast === soulsRequiredVoidMeta) {
      value = QualitativePerformance.Fail;
      tooltip = (
        <>
          {t({ id: 'guide.demonhunter.devourer.reap.alreadyEnough.p1', message: 'You already had enough souls to enter ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.reap.alreadyEnough.p2', message: '!' })}
        </>
      );
    } else if (
      soulsPostCast >= soulsRequiredVoidMeta - 4 &&
      soulsPostCast < soulsRequiredVoidMeta
    ) {
      value = QualitativePerformance.Ok;
      tooltip = (
        <>
          {t({ id: 'guide.demonhunter.devourer.reap.tooEarly.p1', message: 'You cast ' })}
          <SpellLink spell={SPELLS.REAP} />
          {t({ id: 'guide.demonhunter.devourer.reap.tooEarly.p2', message: ` a tad too early. (${soulsPostCast} souls after cast)` })}
        </>
      );
    } else if (soulsPostCast < soulsRequiredVoidMeta) {
      value = QualitativePerformance.Fail;
      tooltip = (
        <>
          {t({ id: 'guide.demonhunter.devourer.reap.wayTooEarly.p1', message: 'You cast ' })}
          <SpellLink spell={SPELLS.REAP} />
          {t({ id: 'guide.demonhunter.devourer.reap.wayTooEarly.p2', message: ` too early! (${soulsPostCast} souls after cast)` })}
        </>
      );
    }

    this.#reapEntries.push({ value, tooltip });
  }

  guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          {t({ id: 'guide.demonhunter.devourer.reap.explanation.p1', message: 'Outside ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.reap.explanation.p2', message: ', you have access to ' })}
          <SpellLink spell={SPELLS.REAP} />
          {t({ id: 'guide.demonhunter.devourer.reap.explanation.p3', message: ', ' })}
          {this.#hasScythesEmbraceTalent ? (
            <>
              {t({ id: 'guide.demonhunter.devourer.reap.explanation.scythes', message: 'which is very strong thanks to ' })}
              <SpellLink spell={TALENTS_DEMON_HUNTER.SCYTHES_EMBRACE_TALENT} />
              {t({ id: 'guide.demonhunter.devourer.reap.explanation.scythes2', message: ' and should be pressed on cooldown' })}
            </>
          ) : (
            <>
              {t({ id: 'guide.demonhunter.devourer.reap.explanation.noScythes', message: 'which is only to be used to quickly absorb the last few souls you need to get into ' })}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
              {t({ id: 'guide.demonhunter.devourer.reap.explanation.noScythes2', message: '.' })}
            </>
          )}
        </p>
      </>
    );
    const data = (
      <RoundedPanel>
        {this.#hasScythesEmbraceTalent ? (
          <CastEfficiencyBar
            spell={SPELLS.REAP}
            gapHighlightMode={GapHighlight.FullCooldown}
            minimizeIcons
            slimLines
          />
        ) : (
          <CastSummaryAndBreakdown spell={SPELLS.REAP} castEntries={this.#reapEntries} />
        )}
      </RoundedPanel>
    );
    return (
      <ExplanationAndDataSubSection
        explanation={explanation}
        data={data}
        explanationPercent={GUIDE_CORE_EXPLANATION_PERCENT}
        title={t({
          id: 'guide.demonhunter.devourer.reap.title',
          message: 'Reap',
        })}
      />
    );
  }
}

export default Reap;
