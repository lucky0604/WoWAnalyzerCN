import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Section, GuideProps, SubSection } from 'interface/guide';
import CombatLogParser from './CombatLogParser';
import Explanation from 'interface/guide/components/Explanation';
import PerformanceStrong from 'interface/PerformanceStrong';
import { formatPercentage } from 'common/format';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import { SpellLink } from 'interface';
import TALENTS from 'common/TALENTS/mage';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import MajorDefensives from 'src/analysis/retail/mage/shared/defensives/DefensivesGuide';

export const GUIDE_CORE_EXPLANATION_PERCENT = 50;

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const alwaysBeCastingSubsection = (
    <SubSection title={t({ id: 'mage.frost.subSection.activeTime', message: 'Active Time' })}>
      <Explanation>
        <b>
          <Trans id="mage.frost.activeTime.title">
            Continuously casting throughout an encounter is the single most important thing for
            achieving good DPS as a caster.
          </Trans>
        </b>
        <p>
          <Trans id="mage.frost.activeTime.description1">
            As mages we have <SpellLink spell={TALENTS.SHIMMER_TALENT} /> to continue casting while
            dealing with mechanics that require movement.
          </Trans>
        </p>
        <p>
          <Trans id="mage.frost.activeTime.description2">
            Some fights have unavoidable downtime, so in these cases 0% downtime will not be
            possible. In encounters with long downtime you can compare your Active Time with some of
            the top logs to see if you can improve.
          </Trans>
        </p>
      </Explanation>
      <p>
        {t({ id: 'mage.frost.activeTime.label', message: 'Active Time:' })}{' '}
        <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
          {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
        </PerformanceStrong>{' '}
        {t({ id: 'mage.frost.cancelledCasts.label', message: 'Cancelled Casts:' })}{' '}
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
      <Section title={t({ id: 'mage.frost.section.core', message: 'Core' })}>
        <HideExplanationsToggle id="hide-explanations-core" />
        {alwaysBeCastingSubsection}
        {modules.iceLance.guideSubsection}
        {modules.flurry.guideSubsection}
      </Section>
      <Section title={t({ id: 'mage.frost.section.procs', message: 'Procs' })}>
        <HideExplanationsToggle id="hide-explanations-procs" />
        {info.combatant.hasTalent(TALENTS.BRAIN_FREEZE_TALENT) &&
          modules.brainFreeze.guideSubsection}
        {info.combatant.hasTalent(TALENTS.FINGERS_OF_FROST_TALENT) &&
          modules.fingersOfFrost.guideSubsection}
      </Section>
      <Section title={t({ id: 'mage.frost.section.cooldowns', message: 'Cooldowns' })}>
        <HideExplanationsToggle id="hide-explanations-cooldowns" />
        {info.combatant.hasTalent(TALENTS.RAY_OF_FROST_TALENT) &&
          modules.rayOfFrost.guideSubsection}
        {info.combatant.hasTalent(TALENTS.COMET_STORM_TALENT) && modules.cometStorm.guideSubsection}
      </Section>
      <MajorDefensives />
      <PreparationSection />
    </>
  );
}
