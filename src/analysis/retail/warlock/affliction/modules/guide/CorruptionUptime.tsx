import { t } from '@lingui/core/macro';
import Analyzer from 'parser/core/Analyzer';
import StatisticBar from 'parser/ui/StatisticBar';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import type { JSX } from 'react';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import Corruption from '../analyzers/Corruption';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TALENTS_WARLOCK } from 'common/TALENTS';

class CorruptionUptime extends Analyzer {
  static dependencies = {
    corruption: Corruption,
  };

  protected corruption!: Corruption;

  get guideSubsection(): JSX.Element {
    const spell = this.selectedCombatant.hasTalent(TALENTS_WARLOCK.WITHER_TALENT)
      ? SPELLS.WITHER_DEBUFF
      : SPELLS.CORRUPTION_DEBUFF;

    const explanation = (
      <>
        <p>
          <b>
            {t({
              id: 'warlock.affliction.corruptionUptime.keepActive',
              message: 'Keep Corruption active at all times.',
            })}
          </b>
        </p>

        {!this.selectedCombatant.hasTalent(TALENTS_WARLOCK.WITHER_TALENT) && (
          <p>
            {t({
              id: 'warlock.affliction.corruptionUptime.maintainCorruption',
              message:
                'Maintain Corruption on the boss at all times. This DoT contributes significant damage and enables rotational synergies with Nightfall and other Affliction talents.',
            })}
          </p>
        )}

        {this.selectedCombatant.hasTalent(TALENTS_WARLOCK.WITHER_TALENT) && (
          <p>
            {t({
              id: 'warlock.affliction.corruptionUptime.maintainWither',
              message:
                'When playing Hellcaller, maintain Wither. This DoT contributes a massive amount of damage and enables rotational synergies with Nightfall and other Affliction talents.',
            })}
          </p>
        )}
      </>
    );

    const data = <RoundedPanel>{this.corruption.subStatistic()}</RoundedPanel>;

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <StatisticBar wide position={STATISTIC_ORDER.CORE(1)}>
        {this.corruption.subStatistic()}
      </StatisticBar>
    );
  }
}

export default CorruptionUptime;
