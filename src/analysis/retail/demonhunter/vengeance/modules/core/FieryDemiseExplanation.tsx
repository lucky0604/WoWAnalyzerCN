import { SpellLink } from 'interface';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { t } from '@lingui/core/macro';

import DownInFlamesExplanation from './DownInFlamesExplanation';
import { useInfo } from 'interface/guide';

interface Props {
  includeDownInFlames?: boolean;
  lineBreak?: boolean;
}

const FieryDemiseExplanation = ({ includeDownInFlames, lineBreak }: Props) => {
  const info = useInfo();
  if (!info || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.FIERY_DEMISE_TALENT)) {
    return null;
  }
  return (
    <>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      {lineBreak ? <br /> : ' '}
      {t({ id: 'guide.demonhunter.vengeance.fieryDemise.explanation.p1', message: 'Always use when ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} />
      {t({ id: 'guide.demonhunter.vengeance.fieryDemise.explanation.p2', message: ' is applied to the target in order to maximise the damage dealt due to ' })}
      <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_DEMISE_TALENT} />
      {t({ id: 'guide.demonhunter.vengeance.fieryDemise.explanation.p3', message: '.' })}
      <DownInFlamesExplanation includeDownInFlames={includeDownInFlames} />
    </>
  );
};

export default FieryDemiseExplanation;
