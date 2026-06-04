import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import HealingEfficiencyBreakdown from 'parser/core/healingEfficiency/HealingEfficiencyBreakdown';
import HealingEfficiencyDetails from 'parser/core/healingEfficiency/HealingEfficiencyDetails';
import Panel from 'parser/ui/Panel';

class PreservationHealingEfficiencyDetails extends HealingEfficiencyDetails {
  statistic() {
    return (
      <Panel
        title={t({ id: 'evoker.preservation.healingEfficiency.title', message: 'Mana Efficiency' })}
        explanation={
          <>
            <SpellLink spell={SPELLS.DREAM_BREATH} />
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

export default PreservationHealingEfficiencyDetails;
