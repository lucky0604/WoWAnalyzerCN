import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GoodColor, GuideProps, Section, SubSection, useAnalyzers } from 'interface/guide';
import CombatLogParser from 'analysis/retail/druid/guardian/CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import IronfurSection from 'analysis/retail/druid/guardian/modules/spells/IronfurGuideSection';
import { ResourceLink, SpellLink } from 'interface';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SPELLS from 'common/SPELLS';
import { TALENTS_DRUID } from 'common/TALENTS';
import PerformancePercentage from 'analysis/retail/demonhunter/shared/guide/PerformancePercentage';
import {
  PERFECT_RAGE_WASTED,
  GOOD_RAGE_WASTED,
  OK_RAGE_WASTED,
  RAGE_SCALE_FACTOR,
} from 'analysis/retail/druid/guardian/modules/core/rage/RageTracker';
import { Highlight } from 'interface/Highlight';
import Explanation from 'interface/guide/components/Explanation';
import { TooltipElement } from 'interface';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsagesList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { PerformanceStrong } from 'analysis/retail/priest/shadow/modules/guide/ExtraComponents';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import Barkskin from 'analysis/retail/druid/guardian/modules/spells/Barkskin';
import SurvivalInstincts from 'analysis/retail/druid/guardian/modules/spells/SurvivalInstincts';
import { GapHighlight } from 'parser/ui/CooldownBar';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { cdSpell } from 'analysis/retail/druid/guardian/constants';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <IronfurSection />
      <RageSection modules={modules} events={events} info={info} />
      <RotationSection modules={modules} events={events} info={info} />
      <MajorDefensivesSection />
      <OffensiveCooldownsSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

// TODO move to own Rage class?
function RageSection({ modules }: GuideProps<typeof CombatLogParser>): JSX.Element {
  return (
    <Section title={t({ id: 'guardian.section.rage', message: 'Rage' })}>
        <p>
          {t({
            id: 'guardian.rage.description',
            message:
              "Guardian's primary resource is ",
          })}
          <ResourceLink id={RESOURCE_TYPES.RAGE.id} />
          {t({
            id: 'guardian.rage.description.p2',
            message:
              ". It's generated as part of your normal rotation, and can be consumed either defensively (with ",
          })}
          <SpellLink spell={SPELLS.IRONFUR} /> / <SpellLink spell={SPELLS.FRENZIED_REGENERATION} />
          {t({
            id: 'guardian.rage.description.p3',
            message: ') or offesnively (with ',
          })}
          <SpellLink spell={SPELLS.MAUL} /> / <SpellLink spell={TALENTS_DRUID.RAZE_TALENT} />
          {t({
            id: 'guardian.rage.description.p4',
            message:
              '). You should always spend your Rage before capping, as lost generation is lost effectiveness. ',
          })}
          <SpellLink spell={SPELLS.IRONFUR} />
          {t({
            id: 'guardian.rage.description.p5',
            message:
              ' is not on the GCD - excess rage can always be instantly turned into extra stacks.',
          })}
        </p>
      <p>
        <>{t({ id: 'guardian.rage.wasted.p1', message: 'The chart below shows your Rage over the course of the encounter. You wasted' })}
          {' '}
          <PerformancePercentage
            performance={modules.rageTracker.wastedPerformance}
            perfectPercentage={PERFECT_RAGE_WASTED}
            goodPercentage={GOOD_RAGE_WASTED}
            okPercentage={OK_RAGE_WASTED}
            percentage={modules.rageTracker.percentAtCap}
            flatAmount={modules.rageTracker.wasted * RAGE_SCALE_FACTOR}
          />
          {' '}
          {t({ id: 'guardian.rage.wasted.p2', message: 'of your ' })}
          <ResourceLink id={RESOURCE_TYPES.RAGE.id} />
          {t({ id: 'guardian.rage.wasted.p3', message: '.' })}
        </>
      </p>
      {modules.rageGraph.plot}
    </Section>
  );
}

function RotationSection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'guardian.section.rotation', message: 'Rotation' })}>
        <p>
          {t({
            id: 'guardian.rotation.basics',
            message:
              "The basics of Guardian's damage / rage-building rotation is to use ",
          })}
          <SpellLink spell={SPELLS.MANGLE_BEAR} />
          {t({ id: 'guardian.rotation.basics.p2', message: ' and ' })}
          <SpellLink spell={SPELLS.THRASH_BEAR} />
          {t({
            id: 'guardian.rotation.basics.p3',
            message: ' on cooldown while maintaining ',
          })}
          <SpellLink spell={SPELLS.MOONFIRE_DEBUFF} />
          {t({
            id: 'guardian.rotation.basics.p4',
            message: ' on enemies. Fill any empty GCDs with ',
          })}
          <SpellLink spell={SPELLS.SWIPE_BEAR} />
          {t({
            id: 'guardian.rotation.basics.p5',
            message:
              '. For more detail on the specifics and priorities at play, refer to the ',
          })}
          <a
            href="https://www.wowhead.com/guide/classes/druid/guardian/rotation-cooldowns-pve-tank"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t({
              id: 'guardian.rotation.basics.link',
              message: 'Wowhead rotation guide',
            })}
          </a>
        </p>
      <p>
        {t({
          id: 'guardian.rotation.gcdCapped',
          message:
            "Guardian is absolutely a GCD-capped spec and you should be constantly using abilities. Active time shows the percentage of time you were spamming abilities - get as close to 100% as you can.",
        })}
      </p>
      <p>
        <strong>
          {t({ id: 'guardian.rotation.activeTime', message: 'Active Time:' })}{' '}
          <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
            {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
          </PerformanceStrong>{' '}
        </strong>
      </p>
      <p>
        <ActiveTimeGraph
          activeTimeSegments={modules.alwaysBeCasting.activeTimeSegments}
          fightStart={info.fightStart}
          fightEnd={info.fightEnd}
        />
      </p>
      {/* {modules.mangle.guideSubsection}
      {modules.thrash.guideSubsection}
      {modules.moonfire.guideSubsection}
      {modules.swipe.guideSubsection} */}
    </Section>
  );
}

function OffensiveCooldownsSection({
  modules,
  info,
}: GuideProps<typeof CombatLogParser>): JSX.Element | null {
  return (
    <Section
      title={t({ id: 'guardian.section.offensiveCooldowns', message: 'Offensive Cooldowns' })}
    >
      <Explanation>
        {t({
          id: 'guardian.offensiveCooldowns.description',
          message:
            'While your first priority should always be to stay alive, prompt and proper use of your offensive cooldowns can increase your damage contribution.',
        })}
      </Explanation>
      <SubSection>
        <CastEfficiencyBar
          spell={cdSpell(info.combatant)}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
        {info.combatant.hasTalent(TALENTS_DRUID.LUNAR_BEAM_TALENT) && (
          <CastEfficiencyBar
            spell={TALENTS_DRUID.LUNAR_BEAM_TALENT}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
      </SubSection>
      {/* {modules.berserk.guideCastBreakdown} */}
    </Section>
  );
}

function MajorDefensivesSection(): JSX.Element | null {
  const analyzers = useAnalyzers([Barkskin, SurvivalInstincts]);
  return (
    <Section
      title={t({ id: 'guardian.section.majorDefensives', message: 'Major Defensives' })}
    >
      <Explanation>
        <p>
          {t({
            id: 'guardian.majorDefensives.intro',
            message:
              'Effectively using your defensive cooldowns is a core part of playing tank well. Guardian in particular must use cooldowns to effectively mitigate big magic damage.',
          })}
        </p>
        <p>
          {t({
            id: 'guardian.majorDefensives.twoThings',
            message: 'There are two things you should look for in your cooldown usage:',
          })}
        </p>
        <ol>
          <li>
            {t({
              id: 'guardian.majorDefensives.coverSpikes',
              message: 'You should cover as many ',
            })}
            <TooltipElement
              content={
                <>
                  {t({
                    id: 'guardian.majorDefensives.damageSpikeTooltip.p1',
                    message: 'A ',
                  })}
                  <strong>
                    {t({
                      id: 'guardian.majorDefensives.damageSpikeTooltip.strong',
                      message: 'damage spike',
                    })}
                  </strong>
                  {t({
                    id: 'guardian.majorDefensives.damageSpikeTooltip.p2',
                    message:
                      ' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.',
                  })}
                </>
              }
            >
              damage spikes
            </TooltipElement>{' '}
            {t({
              id: 'guardian.majorDefensives.coverSpikes.p2',
              message:
                'as possible, and use any left over to cover periods of heavy, consistent damage.',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <small>
              <>{t({ id: 'guardian.majorDefensives.greenHighlight.p1', message: 'In the damage chart below, a spike highlighted in' })}
                {' '}
                <Highlight color={GoodColor} textColor="black">
                  green
                </Highlight>
                {' '}
                {t({ id: 'guardian.majorDefensives.greenHighlight.p2', message: 'was covered by a defensive.' })}
              </>
            </small>
          </li>
          <li>
            <>{t({ id: 'guardian.majorDefensives.useThem.p1', message: 'You should ' })}
              <em>{t({ id: 'guardian.majorDefensives.useThem.em', message: 'use' })}</em>
              {t({ id: 'guardian.majorDefensives.useThem.p2', message: 'your cooldowns. This may seem silly&mdash;but not using major defensives is a common problem! For Guardian, it is also likely to be fatal.' })}
            </>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <small>
              <Trans id="guardian.majorDefensives.gapNote">
                Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                could get more uses&mdash;but remember that covering spikes is more important than
                maximizing total casts!
              </Trans>
            </small>
          </li>
        </ol>
      </Explanation>
      <SubSection
        title={t({ id: 'guardian.timeline.title', message: 'Timeline' })}
      >
        <Timeline analyzers={analyzers} yScale={0.4} />
      </SubSection>
      <AllCooldownUsagesList analyzers={analyzers} />
    </Section>
  );
}
