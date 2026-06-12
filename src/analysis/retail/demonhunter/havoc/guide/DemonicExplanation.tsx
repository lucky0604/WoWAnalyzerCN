import { t } from '@lingui/core/macro';
import { useInfo } from 'interface/guide';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import SPELLS from 'common/SPELLS/demonhunter';
import { SpellLink } from 'interface';

const DemonicExplanation = () => {
  const info = useInfo();
  if (!info || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.DEMONIC_TALENT)) {
    return null;
  }
  return (
    <p>
      {t({ id: 'demonhunter.havoc.demonicExplanation.p1', message: 'Always use after casting ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
      {t({ id: 'demonhunter.havoc.demonicExplanation.p2', message: ' so that you can benefit from the ' })}
      <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />
      {t({ id: 'demonhunter.havoc.demonicExplanation.p3', message: ' provided by ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} />
      {t({ id: 'demonhunter.havoc.demonicExplanation.p4', message: '.' })}
    </p>
  );
};

export default DemonicExplanation;
