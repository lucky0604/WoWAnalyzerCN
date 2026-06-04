import { t } from '@lingui/core/macro';
import { SubSection, GuideProps } from 'interface/guide';
import { PerformanceStrong } from './ExtraComponents';
import TALENTS from 'common/TALENTS/priest';
import { SpellLink } from 'interface';

import { formatPercentage } from 'common/format';
import CombatLogParser from 'analysis/retail/priest/shadow/CombatLogParser';

function ResourceSubsection({ modules }: GuideProps<typeof CombatLogParser>) {
  let perfect = false;
  if (modules.insanityUsage.wasted < 50) {
    perfect = true;
  }

  return (
    <SubSection>
      <p>
        {perfect && (
          <b>
            {t({
              id: 'priest.shadow.resourceSubsection.goodJob',
              message: 'Good job! You avoided overcapping insanity.',
            })}{' '}
            <SpellLink spell={TALENTS.SHADOW_WORD_MADNESS_TALENT} />
          </b>
        )}
        {!perfect && (
          <b>
            {t({
              id: 'priest.shadow.resourceSubsection.avoidCapping',
              message: 'You should avoid capping insanity.',
            })}{' '}
            <SpellLink spell={TALENTS.SHADOW_WORD_MADNESS_TALENT} />
          </b>
        )}
      </p>
      <p>
        {t({
          id: 'priest.shadow.resourceSubsection.wastedPrefix',
          message: 'You wasted',
        })}{' '}
        <PerformanceStrong performance={modules.insanityTracker.WastedInsanityPerformance}>
          {modules.insanityUsage.wasted} (
          {formatPercentage(modules.insanityUsage.wastePercentage, 1)}%)
        </PerformanceStrong>{' '}
        {t({
          id: 'priest.shadow.resourceSubsection.wastedSuffix',
          message:
            'of your Insanity. The chart below shows your Insanity over the course of the encounter.',
        })}
      </p>
      {modules.insanityGraph.plot}
    </SubSection>
  );
}

export default { ResourceSubsection };
