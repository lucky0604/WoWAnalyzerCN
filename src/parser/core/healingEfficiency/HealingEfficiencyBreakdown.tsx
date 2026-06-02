import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatNumber, formatPercentage, formatDuration } from 'common/format';
import { SpellLink } from 'interface';
import { TooltipElement } from 'interface';
import PerformanceBar from 'parser/ui/PerformanceBar';
import { useState } from 'react';
import Toggle from 'interface/react-toggle';

import HealingEfficiencyTracker, { SpellInfoDetails } from './HealingEfficiencyTracker';
import type Spell from 'common/SPELLS/Spell';

interface Props<T extends HealingEfficiencyTracker = HealingEfficiencyTracker> {
  tracker: T;
  disableDamageToggle?: boolean;
}

export const BarHeader = ({ showHealing }: { showHealing: boolean }) => (
  <>
    <th>{t({ id: 'shared.healingEfficiency.tableHeader.manaSpent', message: 'Mana Spent' })}</th>
    {showHealing && (
      <>
        <th colSpan={2} className="text-center">
          {t({ id: 'common.stat.healingPerMana', message: 'Healing per mana spent' })}
        </th>
        <th colSpan={2} className="text-center">
          <TooltipElement
            content={
              <Trans id="common.stat.healingPerExecutionTime.long">
                Healing per second spent casting the spell, including GCD wait time.
              </Trans>
            }
          >
            {t({
              id: 'common.stat.healingPerExecutionTime',
              message: 'Healing per second spent casting',
            })}
          </TooltipElement>
        </th>
      </>
    )}
    {!showHealing && (
      <>
        <th colSpan={2} className="text-center">
          {t({ id: 'common.stat.damagePerMana', message: 'Damage per mana spent' })}
        </th>
        <th colSpan={2} className="text-center">
          <Trans id="common.stat.damagePerExecutionTime.long">
            Damage per second spent casting the spell
          </Trans>
        </th>
      </>
    )}
  </>
);

export const DetailHeader = ({ showHealing }: { showHealing: boolean }) => (
  <>
    <th>
      <TooltipElement
        content={
          <Trans id="shared.healingEfficiency.tableHeader.casts.tooltip">
            Total Casts (Number of targets hit)
          </Trans>
        }
      >
        {t({ id: 'shared.healingEfficiency.tableHeader.casts', message: 'Casts' })}
      </TooltipElement>
    </th>
    <th>{t({ id: 'shared.healingEfficiency.tableHeader.manaSpent', message: 'Mana Spent' })}</th>
    <th>{t({ id: 'shared.healingEfficiency.tableHeader.timeSpent', message: 'Time Spent' })}</th>
    {showHealing && (
      <>
        <th>
          {t({ id: 'shared.healingEfficiency.tableHeader.healingDone', message: 'Healing Done' })}
        </th>
        <th>
          {t({
            id: 'shared.healingEfficiency.tableHeader.overhealingDone',
            message: 'Overhealing',
          })}
        </th>
        <th>
          <TooltipElement
            content={
              <Trans id="common.stat.healingPerMana.long">
                Healing per mana spent casting the spell
              </Trans>
            }
          >
            {t({ id: 'common.stat.healingPerMana.short', message: 'HPM' })}
          </TooltipElement>
        </th>
        <th>
          <TooltipElement
            content={
              <Trans id="common.stat.healingPerExecutionTime.long">
                Healing per second spent casting the spell, including GCD wait time.
              </Trans>
            }
          >
            {t({ id: 'common.stat.healingPerExecutionTime.short', message: 'HPET' })}
          </TooltipElement>
        </th>
      </>
    )}
    {!showHealing && (
      <>
        <th>
          {t({ id: 'shared.healingEfficiency.tableHeader.damageDone', message: 'Damage Done' })}
        </th>
        <th>
          <TooltipElement
            content={
              <Trans id="common.stat.damagePerMana.long">
                Damage per mana spent casting the spell
              </Trans>
            }
          >
            {t({ id: 'common.stat.damagePerMana.short', message: 'DPM' })}
          </TooltipElement>
        </th>
        <th>
          <TooltipElement
            content={
              <Trans id="common.stat.damagePerExecutionTime.long">
                Damage per second spent casting the spell
              </Trans>
            }
          >
            {t({ id: 'common.stat.damagePerExecutionTime.short', message: 'DPET' })}
          </TooltipElement>
        </th>
      </>
    )}
  </>
);

const BarView = (
  spellDetail: SpellInfoDetails,
  topHpm: number,
  topDpm: number,
  topHpet: number,
  topDpet: number,
  showHealing: boolean,
) => {
  const hasHealing = spellDetail.healingDone;
  const hasDamage = spellDetail.damageDone > 0;
  const barWidth = 20;

  return (
    <>
      <td>
        {formatNumber(spellDetail.manaSpent)}
        {' (' + formatPercentage(spellDetail.manaPercentSpent) + '%)'}
      </td>
      {showHealing && (
        <>
          <td className="text-right">{hasHealing ? spellDetail.hpm.toFixed(2) : '-'}</td>
          <td width={barWidth + '%'}>
            <PerformanceBar percent={spellDetail.hpm / topHpm} />
          </td>

          <td className="text-right">{hasHealing ? formatNumber(spellDetail.hpet * 1000) : '-'}</td>
          <td width={barWidth + '%'}>
            <PerformanceBar percent={spellDetail.hpet / topHpet} />
          </td>
        </>
      )}
      {!showHealing && (
        <>
          <td className="text-right">{hasDamage ? spellDetail.dpm.toFixed(2) : '-'}</td>
          <td width={barWidth + '%'}>
            <PerformanceBar percent={spellDetail.dpm / topDpm} />
          </td>

          <td className="text-right">{hasDamage ? formatNumber(spellDetail.dpet * 1000) : '-'}</td>
          <td width={barWidth + '%'}>
            <PerformanceBar percent={spellDetail.dpet / topDpet} />
          </td>
        </>
      )}
    </>
  );
};

const DetailView = (spellDetail: SpellInfoDetails, showHealing: boolean) => {
  const hasHealing = spellDetail.healingDone;
  const hasOverhealing = spellDetail.healingDone > 0 || spellDetail.overhealingDone > 0;
  const hasDamage = spellDetail.damageDone > 0;

  return (
    <>
      <td>
        {spellDetail.casts} (
        {showHealing ? Math.floor(spellDetail.healingHits) : Math.floor(spellDetail.damageHits)})
      </td>
      <td>
        {formatNumber(spellDetail.manaSpent)}
        {' (' + formatPercentage(spellDetail.manaPercentSpent) + '%)'}
      </td>
      <td>
        {spellDetail.timeSpentCasting !== 0
          ? formatDuration(spellDetail.timeSpentCasting) +
            ' (' +
            formatPercentage(spellDetail.percentTimeSpentCasting) +
            '%)'
          : '-'}
      </td>
      {showHealing && (
        <>
          <td>
            {hasHealing ? formatNumber(spellDetail.healingDone) : '-'}
            {hasHealing ? ' (' + formatPercentage(spellDetail.percentHealingDone) + '%)' : ''}
          </td>
          <td>
            {hasOverhealing ? formatNumber(spellDetail.overhealingDone) : '-'}
            {hasOverhealing
              ? ' (' + formatPercentage(spellDetail.percentOverhealingDone) + '%)'
              : ''}
          </td>
          <td>{hasHealing ? spellDetail.hpm.toFixed(2) : '-'}</td>
          <td>{hasHealing ? formatNumber(spellDetail.hpet * 1000) : '-'}</td>
        </>
      )}
      {!showHealing && (
        <>
          <td>
            {hasDamage ? formatNumber(spellDetail.damageDone) : '-'}
            {hasDamage ? ' (' + formatPercentage(spellDetail.percentDamageDone) + '%)' : ''}
          </td>
          <td>{hasDamage ? spellDetail.dpm.toFixed(2) : '-'}</td>
          <td>{hasDamage ? formatNumber(spellDetail.dpet * 1000) : '-'}</td>
        </>
      )}
    </>
  );
};

const HealingEfficiencySpellRow = (
  spellDetail: SpellInfoDetails,
  topHpm: number,
  topDpm: number,
  topHpet: number,
  topDpet: number,
  showHealing: boolean,
  detailedView: boolean,
) => (
  <tr key={spellDetail.spell.id}>
    <td>
      <SpellLink
        spell={'icon' in spellDetail.spell ? (spellDetail.spell as Spell) : spellDetail.spell.id}
      />
    </td>
    {detailedView
      ? DetailView(spellDetail, showHealing)
      : BarView(spellDetail, topHpm, topDpm, topHpet, topDpet, showHealing)}
  </tr>
);

interface TableProps {
  tracker: HealingEfficiencyTracker;
  showHealing: boolean;
  detailedView: boolean;
  showCooldowns: boolean;
}

export const HealingEfficiencyTable = ({
  tracker,
  showHealing,
  detailedView,
  showCooldowns,
}: TableProps) => {
  const { spells, topHpm, topDpm, topHpet, topDpet } = tracker.getAllSpellStats(showCooldowns);

  const spellArray = Object.values(spells);

  spellArray.sort((a, b) => {
    if (showHealing) {
      if (a.hpm < b.hpm) {
        return 1;
      } else if (a.hpm > b.hpm) {
        return -1;
      }
    } else {
      if (a.dpm < b.dpm) {
        return 1;
      } else if (a.dpm > b.dpm) {
        return -1;
      }
    }

    return 0;
  });

  const spellRows = spellArray.map((spellDetail) => {
    if (spellDetail.casts > 0) {
      return HealingEfficiencySpellRow(
        spellDetail,
        topHpm,
        topDpm,
        topHpet,
        topDpet,
        showHealing,
        detailedView,
      );
    }
    return null;
  });

  return <>{spellRows}</>;
};

const HealingEfficiencyBreakdown = ({ tracker, disableDamageToggle }: Props) => {
  const [showHealing, setShowHealing] = useState(true);
  const [detailedView, setDetailedView] = useState(false);
  const [showCooldowns, setShowCooldowns] = useState(false);

  return (
    <>
      <div className="pad" style={{ paddingTop: 10 }}>
        <div className="pull-left">
          <div className="toggle-control pull-right" style={{ marginRight: '.5em' }}>
            <Toggle
              defaultChecked={false}
              icons={false}
              onChange={(event) => setDetailedView(event.target.checked)}
              id="detailed-toggle"
            />
            <label htmlFor="detailed-toggle" style={{ marginLeft: '0.5em' }}>
              {t({ id: 'shared.healingEfficiency.toggle.detailed', message: 'Detailed View' })}
            </label>
          </div>
        </div>
        <div className="pull-right">
          <div
            className="toggle-control pull-left"
            style={{ marginLeft: '.5em', marginRight: '.5em' }}
          >
            <Toggle
              defaultChecked={false}
              icons={false}
              onChange={(event) => setShowCooldowns(event.target.checked)}
              id="cooldown-toggle"
            />
            <label htmlFor="cooldown-toggle" style={{ marginLeft: '0.5em' }}>
              {t({ id: 'shared.healingEfficiency.toggle.cooldowns', message: 'Show Cooldowns' })}
            </label>
          </div>
          {!disableDamageToggle && (
            <div className="toggle-control pull-left" style={{ marginLeft: '.5em' }}>
              <label htmlFor="healing-toggle" style={{ marginLeft: '0.5em', marginRight: '1em' }}>
                {t({ id: 'shared.healingEfficiency.toggle.damage', message: 'Show Damage' })}
              </label>
              <Toggle
                defaultChecked
                icons={false}
                onChange={(event) => setShowHealing(event.target.checked)}
                id="healing-toggle"
              />
              <label htmlFor="healing-toggle" style={{ marginLeft: '0.5em' }}>
                {t({ id: 'shared.healingEfficiency.toggle.healing', message: 'Show Healing' })}
              </label>
            </div>
          )}
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t({ id: 'common.ability', message: 'Ability' })}</th>
            {detailedView ? (
              <DetailHeader showHealing={showHealing} />
            ) : (
              <BarHeader showHealing={showHealing} />
            )}
          </tr>
        </thead>
        <tbody>
          <HealingEfficiencyTable
            tracker={tracker}
            showHealing={showHealing}
            detailedView={detailedView}
            showCooldowns={showCooldowns}
          />
        </tbody>
      </table>
    </>
  );
};

export default HealingEfficiencyBreakdown;
