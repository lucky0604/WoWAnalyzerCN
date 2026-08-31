import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellIcon, SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import SPELLS from 'common/SPELLS';
import CombatLogParser from '../mistweaver/CombatLogParser';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import * as AplCheck from './modules/core/apl/AplCheck';
import AplChoiceDescription from './modules/core/apl/AplChoiceDescription';
import { AplSectionData } from 'interface/guide/components/Apl';
import { defaultExplainers } from 'interface/guide/components/Apl/violations/claims';
import { filterCelestial } from './modules/core/apl/ExplainCelestial';
import { getCurrentCelestialTalent, getCurrentRSKTalent } from './constants';

const explainers = {
  overcast: filterCelestial(defaultExplainers.overcastFillers),
  dropped: filterCelestial(defaultExplainers.droppedRule),
};
/** Common 'rule line' point for the explanation/data in Core Spells section */
export const GUIDE_CORE_EXPLANATION_PERCENT = 40;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section
        title={t({ id: 'monk.mistweaver.section.coreSpells', message: 'Core Spells and Buffs' })}
      >
        {modules.renewingMist.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.RISING_MIST_TALENT) &&
          modules.risingSunKick.guideSubsection}
        {modules.thunderFocusTea.guideSubsection}
        {!info.combatant.hasTalent(TALENTS_MONK.SHEILUNS_GIFT_TALENT) &&
          modules.vivify.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.SHEILUNS_GIFT_TALENT) && (
          <SheilunsGraph modules={modules} events={events} info={info} />
        )}
        {info.combatant.hasTalent(TALENTS_MONK.ASPECT_OF_HARMONY_TALENT) &&
          modules.aspectOfHarmony.guideSubsection}
        <RemGraphSubsection modules={modules} events={events} info={info} />
      </Section>
      <Section
        title={t({ id: 'monk.mistweaver.section.healingCooldowns', message: 'Healing Cooldowns' })}
      >
        <CooldownGraphSubsection modules={modules} events={events} info={info} />
        {info.combatant.hasTalent(TALENTS_MONK.INVOKE_CHI_JI_THE_RED_CRANE_TALENT)
          ? modules.invokeChiJi.guideCastBreakdown
          : modules.invokeYulon.guideCastBreakdown}
        {info.combatant.hasTalent(TALENTS_MONK.JADE_BOND_TALENT) &&
          modules.revival.guideCastBreakdown}
        {info.combatant.hasTalent(TALENTS_MONK.CELESTIAL_CONDUIT_MISTWEAVER_TALENT) &&
          modules.celestialConduit.guideCastBreakdown}
        <HotGraphSubsection modules={modules} events={events} info={info} />
      </Section>
      <Section title={t({ id: 'monk.mistweaver.section.coreRotation', message: 'Core Rotation' })}>
        <p>
          <Trans id="monk.mistweaver.coreRotation.description1">
            Healers do not have a static rotation, but Mistweaver gameplay is still driven by a
            priority list that is valid in the majority of situations. When using an ability, aim to
            use the abilities that are highest on the list.
          </Trans>
        </p>
        <AplChoiceDescription aplChoice={AplCheck.chooseApl(info)} />
        <p>
          <strong>
            <>{t({ id: 'monk.mistweaver.coreRotation.description2.p1', message: 'It is important to note that using abilites like' })}
              {' '}
              <SpellLink spell={getCurrentCelestialTalent(info.combatant)} />
              {t({ id: 'monk.mistweaver.coreRotation.description2.p2', message: 'have their own priority that supercedes the priority list below. This section omits all casts in those windows.' })}
            </>
          </strong>
        </p>
        <SubSection>
          <AplSectionData
            checker={AplCheck.check}
            apl={AplCheck.apl(info)}
            violationExplainers={explainers}
          />
        </SubSection>
      </Section>
      <Section
        title={t({
          id: 'monk.mistweaver.section.otherCooldowns',
          message: 'Other cooldowns, buffs, and procs',
        })}
      >
        {info.combatant.hasTalent(TALENTS_MONK.LIFE_COCOON_TALENT) &&
          modules.lifeCocoon.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.VIVACIOUS_VIVIFICATION_TALENT) &&
          modules.vivaciousVivification.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.ZEN_PULSE_TALENT) &&
          modules.zenPulse.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.SPIRITFONT_1_MISTWEAVER_TALENT) &&
          modules.spiritfont.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.STRENGTH_OF_THE_BLACK_OX_TALENT) &&
          modules.strengthOfTheBlackOx.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.DANCE_OF_CHI_JI_MISTWEAVER_TALENT) &&
          modules.danceOfChiJi.guideSubsection}
      </Section>
      <PreparationSection />
    </>
  );
}

function HotGraphSubsection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <SubSection>
      <strong>{t({ id: 'monk.mistweaver.hotGraph.title', message: 'Healing Amp Graph' })}</strong>
      <Trans id="monk.mistweaver.hotGraph.description">
        - This graph shows the number of non-Renewing Mist healing amps you had active over the
        course of the encounter. It can help you evaluate how effective you were at prepping and
        executing your cooldowns.
      </Trans>
      {modules.hotCountGraph.plot}
    </SubSection>
  );
}

function RemGraphSubsection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <SubSection>
      <strong>
        <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
      </strong>{' '}
      <>{t({ id: 'monk.mistweaver.remGraph.description.p1', message: '- this graph shows how many ' })}
        <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
        {t({ id: 'monk.mistweaver.remGraph.description.p2', message: 'you have over the course of the fight in relation to your' })}
        {' '}
        <SpellLink spell={getCurrentRSKTalent(info.combatant)} />
        {t({ id: 'monk.mistweaver.remGraph.description.p3', message: 'and' })}
        {' '}
        <SpellLink spell={SPELLS.VIVIFY} />
        {t({ id: 'monk.mistweaver.remGraph.description.p4', message: 'casts.' })}
      </>
      {modules.remGraph.plot}
    </SubSection>
  );
}

function SheilunsGraph({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const styleObj = {
    fontSize: 20,
  };
  const styleObjInner = {
    fontSize: 15,
  };
  const explanation = (
    <>
      <p>
        <b>
          <SpellLink spell={TALENTS_MONK.SHEILUNS_GIFT_TALENT} />
        </b>{' '}
        <>{t({ id: 'monk.mistweaver.sheilunsGift.description.p1', message: 'is a potent AoE group heal. If talented into' })}
          {' '}
          <SpellLink spell={TALENTS_MONK.VEIL_OF_PRIDE_TALENT} />
          {t({ id: 'monk.mistweaver.sheilunsGift.description.p2', message: ', then try to cast' })}
          {' '}
          <SpellLink spell={TALENTS_MONK.SHEILUNS_GIFT_TALENT} />
          {t({ id: 'monk.mistweaver.sheilunsGift.description.p3', message: 'as a powerful spot heal when you have at least 4 stacks, while trying to avoid excessive overhealing.' })}
        </>
      </p>
    </>
  );

  const data = (
    <div>
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_MONK.SHEILUNS_GIFT_TALENT} />{' '}
            {t({ id: 'monk.mistweaver.sheilunsGift.cloudEfficiency', message: 'cloud efficiency' })}
          </strong>
          {modules.sheilunsGiftCloudGraph.plot}
        </RoundedPanel>
      </div>
      <RoundedPanel>
        <div style={styleObj}>
          <SpellIcon spell={TALENTS_MONK.SHEILUNS_GIFT_TALENT} style={{ height: '28px' }} />{' '}
          <b>{modules.sheilunsGift.cloudsLost}</b>{' '}
          <small style={styleObjInner}>
            {t({ id: 'monk.mistweaver.sheilunsGift.cloudsWasted', message: 'clouds wasted' })}
          </small>
        </div>
      </RoundedPanel>
    </div>
  );

  return (
    <SubSection>
      {explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT)}
    </SubSection>
  );
}

function CooldownGraphSubsection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const invokeSpell = info.combatant.hasTalent(TALENTS_MONK.INVOKE_CHI_JI_THE_RED_CRANE_TALENT)
    ? TALENTS_MONK.INVOKE_CHI_JI_THE_RED_CRANE_TALENT
    : TALENTS_MONK.INVOKE_YULON_THE_JADE_SERPENT_TALENT;
  return (
    <SubSection>
      <strong>{t({ id: 'monk.mistweaver.cooldownGraph.title', message: 'Cooldown Graph' })}</strong>
      <Trans id="monk.mistweaver.cooldownGraph.description">
        - this graph shows when you used your cooldowns and how long you waited to use them again.
        Grey segments show when the spell was available, yellow segments show when the spell was
        cooling down. Red segments highlight times when you could have fit a whole extra use of the
        cooldown.
      </Trans>
      <CastEfficiencyBar
        spell={invokeSpell}
        gapHighlightMode={GapHighlight.FullCooldown}
        useThresholds
      />
      <CastEfficiencyBar
        spell={
          info.combatant.hasTalent(TALENTS_MONK.RESTORAL_TALENT)
            ? TALENTS_MONK.RESTORAL_TALENT
            : TALENTS_MONK.REVIVAL_TALENT
        }
        gapHighlightMode={GapHighlight.FullCooldown}
        useThresholds
      />
      {info.combatant.hasTalent(TALENTS_MONK.CELESTIAL_CONDUIT_MISTWEAVER_TALENT) && (
        <CastEfficiencyBar
          spell={TALENTS_MONK.CELESTIAL_CONDUIT_MISTWEAVER_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
    </SubSection>
  );
}
