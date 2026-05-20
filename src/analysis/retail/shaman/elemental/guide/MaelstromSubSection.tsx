import { TALENTS_SHAMAN } from 'common/TALENTS/shaman';
import { GuideProps } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import CombatLogParser from '../CombatLogParser';
import { GUIDE_EXPLANATION_PERCENT_WIDTH } from '../constants';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import BoringResourceValue from 'parser/ui/BoringResourceValue';
import SpellLink from 'interface/SpellLink';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

/** A guide subsection for tracking Maelstrom usage. */
export const MaelstromSubSection = ({ modules }: GuideProps<typeof CombatLogParser>) => {
  const explanation = (
    <>
      <p>
        <Trans id="shaman.elemental.maelstrom.explanation">
          Maelstrom is the primary resource of elemental shamans. It empowers our most powerful
          spells: <SpellLink spell={TALENTS_SHAMAN.EARTH_SHOCK_TALENT} />,
          <SpellLink spell={TALENTS_SHAMAN.EARTHQUAKE_1_ELEMENTAL_TALENT} /> and{' '}
          <SpellLink spell={TALENTS_SHAMAN.ELEMENTAL_BLAST_TALENT} />. These spells are almost always
          more powerful than the alternatives so you will want to cast them as much as possible.
        </Trans>
      </p>
      <p>
        <Trans id="shaman.elemental.maelstrom.cap">
          Maelstrom has a cap of 100 (or 150 with{' '}
          <SpellLink spell={TALENTS_SHAMAN.SWELLING_MAELSTROM_TALENT} />
          ). Any maelstrom generated past that cap is wasted and will not contribute to your damage.
        </Trans>
      </p>
    </>
  );

  const data = (
    <BoringResourceValue
      resource={RESOURCE_TYPES.MAELSTROM}
      label={t({ id: 'shaman.elemental.maelstrom.wasted', message: 'Wasted Maelstrom' })}
      value={modules.maelstromDetails.wasted}
    />
  );

  return (
    <ExplanationAndDataSubSection
      title={t({ id: 'shaman.elemental.maelstrom.title', message: 'Maelstrom' })}
      explanation={explanation}
      data={data}
      explanationPercent={GUIDE_EXPLANATION_PERCENT_WIDTH}
    />
  );
};
