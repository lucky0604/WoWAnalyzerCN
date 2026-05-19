import { t } from '@lingui/core/macro';
import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import ResourceUsage from './modules/guide/ResourceUsage';
import CooldownSubsection from './modules/guide/CooldownSubsection';
import DefensivesGuide from '../shared/Defensives';
import { HavocGuide } from './modules/guide/HavocGuide';
import { DemonicHealthstoneGuide } from '../shared/DHSGuide';
import { BackdraftGuide } from './modules/guide/BackdraftGuide';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      {/* Core Section */}
      <Section title={t({ id: 'warlock.destruction.section.core', message: 'Core' })}>
        <Section title={t({ id: 'warlock.destruction.section.dotUptime', message: 'DoT Uptime' })}>
          {modules.immolateUptime.guideSubsection}
        </Section>

        <Section
          title={t({ id: 'warlock.destruction.section.cooldownUsage', message: 'Cooldown Usage' })}
        >
          <CooldownSubsection />
        </Section>
      </Section>

      {/* Rotation Section */}
      <Section title={t({ id: 'warlock.destruction.section.rotation', message: 'Rotation' })}>
        {modules.backdraft?.active && (
          <Section
            title={t({
              id: 'warlock.destruction.section.backdraftUsage',
              message: 'Backdraft Usage',
            })}
          >
            <BackdraftGuide
              analyzer={modules.backdraft}
              fightStart={info.fightStart}
              fightEnd={info.fightEnd}
            />
          </Section>
        )}

        {modules.havocAnalyzer?.active && (
          <Section
            title={t({ id: 'warlock.destruction.section.havocUsage', message: 'Havoc Usage' })}
          >
            <HavocGuide
              havocAnalyzer={modules.havocAnalyzer}
              formatTimestamp={modules.havocAnalyzer.getFormatTimestamp()}
            />
          </Section>
        )}
      </Section>

      {/* Defensives Section */}
      <Section title={t({ id: 'warlock.destruction.section.defensives', message: 'Defensives' })}>
        <Section
          title={t({
            id: 'warlock.destruction.section.healthstoneTracker',
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
        title={t({ id: 'warlock.destruction.section.resourceUsage', message: 'Resource Usage' })}
      >
        <ResourceUsage modules={modules} events={events} info={info} />
      </Section>

      {/* Preparation Section */}
      <Section title={t({ id: 'warlock.destruction.section.preparation', message: 'Preparation' })}>
        <PreparationSection />
      </Section>
    </>
  );
}
