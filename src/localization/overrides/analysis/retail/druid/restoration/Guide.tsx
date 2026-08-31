import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import { GapHighlight } from 'parser/ui/CooldownBar';

import CombatLogParser from './CombatLogParser';
import { TALENTS_DRUID } from 'common/TALENTS';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';
import {
  AdvancedGuideContextProvider,
  AdvancedGuideToggle,
  useAdvancedGuide,
} from './guide/AdvancedGuideContext';

/** Common 'rule line' point for the explanation/data in Core Spells section */
export const GUIDE_CORE_EXPLANATION_PERCENT = 40;

export default function Guide(props: GuideProps<typeof CombatLogParser>) {
  return (
    <AdvancedGuideContextProvider>
      <GuideContent {...props} />
    </AdvancedGuideContextProvider>
  );
}

function GuideContent({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const { isAdvanced } = useAdvancedGuide();

  return (
    <>
      <Section title={t({ id: 'restoration.alwaysBeCasting.title', message: 'Always Be Casting' })}>
        <FoundationDowntimeSectionV2 />
        {info.combatant.hasTalent(TALENTS_DRUID.MASTER_SHAPESHIFTER_TALENT) && (
          <p>
            {t({
              id: 'restoration.guide.ms.p1',
              message: 'During real downtime, cast ',
            })}
            <SpellLink spell={SPELLS.WRATH} />
            {t({ id: 'restoration.guide.ms.p2', message: ' to regenerate mana via ' })}
            <SpellLink spell={TALENTS_DRUID.MASTER_SHAPESHIFTER_TALENT} />
            {t({ id: 'restoration.guide.ms.p3', message: '. That mana funds extra ' })}
            <SpellLink spell={SPELLS.WILD_GROWTH} />
            {t({ id: 'restoration.guide.ms.p4', message: 's' })}
            {info.combatant.hasTalent(TALENTS_DRUID.ABUNDANCE_TALENT) ? (
              <>
                {t({
                  id: 'restoration.guide.ms_ab.p1',
                  message: '. If damage is persistently heavy, wait for ',
                })}
                <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />
                {t({
                  id: 'restoration.guide.ms_ab.p2',
                  message:
                    ' to drop before you spam Wrath. Wrath mid-Abundance cycle is much less efficient than spending those GCDs on ',
                })}
                <SpellLink spell={SPELLS.REGROWTH} />
              </>
            ) : null}
            .
          </p>
        )}
      </Section>
      <Section title={t({ id: 'restoration.coreSpells.title', message: 'Core Spells and Buffs' })}>
        <AdvancedGuideToggle />
        {modules.lifebloom.getGuideSubsection(isAdvanced)}
        {modules.swiftmend.guideSubsection}
        {modules.regrowthAndClearcasting.getGuideSubsection(isAdvanced)}
        {isAdvanced && modules.naturesSwiftness.guideSubsection}
        {modules.wildGrowth.guideSubsection}
        {!info.combatant.hasTalent(TALENTS_DRUID.LIFETREADING_TALENT) &&
          modules.efflorescence.guideSubsection}
        {isAdvanced && modules.rejuvenation.guideSubsection}
      </Section>
      <Section
        title={t({ id: 'restoration.healingCooldowns.title', message: 'Healing Cooldowns' })}
      >
        <p>
          {t({
            id: 'restoration.guide.cd.p1',
            message:
              'Resto Druids have access to a variety of powerful healing cooldowns. Use them frequently on dangerous damage. ',
          })}
          <SpellLink spell={SPELLS.TRANQUILITY_CAST} />
          {t({ id: 'restoration.guide.cd.p2', message: ' is your biggest window. Start ramping 15–20 seconds ahead with as many ' })}
          <SpellLink spell={SPELLS.REGROWTH} />
          {t({ id: 'restoration.guide.cd.p3', message: 's as you can, plus a ' })}
          <SpellLink spell={SPELLS.WILD_GROWTH} />
          {t({
            id: 'restoration.guide.cd.p4',
            message:
              ', so Flourish extends those HoTs. You should always have a Wild Growth out before activating a major cooldown.',
          })}
        </p>
        <HotGraphSubsection modules={modules} events={events} info={info} />
        <CooldownGraphSubsection modules={modules} events={events} info={info} />
        <CooldownBreakdownSubsection modules={modules} events={events} info={info} />
        <PreparationSection />
      </Section>
    </>
  );
}

function HotGraphSubsection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <SubSection>
      <strong>{t({ id: 'restoration.hotGraph.title', message: 'HoT Graph' })}</strong>{' '}
      {t({
        id: 'restoration.hotGraph.description',
        message:
          '- this graph shows how many Rejuvenation, Regrowth, and Wild Growths you had active over the course of the encounter, with rule lines showing when you activated your healing cooldowns. Did you have a Wild Growth out before every cooldown? For Tranquility, did you ramp a lot of Regrowths (not just Rejuvenations) before the channel?',
      })}
      {modules.hotCountGraph.plot}
    </SubSection>
  );
}

function CooldownGraphSubsection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <SubSection>
      <strong>{t({ id: 'restoration.cooldownGraph.title', message: 'Cooldown Graph' })}</strong>{' '}
      {t({ id: 'restoration.cooldownGraph.description', message: '- this graph shows when you used your cooldowns and how long you waited to use them again. Grey segments show when the spell was available, yellow segments show when the spell was cooling down. Red segments highlight times when you could have fit a whole extra use of the cooldown.' })}
      {info.combatant.hasTalent(TALENTS_DRUID.CONVOKE_THE_SPIRITS_TALENT) && (
        <CastEfficiencyBar
          spell={SPELLS.CONVOKE_SPIRITS}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
      {info.combatant.hasTalent(TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT) && (
        <CastEfficiencyBar
          spell={TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
      {info.combatant.hasTalent(TALENTS_DRUID.TRANQUILITY_TALENT) && (
        <CastEfficiencyBar
          spell={SPELLS.TRANQUILITY_CAST}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
      {info.combatant.hasTalent(TALENTS_DRUID.INNERVATE_TALENT) && (
        <CastEfficiencyBar
          spell={SPELLS.INNERVATE}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
    </SubSection>
  );
}

function CooldownBreakdownSubsection({
  modules,
  events,
  info,
}: GuideProps<typeof CombatLogParser>) {
  return (
    <SubSection>
      <strong>{t({ id: 'restoration.spellBreakdown.title', message: 'Spell Breakdowns' })}</strong>
      <p />
      {info.combatant.hasTalent(TALENTS_DRUID.CONVOKE_THE_SPIRITS_TALENT) &&
        modules.convokeSpirits.guideCastBreakdown}
      {info.combatant.hasTalent(TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT) &&
        modules.treeOfLife.guideCastBreakdown}
      {info.combatant.hasTalent(TALENTS_DRUID.TRANQUILITY_TALENT) &&
        modules.tranquility.guideCastBreakdown}
      {info.combatant.hasTalent(TALENTS_DRUID.INNERVATE_TALENT) &&
        modules.innervate.guideCastBreakdown}
    </SubSection>
  );
}
