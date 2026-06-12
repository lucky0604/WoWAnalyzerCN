import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GuideProps, Section, SubSection, useInfo } from 'interface/guide';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import SPELLS from 'common/SPELLS/demonhunter';
import { ResourceLink, SpellLink } from 'interface';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import FuryCapWaste from 'analysis/retail/demonhunter/shared/guide/FuryCapWaste';
import CooldownUsage from 'parser/core/MajorCooldowns/CooldownUsage';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { HideGoodCastsToggle } from 'interface/guide/components/HideGoodCastsToggle';
import CooldownGraphSubsection, {
  Cooldown,
} from 'interface/guide/components/CooldownGraphSubSection';

import CombatLogParser from './CombatLogParser';
import MajorDefensives from './modules/core/MajorDefensives';
import {
  GOOD_TIME_AT_FURY_CAP,
  OK_TIME_AT_FURY_CAP,
  PERFECT_TIME_AT_FURY_CAP,
} from './modules/resourcetracker/FuryTracker';
import { PerformanceStrong } from 'analysis/retail/priest/shadow/modules/guide/ExtraComponents';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <CoreSection modules={modules} events={events} info={info} />
      <RotationSection modules={modules} events={events} info={info} />
      <MitigationSection />
      <CooldownSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function CoreSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const percentAtFuryCap = modules.furyTracker.percentAtCap;
  const percentAtFuryCapPerformance = modules.furyTracker.percentAtCapPerformance;
  const furyWasted = modules.furyTracker.wasted;

  return (
    <Section
      title={t({
        id: 'guide.demonhunter.vengeance.sections.core.title',
        message: 'Core',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.demonhunter.vengeance.sections.core.fury.title',
          message: 'Fury',
        })}
      >
        <p>
          <Trans id="guide.demonhunter.vengeance.sections.core.fury.summary">
            Vengeance's primary resource is <ResourceLink id={RESOURCE_TYPES.FURY.id} />. You should
            avoid capping <ResourceLink id={RESOURCE_TYPES.FURY.id} /> - lost{' '}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} /> generation is lost DPS.
          </Trans>
        </p>
        <FuryCapWaste
          percentAtCap={percentAtFuryCap}
          percentAtCapPerformance={percentAtFuryCapPerformance}
          perfectTimeAtFuryCap={PERFECT_TIME_AT_FURY_CAP}
          goodTimeAtFuryCap={GOOD_TIME_AT_FURY_CAP}
          okTimeAtFuryCap={OK_TIME_AT_FURY_CAP}
          wasted={furyWasted}
        />
        {modules.furyGraph.plot}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.demonhunter.vengeance.sections.core.soulFragments.title',
          message: 'Soul Fragments',
        })}
      >
        <p>
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.p1', message: 'Most of your abilities either ' })}
          <strong>{t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.bold1', message: 'build' })}</strong>
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.p2', message: ' or ' })}
          <strong>{t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.bold2', message: 'spend' })}</strong>
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.p3', message: ' Soul Fragments. Never use a builder at max ' })}
          <SpellLink spell={SPELLS.SOUL_FRAGMENT} />
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.p4', message: 's or when doing so will cause you to overcap on ' })}
          <SpellLink spell={SPELLS.SOUL_FRAGMENT} />
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.summary.p5', message: 's.' })}
        </p>
        <p>
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.chart.p1', message: 'The chart below shows your ' })}
          <SpellLink spell={SPELLS.SOUL_FRAGMENT} />
          {t({ id: 'guide.demonhunter.vengeance.sections.core.soulFragments.chart.p2', message: 's over the course of the encounter.' })}
        </p>
        {modules.soulFragmentsGraph.plot}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.demonhunter.vengeance.sections.core.activeTime.title',
          message: 'Active Time',
        })}
      >
        <p>
          <b>{t({ id: 'guide.demonhunter.vengeance.sections.core.activeTime.summary.bold', message: 'Continuously casting throughout an encounter is the single most important thing for achieving good DPS.' })}</b>
          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
          <br />
          {t({ id: 'guide.demonhunter.vengeance.sections.core.activeTime.summary.rest', message: 'Some fights have unavoidable downtime due to phase transitions and the like, so in these cases 0% downtime will not be possible - do the best you can.' })}
        </p>
        <p>
          <Trans id="guide.demonhunter.vengeance.sections.core.activeTime.value">
            Active Time:{' '}
          </Trans>
          <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
            {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
          </PerformanceStrong>{' '}
        </p>
        <ActiveTimeGraph
          activeTimeSegments={modules.alwaysBeCasting.activeTimeSegments}
          fightStart={info.fightStart}
          fightEnd={info.fightEnd}
        />
      </SubSection>
    </Section>
  );
}

function MitigationSection() {
  const info = useInfo();
  if (!info) {
    return null;
  }

  return (
    <Section
      title={t({
        id: 'guide.demonhunter.vengeance.sections.mitigation.title',
        message: 'Defensive Cooldowns and Mitigation',
      })}
    >
      <MajorDefensives />
    </Section>
  );
}

function RotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.vengeance.sections.rotation.title',
        message: 'Rotation',
      })}
    >
      <p>
        {t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.p1', message: "Vengeance's core rotation involves " })}
        <strong>{t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.bold1', message: 'building' })}</strong>
        {t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.p2', message: ' and then ' })}
        <strong>{t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.bold2', message: 'spending' })}</strong>
        {' '}
        <ResourceLink id={RESOURCE_TYPES.FURY.id} />
        {t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.p3', message: ' and ' })}
        <SpellLink spell={SPELLS.SOUL_FRAGMENT} />
        {t({ id: 'guide.demonhunter.vengeance.sections.rotation.summary.p4', message: 's, which heal for 6% of damage taken in the 5 seconds before they are absorbed.' })}
      </p>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      <br />
      <HideExplanationsToggle id="hide-explanations-rotation" />
      <HideGoodCastsToggle id="hide-good-casts-rotation" />
      {modules.fracture.guideSubsection()}
      {modules.immolationAura.vengeanceGuideSubsection()}
      {modules.sigilOfFlame.guideSubsection()}
      {info.combatant.hasTalent(TALENTS_DEMON_HUNTER.SPIRIT_BOMB_TALENT) &&
        modules.spiritBomb.guideSubsection()}
    </Section>
  );
}

const cooldowns: Cooldown[] = [
  {
    spell: TALENTS_DEMON_HUNTER.SOUL_CARVER_TALENT,
    isActive: (c) => c.hasTalent(TALENTS_DEMON_HUNTER.SOUL_CARVER_TALENT),
  },
  {
    spell: TALENTS_DEMON_HUNTER.FEL_DEVASTATION_TALENT,
    isActive: (c) => c.hasTalent(TALENTS_DEMON_HUNTER.FEL_DEVASTATION_TALENT),
  },
  {
    spell: TALENTS_DEMON_HUNTER.SIGIL_OF_SPITE_TALENT,
    isActive: (c) => c.hasTalent(TALENTS_DEMON_HUNTER.SIGIL_OF_SPITE_TALENT),
  },
  {
    spell: TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT,
    isActive: (c) =>
      c.hasTalent(TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT) &&
      c.hasTalent(TALENTS_DEMON_HUNTER.FIERY_DEMISE_TALENT),
  },
];
function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.vengeance.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      <p>
        {t({ id: 'guide.demonhunter.vengeance.sections.cooldowns.summary.p1', message: "Vengeance has multiple cooldowns that it can use to increase survivability or do large amounts of damage. In order to maximize usages over the course of an encounter, you should aim to send the cooldown as soon as it becomes available (as long as it can do damage on target) if you won't need it for an upcoming mechanic. It is particularly important to use " })}
        <SpellLink spell={TALENTS_DEMON_HUNTER.FEL_DEVASTATION_TALENT} />
        {t({ id: 'guide.demonhunter.vengeance.sections.cooldowns.summary.p2', message: ' as often as possible.' })}
      </p>
      <HideExplanationsToggle id="hide-explanations-cooldowns" />
      <HideGoodCastsToggle id="hide-good-casts-cooldowns" />
      <CooldownGraphSubsection cooldowns={cooldowns} />
      {info.combatant.hasTalent(TALENTS_DEMON_HUNTER.FEL_DEVASTATION_TALENT) && (
        <CooldownUsage analyzer={modules.felDevastation} />
      )}
      {info.combatant.hasTalent(TALENTS_DEMON_HUNTER.SOUL_CARVER_TALENT) && (
        <CooldownUsage analyzer={modules.soulCarver} />
      )}
    </Section>
  );
}
