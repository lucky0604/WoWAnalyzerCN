import { t } from '@lingui/core/macro';
import { GuideProps, Section, SubSection, useAnalyzers } from 'interface/guide';
import { AplSectionData } from 'interface/guide/components/Apl';
import Explanation from 'interface/guide/components/Explanation';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import DivineProtection from '../modules/spells/DivineProtection';
import DivineShield from '../modules/spells/DivineShield';
import { ResourceLink } from 'interface';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import * as AplCheck from '../modules/core/AplCheck';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';
import CombatLogParser from '../CombatLogParser';
import CooldownGraphSubsection from './CooldownGraphSubsection';
import talents from 'common/TALENTS/paladin';

/** Common 'rule line' point for the explanation/data in Core Spells section */
export const GUIDE_CORE_EXPLANATION_PERCENT = 40;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section
        title={t({ id: 'paladin.holy.section.alwaysBeCasting', message: 'Always Be Casting' })}
      >
        <FoundationDowntimeSectionV2 />
      </Section>
      <CoreSection modules={modules} info={info} events={events} />
      <CoreRotationSection info={info} />
      <InfusionOfLightSection modules={modules} info={info} events={events} />
      <Section title={t({ id: 'paladin.holy.section.beacons', message: 'Beacons' })}>
        {info.combatant.hasTalent(talents.BEACON_OF_VIRTUE_TALENT)
          ? modules.beaconOfVirtue.guideSubsection
          : modules.beaconUptime.guideSubsection}
        {modules.beaconOverview.guideSubsection}
      </Section>
      <Section
        title={t({
          id: 'paladin.holy.section.healingCooldowns',
          message: 'Healing cooldowns',
        })}
      >
        <CooldownGraphSubsection />
      </Section>
      <DefensivesSection />
      <PreparationSection />
    </>
  );
}

const CoreSection = ({ modules, info, events }: GuideProps<typeof CombatLogParser>) => {
  return (
    <Section title={t({ id: 'paladin.holy.section.core', message: 'Core' })}>
      {modules.holyShock.guideSubsection}
      {modules.holyPowerOverview.guideSubsection}
      {info.combatant.hasTalent(talents.HOLY_PRISM_TALENT) && modules.holyPrism.guideSubsection}
      {modules.holyLight.guideSubsection}
      {modules.judgment.guideSubsection}
    </Section>
  );
};

const CoreRotationSection = ({ info }: { info: GuideProps<typeof CombatLogParser>['info'] }) => (
  <Section title={t({ id: 'paladin.holy.section.coreRotation', message: 'Core Rotation' })}>
    <p>
      <>
        {t({
          id: 'paladin.holy.coreRotation.description.p1',
          message:
            'Holy Paladin is a reactive healer. There is no rotation to follow, but there is a priority list that holds whenever nothing more urgent is happening: build ',
        })}
        <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
        {t({
          id: 'paladin.holy.coreRotation.description.p2',
          message: " and spend it, and don't waste either end of that.",
        })}
      </>
    </p>
    <p>
      <strong>
        {t({
          id: 'paladin.holy.coreRotation.description.strong',
          message: 'This list cannot see the damage you were reacting to.',
        })}
      </strong>{' '}
      {t({
        id: 'paladin.holy.coreRotation.description.p3',
        message:
          'Holding a global because you expected damage, or healing someone who was about to die, will show up here as a violation. Use it to find moments worth looking at, not as a score.',
      })}
    </p>
    <SubSection>
      <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
    </SubSection>
  </Section>
);

const DEFENSIVE_ANALYZERS = [DivineProtection, DivineShield];

const DefensivesSection = () => (
  <Section title={t({ id: 'paladin.holy.section.defensives', message: 'Defensives' })}>
    <HideExplanationsToggle id="hide-explanations-major-defensives" />
    <Explanation>
      {t({
        id: 'paladin.holy.section.defensives.explanation',
        message:
          "Taking less damage yourself is healing your healers -- or in a dungeon, healing you don't have to do. These are short enough to use for anything you can see coming rather than saved for something worse.",
      })}
    </Explanation>
    <SubSection title={t({ id: 'paladin.holy.section.damageTaken', message: 'Damage Taken' })}>
      <Timeline analyzers={useAnalyzers(DEFENSIVE_ANALYZERS)} />
    </SubSection>
    <AllCooldownUsageList analyzers={useAnalyzers(DEFENSIVE_ANALYZERS)} showTitles />
  </Section>
);

/** Infusion of Light and the spells it empowers, which only make sense read together. */
const InfusionOfLightSection = ({ modules, info }: GuideProps<typeof CombatLogParser>) => {
  if (!info.combatant.hasTalent(talents.INFUSION_OF_LIGHT_TALENT)) {
    return null;
  }

  return (
    <Section
      title={t({ id: 'paladin.holy.section.infusionOfLight', message: 'Infusion of Light' })}
    >
      {modules.infusionOfLight.guideSubsection}
      {modules.flashOfLightUsage.guideSubsection}
    </Section>
  );
};
