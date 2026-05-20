import type { HTMLAttributes, ReactNode } from 'react';
import { CSSProperties, useCallback } from 'react';
import Spell from 'common/SPELLS/Spell';

import SpellIcon from './SpellIcon';
import useSpellInfo from './useSpellInfo';
import useTooltip from './useTooltip';
import { getSpellId } from 'common/getSpellId';
import { useFetchTooltip } from './useFetchTooltip';
import { useTooltipContext } from './TooltipContext';

interface Props extends Omit<HTMLAttributes<HTMLAnchorElement>, 'id'> {
  spell: number | Spell;
  children?: ReactNode;
  icon?: boolean;
  iconStyle?: CSSProperties;
  ilvl?: number;
  rank?: number;
  def?: number;
}

const SpellLink = ({
  ref,
  spell,
  children,
  icon = true,
  iconStyle,
  ilvl,
  rank,
  def,
  ...other
}: Props & { ref?: React.RefObject<HTMLAnchorElement | null> }) => {
  const spellData = spell;
  const spellId = getSpellId(spellData);
  const spellInfo = useSpellInfo(spellData);
  const { spell: spellTooltip } = useTooltip();
  const fetchTooltip = useFetchTooltip();
  const { showTooltip, hideTooltip } = useTooltipContext();

  const handleMouseEnter = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (other.onMouseEnter) {
        other.onMouseEnter(event);
      }

      const tooltipContent = await fetchTooltip({
        type: 'spell',
        id: spellId,
      });

      if (tooltipContent) {
        showTooltip(
          tooltipContent,
          event.clientX + 10,
          event.clientY + 10,
        );
      }
    },
    [spellId, fetchTooltip, showTooltip, other],
  );

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (other.onMouseLeave) {
        other.onMouseLeave(event);
      }
      hideTooltip();
    },
    [hideTooltip, other],
  );

  return (
    <a
      href={spellTooltip(spellId, { ilvl, rank, def })}
      target="_blank"
      rel="noopener noreferrer"
      ref={ref}
      className="spell-link-text"
      {...other}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon && (
        <>
          <SpellIcon spell={spellData} noLink style={iconStyle} alt="" />{' '}
        </>
      )}
      {children || (spellInfo?.name ? spellInfo.name : `Unknown spell: ${spellId}`)}
    </a>
  );
};

export default SpellLink;
