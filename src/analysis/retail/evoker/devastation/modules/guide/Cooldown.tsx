import { GuideProps, Section } from 'interface/guide';

import { useAnalyzer } from 'interface/guide';
import { TALENTS_EVOKER } from 'common/TALENTS';
import CastEfficiency from 'parser/shared/modules/CastEfficiency';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import SPELLS from 'common/SPELLS';
import { GapHighlight } from 'parser/ui/CooldownBar';
import CombatLogParser from '../../CombatLogParser';
import { SpellLink } from 'interface';
import TALENTS from 'common/TALENTS/evoker';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const castEfficiency = useAnalyzer(CastEfficiency);
  if (!info || !castEfficiency) {
    return null;
  }

  const hasFontTalent = info.combatant.hasTalent(TALENTS_EVOKER.FONT_OF_MAGIC_DEVASTATION_TALENT);

  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      <p>
        <Trans id="guide.evoker.devastation.sections.cooldowns.summary">
          These cooldowns are essential for maximizing your damage output. Top performing Evokers are
          able to acheive 100% efficiency with{' '}
          <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />,{' '}
          <SpellLink spell={SPELLS.FIRE_BREATH} />, and <SpellLink spell={SPELLS.ETERNITY_SURGE} />.
        </Trans>
      </p>
      <div>
        {t({ id: 'guide.evoker.devastation.sections.cooldowns.legend', message: 'Legend' })}
        <ul>
          <li>
            <Trans id="guide.evoker.devastation.sections.cooldowns.legend.gray">
              Gray - Spell was available
            </Trans>
          </li>
          <li>
            <Trans id="guide.evoker.devastation.sections.cooldowns.legend.yellow">
              Yellow - Spell was on cooldown
            </Trans>
          </li>
          <li>
            <Trans id="guide.evoker.devastation.sections.cooldowns.legend.red">
              Red - Spell was available and potentially affected your effieciency
            </Trans>
          </li>
        </ul>
      </div>
      <CastEfficiencyBar spell={TALENTS.DRAGONRAGE_TALENT} gapHighlightMode={GapHighlight.All} />
      <CastEfficiencyBar
        spell={hasFontTalent ? SPELLS.FIRE_BREATH_FONT : SPELLS.FIRE_BREATH}
        gapHighlightMode={GapHighlight.FullCooldown}
      />
      <CastEfficiencyBar
        spell={hasFontTalent ? SPELLS.ETERNITY_SURGE_FONT : SPELLS.ETERNITY_SURGE}
        gapHighlightMode={GapHighlight.FullCooldown}
      />
      <CastEfficiencyBar
        spell={
          info.combatant.hasTalent(TALENTS.MANEUVERABILITY_TALENT)
            ? SPELLS.DEEP_BREATH_SCALECOMMANDER
            : SPELLS.DEEP_BREATH
        }
        gapHighlightMode={GapHighlight.All}
      />
    </Section>
  );
}
