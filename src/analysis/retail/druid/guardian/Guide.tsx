import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GuideProps, Section, SubSection, useAnalyzers } from 'interface/guide';
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
import { PerformanceStrong } from 'analysis/retail/priest/shadow/modules/guide/ExtraComponents';
import { formatPercentage } from 'common/format';
import Explanation from 'interface/guide/components/Explanation';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsagesList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
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
    <Section title="Rage">
      <p>
        <Trans id="guardian.rage.description">
          Guardian's primary resource is <ResourceLink id={RESOURCE_TYPES.RAGE.id} />. It's
          generated as part of your normal rotation, and can be consumed either defensively (with{' '}
          <SpellLink spell={SPELLS.IRONFUR} /> / <SpellLink spell={SPELLS.FRENZIED_REGENERATION} />)
          or offensively (with <SpellLink spell={SPELLS.MAUL} /> /{' '}
          <SpellLink spell={TALENTS_DRUID.RAZE_TALENT} />
          ). You should always spend your Rage before capping, as lost generation is lost
          effectiveness. <SpellLink spell={SPELLS.IRONFUR} /> is not on the GCD - excess rage can
          always be instantly turned into extra stacks.
        </Trans>
      </p>
      <p>
        <Trans id="guardian.rage.wasted">
          The chart below shows your Rage over the course of the encounter. You wasted{' '}
          <PerformancePercentage
            performance={modules.rageTracker.wastedPerformance}
            perfectPercentage={PERFECT_RAGE_WASTED}
            goodPercentage={GOOD_RAGE_WASTED}
            okPercentage={OK_RAGE_WASTED}
            percentage={modules.rageTracker.percentAtCap}
            flatAmount={modules.rageTracker.wasted * RAGE_SCALE_FACTOR}
          />{' '}
          of your <ResourceLink id={RESOURCE_TYPES.RAGE.id} />.
        </Trans>
      </p>
      {modules.rageGraph.plot}
    </Section>
  );
}

function RotationSection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title="Rotation">
      <p>
        <Trans id="guardian.rotation.basics">
          The basics of Guardian's damage / rage-building rotation is to use{' '}
          <SpellLink spell={SPELLS.MANGLE_BEAR} /> and <SpellLink spell={SPELLS.THRASH_BEAR} /> on
          cooldown while maintaining <SpellLink spell={SPELLS.MOONFIRE_DEBUFF} /> on enemies. Fill
          any empty GCDs with <SpellLink spell={SPELLS.SWIPE_BEAR} />. For more detail on the
          specifics and priorities at play, refer to the{' '}
          <a
            href="https://www.wowhead.com/guide/classes/druid/guardian/rotation-cooldowns-pve-tank"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wowhead rotation guide
          </a>
          .
        </Trans>
      </p>
      <p>
        <Trans id="guardian.rotation.gcdCapped">
          Guardian is absolutely a GCD-capped spec and you should be constantly using abilities.
          Active time shows the percentage of time you were spamming abilities - get as close to
          100% as you can.
        </Trans>
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
        Guardian is absolutely a GCD-capped spec and you should be constantly using abilities.
        Active time shows the percentage of time you were spamming abilities - get as close to 100%
        as you can.
      </p>
      <p>
        <strong>
          Active Time:{' '}
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
    <Section title="Offensive Cooldowns">
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
    <Section title="Major Defensives">
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
              message:
                'You should cover as many damage spikes as possible, and use any left over to cover periods of heavy, consistent damage.',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br */}
            <br />
            <small>
              {t({
                id: 'guardian.majorDefensives.greenHighlight',
                message:
                  'In the damage chart below, a spike highlighted in green was covered by a defensive.',
              })}
            </small>
          </li>
          <li>
            {t({
              id: 'guardian.majorDefensives.useThem',
              message:
                'You should use your cooldowns. This may seem silly—but not using major defensives is a common problem! For Guardian, it is also likely to be fatal.',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br */}
            <br />
            <small>
              {t({
                id: 'guardian.majorDefensives.gapNote',
                message:
                  'Below the damage chart, your cooldowns are shown. Large gaps may indicate that you could get more uses—but remember that covering spikes is more important than maximizing total casts!',
              })}
            </small>
          </li>
        </ol>
      </Explanation>
      <SubSection title="Timeline">
        <Timeline analyzers={analyzers} yScale={0.4} />
      </SubSection>
      <AllCooldownUsagesList analyzers={analyzers} />
    </Section>
  );
}
