import { t } from '@lingui/core/macro';
import { GuideProps, Section, SubSection } from 'interface/guide';
import CombatLogParser from 'analysis/retail/hunter/survival/CombatLogParser';
export default function RotationSection({
  modules,
  events,
  info,
}: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.rotation.title',
        message: 'Rotation',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.hunter.survival.sections.rotation.core.title',
          message: 'Core Rotation',
        })}
      >
        {modules.raptorStrike.guideSubsection}
      </SubSection>

      <SubSection
        title={t({
          id: 'guide.hunter.survival.sections.rotation.rotationalcooldowns.title',
          message: 'Rotational Cooldowns',
        })}
      >
        <strong>
          {t({
            id: 'guide.hunter.survival.sections.rotation.core.graph.bold',
            message: 'Cooldown Graph',
          })}
        </strong>
        {t({
          id: 'guide.hunter.survival.sections.rotation.core.graph.p1',
          message: ' - this graph shows when you used your cooldowns and how long you waited to use them again. Grey segments show when the spell was available, yellow segments show when the spell was cooling down. Red segments highlight times when you could have fit a whole extra use of the cooldown.',
        })}
        {modules.raptorSwipe.guideSubsection}
        {modules.wildfireBomb.guideSubsection}
        {modules.boomstick.guideSubsection}
      </SubSection>
    </Section>
  );
}
