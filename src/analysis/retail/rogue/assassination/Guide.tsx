import { GuideProps, Section, SubSection } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import EnergyCapWaste from 'analysis/retail/rogue/shared/guide/EnergyCapWaste';
import TALENTS from 'common/TALENTS/rogue';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import { ResourceLink, SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

import CombatLogParser from './CombatLogParser';
import CooldownGraphSubsection from './guide/CooldownGraphSubsection';
import { HideGoodCastsToggle } from 'interface/guide/components/HideGoodCastsToggle';
import { getTargetComboPoints } from 'analysis/retail/rogue/assassination/constants';
import {
  ExperimentalKingsbaneContextProvider,
  ExperimentalKingsbaneToggle,
} from 'analysis/retail/rogue/assassination/guide/ExperimentalKingsbaneContext';

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
        id: 'guide.rogue.assassination.sections.resources.title',
        message: 'Resource Use',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.rogue.assassination.sections.resources.energy.title',
          message: 'Energy',
        })}
      >
        <p>
          <>{t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p1', message: 'Your primary resource is ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p2', message: '. Typically, ability use will be limited by ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p3', message: ', not time. Avoid capping ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p4', message: '- lost' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p5', message: 'regeneration is lost DPS. It will occasionally be impossible to avoid capping ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {' '}
            {t({ id: 'guide.rogue.assassination.sections.resources.energy.summary.p6', message: '- like while handling mechanics or during intermission phases.' })}
          </>
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
          id: 'guide.rogue.assassination.sections.resources.comboPoints.title',
          message: 'Combo Points',
        })}
      >
        <p>
          <>
            {t({
              id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.p1',
              message: 'Most of your abilities either ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.bold',
                message: 'build',
              })}
            </strong>
            {t({
              id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.p2',
              message: ' or ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.bold2',
                message: 'spend',
              })}
            </strong>{' '}
            <ResourceLink id={RESOURCE_TYPES.COMBO_POINTS.id} />
            {t({
              id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.p3',
              message: '. Never use a builder at max CPs, and always wait until ',
            })}
            {getTargetComboPoints(info.combatant)}
            {t({
              id: 'guide.rogue.assassination.sections.resources.comboPoints.summary.p4',
              message: '+ CPs to use a spender.',
            })}
          </>
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
        id: 'guide.rogue.assassination.sections.coreRotation.title',
        message: 'Core Rotation',
      })}
    >
      <p>
        <>
          {t({
            id: 'guide.rogue.assassination.sections.coreRotation.summary.p1',
            message: "Assassination's core rotation involves performing ",
          })}
          <strong>
            {t({
              id: 'guide.rogue.assassination.sections.coreRotation.summary.bold',
              message: 'builder',
            })}
          </strong>
          {t({
            id: 'guide.rogue.assassination.sections.coreRotation.summary.p2',
            message: ' abilites up to ',
          })}
          {modules.comboPointTracker.maxResource}
          {t({
            id: 'guide.rogue.assassination.sections.coreRotation.summary.p3',
            message: ' combo points, then using a ',
          })}
          <strong>
            {t({
              id: 'guide.rogue.assassination.sections.coreRotation.summary.bold2',
              message: 'spender',
            })}
          </strong>{' '}
          {t({
            id: 'guide.rogue.assassination.sections.coreRotation.summary.p4',
            message:
              'ability. Maintain your damage over time effects on targets, then fill with your direct damage abilities. Refer to the spec guide for ',
          })}
          <a
            href="https://www.wowhead.com/assassination-rogue-rotation-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t({
              id: 'guide.rogue.assassination.sections.coreRotation.summary.link',
              message: 'rotation details',
            })}
          </a>
          {t({
            id: 'guide.rogue.assassination.sections.coreRotation.summary.p5',
            message: '. See below for spell usage details.',
          })}
        </>
      </p>
      <HideExplanationsToggle id="hide-explanations-rotation" />
      <HideGoodCastsToggle id="hide-good-casts-rotation" />
      {modules.mutilate.guideSubsection}
      {modules.garroteUptimeAndSnapshots.guideSubsection}
      {modules.ruptureUptimeAndSnapshots.guideSubsection}
      {modules.envenom.guideSubsection}
      {info.combatant.hasTalent(TALENTS.CRIMSON_TEMPEST_TALENT) &&
        modules.crimsonTempest.guideSubsection}
      {info.combatant.hasTalent(TALENTS.DEATHMARK_TALENT) && modules.deathmark.guideSubsection}
      {modules.hitCountAoe.guideSubsection}
    </Section>
  );
}

function CooldownSection({ info, modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <ExperimentalKingsbaneContextProvider>
      <Section
        title={t({
          id: 'guide.rogue.assassination.sections.cooldowns.title',
          message: 'Cooldowns',
        })}
      >
        <p>
          <>
            {t({
              id: 'guide.rogue.assassination.sections.cooldowns.summary.p1',
              message:
                "Assassination's cooldowns are decently powerful but should not be held on to for long. In order to maximize usages over the course of an encounter, you should aim to send the cooldown as soon as it becomes available (as long as it can do damage on target). It is particularly important to use ",
            })}
            <SpellLink spell={SPELLS.VANISH} />
            {t({
              id: 'guide.rogue.assassination.sections.cooldowns.summary.p2',
              message: ' as often as possible.',
            })}
          </>
        </p>
        <HideExplanationsToggle id="hide-explanations-rotation" />
        <HideGoodCastsToggle id="hide-good-casts-rotation" />
        <ExperimentalKingsbaneToggle />
        <CooldownGraphSubsection />
        {info.combatant.hasTalent(TALENTS.KINGSBANE_TALENT) && modules.kingsbane.guideSubsection}
      </Section>
    </ExperimentalKingsbaneContextProvider>
  );
}
