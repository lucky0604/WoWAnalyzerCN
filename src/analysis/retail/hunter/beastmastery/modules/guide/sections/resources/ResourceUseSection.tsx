import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import CombatLogParser from 'analysis/retail/hunter/beastmastery/CombatLogParser';
import {
  RESOURCES_HUNTER_AVERAGE_THRESHOLD,
  RESOURCES_HUNTER_MAJOR_THRESHOLD,
  RESOURCES_HUNTER_MINOR_THRESHOLD,
} from 'analysis/retail/hunter/shared/constants';
import { formatNumber, formatPercentage } from 'common/format';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { ResourceLink } from 'interface';
import { ModulesOf, PerformanceMark, Section, SubSection } from 'interface/guide';
import PerformanceStrongWithTooltip from 'interface/PerformanceStrongWithTooltip';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

export default function ResourceUseSection(modules: ModulesOf<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.hunter.beastmastery.sections.resources.title',
        message: 'Resource Use',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.hunter.beastmastery.sections.resources.focus.title',
          message: 'Focus',
        })}
      >
        <p>
          <Trans id="guide.hunter.beastmastery.sections.resources.focus.summary">
            Your primary resource is <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />. Typically,
            ability use will be limited by <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />, not time.
            Avoid capping <ResourceLink id={RESOURCE_TYPES.FOCUS.id} /> - lost{' '}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} /> regeneration is lost DPS. It will
            occasionally be impossible to avoid capping{' '}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} /> - like while handling mechanics or during
            intermission phases.
          </Trans>
        </p>
        <p>
          <Trans id="guide.hunter.beastmastery.sections.resources.focus.wasted">
            The chart below shows your <ResourceLink id={RESOURCE_TYPES.FOCUS.id} /> over the course
            of the encounter. You wasted{' '}
          </Trans>
          <PerformanceStrongWithTooltip
            performance={modules.focusTracker.percentAtCapPerformance}
            tooltip={
              <>
                <PerformanceMark perf={QualitativePerformance.Perfect} />{' '}
                <Trans id="guide.hunter.beastmastery.sections.resources.focus.tooltip.perfect">
                  Perfect usage &lt;={''}
                </Trans>{' '}
                {formatPercentage(RESOURCES_HUNTER_MINOR_THRESHOLD, 0)}%
                <p />
                <PerformanceMark perf={QualitativePerformance.Good} />{' '}
                <Trans id="guide.hunter.beastmastery.sections.resources.focus.tooltip.good">
                  Good usage &lt;={''}
                </Trans>{' '}
                {formatPercentage(RESOURCES_HUNTER_AVERAGE_THRESHOLD, 0)}%
                <p />
                <PerformanceMark perf={QualitativePerformance.Ok} />{' '}
                <Trans id="guide.hunter.beastmastery.sections.resources.focus.tooltip.ok">
                  OK usage &lt;={''}
                </Trans>{' '}
                {formatPercentage(RESOURCES_HUNTER_MAJOR_THRESHOLD, 0)}%{' '}
              </>
            }
          >
            {formatNumber(modules.focusTracker.wasted)} (
            {formatPercentage(modules.focusTracker.percentAtCap, 1)}%)
          </PerformanceStrongWithTooltip>{' '}
          <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />.
        </p>
        {modules.focusGraph.plot}
      </SubSection>
    </Section>
  );
}
