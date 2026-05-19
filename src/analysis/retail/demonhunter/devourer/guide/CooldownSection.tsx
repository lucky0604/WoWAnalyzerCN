import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from '../CombatLogParser';
import { t } from '@lingui/core/macro';

function CooldownSection({ modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.devourer.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      {modules.voidMetamorphosis.guideSubsection()}
    </Section>
  );
}

export default CooldownSection;
