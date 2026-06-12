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
  if (!info || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.FURIOUS_GAZE_TALENT)) {
    return null;
  }
  return (
    <>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      {lineBreak ? <br /> : ' '}
      {t({ id: 'demonhunter.havoc.furiousGazeWillGrant.p1', message: 'It will grant ' })} <SpellLink spell={SPELLS.FURIOUS_GAZE} /> {t({ id: 'demonhunter.havoc.furiousGazeWillGrant.p2', message: ' for a short duration when cast due to' })} {' '} {t({ id: 'demonhunter.havoc.furiousGazeWillGrant.p3', message: ' ' })} <SpellLink spell={TALENTS_DEMON_HUNTER.FURIOUS_GAZE_TALENT} /> {t({ id: 'demonhunter.havoc.furiousGazeWillGrant.p4', message: '.' })}
    </>
  );
};

export default DemonicExplanation;
