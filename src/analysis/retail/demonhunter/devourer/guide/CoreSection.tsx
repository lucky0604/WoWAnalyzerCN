import { formatPercentage } from 'common/format';
import { GuideProps, Section, SubSection } from 'interface/guide';
import PerformanceStrong from 'interface/PerformanceStrong';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';
import CombatLogParser from '../CombatLogParser';
import SpellLink from 'interface/SpellLink';
import SPELLS from 'common/SPELLS';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

function CoreSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.demonhunter.devourer.sections.core.title',
        message: 'Core',
      })}
    >
      <SubSection
        title={t({
          id: 'guide.demonhunter.devourer.sections.core.activeTime.title',
          message: 'Active Time',
        })}
      >
        <p>
          <b>{t({ id: 'guide.demonhunter.devourer.sections.core.activeTime.summary.bold', message: 'Continuously casting throughout an encounter is the single most important thing for achieving good DPS.' })}</b>
          <div>
            {t({ id: 'guide.demonhunter.devourer.sections.core.activeTime.summary.rest', message: 'Some fights have unavoidable downtime due to phase transitions and the like, so in these cases 0% downtime will not be possible - do the best you can.' })}
          </div>
        </p>
        <p>
          {t({ id: 'guide.demonhunter.devourer.sections.core.activeTime.fillers.p1', message: 'Remember that you always have access to either ' })}
          <SpellLink spell={SPELLS.CONSUME} />
          {t({ id: 'guide.demonhunter.devourer.sections.core.activeTime.fillers.p2', message: ' or ' })}
          <SpellLink spell={SPELLS.DEVOUR} />
          {t({ id: 'guide.demonhunter.devourer.sections.core.activeTime.fillers.p3', message: ' and that they can be cast while moving.' })}
        </p>
        <p>
          <Trans id="guide.demonhunter.devourer.sections.core.activeTime.value">
            Active Time:{' '}
          </Trans>
          <PerformanceStrong performance={modules.alwaysBeCasting.DowntimePerformance}>
            {formatPercentage(modules.alwaysBeCasting.activeTimePercentage, 1)}%
          </PerformanceStrong>{' '}
        </p>
        <ActiveTimeGraph
          activeTimeSegments={modules.alwaysBeCasting.activeTimeSegments}
          fightStart={info.fightStart}
          fightEnd={info.fightEnd}
        />
      </SubSection>

      {modules.reap.guideSubsection()}
      {info.combatant.hasTalent(TALENTS_DEMON_HUNTER.VOID_RAY_TALENT) &&
        modules.voidRay.guideSubsection()}
    </Section>
  );
}

export default CoreSection;
