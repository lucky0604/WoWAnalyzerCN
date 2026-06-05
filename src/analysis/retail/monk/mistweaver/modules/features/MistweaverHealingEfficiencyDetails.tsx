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
              <Trans id="monk.mistweaver.manaEfficiency.gustsExplanation">
                <SpellLink spell={SPELLS.GUSTS_OF_MISTS} /> healing is added to the appropriate spell
                that caused the gust.
              </Trans>
            </p>
            {this.selectedCombatant.hasTalent(TALENTS_MONK.JADEFIRE_TEACHINGS_TALENT) && (
              <p>
                <Trans id="monk.mistweaver.manaEfficiency.jadefireExplanation">
                  <SpellLink spell={TALENTS_MONK.JADEFIRE_TEACHINGS_TALENT} /> is given to{' '}
                  <SpellLink spell={TALENTS_MONK.JADEFIRE_STOMP_TALENT} /> since it is the spell that
                  applied the buff.
                </Trans>
              </p>
            )}
            <p>
              {this.selectedCombatant.hasTalent(TALENTS_MONK.RAPID_DIFFUSION_TALENT) && (
                <Trans id="monk.mistweaver.manaEfficiency.rapidDiffusionExplanation">
                  <SpellLink spell={TALENTS_MONK.RAPID_DIFFUSION_TALENT} /> is given to the spell
                  that procced it.
                </Trans>
              )}
              {this.selectedCombatant.hasTalent(TALENTS_MONK.MISTY_PEAKS_TALENT) && (
                <Trans id="monk.mistweaver.manaEfficiency.mistyPeaksExplanation">
                  <SpellLink spell={TALENTS_MONK.MISTY_PEAKS_TALENT} /> healing is attributed to the
                  source cast of the <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> that procced
                  it.
                </Trans>
              )}
              {this.selectedCombatant.hasTalent(TALENTS_MONK.ZEN_PULSE_TALENT) && (
                <Trans id="monk.mistweaver.manaEfficiency.zenPulseExplanation">
                  <SpellLink spell={TALENTS_MONK.ZEN_PULSE_TALENT} /> healing is attributed to{' '}
                  <SpellLink spell={SPELLS.VIVIFY} />.
                </Trans>
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
