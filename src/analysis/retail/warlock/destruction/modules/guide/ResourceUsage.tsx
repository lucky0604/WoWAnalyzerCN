import { t } from '@lingui/core/macro';
import { GuideProps, Section, SubSection } from 'interface/guide';
import CombatLogParser from '../../CombatLogParser';

function ResourceUsage({ modules }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'warlock.destruction.resourceUsage.resourceUse', message: 'Resource Use' })}>
      <SubSection title={t({ id: 'warlock.destruction.resourceUsage.soulShards', message: 'Soul Shards' })}>
        <>
          {t({
            id: 'warlock.destruction.resourceUsage.description',
            message:
              "These are your primary spending resource as a Warlock. Instead of spells having cooldowns, you'll be gated by the amount of Soul Shards you have available. Outside of combat you passively regenerate up to 3 shards.",
          })}
          {modules.soulShardGraph.plot}
        </>
      </SubSection>
    </Section>
  );
}

export default ResourceUsage;
