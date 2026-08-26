import { GuideProps, Section, SubSection, useAnalyzer } from 'interface/guide';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { Trans } from '@lingui/react/macro';
import EnergyCapWaste from 'analysis/retail/rogue/shared/guide/EnergyCapWaste';
import TALENTS from 'common/TALENTS/rogue';
import SPELLS from 'common/SPELLS/rogue';
import { ResourceLink, SpellLink } from 'interface';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import CombatLogParser from './CombatLogParser';
import { AplSectionData } from 'interface/guide/components/Apl';
import * as AplCheck from './modules/apl/AplCheck';
import { FoundationDowntimeSection } from 'interface/guide/foundation/FoundationDowntimeSection';
import CastEfficiency from 'parser/shared/modules/CastEfficiency';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { isTalent } from 'common/TALENTS/types';
import { Cooldown } from '../subtlety/guide/CooldownGraphSubsection';
import { t } from '@lingui/core/macro';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section title="Core Skills">
        <FoundationDowntimeSection />
        {modules.rollTheBonesBuffs.guideSubsection}
      </Section>
      <ResourceUsageSection modules={modules} events={events} info={info} />
      <CoreRotationSection modules={modules} events={events} info={info} />
      <ActionPriorityList modules={modules} events={events} info={info} />
      <CooldownSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function ResourceUsageSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const percentAtCap = modules.energyTracker.percentAtCap;
  const energyWasted = modules.energyTracker.wasted;

  return (
    <Section
      title={t({
        id: 'guide.rogue.outlaw.sections.resources.title',
        message: 'Resource Use',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.rogue.outlaw.sections.resources.energy.title',
          message: 'Energy',
        })}
      >
        <p>
          <>{t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p1', message: 'Your primary resource is ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p2', message: '. Typically, ability use will be limited by ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p3', message: ', not time. Avoid capping ' })}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p4', message: '- lost' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p5', message: 'regeneration is lost DPS. It will occasionally be impossible to avoid capping' })}
            {' '}
            <ResourceLink id={RESOURCE_TYPES.ENERGY.id} />
            {t({ id: 'guide.rogue.outlaw.sections.resources.energy.summary.p6', message: '- like while handling mechanics or during intermission phases.' })}
          </>
        </p>
        <EnergyCapWaste
          percentAtCap={percentAtCap}
          perfectTimeAtCap={0.05}
          goodTimeAtCap={0.1}
          okTimeAtCap={0.15}
          wasted={energyWasted}
        />
        {modules.energyGraph.plot}
        <p></p>
        {info.combatant.hasTalent(TALENTS.BLADE_RUSH_TALENT) && modules.bladeRush.guide}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.rogue.outlaw.sections.resources.comboPoints.title',
          message: 'Combo Points',
        })}
      >
        <p>
          <>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p1',
              message: 'Most of your abilities either ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold',
                message: 'build',
              })}
            </strong>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p2',
              message: ' or ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold2',
                message: 'spend',
              })}
            </strong>{' '}
            <ResourceLink id={RESOURCE_TYPES.COMBO_POINTS.id} />.
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p3',
              message: ' Never use a builder at ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold3',
                message: '6 or 7',
              })}
            </strong>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p4',
              message: ' combo points. ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold4',
                message: 'Spenders',
              })}
            </strong>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p5',
              message: ' should typically be used at ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold5',
                message: '6 or more',
              })}
            </strong>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p6',
              message: ' combo points, but at ',
            })}
            <strong>
              {t({
                id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.bold6',
                message: '5 or more',
              })}
            </strong>
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p7',
              message: ' if ',
            })}
            <SpellLink spell={SPELLS.SUBTERFUGE_BUFF} />
            {info.combatant.hasTalent(TALENTS.HIDDEN_OPPORTUNITY_TALENT) && (
              <>
                , <SpellLink spell={SPELLS.AUDACITY_TALENT_BUFF} />{' '}
                {t({
                  id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p8',
                  message: 'or ',
                })}
                <SpellLink spell={SPELLS.OPPORTUNITY} />
              </>
            )}{' '}
            {t({
              id: 'guide.rogue.outlaw.sections.resources.comboPoints.summary.p9',
              message: 'is active.',
            })}
          </>
        </p>
        <SideBySidePanels>
          <RoundedPanel>{modules.builderUse.chart}</RoundedPanel>
          <RoundedPanel>{modules.finisherUse.chart}</RoundedPanel>
        </SideBySidePanels>
      </SubSection>
    </Section>
  );
}

function CoreRotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.rogue.outlaw.sections.coreRotation.title',
        message: 'Core rotation',
      })}
    >
      {modules.finisherUse.guide}
      {modules.adrenalineRush.guideSubsection}
    </Section>
  );
}

function ActionPriorityList({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title="Action Priority List">
      <p>
        Outlaw has a fast paced rotation that is constantly reacting to buffs and procs. The spec
        doesn't burst but makes up for it in consistent output. Should be thought as a chaining
        priority list:
        <ol>
          <li>Cooldowns, according to the priorities below.</li>
          <li>Finishers, according to the priorities below.</li>
          <li>Builders, according to the priorities below.</li>
        </ol>
      </p>
      <p>
        This Action Priority List (APL) is a simplified version off the simc APL that can be found{' '}
        <a href="https://github.com/simulationcraft/simc/blob/thewarwithin/engine/class_modules/apl/rogue/outlaw.simc">
          here
        </a>
        .
      </p>
      <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
      <hr />
      <p>
        <strong>Disclaimer:</strong> (Currently unsupported spells/talents)
        <ul>
          <li>
            {' '}
            <SpellLink spell={TALENTS.THISTLE_TEA_1_TALENT} />
          </li>
          <li>
            {' '}
            <SpellLink spell={SPELLS.BLADE_FLURRY} />
          </li>
        </ul>
      </p>
      <p>You can use the accuracy here as a reference point to compare to other logs.</p>
    </Section>
  );
}

const cooldownsToCheck: Cooldown[] = [
  { spell: TALENTS.ADRENALINE_RUSH_TALENT },
  { spell: TALENTS.KILLING_SPREE_TALENT },
  { spell: TALENTS.KEEP_IT_ROLLING_TALENT },
];

function CooldownSection({ info }: GuideProps<typeof CombatLogParser>) {
  const castEfficiency = useAnalyzer(CastEfficiency);
  if (!info || !castEfficiency) {
    return null;
  }

  const cooldowns = cooldownsToCheck.filter((cooldown) => {
    const hasTalent = !isTalent(cooldown.spell) || info.combatant.hasTalent(cooldown.spell);
    const hasExtraTalents =
      cooldown.extraTalents?.reduce(
        (acc, talent) => acc && info.combatant.hasTalent(talent),
        true,
      ) ?? true;
    return hasTalent && hasExtraTalents;
  });

  const hasTooManyCasts = cooldowns.some((cooldown) => {
    const casts = castEfficiency.getCastEfficiencyForSpell(cooldown.spell)?.casts ?? 0;
    return casts >= 10;
  });

  return (
    <Section title="Cooldowns">
      <p>
        <strong>Cooldown Graph</strong> - This graph visualizes the usage of your cooldowns and
        highlights areas where optimizations can be made.
        <ul>
          <li>
            <strong>Grey segments</strong> indicate availability.
          </li>
          <li>
            <strong>Yellow segments</strong> indicate cooldown time.
          </li>
          <li>
            <strong>Red segments</strong> highlight areas where an extra cooldown could have fit.
          </li>
        </ul>
      </p>
      {cooldowns.map((cooldownCheck) => (
        <CastEfficiencyBar
          key={cooldownCheck.spell.id}
          spell={cooldownCheck.spell}
          gapHighlightMode={GapHighlight.FullCooldown}
          minimizeIcons={hasTooManyCasts}
          useThresholds
        />
      ))}
    </Section>
  );
}
