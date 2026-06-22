import { GuideProps, Section, SubSection } from 'interface/guide';
import { ResourceLink } from 'interface';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import CombatLogParser from 'analysis/retail/paladin/retribution/CombatLogParser';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import PerformancePercentage from 'analysis/retail/demonhunter/shared/guide/PerformancePercentage';
import TALENTS from 'common/TALENTS/paladin';
import SpellLink from 'interface/SpellLink';
import CooldownGraphSubsection, {
  Cooldown,
} from 'interface/guide/components/CooldownGraphSubSection';
import CooldownUsage from 'parser/core/MajorCooldowns/CooldownUsage';
import { FoundationDowntimeSection } from 'interface/guide/foundation/FoundationDowntimeSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <CoreSection modules={modules} events={events} info={info} />
      <CooldownSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

export const GUIDE_CORE_EXPLANATION_PERCENT = 40;

const PERFECT_HOLY_POWER_CAP = 0.1;
const GOOD_HOLY_POWER_CAP = 0.15;
const OK_HOLY_POWER_CAP = 0.2;

function CoreSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const holyPowerWasted = modules.holyPowerTracker.wasted;
  const holyPowerTotal = modules.holyPowerTracker.wasted + modules.holyPowerTracker.generated;
  const wastedHolyPowerPercentage = holyPowerWasted / holyPowerTotal;
  let wastedHolyPowerPercentagePerformance = QualitativePerformance.Fail;
  if (wastedHolyPowerPercentage <= PERFECT_HOLY_POWER_CAP) {
    wastedHolyPowerPercentagePerformance = QualitativePerformance.Perfect;
  } else if (wastedHolyPowerPercentage <= GOOD_HOLY_POWER_CAP) {
    wastedHolyPowerPercentagePerformance = QualitativePerformance.Good;
  } else if (wastedHolyPowerPercentage <= OK_HOLY_POWER_CAP) {
    wastedHolyPowerPercentagePerformance = QualitativePerformance.Ok;
  }

  return (
    <Section title={t({ id: 'paladin.retribution.section.core', message: 'Core' })}>
      <FoundationDowntimeSection />
      <h4>
        <strong>{t({ id: 'paladin.retribution.core.explanation', message: 'Explanation' })}</strong>
      </h4>
      <p>
        <>
          {t({ id: 'paladin.retribution.core.downtime.p1', message: 'Although Retribution is a spec with some natural downtime, it needs to be auto-attacking as much as possible because of talents like ' })}
          <SpellLink spell={TALENTS.CRUSADING_STRIKES_TALENT} />
          {t({ id: 'paladin.retribution.core.downtime.p2', message: ' and ' })}
          <SpellLink spell={TALENTS.ART_OF_WAR_TALENT} />
          {t({ id: 'paladin.retribution.core.downtime.p3', message: '. Failing to maintain good melee uptime will likely result in a lower ability uptime because of lower ' })}
          <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
          {t({ id: 'paladin.retribution.core.downtime.p4', message: ' generation.' })}
        </>
      </p>

      <SubSection title={t({ id: 'paladin.retribution.subsection.holyPower', message: 'Holy Power' })}>
        <p>
          <>
            {t({ id: 'paladin.retribution.holyPower.description.p1', message: 'Most of your rotational abilities either ' })}
            <strong>{t({ id: 'paladin.retribution.holyPower.description.build', message: 'build' })}</strong>
            {t({ id: 'paladin.retribution.holyPower.description.p2', message: ' or ' })}
            <strong>{t({ id: 'paladin.retribution.holyPower.description.spend', message: 'spend' })}</strong>
            {' '}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.retribution.holyPower.description.p3', message: '. Never use a builder at max ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.retribution.holyPower.description.p4', message: ' or when doing so will cause you to overcap on ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.retribution.holyPower.description.p5', message: '.' })}
          </>
        </p>
        <SideBySidePanels>
          <RoundedPanel>
            <strong>
              <><ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.retribution.holyPower.wasteTitle.p1', message: 'Waste' })}
              </>
            </strong>
            <p>
              <>{t({ id: 'paladin.retribution.holyPower.wasted.p1', message: 'You wasted' })}
                {' '}
                <PerformancePercentage
                  performance={wastedHolyPowerPercentagePerformance}
                  perfectPercentage={PERFECT_HOLY_POWER_CAP}
                  goodPercentage={GOOD_HOLY_POWER_CAP}
                  okPercentage={OK_HOLY_POWER_CAP}
                  percentage={wastedHolyPowerPercentage}
                  flatAmount={holyPowerWasted}
                />
                {' '}
                {t({ id: 'paladin.retribution.holyPower.wasted.p2', message: 'of your ' })}
                <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.retribution.holyPower.wasted.p3', message: '.' })}
              </>
            </p>
            {info.combatant.hasTalent(TALENTS.CRUSADING_STRIKES_TALENT) ? (
              <p>
                <>
                  {t({ id: 'paladin.retribution.holyPower.crusadingStrikes.p1', message: "Because you're taking " })}
                  <SpellLink spell={TALENTS.CRUSADING_STRIKES_TALENT} />
                  {t({ id: 'paladin.retribution.holyPower.crusadingStrikes.p2', message: ', you need to be extra careful about how you time your abilities that build ' })}
                  <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                  {t({ id: 'paladin.retribution.holyPower.crusadingStrikes.p3', message: " so that you don't overcap." })}
                </>
              </p>
            ) : null}
            {info.combatant.hasTalent(TALENTS.DIVINE_TOLL_TALENT) &&
            wastedHolyPowerPercentage > PERFECT_HOLY_POWER_CAP ? (
              <p>
                <>
                  {t({ id: 'paladin.retribution.holyPower.divineToll.p1', message: 'Some of this might be attributable to the Judgments from ' })}
                  <SpellLink spell={TALENTS.DIVINE_TOLL_TALENT} />
                  {t({ id: 'paladin.retribution.holyPower.divineToll.p2', message: '.' })}
                </>
              </p>
            ) : null}
            {info.combatant.hasTalent(TALENTS.DIVINE_RESONANCE_RETRIBUTION_TALENT) &&
            wastedHolyPowerPercentage > PERFECT_HOLY_POWER_CAP ? (
              <p>
                <>
                  {t({ id: 'paladin.retribution.holyPower.divineResonance.p1', message: 'Some of this might be attributable to the free Judgments from ' })}
                  <SpellLink spell={TALENTS.DIVINE_RESONANCE_RETRIBUTION_TALENT} />
                  {t({ id: 'paladin.retribution.holyPower.divineResonance.p2', message: '.' })}
                </>
              </p>
            ) : null}
          </RoundedPanel>
          <RoundedPanel>
            <strong>
              <><ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
                {t({ id: 'paladin.retribution.holyPower.builderEffectiveness.p1', message: 'Builder Effectiveness' })}
              </>
            </strong>
            {modules.builderUse.chart}
          </RoundedPanel>
        </SideBySidePanels>
      </SubSection>
      {info.combatant.hasTalent(TALENTS.HOLY_FLAMES_TALENT) && (
        <SubSection title={t({ id: 'paladin.retribution.subsection.buffsDebuffs', message: 'Buffs and debuffs' })}>{modules.expurgation.guideSubsection}</SubSection>
      )}
    </Section>
  );
}

const cooldowns: Cooldown[] = [
  {
    spell: TALENTS.AVENGING_WRATH_TALENT,
    isActive: (c) => !c.hasTalent(TALENTS.RADIANT_GLORY_TALENT),
  },
  {
    spell: TALENTS.WAKE_OF_ASHES_TALENT,
    isActive: (c) => c.hasTalent(TALENTS.WAKE_OF_ASHES_TALENT),
  },
  {
    spell: TALENTS.EXECUTION_SENTENCE_TALENT,
    isActive: (c) => c.hasTalent(TALENTS.EXECUTION_SENTENCE_TALENT),
  },
  {
    spell: TALENTS.DIVINE_TOLL_TALENT,
    isActive: (c) => c.hasTalent(TALENTS.DIVINE_TOLL_TALENT),
  },
];
function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'paladin.retribution.section.cooldowns', message: 'Cooldowns' })}>
      <p>
        <Trans id="paladin.retribution.cooldowns.description">
          Retribution's cooldowns are decently powerful but should not be held on to for long. In
          order to maximize usages over the course of an encounter, you should aim to send the
          cooldown as soon as it becomes available (as long as it can do damage on target).
        </Trans>
      </p>
      <CooldownGraphSubsection cooldowns={cooldowns} />
      {info.combatant.hasTalent(TALENTS.RADIANT_GLORY_TALENT) && (
        <CooldownUsage analyzer={modules.wakeofAshes} title="Wake of Ashes" />
      )}
    </Section>
  );
}
