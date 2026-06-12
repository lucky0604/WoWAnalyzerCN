import { t } from '@lingui/core/macro';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS/demonhunter';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { useInfo } from 'interface/guide';

interface Props {
  lineBreak?: boolean;
}
const DemonicExplanation = ({ lineBreak }: Props) => {
  const info = useInfo();
  if (!info || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.DEMONIC_TALENT)) {
    return null;
  }
  return (
    <>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      {lineBreak ? <br /> : ' '}
      {t({ id: 'demonhunter.havoc.demonicWillGrant.p1', message: 'It will grant ' })} <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} /> {t({ id: 'demonhunter.havoc.demonicWillGrant.p2', message: ' for a short duration when cast due to ' })} <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} /> {t({ id: 'demonhunter.havoc.demonicWillGrant.p3', message: '.' })}
    </>
  );
};

export default DemonicExplanation;
