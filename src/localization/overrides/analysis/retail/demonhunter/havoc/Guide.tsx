import { GoodColor, GuideProps, Section, SubSection, useAnalyzers } from 'interface/guide';
import TALENTS from 'common/TALENTS/demonhunter';
import SPELLS from 'common/SPELLS/demonhunter';
import { ResourceLink, SpellLink } from 'interface';
import { Highlight } from 'interface/Highlight';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import CooldownUsage from 'parser/core/MajorCooldowns/CooldownUsage';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import CombatLogParser from './CombatLogParser';
import CooldownGraphSubsection from './guide/CooldownGraphSubSection';
import {
  GOOD_TIME_AT_FURY_CAP,
  OK_TIME_AT_FURY_CAP,
  PERFECT_TIME_AT_FURY_CAP,
} from './modules/resourcetracker/FuryTracker';
import FuryCapWaste from './guide/FuryCapWaste';
import { HideGoodCastsToggle } from 'interface/guide/components/HideGoodCastsToggle';
import { PerformanceStrong } from 'analysis/retail/priest/shadow/modules/guide/ExtraComponents';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import Blur from './modules/spells/Blur';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <ResourceUsageSection modules={modules} events={events} info={info} />
      <CooldownSection modules={modules} events={events} info={info} />
      <RotationSection modules={modules} events={events} info={info} />
      <DefensivesSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function ResourceUsageSection({ info, modules }: GuideProps<typeof CombatLogParser>) {
  const percentAtFuryCap = modules.furyTracker.percentAtCap;
  const percentAtFuryCapPerformance = modules.furyTracker.percentAtCapPerformance;
  const furyWasted = modules.furyTracker.wasted;
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.havoc.sections.core.title',
        message: 'Core',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.demonhunter.havoc.sections.core.fury.title',
          message: 'Fury',
        })}
      >
        <p>
          <>{t({ id: 'guide.demonhunter.havoc.sections.core.fury.summary.p1', message: 'Havoc\'s primary resource is ' })}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} />
            {t({ id: 'guide.demonhunter.havoc.sections.core.fury.summary.p2', message: '. You should avoid capping ' })}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} />
            {t({ id: 'guide.demonhunter.havoc.sections.core.fury.summary.p3', message: '- lost' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} />
            {t({ id: 'guide.demonhunter.havoc.sections.core.fury.summary.p4', message: 'generation is lost DPS.' })}
          </>
        </p>
        <FuryCapWaste
          percentAtCap={percentAtFuryCap}
          percentAtCapPerformance={percentAtFuryCapPerformance}
          wasted={furyWasted}
          perfectTimeAtFuryCap={PERFECT_TIME_AT_FURY_CAP}
          goodTimeAtFuryCap={GOOD_TIME_AT_FURY_CAP}
          okTimeAtFuryCap={OK_TIME_AT_FURY_CAP}
        />
        {modules.furyGraph.plot}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.demonhunter.havoc.sections.core.activeTime.title',
          message: 'Active Time',
        })}
      >
        <p>
          <><b>{t({ id: 'guide.demonhunter.havoc.sections.core.activeTime.summary.b', message: 'Continuously casting throughout an encounter is the single most important thing for achieving good DPS.' })}</b>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            {t({ id: 'guide.demonhunter.havoc.sections.core.activeTime.summary.p1', message: 'Some fights have unavoidable downtime due to phase transitions and the like, so in these cases 0% downtime will not be possible - do the best you can.' })}
          </>
        </p>
        <p>
          <Trans id="guide.demonhunter.havoc.sections.core.activeTime.value">Active Time: </Trans>
          <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
            {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
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

function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.havoc.sections.cooldowns.title',
        message: 'Cooldowns',
      })}
    >
      <HideExplanationsToggle id="hide-explanations-cooldowns" />
      <HideGoodCastsToggle id="hide-good-casts-cooldowns" />
      <CooldownGraphSubsection />
      <CooldownUsage analyzer={modules.eyeBeam} title="Eye Beam" />
      {info.combatant.hasTalent(TALENTS.ESSENCE_BREAK_TALENT) &&
        explanationAndDataSubsection(
          <div>
            <>{t({ id: 'guide.demonhunter.havoc.sections.cooldowns.essenceBreak.soon.p1', message: 'Per-cast breakdown for ' })}
              <SpellLink spell={TALENTS.ESSENCE_BREAK_TALENT} />
              {t({ id: 'guide.demonhunter.havoc.sections.cooldowns.essenceBreak.soon.p2', message: 'coming soon!' })}
            </>
          </div>,
          <></>,
        )}
      {info.combatant.hasTalent(TALENTS.ART_OF_THE_GLAIVE_TALENT) &&
        explanationAndDataSubsection(
          <div>
            <>{t({ id: 'guide.demonhunter.havoc.sections.cooldowns.artOfTheGlaive.soon.p1', message: 'Per-cast breakdown for ' })}
              <SpellLink spell={TALENTS.ART_OF_THE_GLAIVE_TALENT} />
              {t({ id: 'guide.demonhunter.havoc.sections.cooldowns.artOfTheGlaive.soon.p2', message: 'coming soon!' })}
            </>
          </div>,
          <></>,
        )}
    </Section>
  );
}

function RotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.havoc.sections.rotation.title',
        message: 'Rotation',
      })}
    >
      <HideExplanationsToggle id="hide-explanations-rotations" />
      <HideGoodCastsToggle id="hide-good-casts-rotations" />
      <p>
        <Trans id="guide.demonhunter.havoc.sections.rotation.summary">
          Havoc does not have a single rigid rotation. Your priority changes with your talent
          choices, with different builds leaning into different burst windows, buff upkeep, and
          cooldown pairings.
        </Trans>
      </p>
      {modules.inertia.guideSubsection()}
      {/* {modules.throwGlaive.guideSubsection()} */}
      {info.combatant.hasTalent(TALENTS.ESSENCE_BREAK_TALENT) &&
        explanationAndDataSubsection(
          <div>
            <>{t({ id: 'guide.demonhunter.havoc.sections.rotation.essenceBreak.soon.p1', message: 'Per-cast breakdown for ' })}
              <SpellLink spell={TALENTS.ESSENCE_BREAK_TALENT} />
              {t({ id: 'guide.demonhunter.havoc.sections.rotation.essenceBreak.soon.p2', message: 'coming soon!' })}
            </>
          </div>,
          <></>,
        )}
    </Section>
  );
}

function DefensivesSection({ modules }: GuideProps<typeof CombatLogParser>) {
  const defensiveAnalyzers = useAnalyzers([Blur]);

  return (
    <Section
      title={t({
        id: 'guide.demonhunter.havoc.sections.defensives.title',
        message: 'Defensives',
      })}
    >
      <p>
        <><SpellLink spell={SPELLS.BLUR} />
          {t({ id: 'guide.demonhunter.havoc.sections.defensives.blur.summary.p1', message: 'is Havoc\'s primary personal defensive. Using it well helps you survive dangerous moments more reliably and reduces avoidable pressure on your healers.' })}
        </>
      </p>
      <p>
        <Trans id="guide.demonhunter.havoc.sections.defensives.blur.timing">
          Because Blur has a relatively short cooldown, it should usually be used proactively for
          meaningful incoming damage rather than held too long waiting for a perfect emergency.
        </Trans>
      </p>
      <p>
        <Trans id="guide.demonhunter.havoc.sections.defensives.blur.questions">
          When reviewing your Blur usage, focus on two questions:
        </Trans>
      </p>
      <ol>
        <li>
          <Trans id="guide.demonhunter.havoc.sections.defensives.blur.question1">
            Did Blur cover dangerous spikes or other high-pressure damage windows?
          </Trans>
          <p>
            <small>
              <>{t({ id: 'guide.demonhunter.havoc.sections.defensives.blur.question1.explanation.p1', message: 'In the damage chart below, a spike highlighted in' })}
                {' '}
                <Highlight color={GoodColor} textColor="black">
                  green
                </Highlight>
                {' '}
                {t({ id: 'guide.demonhunter.havoc.sections.defensives.blur.question1.explanation.p2', message: 'was covered by Blur.' })}
              </>
            </small>
          </p>
        </li>
        <li>
          <Trans id="guide.demonhunter.havoc.sections.defensives.blur.question2">
            Was Blur used often enough across the fight, or was it held long enough to lose value?
          </Trans>
          <p>
            <small>
              <Trans id="guide.demonhunter.havoc.sections.defensives.blur.question2.explanation">
                The cooldown timeline below shows whether casts were timed around threatening damage
                and whether long gaps may have cost you additional uses.
              </Trans>
            </small>
          </p>
        </li>
      </ol>
      <SubSection
        title={t({
          id: 'guide.demonhunter.havoc.sections.defensives.damageTaken.title',
          message: 'Damage Taken',
        })}
      >
        <Timeline analyzers={defensiveAnalyzers} />
      </SubSection>
      <AllCooldownUsageList analyzers={defensiveAnalyzers} />
    </Section>
  );
}
