import { Trans } from '@lingui/react/macro';
import { useInfo } from 'interface/guide';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { SpellLink } from 'interface';

const NoDemonicExplanation = () => {
  const info = useInfo();
  if (!info || info.combatant.hasTalent(TALENTS_DEMON_HUNTER.DEMONIC_TALENT)) {
    return null;
  }
  return (
    <p>
      <Trans id="demonhunter.havoc.noDemonicExplanation">
        Using this ability without also having{' '}
        <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} /> talented will lead to significantly
        less damage.
      </Trans>
    </p>
  );
};

export default NoDemonicExplanation;
