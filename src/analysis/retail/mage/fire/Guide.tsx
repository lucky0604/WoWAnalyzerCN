import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Section, GuideProps, SubSection } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import Explanation from 'interface/guide/components/Explanation';
import PerformanceStrong from 'interface/PerformanceStrong';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import MajorDefensives from 'src/analysis/retail/mage/shared/defensives/DefensivesGuide';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const alwaysBeCastingSubsection = (
    <SubSection title={t({ id: 'mage.fire.subSection.activeTime', message: 'Active Time' })}>
      <Explanation>
        <>
          {t({
            id: 'mage.fire.activeTime.description.p1',
            message: 'Any time you are not casting something, that is damage that is lost. You should always pre-plan your movement to decrease downtime, but can also lean on abilties like ',
          })}
          {info.combatant.hasTalent(TALENTS.SHIMMER_TALENT) ? (
            <SpellLink spell={TALENTS.SHIMMER_TALENT} />
          ) : (
            <SpellLink spell={SPELLS.BLINK} />
          )}
          {t({
            id: 'mage.fire.activeTime.description.p2',
            message: ' to move faster or ',
          })}
          <SpellLink spell={TALENTS.SCORCH_TALENT} />
          {t({
            id: 'mage.fire.activeTime.description.p3',
            message: ' to continue casting while you move. While some encounters have forced downtime, which WoWAnalyzer does not account for, anything you can do to minimize your downtime will help your damage; even casting against a target taking 99% reduced damage is an opportunity to fish for procs. Additionally, to better contextualize your downtime, we recommend comparing your downtime to another Fire Mage that did better than you on the same encounter with roughly the same kill time. If you have less downtime than them, then maybe there is something you can do to improve.',
          })}
        </>
      </Explanation>
      <p>
        {t({ id: 'mage.fire.activeTime.label', message: 'Active Time:' })}{' '}
        <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
          {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
        </PerformanceStrong>{' '}
        {t({ id: 'mage.fire.cancelledCasts.label', message: 'Cancelled Casts:' })}{' '}
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

  return (
    <>
      <Section title={t({ id: 'mage.fire.section.preface', message: 'Preface & Disclaimers' })}>
        <p>
          <>{t({ id: 'mage.fire.preface.description1.p1', message: 'The analysis in this guide is provided in collaboration with Degenhours and the rest of the staff of the ' })}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.fire.preface.description1.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.fire.preface.description1.p2', message: 'Mage Discord. When reviewing this information, keep in mind that WoWAnalyzer is limited to the information that is present in your combat log. As a result, we have no way of knowing if you were intentionally doing something suboptimal because the fight or strat required it (such as Forced Downtime or holding cooldowns for a burn phase). Because of this, we recommend comparing your analysis against a top 100 log for the same boss.' })}
          </>
        </p>
        <p>
          <>{t({ id: 'mage.fire.preface.description2.p1', message: 'For additional assistance in improving your gameplay, or to have someone look more in depth at your combat logs, please visit the' })}
            {' '}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.fire.preface.description2.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.fire.preface.description2.p2', message: 'discord.' })}
          </>
        </p>
        <p>
          <>{t({ id: 'mage.fire.preface.description3.p1', message: 'If you notice any issues or errors in this analysis ... or if there is additional analysis you would like added, please ping ' })}
            <code>{t({ id: 'mage.fire.preface.description3.code', message: '@Sharrq' })}</code>
            {t({ id: 'mage.fire.preface.description3.p2', message: 'in the' })}
            {' '}
            <a href="https://discord.gg/makGfZA">{t({ id: 'mage.fire.preface.description3.a', message: 'Altered Time' })}</a>
            {t({ id: 'mage.fire.preface.description3.p3', message: 'discord.' })}
          </>
        </p>
      </Section>
      <Section title={t({ id: 'mage.fire.section.core', message: 'Core' })}>{alwaysBeCastingSubsection}</Section>
      <Section title={t({ id: 'mage.fire.section.heatingUpAndHotStreak', message: 'Heating Up & Hot Streak' })}>
        <>
          <>
            {t({
              id: 'mage.fire.heatingUpAndHotStreak.description.p1',
              message: 'As a Fire Mage, the vast majority of your rotation revolves around generating, managing, and spending your ',
            })}
            <SpellLink spell={SPELLS.HEATING_UP} />
            {t({
              id: 'mage.fire.heatingUpAndHotStreak.description.p2',
              message: ' and ',
            })}
            <SpellLink spell={SPELLS.HOT_STREAK} />
            {t({
              id: 'mage.fire.heatingUpAndHotStreak.description.p3',
              message: ' procs. Regardless of whether ',
            })}
            <SpellLink spell={TALENTS.COMBUSTION_TALENT} />
            {t({
              id: 'mage.fire.heatingUpAndHotStreak.description.p4',
              message: ' is active or not, learning to properly utilize your procs will go a long way towards increasing your damage.',
            })}
          </>
        </>
        {modules.heatingUpGuide.guideSubsection}
        {modules.hotStreakGuide.guideSubsection}
      </Section>

      <Section title={t({ id: 'mage.fire.section.buffsAndProcs', message: 'Buffs & Procs' })}>
        <>
          <>
            {t({
              id: 'mage.fire.buffsAndProcs.description.p1',
              message: 'Fire Mage has several buffs and procs that need to be managed properly in order to get the most out of them and maximize your damage. ',
            })}
            <SpellLink spell={SPELLS.HOT_STREAK} />
            {t({
              id: 'mage.fire.buffsAndProcs.description.p2',
              message: ' and ',
            })}
            <SpellLink spell={SPELLS.HEATING_UP} />
            {t({
              id: 'mage.fire.buffsAndProcs.description.p3',
              message: ' are your most important procs, but others such as ',
            })}
            <SpellLink spell={TALENTS.HEAT_SHIMMER_TALENT} />
            {t({
              id: 'mage.fire.buffsAndProcs.description.p4',
              message: ' will also increase your damage in other ways which will play a large part in maximizing your overall and burst damage.',
            })}
          </>
        </>
        {info.combatant.hasTalent(TALENTS.HEAT_SHIMMER_TALENT) &&
          modules.heatShimmerGuide.guideSubsection}
      </Section>

      <Section title={t({ id: 'mage.fire.section.cooldowns', message: 'Cooldowns' })}>
        <>
          <>
            {t({
              id: 'mage.fire.cooldowns.description.p1',
              message: 'As is the case with most damage specs, properly utilizing your damage cooldowns will go a long way towards improving your overall damage, especially ',
            })}
            <SpellLink spell={TALENTS.COMBUSTION_TALENT} />
            {t({
              id: 'mage.fire.cooldowns.description.p2',
              message: '.',
            })}
          </>
        </>
        {info.combatant.hasTalent(TALENTS.COMBUSTION_TALENT) &&
          modules.combustionGuide.guideSubsection}
      </Section>

      <Section title={t({ id: 'mage.fire.section.talents', message: 'Talents' })}>
        {info.combatant.hasTalent(TALENTS.METEOR_TALENT) && modules.meteorGuide.guideSubsection}
      </Section>

      <SubSection title={t({ id: 'mage.fire.subSection.castEfficiency', message: 'Cast Efficiency' })}></SubSection>
      {info.combatant.hasTalent(TALENTS.COMBUSTION_TALENT) && (
        <CastEfficiencyBar
          spell={TALENTS.COMBUSTION_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
      {info.combatant.hasTalent(TALENTS.METEOR_TALENT) && (
        <CastEfficiencyBar
          spell={TALENTS.METEOR_TALENT}
          gapHighlightMode={GapHighlight.FullCooldown}
          useThresholds
        />
      )}
      <MajorDefensives />
      <PreparationSection />
    </>
  );
}
