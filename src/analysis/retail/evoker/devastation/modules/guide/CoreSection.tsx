import CombatLogParser from '../../CombatLogParser';
import { GuideProps, Section, SubSection } from 'interface/guide';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import PerformancePercentage from './PerformancePercentage';
import { ResourceLink, SpellLink } from 'interface';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SPELLS from 'common/SPELLS/evoker';
import PerformanceStrong from 'interface/PerformanceStrong';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function CoreSection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const percentAtCap = modules.essenceTracker.percentAtCap;
  const essenceWasted = modules.essenceTracker.wasted;

  const perfectTimeAtEssenceCap = 0.1;
  const goodTimeAtEssenceCap = 0.15;
  const okTimeAtEssenceCap = 0.2;

  const percentAtCapPerformance =
    percentAtCap <= perfectTimeAtEssenceCap
      ? QualitativePerformance.Perfect
      : percentAtCap <= goodTimeAtEssenceCap
        ? QualitativePerformance.Good
        : percentAtCap <= okTimeAtEssenceCap
          ? QualitativePerformance.Ok
          : QualitativePerformance.Fail;

  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.core.title',
        message: 'Core',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.evoker.devastation.sections.core.essenceGraph.title',
          message: 'Essence Graph',
        })}
      >
        <p>
          <Trans id="guide.evoker.devastation.sections.core.essenceGraph.summary">
            Your primary resource is <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} />. You should
            avoid overcapping <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} /> - lost{' '}
            <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} /> generation is lost DPS. Sometimes it
            will be impossible to avoid overcapping <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} />{' '}
            - due to handling mechanics, high rolling{' '}
            <SpellLink spell={SPELLS.ESSENCE_BURST_DEV_BUFF} /> procs or during intermission phases.
          </Trans>
        </p>
        <p>
          <Trans id="guide.evoker.devastation.sections.core.essenceGraph.wasted">
            The chart below shows your <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} /> over the
            course of the encounter. You wasted{' '}
            <PerformancePercentage
              performance={percentAtCapPerformance}
              perfectPercentage={perfectTimeAtEssenceCap}
              goodPercentage={goodTimeAtEssenceCap}
              okPercentage={okTimeAtEssenceCap}
              percentage={percentAtCap}
              flatAmount={essenceWasted}
            />{' '}
            of your <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} />.
          </Trans>
        </p>
        {modules.essenceGraph.plot}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.evoker.devastation.sections.core.alwaysBeCasting.title',
          message: 'Always be Casting',
        })}
      >
        <p>
          <Trans id="guide.evoker.devastation.sections.core.alwaysBeCasting.summary">
            <em>
              <b>
                Continuously chaining casts throughout an encounter is the single most important
                thing for achieving good DPS as a caster.
              </b>
            </em>
          </Trans>
        </p>
        <p>
          <Trans id="guide.evoker.devastation.sections.core.alwaysBeCasting.summary2">
            There should be no delay at all between your spell casts, it's better to start casting
            the wrong spell than to think for a few seconds and then cast the right spell. You
            should be able to handle a fight's mechanics with the minimum possible interruption to
            your casting. Some fights have unavoidable downtime due to phase transitions and the
            like, so in these cases 0% downtime will not be possible - do the best you can.
          </Trans>
        </p>
        <p>
          <Trans id="guide.evoker.devastation.sections.core.alwaysBeCasting.value">
            Active Time:{' '}
          </Trans>
          <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
            {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
          </PerformanceStrong>{' '}
          {t({
            id: 'guide.evoker.devastation.sections.core.alwaysBeCasting.cancelledCasts',
            message: 'Cancelled Casts:',
          })}{' '}
          <PerformanceStrong performance={modules.cancelledCasts.CancelledPerformance}>
            {formatPercentage(modules.cancelledCasts.cancelledPercentage, 1)}%
          </PerformanceStrong>{' '}
        </p>
        <ActiveTimeGraph
          activeTimeSegments={modules.alwaysBeCasting.activeTimeSegments}
          fightStart={info.fightStart}
          fightEnd={info.fightEnd}
        />
      </SubSection>
    </Section>
  );
}
