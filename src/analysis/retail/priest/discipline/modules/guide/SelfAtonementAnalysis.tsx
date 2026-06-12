import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import { TALENTS_PRIEST } from 'common/TALENTS';
import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import { Options } from 'parser/core/Module';
import Events, { CastEvent } from 'parser/core/Events';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { SpellLink } from 'interface';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

/*
  The purpose of this analyzer is to highlight inefficient atonement applications when using the binding heals talent.
  When using this talent applying atonement via flash heal to another player is the most efficient method of applying atonement,
  and due to this atonement should never be applied to the player manually.
*/

class SelfAtonementAnalyzer extends Analyzer {
  badCasts = 0;
  totalCasts = 0;
  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_PRIEST.BINDING_HEALS_TALENT);

    this.addEventListener(
      Events.cast
        .by(SELECTED_PLAYER)
        .spell([
          TALENTS_PRIEST.POWER_WORD_RADIANCE_TALENT,
          SPELLS.POWER_WORD_SHIELD,
          SPELLS.FLASH_HEAL,
          SPELLS.PLEA,
          SPELLS.PENANCE_CAST,
        ]),
      this.onCast,
    );
  }

  onCast(event: CastEvent) {
    this.totalCasts += 1;
    if (event.targetID === this.selectedCombatant.id) {
      this.badCasts += 1;
    }
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <strong><SpellLink spell={SPELLS.FLASH_HEAL} /></strong>{' '}
          {t({ id: 'priest.discipline.selfAtonementAnalysis.explanation.p1', message: 'applies ' })}<SpellLink spell={TALENTS_PRIEST.ATONEMENT_TALENT} />{t({ id: 'priest.discipline.selfAtonementAnalysis.explanation.p2', message: ' to yourself when used on another target while using ' })}<SpellLink spell={TALENTS_PRIEST.BINDING_HEALS_TALENT} />{t({ id: 'priest.discipline.selfAtonementAnalysis.explanation.p3', message: '. It is the most mana efficient way to apply atonements and you should avoid to ever apply ' })}<SpellLink spell={TALENTS_PRIEST.ATONEMENT_TALENT} />{t({ id: 'priest.discipline.selfAtonementAnalysis.explanation.p4', message: ' manually to yourself.' })}
        </p>
      </>
    );
    const data = (
      <div>
        <strong>
          <><SpellLink spell={TALENTS_PRIEST.ATONEMENT_TALENT} /> {t({ id: 'priest.discipline.selfAtonementAnalysis.applicatorBreakdown', message: 'applicator breakdown' })}</>
        </strong>
        <small>
          {' '}
          <Trans id="priest.discipline.selfAtonementAnalysis.legend">
            - Green indicates casts which were not on yourself, while red indicates manual
            applications of atonement to yourself.
          </Trans>
        </small>
        <GradiatedPerformanceBar good={this.totalCasts - this.badCasts} bad={this.badCasts} />
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }
}

export default SelfAtonementAnalyzer;
