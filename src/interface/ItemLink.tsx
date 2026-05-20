import getItemQualityLabel from 'common/getItemQualityLabel';
import ITEMS from 'common/ITEMS';
import type { ReactNode } from 'react';
import { AnchorHTMLAttributes, useCallback } from 'react';

import ItemIcon from './ItemIcon';
import QualityIcon from './QualityIcon';
import useTooltip from './useTooltip';
import { useFetchTooltip } from './useFetchTooltip';
import { useTooltipContext } from './TooltipContext';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'id'> {
  id: number;
  children?: ReactNode;
  details?: {
    itemLevel: number;
    quality: number;
  };
  quality?: number;
  icon?: boolean;
  craftQuality?: 1 | 2 | 3 | 4 | 5;
}

const ItemLink = ({
  id,
  children,
  details,
  icon = true,
  craftQuality,
  quality: rawQuality,
  ...others
}: Props) => {
  const { item: itemTooltip } = useTooltip();
  const fetchTooltip = useFetchTooltip();
  const { showTooltip, hideTooltip } = useTooltipContext();

  if (import.meta.env.DEV && !children && !ITEMS[id]) {
    throw new Error(`Unknown item: ${id}`);
  }

  let quality;
  if (rawQuality !== undefined && rawQuality !== null) {
    quality = rawQuality;
  } else if (details?.quality) {
    quality = details.quality;
  }

  const handleMouseEnter = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (others.onMouseEnter) {
        others.onMouseEnter(event);
      }

      const tooltipContent = await fetchTooltip({
        type: 'item',
        id,
      });

      if (tooltipContent) {
        showTooltip(
          tooltipContent,
          event.clientX + 10,
          event.clientY + 10,
        );
      }
    },
    [id, fetchTooltip, showTooltip, others],
  );

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (others.onMouseLeave) {
        others.onMouseLeave(event);
      }
      hideTooltip();
    },
    [hideTooltip, others],
  );

  return (
    <a
      href={itemTooltip(id, details)}
      target="_blank"
      rel="noopener noreferrer"
      className={getItemQualityLabel(quality) + 'item-link-text'}
      {...others}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon && (
        <>
          <ItemIcon id={id} noLink />{' '}
        </>
      )}
      {children || ITEMS[id]?.name}
      {craftQuality ? <QualityIcon quality={craftQuality} /> : null}
    </a>
  );
};

export default ItemLink;
