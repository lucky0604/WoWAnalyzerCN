import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import { useMemo } from 'react';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import GuideSection from 'interface/guide/components/GuideSection';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import {
  SpellSequence,
  type CastSequenceEntry,
  type CastInSequence,
} from 'interface/guide/components/CastSequence';
import HavocAnalyzer, { HavocWindowData } from '../analyzers/HavocAnalyzer';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { TALENTS_WARLOCK } from 'common/TALENTS';
import { CastEvent } from 'parser/core/Events';

interface HavocGuideProps {
  havocAnalyzer: HavocAnalyzer;
  formatTimestamp: (ts: number) => string;
}

export function HavocGuide({ havocAnalyzer, formatTimestamp }: HavocGuideProps): JSX.Element {
  const havoc = <SpellLink spell={SPELLS.HAVOC} />;

  const explanation = (
    <>
      <p>
        <b>{havoc}</b>{' '}
        <>
          {t({
            id: 'warlock.destruction.havocGuide.duplicatesSingleTarget.p1',
            message:
              'duplicates your single target spells onto a second target. To maximize its effectiveness, you should cast as many ',
          })}
          <SpellLink spell={SPELLS.CHAOS_BOLT} />
          {t({ id: 'warlock.destruction.havocGuide.duplicatesSingleTarget.p2', message: ' or ' })}
          <SpellLink spell={TALENTS_WARLOCK.SHADOWBURN_TALENT} />
          {t({
            id: 'warlock.destruction.havocGuide.duplicatesSingleTarget.p3',
            message: ' as possible during the Havoc window.',
          })}
        </>
      </p>
      <p>
        <>
          {t({
            id: 'warlock.destruction.havocGuide.poolSoulShards.p1',
            message:
              'Ideally, you should enter Havoc with Soul Shards already pooled so you can immediately begin casting ',
          })}
          <SpellLink spell={SPELLS.CHAOS_BOLT} />
          {t({ id: 'warlock.destruction.havocGuide.poolSoulShards.p2', message: '.' })}
        </>
      </p>
    </>
  );

  const havocSequenceEvents: CastSequenceEntry<HavocWindowData>[] = useMemo(
    () =>
      havocAnalyzer.havocData.map((window) => {
        const windowStart = window.start;
        const windowEnd = window.end ?? window.start + havocAnalyzer.havocDuration;

        const casts: CastInSequence[] = window.casts.map((event) => ({
          timestamp: event.timestamp,
          spellId: event.ability.guid,
          spellName: event.ability.name,
          icon: event.ability.abilityIcon.replace('.jpg', ''),
        }));

        return {
          data: window,
          start: windowStart,
          end: windowEnd,
          casts,
        };
      }),
    [havocAnalyzer.havocData, havocAnalyzer.havocDuration],
  );

  function rateHavocWindow(chaosBolts: number, duration: number): QualitativePerformance {
    if (duration === 20000) {
      if (chaosBolts >= 6) return QualitativePerformance.Perfect;
      if (chaosBolts === 5) return QualitativePerformance.Good;
      if (chaosBolts === 4) return QualitativePerformance.Ok;
      return QualitativePerformance.Fail;
    }

    if (chaosBolts >= 5) return QualitativePerformance.Perfect;
    if (chaosBolts === 4) return QualitativePerformance.Good;
    if (chaosBolts === 3) return QualitativePerformance.Ok;
    return QualitativePerformance.Fail;
  }

  function getHavocFeedback(
    spenders: number,
    shadowburns: number,
    casts: CastEvent[],
    duration: number,
    targetDied?: boolean,
  ): JSX.Element {
    const feedback: string[] = [];
    const isImproved = duration === 20000;

    if (isImproved) {
      if (spenders >= 6)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.excellentUsage',
            message: 'Excellent Havoc usage. You maximized Chaos Bolt casts during the window.',
          }),
        );
      else if (spenders === 5)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.goodWindow',
            message: 'Good Havoc window. One additional Chaos Bolt would make this perfect.',
          }),
        );
      else if (spenders === 4)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.decentWindow',
            message:
              'Decent Havoc window, but you could likely fit another Chaos Bolt by pooling more Soul Shards beforehand.',
          }),
        );
      else
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.lowChaosBoltCount',
            message: 'Low Chaos Bolt count during Havoc. Try pooling Soul Shards before casting Havoc.',
          }),
        );
    } else {
      if (spenders >= 5)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.excellentUsage',
            message: 'Excellent Havoc usage. You maximized Chaos Bolt casts during the window.',
          }),
        );
      else if (spenders === 4)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.goodWindow',
            message: 'Good Havoc window. One additional Chaos Bolt would make this perfect.',
          }),
        );
      else if (spenders === 3)
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.decentWindow',
            message:
              'Decent Havoc window, but you could likely fit another Chaos Bolt by pooling more Soul Shards beforehand.',
          }),
        );
      else
        feedback.push(
          t({
            id: 'warlock.destruction.havocGuide.lowChaosBoltCount',
            message: 'Low Chaos Bolt count during Havoc. Try pooling Soul Shards before casting Havoc.',
          }),
        );
    }

    if (casts.length < 6) {
      feedback.push(
        t({
          id: 'warlock.destruction.havocGuide.fewSpellsCast',
          message: `Only ${casts.length} Havocable spell${casts.length !== 1 ? 's' : ''} were cast in this Havoc window. This may indicate movement, delayed casting, or missed opportunities.`,
        }),
      );
    }

    if (targetDied)
      feedback.push(
        t({
          id: 'warlock.destruction.havocGuide.targetDied',
          message: 'The target died before the debuff expired, shortening your Havoc window.',
        }),
      );

    return (
      <>
        {feedback.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </>
    );
  }

  const perCastData: PerCastData[] = havocAnalyzer.havocData.map((window, index) => {
    const sequenceEntry = havocSequenceEvents[index];
    const spenders = window.chaosBolts + window.shadowburns;

    return {
      timestamp: formatTimestamp(window.start),
      performance: rateHavocWindow(spenders, havocAnalyzer.havocDuration),
      stats: [
        {
          label: t({ id: 'warlock.destruction.havocGuide.chaosBolts', message: 'Chaos Bolts' }),
          value: window.chaosBolts,
          tooltip: t({
            id: 'warlock.destruction.havocGuide.chaosBoltsTooltip',
            message: 'Chaos Bolts cast during the Havoc window',
          }),
        },
        {
          label: t({ id: 'warlock.destruction.havocGuide.shadowburns', message: 'Shadowburns' }),
          value: window.shadowburns,
          tooltip: t({
            id: 'warlock.destruction.havocGuide.shadowburnsTooltip',
            message: 'Shadowburn casts during the Havoc window',
          }),
        },
        {
          label: t({ id: 'warlock.destruction.havocGuide.casts', message: 'Casts' }),
          value: window.casts.length,
          tooltip: t({
            id: 'warlock.destruction.havocGuide.castsTooltip',
            message: 'Total Havocable spells cast during this Havoc window',
          }),
        },
      ],
      details: getHavocFeedback(
        spenders,
        window.shadowburns,
        window.casts,
        havocAnalyzer.havocDuration,
        window.targetDied,
      ),
      additionalContent: sequenceEntry
        ? {
            title: t({ id: 'warlock.destruction.havocGuide.castSequence', message: 'Cast Sequence' }),
            content: <SpellSequence casts={sequenceEntry.casts} iconSize={40} />,
          }
        : undefined,
    };
  });

  return (
    <GuideSection spell={SPELLS.HAVOC} explanation={explanation}>
      <CastDetail title={t({ id: 'warlock.destruction.havocGuide.havocWindows', message: 'Havoc Windows' })} casts={perCastData} />
    </GuideSection>
  );
}
