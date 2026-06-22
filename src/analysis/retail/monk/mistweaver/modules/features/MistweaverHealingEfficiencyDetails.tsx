import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import HealingEfficiencyBreakdown from 'parser/core/healingEfficiency/HealingEfficiencyBreakdown';
import HealingEfficiencyDetails from 'parser/core/healingEfficiency/HealingEfficiencyDetails';
import Panel from 'parser/ui/Panel';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

class MistweaverHealingEfficiencyDetails extends HealingEfficiencyDetails {
  statistic() {
    return (
      <Panel
        title={t({ id: 'monk.mistweaver.manaEfficiency.title', message: 'Mana efficiency' })}
        explanation={
          <>
            <p>
              <><SpellLink spell={SPELLS.GUSTS_OF_MISTS} />
                {t({ id: 'monk.mistweaver.manaEfficiency.gustsExplanation.p1', message: 'healing is added to the appropriate spell that caused the gust.' })}
              </>
            </p>
            {this.selectedCombatant.hasTalent(TALENTS_MONK.JADEFIRE_TEACHINGS_TALENT) && (
              <p>
                <><SpellLink spell={TALENTS_MONK.JADEFIRE_TEACHINGS_TALENT} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.jadefireExplanation.p1', message: 'is given to' })}
                  {' '}
                  <SpellLink spell={TALENTS_MONK.JADEFIRE_STOMP_TALENT} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.jadefireExplanation.p2', message: 'since it is the spell that applied the buff.' })}
                </>
              </p>
            )}
            <p>
              {this.selectedCombatant.hasTalent(TALENTS_MONK.RAPID_DIFFUSION_TALENT) && (
                <><SpellLink spell={TALENTS_MONK.RAPID_DIFFUSION_TALENT} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.rapidDiffusionExplanation.p1', message: 'is given to the spell that procced it.' })}
                </>
              )}
              {this.selectedCombatant.hasTalent(TALENTS_MONK.MISTY_PEAKS_TALENT) && (
                <><SpellLink spell={TALENTS_MONK.MISTY_PEAKS_TALENT} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.mistyPeaksExplanation.p1', message: 'healing is attributed to the source cast of the ' })}
                  <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.mistyPeaksExplanation.p2', message: 'that procced it.' })}
                </>
              )}
              {this.selectedCombatant.hasTalent(TALENTS_MONK.ZEN_PULSE_TALENT) && (
                <><SpellLink spell={TALENTS_MONK.ZEN_PULSE_TALENT} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.zenPulseExplanation.p1', message: 'healing is attributed to' })}
                  {' '}
                  <SpellLink spell={SPELLS.VIVIFY} />
                  {t({ id: 'monk.mistweaver.manaEfficiency.zenPulseExplanation.p2', message: '.' })}
                </>
              )}
            </p>
          </>
        }
        pad={false}
        position={120}
      >
        <HealingEfficiencyBreakdown tracker={this.healingEfficiencyTracker} />
      </Panel>
    );
  }
}

export default MistweaverHealingEfficiencyDetails;
