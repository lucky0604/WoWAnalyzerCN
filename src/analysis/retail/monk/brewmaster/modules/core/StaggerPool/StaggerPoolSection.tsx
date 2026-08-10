import { SubSection, useAnalyzer, useAnalyzers } from 'interface/guide';
import { JSX, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import StaggerPoolGraph from '../../features/StaggerPoolGraph';
import StaggerPool from '../StaggerPool';
import Table from 'interface/Table/Table';
import {
  amountBar,
  literalNumberColumn,
  OTHER_SPECIAL_ID,
  spellName,
} from 'interface/Table/ThroughputTable';
import { Highlight } from 'interface/Highlight';
import QuickSip from '../../talents/QuickSip';
import StaggeringStrikes from '../../talents/StaggeringStrikes';
import TranquilSpirit from '../../talents/TranquilSpirit';
import PurifyingBrew from '../../talents/PurifyingBrew';
import TouchOfDeathStagger from '../../spells/TouchOfDeathStagger';
import SPELLS from 'common/SPELLS';
import spells from '../../../spell-list_Monk_Brewmaster.retail';
import cssComponent from 'interface/utils/css-component';
import styles from './StaggerPoolSection.module.scss';
import SpellLink from 'interface/SpellLink';
import Explanation from 'interface/guide/components/Explanation';
import { formatNumber } from 'common/format';
import InvokeNiuzaoStagger from '../../talents/InvokeNiuzao/InvokeNiuzaoStagger';
import Tooltip from 'interface/Tooltip';
import { InformationIcon } from 'interface/icons';
import AlertInfo from 'interface/AlertInfo';
import AlertWarning from 'interface/AlertWarning';

const SideBySide = cssComponent('div', styles.SideBySide, [] as const);

const SummaryDL = cssComponent('dl', styles.SummaryDL, [] as const);

export default function StaggerPoolSection(): JSX.Element | null {
  const graph = useAnalyzer(StaggerPoolGraph);
  const stagger = useAnalyzer(StaggerPool);
  const tranquilSpirit = useAnalyzer(TranquilSpirit);
  const totalAbsorb = useMemo(() => {
    return stagger?.totalDamageByAbility.values().reduce((total, v) => total + v, 0) ?? 0;
  }, [stagger]);

  if (!stagger) {
    return null;
  }

  return (
    <>
      <AlertInfo>
        <>
          <SpellLink spell={spells.STAGGER_TALENT} />
          {t({
            id: 'monk.brewmaster.stagger.overhaul.p1',
            message:
              ' tracking has received a major overhaul in Midnight to handle all of the new talents that purify or prevent Stagger. If you see errors, please contact ',
          })}
          <code>@emallson</code>
          {t({ id: 'monk.brewmaster.stagger.overhaul.p2', message: ' on Discord.' })}
        </>
      </AlertInfo>
      {(tranquilSpirit?.missedClearsPerMinute ?? 0) >= 1 && (
        <AlertWarning>
          <>
            <SpellLink spell={spells.TRANQUIL_SPIRIT_TALENT} />
            {t({
              id: 'monk.brewmaster.stagger.tranquil_spirit_missing.p1',
              message: ' is missing a high number of ',
            })}
            <SpellLink spell={spells.STAGGER_TALENT} />
            {t({
              id: 'monk.brewmaster.stagger.tranquil_spirit_missing.p2',
              message: ' clearing events (',
            })}
            {tranquilSpirit!.missedClearsPerMinute.toFixed(1)}
            {t({
              id: 'monk.brewmaster.stagger.tranquil_spirit_missing.p3',
              message: ' per minute). Please report this log to ',
            })}
            <code>@emallson</code>
            {t({
              id: 'monk.brewmaster.stagger.tranquil_spirit_missing.p4',
              message: ' on Discord for investigation.',
            })}
          </>
        </AlertWarning>
      )}
      <SubSection title={<SpellLink spell={spells.STAGGER_TALENT} />}>
        <SummaryDL>
          <dt>
            <>
              {t({ id: 'monk.brewmaster.stagger.total_absorbed.p1', message: 'Total Damage Absorbed by ' })}
              <SpellLink spell={spells.STAGGER_TALENT} />
            </>
          </dt>
          <dd>{formatNumber(totalAbsorb)}</dd>
          <dt>
            <>
              {t({ id: 'monk.brewmaster.stagger.total_tick.p1', message: 'Total Damage Taken from ' })}
              <SpellLink spell={spells.STAGGER_TALENT} />
              {t({ id: 'monk.brewmaster.stagger.total_tick.p2', message: ' (DoT)' })}
            </>
          </dt>
          <dd>{formatNumber(stagger.totalTickDamageTaken)}</dd>
          <dt>
            {t({
              id: 'monk.brewmaster.stagger.total_purified',
              message: 'Total Damage Purified&nbsp;',
            })}
            <Tooltip
              content={
                <Trans id="monk.brewmaster.stagger.purified_tooltip">
                  This may not exactly match the table below due to immunities or the fast Stagger
                  drain that occurs after several seconds without incoming damage taken.
                </Trans>
              }
            >
              <span>
                <InformationIcon />
              </span>
            </Tooltip>
          </dt>
          <dd>{formatNumber(totalAbsorb - stagger.totalTickDamageTaken)} </dd>
        </SummaryDL>
        <Explanation>
          <>
            {t({ id: 'monk.brewmaster.stagger.chart_explanation.p1', message: 'This chart shows the amount of damage in the ' })}
            <SpellLink spell={spells.STAGGER_TALENT} />
            {t({ id: 'monk.brewmaster.stagger.chart_explanation.p2', message: ' pool over time, with ' })}
            <SpellLink spell={spells.PURIFYING_BREW_TALENT} />
            {t({ id: 'monk.brewmaster.stagger.chart_explanation.p3', message: ' casts highlighted.' })}
          </>
          {graph?.deps.ht.active == true && (
            <>
              {t({ id: 'monk.brewmaster.stagger.chart_green.p1', message: '  in ' })}
              <Highlight color="#00ff96" textColor="black">
                {t({ id: 'monk.brewmaster.stagger.chart_green.p2', message: 'green' })}
              </Highlight>
              {t({ id: 'monk.brewmaster.stagger.chart_green.p3', message: '  if cast while ' })}
              <SpellLink spell={SPELLS.ELEVATED_STAGGER_BUFF} />
              {t({ id: 'monk.brewmaster.stagger.chart_green.p4', message: ' is active' })}
            </>
          )}
          .
        </Explanation>
        <div>{graph?.plot}</div>
        <SideBySide>
          <div>
            <header>
              <strong>
                <>
                  {t({ id: 'monk.brewmaster.stagger.added.p1', message: 'Damage Added to ' })}
                  <SpellLink spell={spells.STAGGER_TALENT} />
                </>
              </strong>
              <Explanation>
                <>
                  {t({ id: 'monk.brewmaster.stagger.added_explanation.p1', message: 'Part of damage taken from every hit is absorbed by ' })}
                  <SpellLink spell={spells.STAGGER_TALENT} />
                  {t({ id: 'monk.brewmaster.stagger.added_explanation.p2', message: '. This table shows the amount added by incoming damage sources.' })}
                </>
              </Explanation>
            </header>
            <StaggerTakenTable />
          </div>
          <div>
            <header>
              <strong>
                <>
                  {t({ id: 'monk.brewmaster.stagger.removed.p1', message: 'Damage Removed from ' })}
                  <SpellLink spell={spells.STAGGER_TALENT} />
                </>
              </strong>
              <Explanation>
                <>
                  {t({ id: 'monk.brewmaster.stagger.removed_explanation.p1', message: 'Damage can be removed from the ' })}
                  <SpellLink spell={spells.STAGGER_TALENT} />
                  {t({ id: 'monk.brewmaster.stagger.removed_explanation.p2', message: ' ' })}
                  <em>{t({ id: 'monk.brewmaster.stagger.removed_explanation.p3', message: 'pool' })}</em>
                  {t({ id: 'monk.brewmaster.stagger.removed_explanation.p4', message: ' before the ' })}
                  <SpellLink spell={spells.STAGGER_TALENT} />
                  {t({ id: 'monk.brewmaster.stagger.removed_explanation.p5', message: ' DoT deals it as damage. This table shows the amount removed by different effects (including the DoT).' })}
                </>
              </Explanation>
            </header>
            <StaggerPurifiedTable />
          </div>
        </SideBySide>
      </SubSection>
    </>
  );
}

const commonTableColumns = {
  staggerSpellName: spellName.withLabels({
    [spells.STAGGER_TALENT.id]: <Trans id="monk.brewmaster.stagger.dot">Stagger (DoT)</Trans>,
  }),
  amountBar: amountBar(<Trans id="monk.brewmaster.stagger.damage">Damage</Trans>),
};

const damageTakenColumns = {
  ...commonTableColumns,
  hits: literalNumberColumn(<Trans id="monk.brewmaster.stagger.hits">Hits</Trans>, 'hits'),
};

const MAX_DATA_ROWS = 5;

function StaggerTakenTable(): JSX.Element | null {
  const stagger = useAnalyzer(StaggerPool);

  const { rows, ctx } = useMemo(() => {
    if (!stagger) {
      return { rows: [], ctx: { max: 0, total: 0 } };
    }
    let rows = [];

    for (const [spellId, total] of stagger.totalDamageByAbility) {
      rows.push({
        spell: spellId,
        school: stagger.observedSpellSchools.get(spellId) ?? 1,
        hits: stagger.hitsByAbility.get(spellId),
        amount: total,
      });
    }

    const total = rows.reduce((total, row) => row.amount + total, 0);
    let max = rows.reduce((max, row) => Math.max(row.amount, max), 0);

    rows.sort((a, b) => b.amount - a.amount);

    if (rows.length > MAX_DATA_ROWS) {
      rows = [
        ...rows.slice(0, MAX_DATA_ROWS),
        {
          spell: OTHER_SPECIAL_ID,
          type: t({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
          amount: rows.slice(MAX_DATA_ROWS).reduce((total, row) => row.amount + total, 0),
          hits: rows.slice(MAX_DATA_ROWS).reduce((total, row) => (row.hits ?? 0) + total, 0),
        },
      ];
      max = Math.max(max, rows[rows.length - 1].amount);
    }

    return { rows, ctx: { total, max } };
  }, [stagger]);

  if (!stagger) {
    return null;
  }

  return <Table columns={damageTakenColumns} data={rows} ctx={ctx} />;
}

const PURIFICATION_SOURCES = [
  QuickSip,
  StaggeringStrikes,
  TranquilSpirit,
  PurifyingBrew,
  TouchOfDeathStagger,
  InvokeNiuzaoStagger,
] as const;

const purificationColumns = {
  ...commonTableColumns,
  triggers: literalNumberColumn(
    <Trans id="monk.brewmaster.stagger.triggers">Triggers</Trans>,
    'count',
  ),
};

function StaggerPurifiedTable(): JSX.Element | null {
  const analyzers = useAnalyzers(PURIFICATION_SOURCES);
  const stagger = useAnalyzer(StaggerPool);

  const { rows, ctx } = useMemo(() => {
    const rows = [];

    for (const analyzer of analyzers) {
      if (!analyzer.active) {
        continue;
      }

      rows.push({
        spell: analyzer.ability.id,
        amount: analyzer.amount,
        count: analyzer.count,
      });
    }

    const totalStaggerAbsorbed =
      stagger?.totalDamageByAbility.values().reduce((total, amount) => total + amount, 0) ?? 0;
    const totalKnown = rows.reduce((total, row) => row.amount + total, 0);
    const totalDoT = stagger?.totalTickDamageTaken ?? 0;

    rows.sort((a, b) => b.amount - a.amount);

    rows.push({
      spell: OTHER_SPECIAL_ID,
      type: t({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
      amount: totalStaggerAbsorbed - totalDoT - totalKnown,
    });

    rows.push({
      spell: spells.STAGGER_TALENT.id,
      type: t({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
      amount: totalDoT,
    });

    const max = rows.reduce((max, row) => Math.max(row.amount, max), 0);

    return {
      rows,
      ctx: { max, total: totalStaggerAbsorbed },
    };
  }, [analyzers, stagger]);

  return <Table columns={purificationColumns} data={rows} ctx={ctx} />;
}
