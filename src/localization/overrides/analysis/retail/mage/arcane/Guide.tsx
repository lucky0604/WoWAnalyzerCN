import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Section, GuideProps, SubSection } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import Explanation from 'interface/guide/components/Explanation';
import PerformanceStrong from 'interface/PerformanceStrong';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';

import { GapHighlight } from 'parser/ui/CooldownBar';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import MajorDefensives from 'src/analysis/retail/mage/shared/defensives/DefensivesGuide';

export const GUIDE_CORE_EXPLANATION_PERCENT = 50;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const alwaysBeCastingSubsection = (
    <SubSection title={t({ id: 'mage.arcane.subSection.activeTime', message: 'Active Time' })}>
      <Explanation>
        <>
          <>{t({ id: 'mage.arcane.activeTime.description.p1', message: 'Any time you are not casting something, that is damage that is lost. Mage has many ways to decrease downtime, such as using ' })}
            <SpellLink spell={SPELLS.BLINK} />
            {t({ id: 'mage.arcane.activeTime.description.p2', message: 'to get somewhere faster so you can continue casting or using' })}
            {' '}
            <SpellLink spell={TALENTS.SLIPSTREAM_TALENT} />
            {t({ id: 'mage.arcane.activeTime.description.p3', message: 'to cast/channel' })}
            {' '}
            <SpellLink spell={TALENTS.ARCANE_MISSILES_TALENT} />
            {t({ id: 'mage.arcane.activeTime.description.p4', message: 'or' })}
            {' '}
            <SpellLink spell={TALENTS.EVOCATION_TALENT} />
            {t({ id: 'mage.arcane.activeTime.description.p5', message: 'while you are moving; even phases where the only target is taking 99% reduced damage is an opportunity to fish for' })}
            {' '}
            <SpellLink spell={SPELLS.CLEARCASTING_BUFF} />
            {t({ id: 'mage.arcane.activeTime.description.p6', message: 'procs. While some encounters have forced downtime, which WoWAnalyzer does not account for, anything you can do to minimize your downtime will help your damage. Additionally, to better contextualize your downtime, we recommend comparing your downtime to another Arcane Mage that did better than you on the same encounter with roughly the same kill time. If you have less downtime than them, then maybe there is something you can do to improve.' })}
          </>
        </>
      </Explanation>
      <p>
        <Trans id="mage.arcane.activeTime.label">Active Time:</Trans>{' '}
        <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
          {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
        </PerformanceStrong>{' '}
        <Trans id="mage.arcane.cancelledCasts.label">Cancelled Casts:</Trans>{' '}
        <PerformanceStrong performance={modules.cancelledCasts.CancelledPerformance}>
          {formatPercentage(modules.cancelledCasts.cancelledPercentage, 1)}%
        </PerformanceStrong>{' '}
      </p>
      <ActiveTimeGraph
        activeTimeSegments={modules.alwaysBeCasting.activeTimeSegments}
        fightStart={info.fightStart}
        fightEnd={info.fightEnd}
      />
    </SubSection>
  );

  const manaLevelSubsection = modules.manaChart.guideSubsection;

  return (
    <>
      <Section title={t({ id: 'mage.arcane.section.preface', message: 'Preface & Disclaimers' })}>
        <p>
          <>{t({ id: 'mage.arcane.preface.description1.p1', message: 'The analysis in this guide is provided in collaboration with Porom and the rest of the staff of the ' })}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.arcane.preface.description1.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.arcane.preface.description1.p2', message: 'Mage Discord. When reviewing this information, keep in mind that WoWAnalyzer is limited to the information that is present in your combat log. As a result, we have no way of knowing if you were intentionally doing something suboptimal because the fight or strat required it (such as Forced Downtime or holding cooldowns for a burn phase). Because of this, we recommend comparing your analysis against a top 100 log for the same boss.' })}
          </>
        </p>
        <p>
          <>{t({ id: 'mage.arcane.preface.description2.p1', message: 'For additional assistance in improving your gameplay, or to have someone look more in depth at your combat logs, please visit the' })}
            {' '}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.arcane.preface.description2.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.arcane.preface.description2.p2', message: 'discord.' })}
          </>
        </p>
        <p>
          <>{t({ id: 'mage.arcane.preface.description3.p1', message: 'If you notice any issues or errors in this analysis ... or if there is additional analysis you would like added, please ping ' })}
            <code>{t({ id: 'mage.arcane.preface.description3.code', message: '@Sharrq' })}</code>
            {t({ id: 'mage.arcane.preface.description3.p2', message: 'in the' })}
            {' '}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.arcane.preface.description3.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.arcane.preface.description3.p3', message: 'discord.' })}
          </>
        </p>
      </Section>
      <Section title={t({ id: 'mage.arcane.section.core', message: 'Core' })}>
        {alwaysBeCastingSubsection}
        {manaLevelSubsection}
      </Section>

      <Section title={t({ id: 'mage.arcane.section.burnPhase', message: 'Burn Phase' })}>
        <>
          <>{t({ id: 'mage.arcane.burnPhase.description.p1', message: 'The Arcane Mage rotation is largely built around the balance between your burn phases and your conserve phases. The burn phases will occur every 45 seconds, alternating between a minor burn phase with only ' })}
            <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />
            {t({ id: 'mage.arcane.burnPhase.description.p2', message: 'and a major burn phase with both ' })}
            <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />
            {t({ id: 'mage.arcane.burnPhase.description.p3', message: 'and ' })}
            <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />
            {t({ id: 'mage.arcane.burnPhase.description.p4', message: '. In order to get the most out of those burn phases, you should stack as many damage amplifiers as you can into those burn phases, the major burn phase in particular. Additionally the 45 second cooldown on ' })}
            <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />
            {t({ id: 'mage.arcane.burnPhase.description.p5', message: 'and the 90 second cooldown on ' })}
            <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />
            {t({ id: 'mage.arcane.burnPhase.description.p6', message: 'will mean that it is very important that you are using those two cooldowns as quickly as possible to prevent them from getting offset.' })}
          </>
        </>

        {info.combatant.hasTalent(TALENTS.ARCANE_SURGE_TALENT) &&
          modules.arcaneSurgeGuide.guideSubsection}
        {info.combatant.hasTalent(TALENTS.TOUCH_OF_THE_MAGI_TALENT) &&
          modules.touchOfTheMagiGuide.guideSubsection}
      </Section>
      <Section
        title={t({
          id: 'mage.arcane.section.rotationalAbilities',
          message: 'Rotational Abilities',
        })}
      >
        <>
          <Trans id="mage.arcane.rotationalAbilities.description">
            Arcane Mage generally revolves around your major and minor burn phases, but your other
            rotational abilities also contribute to your damage and, in most cases, help set you up
            for your burn phases so you can get the most out of them.
          </Trans>
        </>
        {modules.arcaneMissilesGuide.guideSubsection}
        {modules.prismaticBoltGuide.guideSubsection}
        {modules.arcaneBarrageGuide.guideSubsection}
        {modules.arcaneOrbGuide.guideSubsection}
        {info.combatant.hasTalent(TALENTS.PRESENCE_OF_MIND_TALENT) &&
          modules.presenceOfMindGuide.guideSubsection}
      </Section>
      <Section title={t({ id: 'mage.arcane.section.cooldowns', message: 'Cooldowns' })}>
        <>
          <>{t({ id: 'mage.arcane.cooldowns.description.p1', message: 'As is the case with most damage specs, properly utilizing your damage cooldowns will go a long way towards improving your overall damage, especially' })}
            {' '}
            <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />
            {t({ id: 'mage.arcane.cooldowns.description.p2', message: '.' })}
          </>
        </>
        <CastEfficiencyBar
          spell={TALENTS.ARCANE_SURGE_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
        <CastEfficiencyBar
          spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
        {info.combatant.hasTalent(TALENTS.ARCANE_ORB_TALENT) && (
          <CastEfficiencyBar
            spell={SPELLS.ARCANE_ORB}
            gapHighlightMode={GapHighlight.FullCooldown}
            minimizeIcons
            showExplanation
          />
        )}
        {info.combatant.hasTalent(TALENTS.PRESENCE_OF_MIND_TALENT) && (
          <CastEfficiencyBar
            spell={TALENTS.PRESENCE_OF_MIND_TALENT}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
        {info.combatant.hasTalent(TALENTS.EVOCATION_TALENT) && (
          <CastEfficiencyBar
            spell={TALENTS.EVOCATION_TALENT}
            gapHighlightMode={GapHighlight.FullCooldown}
            useThresholds
          />
        )}
      </Section>
      <MajorDefensives />
      <PreparationSection />
    </>
  );
}
