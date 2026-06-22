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
          <>{t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p1', message: 'Your primary resource is ' })}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p2', message: '. Typically, ability use will be limited by ' })}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p3', message: ', not time. Avoid capping ' })}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p4', message: '- lost' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p5', message: 'regeneration is lost DPS. It will occasionally be impossible to avoid capping' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.summary.p6', message: '- like while handling mechanics or during intermission phases.' })}
          </>
        </p>
        <p>
          <>{t({ id: 'guide.hunter.beastmastery.sections.resources.focus.wasted.p1', message: 'The chart below shows your ' })}
            <ResourceLink id={RESOURCE_TYPES.FOCUS.id} />
            {t({ id: 'guide.hunter.beastmastery.sections.resources.focus.wasted.p2', message: 'over the course of the encounter. You wasted' })}
            {' '}
          </>
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
