import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellIcon, SpellLink } from 'interface';
import { SubSection, useInfo } from 'interface/guide';
import * as AplCheck from '../AplCheck';
import { SpellSeq } from 'parser/ui/SpellSeq';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { AplSectionData } from 'interface/guide/components/Apl';
import { useMemo, type JSX } from 'react';
import cssComponent from 'interface/utils/css-component';
import styles from './AplChoiceDescription.module.scss';

const blank = {
  id: -1,
  name: 'Blank',
  icon: 'inv_misc_questionmark',
};

// hack around annoying nesting issue. why is P not a proper container?
const DivP = cssComponent('div', styles.DivP, [] as const);

const StandardDescription = () => {
  const info = useInfo();
  if (!info) {
    return null;
  }

  if (info.combatant.hasTalent(talents.BLACKOUT_COMBO_TALENT)) {
    return (
      <>
          <p>
            <>
              {t({ id: 'monk.brewmaster.blackoutCombo.description2.p1', message: 'Using ' })}
              <SpellLink spell={talents.BLACKOUT_COMBO_TALENT} />
              {t({ id: 'monk.brewmaster.blackoutCombo.description2.p2', message: ' adds an extra layer to the Brewmaster rotation. You ' })}
              <em>{t({ id: 'monk.brewmaster.blackoutCombo.description2.p3', message: 'almost always' })}</em>
              {t({ id: 'monk.brewmaster.blackoutCombo.description2.p4', message: ' want to spend the ' })}
              <SpellLink spell={talents.BLACKOUT_COMBO_TALENT}>Combo</SpellLink>
              {t({ id: 'monk.brewmaster.blackoutCombo.description2.p5', message: ' on ' })}
              <SpellLink spell={SPELLS.TIGER_PALM} />
              {t({ id: 'monk.brewmaster.blackoutCombo.description2.p6', message: '.' })}
            </>
          </p>
          <DivP>
            <>
              {t({ id: 'monk.brewmaster.apl.sequence_think.p1', message: 'It can help to think of your rotation as small sequences like ' })}
              <SpellSeq spells={[SPELLS.BLACKOUT_KICK_BRM, blank, blank, blank]} />
              {t({ id: 'monk.brewmaster.apl.sequence_think.p2', message: '. You start the sequence with ' })}
              <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />
              {t({ id: 'monk.brewmaster.apl.sequence_think.p3', message: ', and then fill in the blanks like this:' })}
            </>
          </DivP>
        <ol>
          <li>
            <>
              {t({ id: 'monk.brewmaster.apl.sequence_rule1.p1', message: 'Always fill one ' })}
              <SpellIcon spell={blank} />
              {t({ id: 'monk.brewmaster.apl.sequence_rule1.p2', message: ' with ' })}
              <SpellLink spell={SPELLS.TIGER_PALM}>TP</SpellLink>
              {t({ id: 'monk.brewmaster.apl.sequence_rule1.p3', message: ' to spend your ' })}
              <SpellLink spell={SPELLS.BLACKOUT_COMBO_BUFF} />
              {t({ id: 'monk.brewmaster.apl.sequence_rule1.p4', message: ', even in AoE' })}
            </>
          </li>
          <li>
            <>
              {t({ id: 'monk.brewmaster.apl.sequence_rule2.p1', message: 'If you fill a ' })}
              <SpellIcon spell={blank} />
              {t({ id: 'monk.brewmaster.apl.sequence_rule2.p2', message: ' with ' })}
              <SpellLink spell={talents.KEG_SMASH_TALENT} />
              {t({ id: 'monk.brewmaster.apl.sequence_rule2.p3', message: ', it should be ' })}
              <em>{t({ id: 'monk.brewmaster.apl.sequence_rule2.p4', message: 'after' })}</em>
              {t({ id: 'monk.brewmaster.apl.sequence_rule2.p5', message: ' ' })}
              <SpellLink spell={SPELLS.TIGER_PALM}>TP</SpellLink>
            </>
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
      <>
        {t({ id: 'monk.brewmaster.apl.pt_advantage_limited.p1', message: 'Analysis of the ' })}
        <SpellLink spell={talents.PRESS_THE_ADVANTAGE_TALENT} />
        {t({ id: 'monk.brewmaster.apl.pt_advantage_limited.p2', message: ' rotation has limited support.' })}
      </>
      </>
    );
  }

  return (
    <>
      <p>
          <>
            {t({ id: 'monk.brewmaster.apl.core_explanation.p1', message: 'The Brewmaster rotation is driven by ' })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />
            {t({ id: 'monk.brewmaster.apl.core_explanation.p2', message: '. It grants ' })}
            <SpellLink spell={talents.SHUFFLE_TALENT} />
            {t({ id: 'monk.brewmaster.apl.core_explanation.p3', message: ', triggers ' })}
            <SpellLink spell={talents.SPIRIT_OF_THE_OX_TALENT} />
            {t({ id: 'monk.brewmaster.apl.core_explanation.p4', message: ', and does a lot of damage. ' })}
            <strong>
              <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM}>BoK</SpellLink>
              {t({ id: 'monk.brewmaster.apl.core_explanation.bold', message: ' is your most important ability.' })}
            </strong>
          </>
      </p>
      <p>
          <>
            {t({ id: 'monk.brewmaster.apl.next_priority.p1', message: 'After pushing ' })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK_BRM} />
            {t({ id: 'monk.brewmaster.apl.next_priority.p2', message: ', you follow a simple priority focused on using strong, low-cooldown abilities like ' })}
            <SpellLink spell={talents.KEG_SMASH_TALENT} />
            {t({ id: 'monk.brewmaster.apl.next_priority.p3', message: '.' })}
          </>
      </p>
      <Description aplChoice={aplChoice} />
      <SubSection>
        <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
      </SubSection>
    </>
  );
}
