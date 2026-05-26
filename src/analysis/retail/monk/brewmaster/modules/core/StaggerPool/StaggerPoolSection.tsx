import { SubSection, useAnalyzer, useAnalyzers } from 'interface/guide';
import { JSX, useMemo } from 'react';
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
import styled from '@emotion/styled';
import * as design from 'interface/design-system';
import SpellLink from 'interface/SpellLink';
import Explanation from 'interface/guide/components/Explanation';
import { formatNumber } from 'common/format';
import InvokeNiuzaoStagger from '../../talents/InvokeNiuzao/InvokeNiuzaoStagger';
import Tooltip from 'interface/Tooltip';
import { InformationIcon } from 'interface/icons';
import AlertInfo from 'interface/AlertInfo';
import AlertWarning from 'interface/AlertWarning';

const SideBySide = styled.div`
  margin-top: ${design.gaps.large};
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${design.gaps.large};

  align-items: start;

  & header {
    margin-bottom: ${design.gaps.medium};
  }
`;

const SummaryDL = styled.dl`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${design.gaps.small} ${design.gaps.medium};
  width: max-content;

  font-size: 95%;

  & dt {
    font-weight: normal;
  }

  & dd {
    text-align: right;
  }
`;

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
        <Trans id="monk.brewmaster.stagger.overhaul">
          <SpellLink spell={spells.STAGGER_TALENT} /> tracking has received a major overhaul in
          Midnight to handle all of the new talents that purify or prevent Stagger. If you see
          errors, please contact <code>@emallson</code> on Discord.
        </Trans>
      </AlertInfo>
      {(tranquilSpirit?.missedClearsPerMinute ?? 0) >= 1 && (
        <AlertWarning>
          <Trans id="monk.brewmaster.stagger.tranquil_spirit_missing">
            <SpellLink spell={spells.TRANQUIL_SPIRIT_TALENT} /> is missing a high number of{' '}
            <SpellLink spell={spells.STAGGER_TALENT} /> clearing events (
            {tranquilSpirit!.missedClearsPerMinute.toFixed(1)} per minute). Please report this log
            to <code>@emallson</code> on Discord for investigation.
          </Trans>
        </AlertWarning>
      )}
      <SubSection title={<SpellLink spell={spells.STAGGER_TALENT} />}>
        <SummaryDL>
          <dt>
            <Trans id="monk.brewmaster.stagger.total_absorbed">
              Total Damage Absorbed by <SpellLink spell={spells.STAGGER_TALENT} />
            </Trans>
          </dt>
          <dd>{formatNumber(totalAbsorb)}</dd>
          <dt>
            <Trans id="monk.brewmaster.stagger.total_tick">
              Total Damage Taken from <SpellLink spell={spells.STAGGER_TALENT} /> (DoT)
            </Trans>
          </dt>
          <dd>{formatNumber(stagger.totalTickDamageTaken)}</dd>
          <dt>
            <Trans id="monk.brewmaster.stagger.total_purified">Total Damage Purified&nbsp;</Trans>
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
          <Trans id="monk.brewmaster.stagger.chart_explanation">
            This chart shows the amount of damage in the <SpellLink spell={spells.STAGGER_TALENT} />{' '}
            pool over time, with <SpellLink spell={spells.PURIFYING_BREW_TALENT} /> casts
            highlighted.
          </Trans>
          {graph?.deps.ht.active == true && (
            <Trans id="monk.brewmaster.stagger.chart_green">
              {' '}
              in{' '}
              <Highlight color="#00ff96" textColor="black">
                green
              </Highlight>{' '}
              if cast while <SpellLink spell={SPELLS.ELEVATED_STAGGER_BUFF} /> is active
            </Trans>
          )}
          .
        </Explanation>
        <div>{graph?.plot}</div>
        <SideBySide>
          <div>
            <header>
              <strong>
                <Trans id="monk.brewmaster.stagger.added">
                  Damage Added to <SpellLink spell={spells.STAGGER_TALENT} />
                </Trans>
              </strong>
              <Explanation>
                <Trans id="monk.brewmaster.stagger.added_explanation">
                  Part of damage taken from every hit is absorbed by{' '}
                  <SpellLink spell={spells.STAGGER_TALENT} />. This table shows the amount added by
                  incoming damage sources.
                </Trans>
              </Explanation>
            </header>
            <StaggerTakenTable />
          </div>
          <div>
            <header>
              <strong>
                <Trans id="monk.brewmaster.stagger.removed">
                  Damage Removed from <SpellLink spell={spells.STAGGER_TALENT} />
                </Trans>
              </strong>
              <Explanation>
                <Trans id="monk.brewmaster.stagger.removed_explanation">
                  Damage can be removed from the <SpellLink spell={spells.STAGGER_TALENT} />{' '}
                  <em>pool</em> before the <SpellLink spell={spells.STAGGER_TALENT} /> DoT deals it
                  as damage. This table shows the amount removed by different effects (including the
                  DoT).
                </Trans>
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
  amountBar: amountBar(defineMessage({ id: 'monk.brewmaster.stagger.damage', message: 'Damage' })),
};

const damageTakenColumns = {
  ...commonTableColumns,
  hits: literalNumberColumn(
    defineMessage({ id: 'monk.brewmaster.stagger.hits', message: 'Hits' }),
    'hits',
  ),
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
          type: defineMessage({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
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
    defineMessage({ id: 'monk.brewmaster.stagger.triggers', message: 'Triggers' }),
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
      type: defineMessage({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
      amount: totalStaggerAbsorbed - totalDoT - totalKnown,
    });

    rows.push({
      spell: spells.STAGGER_TALENT.id,
      type: defineMessage({ id: 'monk.brewmaster.stagger.other', message: 'Other' }),
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
