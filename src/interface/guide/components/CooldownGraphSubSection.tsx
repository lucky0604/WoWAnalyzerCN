import type { JSX } from 'react';
import Spell from 'common/SPELLS/Spell';
import Combatant from 'parser/core/Combatant';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide/index';
import CastEfficiency from 'parser/shared/modules/CastEfficiency';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';

/**
 * Represents a cooldown that we might want to have show up in the graph. Example:
 *
 * @example
 *   {
 *     spell: TALENTS.WAKE_OF_ASHES_TALENT,
 *     isActive: (c) => c.hasTalent(TALENTS.WAKE_OF_ASHES_TALENT),
 *   },
 */
export interface Cooldown {
  spell: Spell;
  isActive?: (c: Combatant) => boolean;
}

interface CooldownGraphSubsectionProps {
  /**
   * Any cooldowns that we want to render in our graph.
   */
  cooldowns: Cooldown[];
  /**
   * A title that we may want to render as part of the subsection.
   */
  title?: string;
  /**
   * A description that we may want to render as part of the subsection.
   */
  description?: JSX.Element;
  /**
   * How many casts of a spell will remove its icon from the graph? Defaults to 10.
   */
  tooManyCasts?: number;
}

/**
 * Renders a subsection for a Guide that contains cast efficiency information about cooldowns that
 * were used during a fight.
 *
 * Needs a list of {@link Cooldown}s so that it can properly process them.
 */
const CooldownGraphSubsection = ({
  cooldowns,
  title,
  description,
  tooManyCasts = 10,
}: CooldownGraphSubsectionProps) => {
  const info = useInfo();
  const castEfficiency = useAnalyzer(CastEfficiency);
  if (!info || !castEfficiency) {
    return null;
  }

  const activeCooldowns = cooldowns.filter(
    (cooldown) => cooldown.isActive?.(info.combatant) ?? true,
  );
  const hasTooManyCasts = activeCooldowns.some((cooldown) => {
    const casts = castEfficiency.getCastEfficiencyForSpell(cooldown.spell)?.casts ?? 0;
    return casts >= tooManyCasts;
  });

  description = description ?? (
    <>
      <strong>冷却图表</strong>
      — 此图显示你何时使用了冷却技能以及再次使用前的等待时间。灰色段表示技能可用，黄色段表示技能冷却中。红色段高亮表示你本可以完整多使用一次该冷却的时间段。
    </>
  );

  return (
    <SubSection title={title}>
      {description}
      {activeCooldowns.map((cooldownCheck) => (
        <CastEfficiencyBar
          key={cooldownCheck.spell.id}
          spell={cooldownCheck.spell}
          gapHighlightMode={GapHighlight.FullCooldown}
          minimizeIcons={hasTooManyCasts}
          useThresholds
        />
      ))}
    </SubSection>
  );
};

export default CooldownGraphSubsection;
