import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GuideProps, Section, SubSection, useInfo } from 'interface/guide';
import { AlertWarning, ResourceLink, SpellLink } from 'interface';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import CombatLogParser from 'analysis/retail/paladin/protection/CombatLogParser';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';

import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import PerformancePercentage from 'analysis/retail/demonhunter/shared/guide/PerformancePercentage';

import MajorDefensives from './modules/core/Defensives';
import ActiveMitgation from './modules/core/Defensives/ActiveMitigation';
import { FoundationDowntimeSection } from 'interface/guide/foundation/FoundationDowntimeSection';
import { FoundationCooldownSection } from 'interface/guide/foundation/FoundationCooldownSection';
import { AplSectionData } from 'interface/guide/components/Apl';
import { apl, check } from './modules/core/AplCheck';
import talents from 'common/TALENTS/paladin';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section
        title={t({ id: 'paladin.protection.section.coreSkills', message: 'Core Skills' })}
      >
        <FoundationDowntimeSection />
        <FoundationCooldownSection />
      </Section>
      <ResourceUsageSection modules={modules} events={events} info={info} />
      <Section title={t({ id: 'paladin.protection.section.rotation', message: 'Rotation' })}>
        {!info.combatant.hasTalent(talents.LIGHTS_GUIDANCE_TALENT) && (
          <AlertWarning>
            <>
              {t({ id: 'paladin.protection.rotation.lightsmithNotImplemented.p1', message: 'Rotational analysis for ' })}
              <SpellLink spell={talents.HOLY_ARMAMENTS_PROTECTION_TALENT}>Lightsmith</SpellLink>
              {t({ id: 'paladin.protection.rotation.lightsmithNotImplemented.p2', message: ' is not implemented at this time.' })}
            </>
          </AlertWarning>
        )}
        <AplSectionData checker={check} apl={apl} />
      </Section>
      <MitigationSection />
      <ActiveMitigationSection />
      <PreparationSection />
    </>
  );
}

const PERFECT_HOLY_POWER_CAP = 0.1;
const GOOD_HOLY_POWER_CAP = 0.15;
const OK_HOLY_POWER_CAP = 0.2;
function ResourceUsageSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const percentAtHolyPowerCap = modules.holyPowerTracker.percentAtCap;
  let percentAtHolyPowerCapPerformance = QualitativePerformance.Fail;
  if (percentAtHolyPowerCap <= PERFECT_HOLY_POWER_CAP) {
    percentAtHolyPowerCapPerformance = QualitativePerformance.Perfect;
  } else if (percentAtHolyPowerCap <= GOOD_HOLY_POWER_CAP) {
    percentAtHolyPowerCapPerformance = QualitativePerformance.Good;
  } else if (percentAtHolyPowerCap <= OK_HOLY_POWER_CAP) {
    percentAtHolyPowerCapPerformance = QualitativePerformance.Ok;
  }
  const holyPowerWasted = modules.holyPowerTracker.wasted;

  return (
    <Section
      title={t({ id: 'paladin.protection.section.resourceUse', message: 'Resource Use' })}
    >
      <SubSection
        title={t({ id: 'paladin.protection.subsection.holyPower', message: 'Holy Power' })}
      >
        <p>
          <>
            {t({ id: 'paladin.protection.holyPower.description.p1', message: 'Most of your rotational abilities either ' })}
            <strong>{t({ id: 'paladin.protection.holyPower.description.build', message: 'build' })}</strong>
            {t({ id: 'paladin.protection.holyPower.description.p2', message: ' or ' })}
            <strong>{t({ id: 'paladin.protection.holyPower.description.spend', message: 'spend' })}</strong>
            {' '}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.protection.holyPower.description.p3', message: '. Never use a builder at max ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.protection.holyPower.description.p4', message: ' or when doing so will cause you to overcap on ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.protection.holyPower.description.p5', message: '.' })}
          </>
        </p>
        <SideBySidePanels>
          <RoundedPanel>
            <strong>
              <><ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.protection.holyPower.wasteTitle.p1', message: 'Waste' })}
              </>
            </strong>
            <p>
              <>{t({ id: 'paladin.protection.holyPower.wasted.p1', message: 'You wasted' })}
                {' '}
                <PerformancePercentage
                  performance={percentAtHolyPowerCapPerformance}
                  perfectPercentage={PERFECT_HOLY_POWER_CAP}
                  goodPercentage={GOOD_HOLY_POWER_CAP}
                  okPercentage={OK_HOLY_POWER_CAP}
                  percentage={percentAtHolyPowerCap}
                  flatAmount={holyPowerWasted}
                />
                {' '}
                {t({ id: 'paladin.protection.holyPower.wasted.p2', message: 'of your' })}
                {' '}
                <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.protection.holyPower.wasted.p3', message: '.' })}
              </>
            </p>
          </RoundedPanel>
          <RoundedPanel>
            <strong>
              <><ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.protection.holyPower.builderEffectiveness.p1', message: 'Builder Effectiveness' })}
              </>
            </strong>
            {modules.builderUse.chart}
          </RoundedPanel>
        </SideBySidePanels>
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
        id: 'paladin.protection.section.defensiveCooldowns',
        message: 'Defensive Cooldowns',
      })}
    >
      <MajorDefensives />
    </Section>
  );
}

function ActiveMitigationSection() {
  const info = useInfo();
  if (!info) {
    return null;
  }

  return (
    <Section
      title={t({
        id: 'paladin.protection.section.activeMitigation',
        message: 'Active Mitigation',
      })}
    >
      <ActiveMitgation />
    </Section>
  );
}
