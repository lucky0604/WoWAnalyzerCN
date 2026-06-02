import styled from '@emotion/styled';
import talents from 'common/TALENTS/deathknight';
import RESOURCE_TYPES, { getResource } from 'game/RESOURCE_TYPES';
import ResourceLink from 'interface/ResourceLink';
import SpellLink from 'interface/SpellLink';
import { BadColor, GoodColor, SubSection, useAnalyzers, useEvents, useInfo } from 'interface/guide';
import RunicPowerTracker from '../../runicpower/RunicPowerTracker';
import SPELLS from 'common/SPELLS';
import { formatNumber, formatPercentage } from 'common/format';
import RuneTracker from '../../core/RuneTracker';
import ProblemList, { ProblemRendererProps } from 'interface/guide/components/ProblemList';
import DeathStrike, {
  BLOOD_SHIELD_THRESHOLD,
  DUMP_RP_THRESHOLD,
  DeathStrikeProblem,
  DeathStrikeReason,
} from './index';
import DamageTaken from 'parser/shared/modules/throughput/DamageTaken';
import BloodShield from '../BloodShield/BloodShield';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useMemo, type JSX } from 'react';
import {
  AnyEvent,
  BaseCastEvent,
  CastEvent,
  EventType,
  GetRelatedEvent,
  HasHitpoints,
  HealEvent,
  HitpointsEvent,
  ResourceActor,
} from 'parser/core/Events';
import { DEATH_STRIKE_CAST, DEATH_STRIKE_HEAL } from './normalizer';
import BaseChart, { defaultConfig } from 'parser/ui/BaseChart';
import { Info } from 'parser/core/metric';
import { VisualizationSpec } from 'react-vega';
import {
  line,
  normalizeTimestampTransform,
  point,
  color as brewColors,
  timeAxis,
} from 'analysis/retail/monk/brewmaster/modules/charts';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ActualCastDescription } from 'interface/guide/components/Apl/violations/claims';
import { StringFieldDefWithCondition } from 'vega-lite/build/src/channeldef';
import { MitigationSegments } from 'interface/guide/components/MajorDefensives/MitigationSegments';
import MAGIC_SCHOOLS, { color } from 'game/MAGIC_SCHOOLS';
import PassFailBar from 'interface/guide/components/PassFailBar';
import CastReasonBreakdownTableContents from 'interface/guide/components/CastReasonBreakdownTableContents';
import { TooltipElement } from 'interface/Tooltip';
import Explanation from 'interface/guide/components/Explanation';
import AlertWarning from 'interface/AlertWarning';

const reasonLabel = (reason: DeathStrikeReason) => {
  switch (reason) {
    case DeathStrikeReason.GoodHealing:
      return defineMessage({ id: 'deathknight.blood.usageSection.largeHeal', message: 'Large Heal' });
    case DeathStrikeReason.LowHealth:
      return (
        <Trans id="deathknight.blood.usageSection.lowHpAt">
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> at Low HP
        </Trans>
      );
    case DeathStrikeReason.BloodShield:
      return (
        <TooltipElement
          content={
            <Trans id="deathknight.blood.usageSection.bloodShieldTooltip">
              Only counts absorbs that mitigate hits for more than{' '}
              <strong>{formatPercentage(BLOOD_SHIELD_THRESHOLD, 0)}%</strong> of your HP.
            </Trans>
          }
        >
          <Trans id="deathknight.blood.usageSection.bloodShield">
            Generate <SpellLink spell={SPELLS.BLOOD_SHIELD} />
          </Trans>
        </TooltipElement>
      );
    case DeathStrikeReason.DumpRP:
      return (
        <Trans id="deathknight.blood.usageSection.dumpRp">
          Dump <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
        </Trans>
      );
    case DeathStrikeReason.Other:
      return defineMessage({ id: 'deathknight.blood.usageSection.other', message: 'Other' });
  }
};

const Table = styled.table`
  td {
    padding: 0 1em;
  }

  th {
    font-weight: bold;
  }

  margin-top: 1em;
`;

const ContentRow = styled.div`
  display: grid;
  grid-template-columns: minmax(40%, max-content) 1fr;
  gap: 1em;
  align-items: start;
`;

const DeathStrikeProblemDescription = ({ data }: { data: DeathStrikeProblem['data'] }) => (
  <div>
    <ActualCastDescription event={data.cast} omitTarget /> while at{' '}
    <strong>{Math.floor(data.runicPower / 10)}</strong>{' '}
    <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} /> and{' '}
    <strong>{formatPercentage(data.hitPoints / data.maxHitPoints, 0)}%</strong> Health.{' '}
    {data.followupDamageTaken ? (
      <Trans id="deathknight.blood.usageSection.problemDescFollowup">
        In the next few seconds, you took{' '}
        <strong>
          {formatNumber(data.followupDamageTaken + (data.followupAbsorbedDamage ?? 0))}
        </strong>{' '}
        damage that this <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> could have helped
        mitigate.
      </Trans>
    ) : (
      <Trans id="deathknight.blood.usageSection.problemDescDefault">
        This left you low on resources and vulnerable to upcoming damage.
      </Trans>
    )}
  </div>
);

// oxlint-disable-next-line typescript/no-explicit-any
const deathStrikeTooltip: StringFieldDefWithCondition<any>[] = [
  { field: 'hitPoints', type: 'quantitative', format: '.3~s', title: 'Hit Points' },
  { field: 'amount', type: 'quantitative', format: '.3~s', title: 'Healing' },
  { field: 'overheal', type: 'quantitative', format: '.3~s', title: 'Overhealing' },
  { field: 'runicPower', type: 'quantitative', title: 'Runic Power' },
];

const scaleHitPointTransform = {
  calculate: 'datum.hitPoints / max(datum.maxHitPoints, datum.hitPoints)',
  as: 'hitPoints',
};

const deathStrikeChartSpec = (info: Info, width: number): VisualizationSpec => ({
  vconcat: [
    {
      encoding: {
        x: { ...timeAxis, axis: null },
        y: {
          field: 'hitPoints',
          type: 'quantitative',
          title: 'Hit Points',
          axis: {
            gridOpacity: 0.3,
            format: '~p',
          },
        },
      },
      layer: [
        {
          transform: [normalizeTimestampTransform(info), scaleHitPointTransform],
          ...line('health', brewColors.stagger),
        },
        {
          params: [
            {
              name: 'hover',
              select: { type: 'point', on: 'mouseover', fields: ['timestamp'] },
            },
          ],
          transform: [normalizeTimestampTransform(info), scaleHitPointTransform],
          ...point('otherDeathStrikes', 'white'),
          encoding: {
            tooltip: deathStrikeTooltip,
          },
        },
        {
          transform: [normalizeTimestampTransform(info), scaleHitPointTransform],
          ...point('problemDeathStrike', 'red'),
          encoding: {
            tooltip: deathStrikeTooltip,
          },
        },
      ],
      width,
      height: 100,
    },
    {
      encoding: {
        x: timeAxis,
        y: {
          field: 'amount',
          type: 'quantitative',
          title: 'RP',
          scale: {
            domain: [0, 125],
          },
          axis: {
            values: [0, DUMP_RP_THRESHOLD / 10],
            gridOpacity: 0.3,
          },
        },
      },
      layer: [
        {
          transform: [normalizeTimestampTransform(info)],
          ...line('runicPower', brewColors.potentialStagger),
        },
        {
          transform: [normalizeTimestampTransform(info)],
          ...point('runicPower', 'white'),
          encoding: {
            opacity: {
              condition: { param: 'hover', value: 0.7, empty: false },
              value: 0,
            },
          },
        },
      ],
      width,
      height: 40,
    },
  ],
});

const DeathStrikeProblemChart = ({
  problem,
  events,
  info,
}: ProblemRendererProps<DeathStrikeProblem['data']>) => {
  const backgroundData = useMemo(
    () => ({
      runicPower: events
        .filter(
          // oxlint-disable-next-line typescript/no-explicit-any
          (event): event is AnyEvent & Required<Pick<BaseCastEvent<any>, 'classResources'>> =>
            'classResources' in event && event.classResources !== undefined,
        )
        .map((event) => {
          const rp = getResource(event.classResources, RESOURCE_TYPES.RUNIC_POWER.id);

          if (!rp) {
            return undefined;
          }

          return {
            timestamp: event.timestamp,
            amount: rp.amount / 10,
            max: rp.max ?? 125,
          };
        })
        .filter(Boolean),
      health: events.filter(
        // oxlint-disable-next-line typescript/no-explicit-any
        (event): event is HitpointsEvent<any> =>
          HasHitpoints(event) &&
          ((event.targetID === info.playerId && event.resourceActor === ResourceActor.Target) ||
            (event.sourceID === info.playerId && event.resourceActor === ResourceActor.Source)),
      ),
    }),
    // doing a clever shallow equality of the events list here to avoid regenerating this data all the time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events.length, events[0].timestamp, events.at(-1)?.timestamp, info.playerId],
  );

  const deathStrikeEvents = useMemo(
    (): HealEvent[] =>
      events.filter(
        (event): event is HealEvent =>
          event.type === EventType.Heal &&
          event.ability.guid === SPELLS.DEATH_STRIKE_HEAL.id &&
          event.targetID === info.playerId,
      ),
    // same trick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events.length, events[0].timestamp, events.at(-1)?.timestamp, info.playerId],
  );

  const deathStrikeData = useMemo(() => {
    const problemEvent = GetRelatedEvent<HealEvent>(problem.data.cast, DEATH_STRIKE_HEAL);
    const problemDeathStrike = problemEvent
      ? [
          {
            ...problemEvent,
            hitPoints: problemEvent.hitPoints - problemEvent.amount,
            runicPower: Math.floor(problem.data.runicPower / 10),
          },
        ]
      : [];

    return {
      otherDeathStrikes: deathStrikeEvents
        .filter(
          (event) => event !== GetRelatedEvent<HealEvent>(problem.data.cast, DEATH_STRIKE_HEAL),
        )
        .map((event) => {
          const cast: CastEvent = GetRelatedEvent(event, DEATH_STRIKE_CAST)!;
          const rp = Math.floor(
            (getResource(cast.classResources, RESOURCE_TYPES.RUNIC_POWER.id)?.amount ?? 0) / 10,
          );

          return {
            ...event,
            hitPoints: event.hitPoints - event.amount,
            runicPower: rp,
          };
        }),
      problemDeathStrike,
    };
  }, [problem.data.cast, problem.data.runicPower, deathStrikeEvents]);

  const data = {
    ...backgroundData,
    ...deathStrikeData,
  };

  return (
    <AutoSizer disableHeight>
      {({ width }) => {
        return (
          <BaseChart
            data={data}
            width={width}
            height={180}
            spec={deathStrikeChartSpec(info, width)}
            config={{
              ...defaultConfig,
              concat: {
                spacing: 8,
              },
              autosize: {
                type: 'fit-x',
                contains: 'padding',
              },
            }}
          />
        );
      }}
    </AutoSizer>
  );
};

const DeathStrikeProblemRenderer = ({
  problem,
  events,
  info,
}: ProblemRendererProps<DeathStrikeProblem['data']>) => (
  <div style={{ minHeight: 250 }}>
    <DeathStrikeProblemChart problem={problem} events={events} info={info} />
    <DeathStrikeProblemDescription data={problem.data} />
  </div>
);

export default function DeathStrikeUsageSubSection(): JSX.Element | null {
  const [ds, runes, rp, dtps, bloodShield] = useAnalyzers([
    DeathStrike,
    RuneTracker,
    RunicPowerTracker,
    DamageTaken,
    BloodShield,
  ] as const);

  const info = useInfo();
  const events = useEvents();

  if (!info || !events) {
    return null;
  }

  const runesSpent = runes.runesMaxCasts - runes.runesWasted;

  const healedDamage = ds.totalHealing + bloodShield.totalHealing;
  const totalDamage = dtps.total.effective;
  const healingTarget = totalDamage / 2;

  return (
    <SubSection
      title={t({
        id: 'deathknight.blood.deathStrikeSection.deathStrikeUsageTitle',
        message: 'Death Strike Usage',
      })}
    >
      <Explanation>
        <p>
          <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph1">
            As a Blood Death Knight, <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> is both your
            main defensive tool and one of your strongest damaging abilities. Balancing these two
            uses is important to playing the spec well.
          </Trans>
        </p>
        <p>
          <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph2Intro">
            There are three main ways that you can use{' '}
            <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> defensively:
          </Trans>
          <ul>
            <li>
              <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph2LowHp">
                You can use it while at <strong>low health</strong> to help recover, or
              </Trans>
            </li>
            <li>
              <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage">
                You can use it{' '}
                <TooltipElement
                  content={
                    <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamageTooltip">
                      <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                      's healing is based on the total amount of damage you took in the previous 5
                      seconds. This allows you to get a lot of healing from it, even if your HP
                      never gets very low.
                    </Trans>
                  }
                >
                  after taking lots of damage
                </TooltipElement>{' '}
                for a <strong>large heal</strong>, or
              </Trans>
            </li>
            <li>
              <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph2BeforeHit">
                You can use it to generate a{' '}
                <strong>
                  <SpellLink spell={SPELLS.BLOOD_SHIELD} />
                </strong>{' '}
                absorb <em>before</em> a large Physical hit to help you survive it.
              </Trans>
            </li>
          </ul>
        </p>
        <p>
          <Trans id="deathknight.blood.deathStrikeSection.explanationParagraph3Intro">
            However, Blood currently has <em>too much</em>{' '}
            <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} /> for you to spend only on defensive
            casts. If you try to only use <SpellLink spell={talents.DEATH_STRIKE_TALENT} />{' '}
            defensively, you will waste most of the RP that you generate. To avoid this, weave casts
            of <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> between your casts of{' '}
            <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} /> generators like{' '}
            <SpellLink spell={talents.HEART_STRIKE_TALENT} /> to keep the extra from going to waste.
            This is called <strong>dumping</strong>{' '}
            <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />.
          </Trans>
        </p>
      </Explanation>
      <ContentRow>
        <Table>
          <thead></thead>
          <tbody>
            <tr>
              <td>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.healingDone',
                  message: 'Healing Done',
                })}
              </td>
              <td>
                {formatNumber(healedDamage)} /{' '}
                <TooltipElement
                  content={
                    <Trans id="deathknight.blood.deathStrikeSection.healingDoneTooltip">
                      You took <strong>{formatNumber(totalDamage)}</strong> total damage. The value
                      shown here is a reasonable goal (~50% of damage taken) for how much you can
                      heal back via <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> and{' '}
                      <SpellLink spell={SPELLS.BLOOD_SHIELD} />
                    </Trans>
                  }
                >
                  {formatNumber(healingTarget)}
                </TooltipElement>
              </td>
              <td>
                <MitigationSegments
                  style={{ width: 'calc(100% + 2px)' }}
                  rounded
                  maxValue={Math.max(healingTarget, healedDamage)}
                  segments={[
                    {
                      amount: ds.totalHealing,
                      color: GoodColor,
                      description: (
                        <Trans id="deathknight.blood.deathStrikeSection.healingByDeathStrike">
                          Healing by <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                        </Trans>
                      ),
                    },
                    {
                      amount: bloodShield.totalHealing,
                      color: color(MAGIC_SCHOOLS.ids.PHYSICAL),
                      description: (
                        <Trans id="deathknight.blood.deathStrikeSection.absorbedByBloodShield">
                          Physical damage absorbed by <SpellLink spell={SPELLS.BLOOD_SHIELD} />
                        </Trans>
                      ),
                    },
                    {
                      amount: Math.max(healingTarget - healedDamage, 0),
                      color: BadColor,
                      description: (
                        <Trans id="deathknight.blood.deathStrikeSection.otherHealingNeeded">
                          Damage that required other healing.
                        </Trans>
                      ),
                    },
                  ]}
                />
              </td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th colSpan={3}>
                <Trans id="deathknight.blood.deathStrikeSection.resourceUsage">
                  Resource Usage
                </Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <TooltipElement
                  content={
                    <Trans id="deathknight.blood.deathStrikeSection.runesSpentTooltip">
                      While <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> does not cost{' '}
                      <ResourceLink id={RESOURCE_TYPES.RUNES.id} /> itself, every Rune spent
                      generates 10 or more <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />.
                      {'\n'}
                      You can roughly convert every 4 unspent{' '}
                      <ResourceLink id={RESOURCE_TYPES.RUNES.id} /> into 1 lost{' '}
                      <SpellLink spell={talents.DEATH_STRIKE_TALENT} />.
                    </Trans>
                  }
                >
                  {t({
                    id: 'deathknight.blood.deathStrikeSection.runesSpent',
                    message: 'Runes Spent',
                  })}
                </TooltipElement>
              </td>
              <td>
                {runesSpent.toFixed(0)} / {runes.runesMaxCasts}
              </td>
              <td>
                <PassFailBar total={runes.runesMaxCasts} pass={runesSpent} />
              </td>
            </tr>
            <tr>
              <td>
                <Trans id="deathknight.blood.deathStrikeSection.runicPowerSpent">
                  Runic Power Spent
                </Trans>
              </td>
              <td>
                {rp.spent} / {rp.spent + rp.wasted}
              </td>
              <td>
                <PassFailBar total={rp.spent + rp.wasted} pass={rp.spent} />
              </td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th colSpan={3}>
                <Trans id="deathknight.blood.deathStrikeSection.typesOfDeathStrikes">
                  Types of Death Strikes
                </Trans>
              </th>
            </tr>
          </thead>
          <CastReasonBreakdownTableContents
            badReason={DeathStrikeReason.Other}
            possibleReasons={[
              DeathStrikeReason.LowHealth,
              DeathStrikeReason.GoodHealing,
              DeathStrikeReason.BloodShield,
              DeathStrikeReason.DumpRP,
              DeathStrikeReason.Other,
            ]}
            label={reasonLabel}
            casts={ds?.casts ?? []}
          />
        </Table>
        <ProblemList
          info={info}
          problems={ds.problems}
          events={events}
          renderer={DeathStrikeProblemRenderer}
        />
      </ContentRow>
      {ds.doubleCastRate > 0.2 && (
        <AlertWarning>
          <Trans id="deathknight.blood.deathStrikeSection.doubleCastWarning">
            {formatPercentage(ds.doubleCastRate, 0)}% of your{' '}
            <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> casts were within 2 GCDs of a previous
            cast and did not do good healing. Repeatedly casting{' '}
            <SpellLink spell={talents.DEATH_STRIKE_TALENT} /> is highly inefficient due to the{' '}
            <TooltipElement
              content={
                <Trans id="deathknight.blood.deathStrikeSection.doubleCastWarningTooltip">
                  Death Strike now only heals you <strong>once</strong> for each damage event in the
                  previous 5 seconds. Repeatedly casting Death Strike does usually give time for
                  more healing to accumulate.
                </Trans>
              }
            >
              changes to <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
            </TooltipElement>
          </Trans>
        </AlertWarning>
      )}
    </SubSection>
  );
}
