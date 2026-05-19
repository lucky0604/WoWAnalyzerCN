import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
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
        <Trans id="paladin.retribution.core.downtime">
          Although Retribution is a spec with some natural downtime, it needs to be auto-attacking
          as much as possible because of talents like{' '}
          <SpellLink spell={TALENTS.CRUSADING_STRIKES_TALENT} /> and{' '}
          <SpellLink spell={TALENTS.ART_OF_WAR_TALENT} />. Failing to maintain good melee uptime
          will likely result in a lower ability uptime because of lower{' '}
          <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} /> generation.
        </Trans>
      </p>

      <SubSection
        title={t({ id: 'paladin.retribution.subsection.holyPower', message: 'Holy Power' })}
      >
        <p>
          <Trans id="paladin.retribution.holyPower.description">
            Most of your rotational abilities either <strong>build</strong> or{' '}
            <strong>spend</strong> <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />. Never use a
            builder at max <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} /> or when doing so will
            cause you to overcap on <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />.
          </Trans>
        </p>
        <SideBySidePanels>
          <RoundedPanel>
            <strong>
              <Trans id="paladin.retribution.holyPower.wasteTitle">
                <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} /> Waste
              </Trans>
            </strong>
            <p>
              <Trans id="paladin.retribution.holyPower.wasted">
                You wasted{' '}
                <PerformancePercentage
                  performance={wastedHolyPowerPercentagePerformance}
                  perfectPercentage={PERFECT_HOLY_POWER_CAP}
                  goodPercentage={GOOD_HOLY_POWER_CAP}
                  okPercentage={OK_HOLY_POWER_CAP}
                  percentage={wastedHolyPowerPercentage}
                  flatAmount={holyPowerWasted}
                />{' '}
                of your <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />.
              </Trans>
            </p>
            {info.combatant.hasTalent(TALENTS.CRUSADING_STRIKES_TALENT) ? (
              <p>
                <Trans id="paladin.retribution.holyPower.crusadingStrikes">
                  Because you're taking <SpellLink spell={TALENTS.CRUSADING_STRIKES_TALENT} />, you
                  need to be extra careful about how you time your abilities that build{' '}
                  <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} /> so that you don't overcap.
                </Trans>
              </p>
            ) : null}
            {info.combatant.hasTalent(TALENTS.DIVINE_TOLL_TALENT) &&
            wastedHolyPowerPercentage > PERFECT_HOLY_POWER_CAP ? (
              <p>
                <Trans id="paladin.retribution.holyPower.divineToll">
                  Some of this might be attributable to the Judgments from{' '}
                  <SpellLink spell={TALENTS.DIVINE_TOLL_TALENT} />.
                </Trans>
              </p>
            ) : null}
            {info.combatant.hasTalent(TALENTS.DIVINE_RESONANCE_RETRIBUTION_TALENT) &&
            wastedHolyPowerPercentage > PERFECT_HOLY_POWER_CAP ? (
              <p>
                <Trans id="paladin.retribution.holyPower.divineResonance">
                  Some of this might be attributable to the free Judgments from{' '}
                  <SpellLink spell={TALENTS.DIVINE_RESONANCE_RETRIBUTION_TALENT} />.
                </Trans>
              </p>
            ) : null}
          </RoundedPanel>
          <RoundedPanel>
            <strong>
              <Trans id="paladin.retribution.holyPower.builderEffectiveness">
                <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} /> Builder Effectiveness
              </Trans>
            </strong>
            {modules.builderUse.chart}
          </RoundedPanel>
        </SideBySidePanels>
      </SubSection>
      {info.combatant.hasTalent(TALENTS.HOLY_FLAMES_TALENT) && (
        <SubSection
          title={t({
            id: 'paladin.retribution.subsection.buffsDebuffs',
            message: 'Buffs and debuffs',
          })}
        >
          {modules.expurgation.guideSubsection}
        </SubSection>
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
