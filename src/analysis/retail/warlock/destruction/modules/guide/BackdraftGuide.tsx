import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Backdraft from '../analyzers/Backdraft';
import { ReactNode } from 'react';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { PerformanceBoxRow, BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import SpellLink from 'interface/SpellLink';
import { SpellUse } from 'parser/core/SpellUsage/core';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

interface BackdraftGuideProps {
  analyzer: Backdraft;
  fightStart: number;
  fightEnd: number;
}

export function BackdraftGuide({ analyzer, fightStart, fightEnd }: BackdraftGuideProps): ReactNode {
  if (!analyzer) return null;

  const uses = analyzer.getSpellUsesWithPotentialMisses(fightStart, fightEnd);

  const boxes: BoxRowEntry[] = uses.map((use: SpellUse) => {
    return {
      value: use.performance,
      tooltip: use.performanceExplanation,
    };
  });

  const goodCount = uses.filter((u) => u.performance === QualitativePerformance.Good).length;
  const okCount = uses.filter((u) => u.performance === QualitativePerformance.Ok).length;
  const wastedCount = uses.filter((u) => u.performance === QualitativePerformance.Fail).length;

  const explanation = (
    <>
      <p>
        <Trans id="warlock.destruction.backdraftGuide.empowers">
          <SpellLink spell={SPELLS.BACKDRAFT} /> empowers your next Chaos Bolt, Incinerate, or Soul
          Fire casts.
        </Trans>
      </p>
      <small>
        <Trans id="warlock.destruction.backdraftGuide.preferSpending">
          Prefer spending stacks on <SpellLink spell={SPELLS.CHAOS_BOLT} /> or{' '}
          <SpellLink spell={TALENTS.SOUL_FIRE_TALENT} /> (green) over{' '}
          <SpellLink spell={SPELLS.INCINERATE} /> (yellow).
        </Trans>
      </small>
    </>
  );

  const data = (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SpellLink spell={SPELLS.BACKDRAFT} />
        <small>
          {' '}
          -{' '}
          {t({
            id: 'warlock.destruction.backdraftGuide.colorLegend',
            message: 'Green = optimal spender, Yellow = acceptable use, Red = wasted stacks.',
          })}
        </small>
      </div>

      <div style={{ marginBottom: 8 }}>
        <small>
          <span style={{ color: 'green' }}>
            {goodCount}{' '}
            {t({ id: 'warlock.destruction.backdraftGuide.optimal', message: 'optimal' })}
          </span>
          {' · '}
          <span style={{ color: 'orange' }}>
            {okCount}{' '}
            {t({ id: 'warlock.destruction.backdraftGuide.acceptable', message: 'acceptable' })}
          </span>
          {' · '}
          <span style={{ color: 'red' }}>
            {wastedCount}{' '}
            {t({ id: 'warlock.destruction.backdraftGuide.wasted', message: 'wasted' })}
          </span>
        </small>
      </div>

      <PerformanceBoxRow values={boxes} />
    </div>
  );

  return ExplanationAndDataSubSection({
    explanation,
    data,
  });
}
