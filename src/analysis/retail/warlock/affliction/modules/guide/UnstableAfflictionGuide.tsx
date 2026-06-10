import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import UnstableAffliction from '../analyzers/UnstableAffliction';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TipBox } from 'interface/guide/components/TipBox';

interface Props {
  unstableAffliction: UnstableAffliction;
}
function UnstableAfflictionGuide({ unstableAffliction }: Props): JSX.Element {
  const explanation = (
    <>
      <p>
        <b>
          {t({
            id: 'warlock.affliction.unstableAfflictionGuide.keepAsMuchAsPossible',
            message: 'Keep Unstable Affliction as much as possible.',
          })}
        </b>
      </p>

      <p>
        {t({
          id: 'warlock.affliction.unstableAfflictionGuide.maintainOnBoss',
          message:
            'Maintain Unstable Affliction on the boss at all times. This DoT contributes significant damage and enables rotational synergies with Cull the Weak and other Affliction talents.',
        })}
      </p>
    </>
  );

  return (
    <>
      <TipBox type="note">
        On cleave or AoE-heavy fights, <SpellLink spell={SPELLS.SEED_OF_CORRUPTION_DEBUFF} /> is a
        DPS gain over <SpellLink spell={SPELLS.UNSTABLE_AFFLICTION} /> at 2+ targets. Low UA uptime
        in those scenarios reflects correct play, not a mistake.
      </TipBox>
      {explanationAndDataSubsection(
        explanation,
        <RoundedPanel>{unstableAffliction.subStatistic()}</RoundedPanel>,
      )}
    </>
  );
}

export default UnstableAfflictionGuide;
