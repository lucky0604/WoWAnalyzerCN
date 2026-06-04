import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import UnstableAffliction from '../analyzers/UnstableAffliction';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TALENTS_WARLOCK } from 'common/TALENTS';

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

  return explanationAndDataSubsection(
    explanation,
    <RoundedPanel>{unstableAffliction.subStatistic()}</RoundedPanel>,
  );
}

export default UnstableAfflictionGuide;
