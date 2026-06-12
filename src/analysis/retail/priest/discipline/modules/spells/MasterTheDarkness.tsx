import SPELLS from 'common/SPELLS';
import { TALENTS_PRIEST } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { Options } from 'parser/core/Module';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import type { JSX } from 'react';
import { t } from '@lingui/core/macro';

class MasterTheDarkness extends Analyzer {
  wastedPenanceCasts: CastEvent[] = [];
  totalPenanceCasts = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(
      TALENTS_PRIEST.MASTER_THE_DARKNESS_1_DISCIPLINE_TALENT,
    );

    if (this.active) {
      this.addEventListener(
        Events.cast.by(SELECTED_PLAYER).spell(SPELLS.PENANCE_CAST),
        this.onCast,
      );
    }
  }

  onCast(event: CastEvent) {
    this.totalPenanceCasts++;
    if (this.selectedCombatant.hasBuff(SPELLS.MASTER_THE_DARKNESS_BUFF)) {
      this.wastedPenanceCasts.push(event);
    }
  }

  get guideSubsection(): JSX.Element | null {
    if (!this.active || this.totalPenanceCasts === 0) {
      return null;
    }

    const explanation = (
      <>
        <p>
          <strong><SpellLink spell={TALENTS_PRIEST.MASTER_THE_DARKNESS_1_DISCIPLINE_TALENT} /></strong>{' '}
          {t({ id: 'priest.discipline.masterTheDarkness.explanation.p1', message: 'gives your ' })}<SpellLink spell={SPELLS.PENANCE_CAST} />{t({ id: 'priest.discipline.masterTheDarkness.explanation.p2', message: ' a chance to upgrade your ' })}<SpellLink spell={SPELLS.POWER_WORD_SHIELD} />{t({ id: 'priest.discipline.masterTheDarkness.explanation.p3', message: ' to ' })}<SpellLink spell={SPELLS.VOID_SHIELD} />{t({ id: 'priest.discipline.masterTheDarkness.explanation.p4', message: '. Casting Penance while the upgrade is already active wastes a potential new proc.' })}
        </p>
      </>
    );

    const boxes = this.wastedPenanceCasts.map((event) => ({
      value: QualitativePerformance.Fail,
      tooltip: (
        <>
          {this.owner.formatTimestamp(event.timestamp)}:{' '}
          <><SpellLink spell={SPELLS.PENANCE_CAST} />{t({ id: 'priest.discipline.masterTheDarkness.castWhileActive.p1', message: ' cast while ' })}<SpellLink spell={SPELLS.MASTER_THE_DARKNESS_BUFF} />{t({ id: 'priest.discipline.masterTheDarkness.castWhileActive.p2', message: ' was already active.' })}</>
        </>
      ),
    }));

    const data = (
      <div>
        <p>
          <>{t({ id: 'priest.discipline.masterTheDarkness.wastedProcs.p1', message: 'Wasted ' })}<SpellLink spell={TALENTS_PRIEST.MASTER_THE_DARKNESS_1_DISCIPLINE_TALENT} />{t({ id: 'priest.discipline.masterTheDarkness.wastedProcs.p2', message: ' procs:' })}</>{' '}
          <strong>{this.wastedPenanceCasts.length}</strong>
        </p>
        {this.wastedPenanceCasts.length > 0 ? (
          <PerformanceBoxRow values={boxes} />
        ) : (
          <p>{t({ id: 'priest.discipline.masterTheDarkness.wellDone', message: 'Well done, no potential procs were missed!' })}</p>
        )}
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}

export default MasterTheDarkness;
