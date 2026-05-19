import { GuideProps, Section, SubSection } from 'interface/guide';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import EnergyCapWaste from 'analysis/retail/rogue/shared/guide/EnergyCapWaste';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import { ResourceLink, SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/rogue';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import CombatLogParser from './CombatLogParser';
import CooldownGraphSubsection from './guide/CooldownGraphSubsection';

export const GUIDE_CORE_EXPLANATION_PERCENT = 50;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <ResourceUsageSection modules={modules} events={events} info={info} />
      <CoreRotationSection modules={modules} events={events} info={info} />
      <CooldownSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function ResourceUsageSection({ info, modules }: GuideProps<typeof CombatLogParser>) {
  const percentAtCap = modules.energyTracker.percentAtCap;
  const energyWasted = modules.energyTracker.wasted;

  return (
    <Section
      title={t({
        id: 'guide.rogue.subtlety.sections.resources.title',
        message: 'Resource Use',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.rogue.subtlety.sections.resources.energy.title',
          message: 'Energy',
        })}
      >
        <p>
          <Trans id="guide.rogue.subtlety.sections.resources.energy.summary">
            Your primary resource is <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />. Avoid energy
            capping, as it results in lost DPS.
          </Trans>
        </p>
        <EnergyCapWaste
          percentAtCap={percentAtCap}
          perfectTimeAtCap={0.05}
          goodTimeAtCap={0.1}
          okTimeAtCap={0.15}
          wasted={energyWasted}
        />
        {modules.energyGraph.plot}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.rogue.subtlety.sections.resources.comboPoints.title',
          message: 'Combo Points',
        })}
      >
        <p>
          <Trans id="guide.rogue.subtlety.sections.resources.comboPoints.summary">
            Subtlety Rogue builds and spends <ResourceLink id={RESOURCE_TYPES.COMBO_POINTS.id} />{' '}
            strategically. Ensure you never waste combo points.
          </Trans>
        </p>
        <SideBySidePanels>
          <RoundedPanel>{modules.builderUse.chart}</RoundedPanel>
          <RoundedPanel>{modules.finisherUse.chart}</RoundedPanel>
        </SideBySidePanels>
      </SubSection>
    </Section>
  );
}

function CoreRotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.rogue.subtlety.sections.coreRotation.title',
        message: 'Core Rotation',
      })}
    >
      <p>
        <Trans id="guide.rogue.subtlety.sections.coreRotation.summary">
          Subtlety’s core rotation involves generating combo points with builders and spending them
          on finishers. Cooldowns like <SpellLink spell={TALENTS.SHADOW_BLADES_TALENT} /> and{' '}
          <SpellLink spell={SPELLS.SHADOW_DANCE} /> should be optimized.
        </Trans>
      </p>
      <HideExplanationsToggle id="hide-explanations-rotation" />
      {modules.shadowDanceGuide.guideSubsection}
      {modules.shadowBlades.guideSubsection}
    </Section>
  );
}

function CooldownSection({ info, modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.rogue.subtlety.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      <p>
        <Trans id="guide.rogue.subtlety.sections.cooldowns.summary">
          Subtlety Rogue’s cooldowns should be used efficiently to maximize burst damage.
        </Trans>
      </p>
      <HideExplanationsToggle id="hide-explanations-rotation" />
      <CooldownGraphSubsection />
    </Section>
  );
}
