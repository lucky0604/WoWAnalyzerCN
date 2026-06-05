import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { JSX } from 'react';
import { Section, SubSection, useAnalyzer, useInfo } from 'interface/guide';
import Para from 'interface/guide/Para';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { FoundationCooldownSection } from 'interface/guide/foundation/FoundationCooldownSection';
import { useExpansionContext } from 'interface/report/ExpansionContext';
import ResourceLink from 'interface/ResourceLink';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import AlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';

export default function Guide(): JSX.Element {
  const { expansion } = useExpansionContext();
  return (
    <>
      <Section
        title={t({
          id: 'classic.warrior.arms.section.coreSkills',
          message: 'Core Skills',
        })}
      >
        <ArmsDowntimeSection />
        <FoundationCooldownSection />
      </Section>
      <PreparationSection expansion={expansion} />
    </>
  );
}

function ArmsDowntimeSection() {
  const info = useInfo();
  const alwaysBeCasting = useAnalyzer(AlwaysBeCasting);

  if (!info || !alwaysBeCasting) {
    return null;
  }

  return (
    <SubSection
      title={t({
        id: 'classic.warrior.arms.subsection.alwaysBeCasting',
        message: 'Always Be Casting',
      })}
    >
      <Para>
        <small>
          <Trans id="classic.warrior.arms.alwaysBeCasting.description">
            In Cataclysm, Arms Warrior does not have enough abilities or{' '}
            <ResourceLink id={RESOURCE_TYPES.RAGE.id} /> to fill every GCD. GCDs that are empty
            because no abilities are usable are also counted as Active Time.
          </Trans>
        </small>
      </Para>
      <FoundationDowntimeSectionV2 />
    </SubSection>
  );
}
