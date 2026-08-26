import { t } from '@lingui/core/macro';
import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import CooldownSubsection from './modules/guide/CooldownsSubsection';
import ResourceUsage from './modules/guide/ResourceUsage';
import DefensivesGuide from '../shared/Defensives';
import UnstableAfflictionGuide from './modules/guide/UnstableAfflictionGuide';
import { DemonicHealthstoneGuide } from '../shared/DHSGuide';
import DarkHarvestGuide from './modules/guide/DarkHarvestGuide';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      {/* DoT Uptime Section */}
      <Section title={t({ id: 'warlock.affliction.section.dotUptimes', message: 'Dot Uptimes' })}>
        {modules.agony.guideSubsection}
        {modules.haunt.guideSubsection}
      </Section>

      {/* Unstable Affliction Section */}
      <Section
        title={t({
          id: 'warlock.affliction.section.unstableAffliction',
          message: 'Unstable Affliction',
        })}
      >
        <UnstableAfflictionGuide unstableAffliction={modules.unstableaffliction} />
      </Section>

      {/* Cooldowns Section */}
      <Section
        title={t({ id: 'warlock.affliction.section.cooldownUsage', message: 'Cooldown Usage' })}
      >
        <CooldownSubsection />
      </Section>

      {/* Dark Harvest Section */}
      {modules.darkHarvest.active && (
        <Section title="Dark Harvest">
          <DarkHarvestGuide />
        </Section>
      )}

      {/* Defensives Section with Healthstone Tracker */}
      <Section title={t({ id: 'warlock.affliction.section.defensives', message: 'Defensives' })}>
        <Section
          title={t({
            id: 'warlock.affliction.section.healthstoneTracker',
            message: 'Healthstone Tracker',
          })}
        >
          {modules.demonicHealthstone?.active && (
            <DemonicHealthstoneGuide
              analyzer={modules.demonicHealthstone}
              fightStart={info.fightStart}
              fightEnd={info.fightEnd}
            />
          )}
        </Section>

        <DefensivesGuide modules={modules} events={events} info={info} />
      </Section>

      {/* Resource Usage Section */}
      <Section
        title={t({ id: 'warlock.affliction.section.resourceUsage', message: 'Resource Usage' })}
      >
        <ResourceUsage modules={modules} events={events} info={info} />
      </Section>

      {/* Preparation Section */}
      <PreparationSection />
    </>
  );
}
