import { GuideProps, Section } from 'interface/guide';

import { useAnalyzer } from 'interface/guide';
import CastEfficiency from 'parser/shared/modules/CastEfficiency';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import CombatLogParser from 'analysis/retail/hunter/survival/CombatLogParser';
import { SpellLink } from 'interface';
import TALENTS from 'common/TALENTS/hunter';
import SPELLS from 'common/SPELLS/hunter';
import TakedownSection from '../../../talents/Takedown/TakedownSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const castEfficiency = useAnalyzer(CastEfficiency);
  if (!info || !castEfficiency) {
    return null;
  }

  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      <p>
        <>
          {t({
            id: 'guide.hunter.survival.sections.cooldowns.summary.p1',
            message: 'These cooldowns are essential for maximizing your damage output.',
          })}
          <SpellLink spell={TALENTS.TAKEDOWN_TALENT} />
          {t({ id: 'guide.hunter.survival.sections.cooldowns.summary.p2', message: '.' })}
        </>
      </p>
      <div>
        {t({ id: 'guide.hunter.survival.sections.cooldowns.legend', message: 'Legend' })}
        <ul>
          <li>
            <Trans id="guide.hunter.survival.sections.cooldowns.legend.available">
              Gray - Spell was available
            </Trans>
          </li>
          <li>
            <Trans id="guide.hunter.survival.sections.cooldowns.legend.onCooldown">
              Yellow - Spell was on cooldown
            </Trans>
          </li>
        </ul>
      </div>
      <CastEfficiencyBar
        spell={SPELLS.TAKEDOWN_PLAYER}
        gapHighlightMode={GapHighlight.FullCooldown}
        slimLines
        useThresholds
      />
      {info.combatant.hasTalent(TALENTS.BOOMSTICK_TALENT) && (
        <CastEfficiencyBar
          spell={TALENTS.BOOMSTICK_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
        />
      )}
      <TakedownSection />
    </Section>
  );
}
