import { formatDurationMinSec } from 'common/format';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellLink, TooltipElement } from 'interface';
import { ReactNode } from 'react';
import { t } from '@lingui/core/macro';

const ESTIMATED_BREW_CDR = 0.45;

/**
 * Brew cooldown for display, rounded up the nearest `basis` seconds.
 */
export const brewCooldownDisplay = (baseCooldown: number, basis = 5) =>
  Math.ceil((baseCooldown * ESTIMATED_BREW_CDR) / basis) * basis;

const lbCooldown = (baseCooldown: number) => brewCooldownDisplay(baseCooldown * 0.8);

const CountsAsBrew = ({
  baseCooldown,
  lightBrewing,
  cdTooltip,
}: {
  baseCooldown: number;
  lightBrewing?: boolean;
  cdTooltip?: ReactNode;
}) => {
  const cdText = (
    <>
      {lightBrewing ? <>{formatDurationMinSec(lbCooldown(baseCooldown))}&ndash;</> : null}
      {formatDurationMinSec(brewCooldownDisplay(baseCooldown))}.
    </>
  );
  return (
    <>
      {t({ id: 'monk.brewmaster.countsAsBrew.countsAsBrew', message: 'It counts as a' })}{' '}
      <TooltipElement
        hoverable
        content={
          <>
            {t({ id: 'monk.brewmaster.countsAsBrew.tooltip.p1', message: 'This means that it benefits from the cooldown reduction on spells like ' })}
            <SpellLink spell={talents.KEG_SMASH_TALENT} />
            {t({ id: 'monk.brewmaster.countsAsBrew.tooltip.p2', message: ' and ' })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({ id: 'monk.brewmaster.countsAsBrew.tooltip.p3', message: '.' })}
          </>
        }
      >
        {t({
          id: 'monk.brewmaster.countsAsBrew.brew',
          message: 'Brew',
        })}
      </TooltipElement>
      {t({ id: 'monk.brewmaster.countsAsBrew.typicalCooldown', message: ', with a typical cooldown of about' })}{' '}
      {cdTooltip ? (
        <TooltipElement hoverable content={cdTooltip}>
          {cdText}
        </TooltipElement>
      ) : (
        cdText
      )}
    </>
  );
};

export default CountsAsBrew;
