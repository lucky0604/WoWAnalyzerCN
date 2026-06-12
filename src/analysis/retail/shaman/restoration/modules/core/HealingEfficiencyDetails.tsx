import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/shaman';
import { SpellLink } from 'interface';
import HealingEfficiencyBreakdown from 'parser/core/healingEfficiency/HealingEfficiencyBreakdown';
import CoreHealingEfficiencyDetails from 'parser/core/healingEfficiency/HealingEfficiencyDetails';
import Panel from 'parser/ui/Panel';

class HealingEfficiencyDetails extends CoreHealingEfficiencyDetails {
  statistic() {
    return (
      <Panel
        title={t({ id: 'shared.healingEfficiency.title', message: 'Mana Efficiency' })}
        explanation={
          <>
            <SpellLink spell={SPELLS.RESURGENCE} />
            {t({
              id: 'shaman.restoration.healingEfficiencyDetails.p1',
              message:
                ' mana gained is removed from the spell, meaning the mana spent of that spell will be lower.',
            })}
            <br />
            {t({
              id: 'shaman.restoration.healingEfficiencyDetails.p2',
              message: 'Healing that is caused by the',
            })}{' '}
            <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
            {t({
              id: 'shaman.restoration.healingEfficiencyDetails.p2.buff',
              message:
                ' buff, is added to',
            })}{' '}
            <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
            {t({
              id: 'shaman.restoration.healingEfficiencyDetails.p2.instead',
              message: ' instead of the spell that was buffed.',
            })}
            <br />
            <SpellLink spell={TALENTS.EARTH_SHIELD_TALENT} />
            {t({
              id: 'shaman.restoration.healingEfficiencyDetails.p3',
              message:
                ' is given the healing from its healing buff and is removed from the spells that were buffed.',
            })}
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

export default HealingEfficiencyDetails;
