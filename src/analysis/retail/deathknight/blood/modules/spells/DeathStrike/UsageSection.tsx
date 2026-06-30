import cssComponent from 'interface/utils/css-component';
import styles from './UsageSection.module.scss';
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
import { t, defineMessage } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
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
      return i18n._(
        defineMessage({ id: 'deathknight.blood.usageSection.largeHeal', message: 'Large Heal' }),
      );
    case DeathStrikeReason.LowHealth:
      return (
        <>
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />{' '}
          {t({ id: 'deathknight.blood.usageSection.lowHpAt', message: 'at Low HP' })}
        </>
      );
    case DeathStrikeReason.BloodShield:
      return (
        <TooltipElement
          content={
            <>
              {t({
                id: 'deathknight.blood.usageSection.bloodShieldTooltip',
                message: 'Only counts absorbs that mitigate hits for more than ',
              })}
              <strong>{formatPercentage(BLOOD_SHIELD_THRESHOLD, 0)}%</strong>
              {t({
                id: 'deathknight.blood.usageSection.bloodShieldTooltip.p2',
                message: ' of your HP.',
              })}
            </>
          }
        >
          {t({
            id: 'deathknight.blood.usageSection.bloodShield',
            message: 'Generate ',
          })}
          <SpellLink spell={SPELLS.BLOOD_SHIELD} />
        </TooltipElement>
      );
    case DeathStrikeReason.DumpRP:
      return (
        <>
          {t({ id: 'deathknight.blood.usageSection.dumpRp.p1', message: 'Dump' })}
          <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
        </>
      );
    case DeathStrikeReason.Other:
      return i18n._(
        defineMessage({ id: 'deathknight.blood.usageSection.other', message: 'Other' }),
      );
  }
};

const Table = cssComponent('table', styles.Table, [] as const);

const ContentRow = cssComponent('div', styles.ContentRow, [] as const);

const DeathStrikeProblemDescription = ({ data }: { data: DeathStrikeProblem['data'] }) => (
  <div>
    <ActualCastDescription event={data.cast} omitTarget />{' '}
    {t({
      id: 'deathknight.blood.usageSection.problemDesc.whileAt',
      message: 'while at',
    })}{' '}
    <strong>{Math.floor(data.runicPower / 10)}</strong>{' '}
    <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />{' '}
    {t({ id: 'deathknight.blood.usageSection.problemDesc.and', message: 'and' })}{' '}
    <strong>{formatPercentage(data.hitPoints / data.maxHitPoints, 0)}%</strong>{' '}
    {t({
      id: 'deathknight.blood.usageSection.problemDesc.health',
      message: 'Health.',
    })}{' '}
    {data.followupDamageTaken ? (
      <>
        {t({
          id: 'deathknight.blood.usageSection.problemDescFollowup',
          message: 'In the next few seconds, you took ',
        })}
        <strong>
          {formatNumber(data.followupDamageTaken + (data.followupAbsorbedDamage ?? 0))}
        </strong>
        {t({
          id: 'deathknight.blood.usageSection.problemDescFollowup.p2',
          message: ' damage that this ',
        })}
        <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
        {t({
          id: 'deathknight.blood.usageSection.problemDescFollowup.p3',
          message: ' could have helped mitigate.',
        })}
      </>
    ) : (
      <Trans id="deathknight.blood.usageSection.problemDescDefault">
        This left you low on resources and vulnerable to upcoming damage.
      </Trans>
    )}
  </div>
);

// oxlint-disable-next-line typescript/no-explicit-any
const deathStrikeTooltip: StringFieldDefWithCondition<any>[] = [
  {
    field: 'hitPoints',
    type: 'quantitative',
    format: '.3~s',
    title: i18n._(
      defineMessage({
        id: 'deathknight.blood.deathStrikeChart.tooltip.hitPoints',
        message: 'Hit Points',
      }),
    ),
  },
  {
    field: 'amount',
    type: 'quantitative',
    format: '.3~s',
    title: i18n._(
      defineMessage({
        id: 'deathknight.blood.deathStrikeChart.tooltip.healing',
        message: 'Healing',
      }),
    ),
  },
  {
    field: 'overheal',
    type: 'quantitative',
    format: '.3~s',
    title: i18n._(
      defineMessage({
        id: 'deathknight.blood.deathStrikeChart.tooltip.overhealing',
        message: 'Overhealing',
      }),
    ),
  },
  {
    field: 'runicPower',
    type: 'quantitative',
    title: i18n._(
      defineMessage({
        id: 'deathknight.blood.deathStrikeChart.tooltip.runicPower',
        message: 'Runic Power',
      }),
    ),
  },
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
          title: i18n._(
            defineMessage({
              id: 'deathknight.blood.deathStrikeChart.axis.hitPoints',
              message: 'Hit Points',
            }),
          ),
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
          title: i18n._(
            defineMessage({
              id: 'deathknight.blood.deathStrikeChart.axis.rp',
              message: 'RP',
            }),
          ),
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
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph1',
            message: 'As a Blood Death Knight, ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph1.p2',
            message:
              ' is both your main defensive tool and one of your strongest damaging abilities. Balancing these two uses is important to playing the spec well.',
          })}
        </p>
        <div>
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph2Intro',
            message: 'There are three main ways that you can use ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph2Intro.p2',
            message: ' defensively:',
          })}
          <ul>
            <li>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2LowHp',
                message: 'You can use it while at ',
              })}
              <strong>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.explanationParagraph2LowHp.bold',
                  message: 'low health',
                })}
              </strong>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2LowHp.p2',
                message: ' to help recover, or',
              })}
            </li>
            <li>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage',
                message: 'You can use it ',
              })}
              <TooltipElement
                content={
                  <>
                    <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                    {t({
                      id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamageTooltip',
                      message:
                        "'s healing is based on the total amount of damage you took in the previous 5 seconds. This allows you to get a lot of healing from it, even if your HP never gets very low.",
                    })}
                  </>
                }
              >
                {t({
                  id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage.link',
                  message: 'after taking lots of damage',
                })}
              </TooltipElement>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage.p2',
                message: ' for a ',
              })}
              <strong>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage.bold',
                  message: 'large heal',
                })}
              </strong>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2AfterDamage.p3',
                message: ', or',
              })}
            </li>
            <li>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2BeforeHit',
                message: 'You can use it to generate a ',
              })}
              <strong>
                <SpellLink spell={SPELLS.BLOOD_SHIELD} />
              </strong>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2BeforeHit.p2',
                message: ' absorb ',
              })}
              <em>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.explanationParagraph2BeforeHit.before',
                  message: 'before',
                })}
              </em>
              {t({
                id: 'deathknight.blood.deathStrikeSection.explanationParagraph2BeforeHit.p3',
                message: ' a large Physical hit to help you survive it.',
              })}
            </li>
          </ul>
        </div>
        <p>
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro',
            message: 'However, Blood currently has ',
          })}
          <em>
            {t({
              id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.tooMuch',
              message: 'too much',
            })}
          </em>{' '}
          <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.p2',
            message: ' for you to spend only on defensive casts. If you try to only use ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.p3',
            message:
              ' defensively, you will waste most of the RP that you generate. To avoid this, weave casts of ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.p4',
            message: ' between your casts of ',
          })}
          <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.p5',
            message: ' generators like ',
          })}
          <SpellLink spell={talents.HEART_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.p6',
            message: ' to keep the extra from going to waste. This is called ',
          })}
          <strong>
            {t({
              id: 'deathknight.blood.deathStrikeSection.explanationParagraph3Intro.dumping',
              message: 'dumping',
            })}
          </strong>{' '}
          <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />.
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
                    <>
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.healingDoneTooltip',
                        message: 'You took ',
                      })}
                      <strong>{formatNumber(totalDamage)}</strong>
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.healingDoneTooltip.p2',
                        message:
                          ' total damage. The value shown here is a reasonable goal (~50% of damage taken) for how much you can heal back via ',
                      })}
                      <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.healingDoneTooltip.p3',
                        message: ' and ',
                      })}
                      <SpellLink spell={SPELLS.BLOOD_SHIELD} />
                    </>
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
                        <>
                          {t({
                            id: 'deathknight.blood.deathStrikeSection.healingByDeathStrike',
                            message: 'Healing by ',
                          })}
                          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                        </>
                      ),
                    },
                    {
                      amount: bloodShield.totalHealing,
                      color: color(MAGIC_SCHOOLS.ids.PHYSICAL),
                      description: (
                        <>
                          {t({
                            id: 'deathknight.blood.deathStrikeSection.absorbedByBloodShield',
                            message: 'Physical damage absorbed by ',
                          })}
                          <SpellLink spell={SPELLS.BLOOD_SHIELD} />
                        </>
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
                    <>
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.runesSpentTooltip',
                        message: 'While ',
                      })}
                      <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.runesSpentTooltip.p2',
                        message: ' does not cost ',
                      })}
                      <ResourceLink id={RESOURCE_TYPES.RUNES.id} />
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.runesSpentTooltip.p3',
                        message: ' itself, every Rune spent generates 10 or more ',
                      })}
                      <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />.{'\n'}
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.runesSpentTooltip.p4',
                        message: 'You can roughly convert every 4 unspent ',
                      })}
                      <ResourceLink id={RESOURCE_TYPES.RUNES.id} />
                      {t({
                        id: 'deathknight.blood.deathStrikeSection.runesSpentTooltip.p5',
                        message: ' into 1 lost ',
                      })}
                      <SpellLink spell={talents.DEATH_STRIKE_TALENT} />.
                    </>
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
          {formatPercentage(ds.doubleCastRate, 0)}%
          {t({
            id: 'deathknight.blood.deathStrikeSection.doubleCastWarning',
            message: ' of your ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.doubleCastWarning.p2',
            message:
              ' casts were within 2 GCDs of a previous cast and did not do good healing. Repeatedly casting ',
          })}
          <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          {t({
            id: 'deathknight.blood.deathStrikeSection.doubleCastWarning.p3',
            message: ' is highly inefficient due to the ',
          })}
          <TooltipElement
            content={
              <>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.doubleCastWarningTooltip',
                  message: 'Death Strike now only heals you ',
                })}
                <strong>
                  {t({
                    id: 'deathknight.blood.deathStrikeSection.doubleCastWarningTooltip.once',
                    message: 'once',
                  })}
                </strong>
                {t({
                  id: 'deathknight.blood.deathStrikeSection.doubleCastWarningTooltip.p2',
                  message:
                    ' for each damage event in the previous 5 seconds. Repeatedly casting Death Strike does usually give time for more healing to accumulate.',
                })}
              </>
            }
          >
            {t({
              id: 'deathknight.blood.deathStrikeSection.doubleCastWarning.changes',
              message: 'changes to ',
            })}
            <SpellLink spell={talents.DEATH_STRIKE_TALENT} />
          </TooltipElement>
        </AlertWarning>
      )}
    </SubSection>
  );
}
