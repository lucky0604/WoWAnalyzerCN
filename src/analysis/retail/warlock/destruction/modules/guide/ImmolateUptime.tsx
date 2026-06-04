import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer from 'parser/core/Analyzer';
import StatisticBar from 'parser/ui/StatisticBar';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import type { JSX } from 'react';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';

import Immolate from '../analyzers/Immolate';

import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TALENTS_WARLOCK } from 'common/TALENTS';

class ImmolateUptime extends Analyzer {
  static dependencies = {
    immolate: Immolate,
  };

  protected immolate!: Immolate;

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <b>{t({ id: 'warlock.destruction.immolateUptime.keepDotActive', message: 'Keep your primary DoT active.' })}</b>
        </p>

        {!this.selectedCombatant.hasTalent(TALENTS_WARLOCK.WITHER_TALENT) && (
          <p>
            <Trans id="warlock.destruction.immolateUptime.maintainImmolate">
              Maintain <SpellLink spell={SPELLS.IMMOLATE} /> on the boss at all times. This DoT
              contributes significant damage and enables rotational synergies with{' '}
              <SpellLink spell={SPELLS.CONFLAGRATE} /> and other Destruction talents.
            </Trans>
          </p>
        )}

        {this.selectedCombatant.hasTalent(TALENTS_WARLOCK.WITHER_TALENT) && (
          <p>
            <Trans id="warlock.destruction.immolateUptime.maintainWither">
              When playing Hellcaller, maintain <SpellLink spell={SPELLS.WITHER_DEBUFF} />. This DoT
              contributes a massive amount of damage and enables rotational synergies with{' '}
              <SpellLink spell={SPELLS.CONFLAGRATE} /> and other Destruction talents.
            </Trans>
          </p>
        )}
      </>
    );

    const data = <RoundedPanel>{this.immolate.subStatistic()}</RoundedPanel>;

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <StatisticBar wide position={STATISTIC_ORDER.CORE(1)}>
        {this.immolate.subStatistic()}
      </StatisticBar>
    );
  }
}

export default ImmolateUptime;
