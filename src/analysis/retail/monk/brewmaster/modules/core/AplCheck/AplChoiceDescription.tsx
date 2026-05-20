import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellIcon, SpellLink } from 'interface';
import { SubSection, useInfo } from 'interface/guide';
import * as AplCheck from '../AplCheck';
import { SpellSeq } from 'parser/ui/SpellSeq';
import { Trans } from '@lingui/react/macro';

import { AplSectionData } from 'interface/guide/components/Apl';
import { useMemo, type JSX } from 'react';
import styled from '@emotion/styled';

const blank = {
  id: -1,
  name: 'Blank',
  icon: 'inv_misc_questionmark',
};

// hack around annoying nesting issue. why is P not a proper container?
const DivP = styled.div`
  margin-bottom: 1rem;
`;

const StandardDescription = () => {
  const info = useInfo();
  if (!info) {
    return null;
  }

  if (info.combatant.hasTalent(talents.BLACKOUT_COMBO_TALENT)) {
    return (
      <>
        <p>
          <Trans id="monk.brewmaster.blackoutCombo.description2">
            Using <SpellLink spell={talents.BLACKOUT_COMBO_TALENT} /> adds an extra layer to the
            Brewmaster rotation. You <em>almost always</em> want to spend the{' '}
            <SpellLink spell={talents.BLACKOUT_COMBO_TALENT}>Combo</SpellLink> on
            <SpellLink spell={SPELLS.TIGER_PALM} />.
          </Trans>
        </p>
        <DivP>
          <Trans id="monk.brewmaster.apl.sequence_think">
            It can help to think of your rotation as small sequences like{' '}
            <SpellSeq spells={[SPELLS.BLACKOUT_KICK_BRM, blank, blank, blank]} />. You start the
            sequence with <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />, and then fill in the blanks
            like this:
          </Trans>
        </DivP>
        <ol>
          <li>
            <Trans id="monk.brewmaster.apl.sequence_rule1">
              Always fill one <SpellIcon spell={blank} /> with{' '}
              <SpellLink spell={SPELLS.TIGER_PALM}>TP</SpellLink> to spend your{' '}
              <SpellLink spell={SPELLS.BLACKOUT_COMBO_BUFF} />, even in AoE
            </Trans>
          </li>
          <li>
            <Trans id="monk.brewmaster.apl.sequence_rule2">
              If you fill a <SpellIcon spell={blank} /> with{' '}
              <SpellLink spell={talents.KEG_SMASH_TALENT} />, it should be <em>after</em>{' '}
              <SpellLink spell={SPELLS.TIGER_PALM}>TP</SpellLink>
            </Trans>
          </li>
          <li>
            <Trans id="monk.brewmaster.apl.sequence_rule3">
              Fill all other <SpellIcon spell={blank} />s with your normal rotation
            </Trans>
          </li>
        </ol>
        <DivP>
          <Trans id="monk.brewmaster.apl.sequence_rule_summary">
            so{' '}
            <SpellSeq
              spells={[
                SPELLS.BLACKOUT_KICK_BRM,
                SPELLS.TIGER_PALM,
                talents.KEG_SMASH_TALENT,
                talents.EXPLODING_KEG_TALENT,
              ]}
            />{' '}
            and{' '}
            <SpellSeq
              spells={[
                SPELLS.BLACKOUT_KICK_BRM,
                talents.EXPLODING_KEG_TALENT,
                SPELLS.TIGER_PALM,
                talents.KEG_SMASH_TALENT,
              ]}
            />{' '}
            would both be fine, but{' '}
            <SpellSeq
              spells={[
                SPELLS.BLACKOUT_KICK_BRM,
                talents.KEG_SMASH_TALENT,
                talents.EXPLODING_KEG_TALENT,
                SPELLS.TIGER_PALM,
              ]}
            />{' '}
            would not.
          </Trans>
        </DivP>
      </>
    );
  }
  return <></>;
};

const Description = ({ aplChoice }: { aplChoice: AplCheck.BrewmasterApl }) => {
  switch (aplChoice) {
    case AplCheck.BrewmasterApl.Standard:
      return <StandardDescription />;
  }
};

export default function AplChoiceDescription(): JSX.Element {
  const info = useInfo();
  const aplChoice = useMemo(() => (info ? AplCheck.chooseApl(info) : undefined), [info]);
  if (aplChoice === undefined || !info) {
    return <></>;
  }

  if (info.combatant.hasTalent(talents.PRESS_THE_ADVANTAGE_TALENT)) {
    return (
      <>
        <Trans id="monk.brewmaster.apl.pt_advantage_limited">
          Analysis of the <SpellLink spell={talents.PRESS_THE_ADVANTAGE_TALENT} /> rotation has
          limited support.
        </Trans>
      </>
    );
  }

  return (
    <>
      <p>
        <Trans id="monk.brewmaster.apl.core_explanation">
          The Brewmaster rotation is driven by <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />. It
          grants <SpellLink spell={talents.SHUFFLE_TALENT} />, triggers{' '}
          <SpellLink spell={talents.SPIRIT_OF_THE_OX_TALENT} />, and does a lot of damage.{' '}
          <strong>
            <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM}>BoK</SpellLink> is your most important
            ability.
          </strong>
        </Trans>
      </p>
      <p>
        <Trans id="monk.brewmaster.apl.next_priority">
          After pushing <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />, you follow a simple priority
          focused on using strong, low-cooldown abilities like{' '}
          <SpellLink spell={talents.KEG_SMASH_TALENT} />.
        </Trans>
      </p>
      <Description aplChoice={aplChoice} />
      <SubSection>
        <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
      </SubSection>
    </>
  );
}
