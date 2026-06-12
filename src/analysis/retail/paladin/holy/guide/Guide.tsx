import { t } from '@lingui/core/macro';
import { GuideProps, Section, SubSection } from 'interface/guide';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import CombatLogParser from '../CombatLogParser';
import CooldownGraphSubsection from './CooldownGraphSubsection';
import { ResourceLink, SpellLink } from 'interface';
import talents from 'common/TALENTS/paladin';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SPELLS from 'common/SPELLS';

/** Common 'rule line' point for the explanation/data in Core Spells section */
export const GUIDE_CORE_EXPLANATION_PERCENT = 40;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <CoreSection modules={modules} info={info} events={events} />
      <Section title={t({ id: 'paladin.holy.section.healingCooldowns', message: 'Healing cooldowns' })}>
        <CooldownGraphSubsection />
      </Section>
      <PreparationSection />
    </>
  );
}

const CoreSection = ({ modules, info, events }: GuideProps<typeof CombatLogParser>) => {
  const holyPowerWasted = modules.holyPowerTracker.wasted;
  return (
    <Section title={t({ id: 'paladin.holy.section.core', message: 'Core' })}>
      {modules.holyShock.guideSubsection}
      {modules.judgment.guideSubsection}
      {info.combatant.hasTalent(talents.HOLY_PRISM_TALENT) && modules.holyPrism.guideSubsection}
      {info.combatant.hasTalent(talents.BEACON_OF_VIRTUE_TALENT)
        ? modules.beaconOfVirtue.guideSubsection
        : modules.beaconUptime.guideSubsection}

      <SubSection title={t({ id: 'paladin.holy.subsection.holyPower', message: 'Holy Power' })}>
        <>
          <p>
            {t({ id: 'paladin.holy.holyPower.description.p1', message: 'Since ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.holy.holyPower.description.p2', message: " spenders are so impactful, minimizing waste should be a priority. " })}
            {info.combatant.hasTalent(talents.ETERNAL_FLAME_TALENT) ? (
              <SpellLink spell={talents.ETERNAL_FLAME_TALENT} />
            ) : (
              <SpellLink spell={SPELLS.WORD_OF_GLORY} />
            )}
            {t({ id: 'paladin.holy.holyPower.description.p3', message: ' is often the most reliable choice when deciding which ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.holy.holyPower.description.p4', message: ' spender to use. As a general rule of thumb, if casting ' })}
            {info.combatant.hasTalent(talents.ETERNAL_FLAME_TALENT) ? (
              <SpellLink spell={talents.ETERNAL_FLAME_TALENT} />
            ) : (
              <SpellLink spell={SPELLS.WORD_OF_GLORY} />
            )}
            {t({ id: 'paladin.holy.holyPower.description.p5', message: " won't result in significant overhealing, it's usually the best option. This is because " })}
            <SpellLink spell={talents.LIGHT_OF_DAWN_TALENT} />
            {t({ id: 'paladin.holy.holyPower.description.p6', message: ' tends to overheal and targets allies randomly, making it less effective.' })}
          </p>
        </>
        <>
          <p>
            {t({ id: 'paladin.holy.holyPower.usage.p1', message: 'When using ' })}
            {info.combatant.hasTalent(talents.ETERNAL_FLAME_TALENT) ? (
              <SpellLink spell={talents.ETERNAL_FLAME_TALENT} />
            ) : (
              <SpellLink spell={SPELLS.WORD_OF_GLORY} />
            )}
            {t({ id: 'paladin.holy.holyPower.usage.p2', message: ', try to avoid targeting your Beaconed allies unless they are in immediate danger of dying. If there is no healing needed, don\'t hesitate to use ' })}
            <SpellLink spell={SPELLS.SHIELD_OF_THE_RIGHTEOUS} />
            {t({ id: 'paladin.holy.holyPower.usage.p3', message: ' to avoid capping on ' })}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.holy.holyPower.usage.p4', message: '.' })}
          </p>
        </>
        <>
          <p>
            {t({ id: 'paladin.holy.holyPower.wasted.p1', message: 'You wasted ' })}
            <strong>{t({ id: 'paladin.holy.holyPower.wasted.count', message: '{count}', values: { count: holyPowerWasted }})}</strong>
            {' '}
            <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
            {t({ id: 'paladin.holy.holyPower.wasted.p2', message: '.' })}
          </p>
        </>
        {modules.holyPowerGraph.plot}
      </SubSection>
    </Section>
  );
};
