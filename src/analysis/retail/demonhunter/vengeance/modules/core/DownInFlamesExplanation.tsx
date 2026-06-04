import { SpellLink } from 'interface';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { useInfo } from 'interface/guide';
import { Trans } from '@lingui/react/macro';

interface Props {
  includeDownInFlames?: boolean;
  lineBreak?: boolean;
}
const DownInFlamesExplanation = ({ includeDownInFlames, lineBreak }: Props) => {
  const info = useInfo();
  if (
    !info ||
    !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.DOWN_IN_FLAMES_TALENT) ||
    !includeDownInFlames
  ) {
    return null;
  }
  return (
    <>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      {lineBreak ? <br /> : ' '}
      <Trans id="guide.demonhunter.vengeance.downInFlames.explanation">
        Always cast one of your charges of{' '}
        <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} /> before casting this ability so
        that you can benefit from <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_DEMISE_TALENT} />.
      </Trans>
    </>
  );
};

export default DownInFlamesExplanation;
