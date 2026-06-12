import { t } from '@lingui/core/macro';
import { SpellLink } from 'interface';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { useInfo } from 'interface/guide';

const InitiativeExplanation = () => {
  const info = useInfo();
  if (!info || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.INITIATIVE_TALENT)) {
    return null;
  }
  return (
    <p>
      {t({ id: 'demonhunter.havoc.initiativeExplanation.p1', message: 'Always use after casting ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
      {t({ id: 'demonhunter.havoc.initiativeExplanation.p2', message: ' so that you benefit from the increased critical strike chance provided by ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />
      {t({ id: 'demonhunter.havoc.initiativeExplanation.p3', message: '.' })}
    </p>
  );
};

export default InitiativeExplanation;
