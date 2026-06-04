import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS/rogue';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import SpellLink from 'interface/SpellLink';
import { HideGoodCastsSpellUsageSubSection } from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import { createSpellUse } from 'parser/core/MajorCooldowns/MajorCooldown';
import { SpellUse } from 'parser/core/SpellUsage/core';

export default class Eviscerate extends Analyzer {
  private cooldownUses: SpellUse[] = [];

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.EVISCERATE), this.onCast);
  }

  get guideSubsection() {
    const explanation = (
      <p>
        <strong>
          <SpellLink spell={SPELLS.EVISCERATE} />
        </strong>{' '}
        {t({ id: 'rogue.subtlety.eviscerate.explanation', message: 'is your primary single-target finisher. Always aim to cast it at' })}{' '}
        <strong>5+ Combo Points</strong>{' '}
        {t({ id: 'rogue.subtlety.eviscerate.explanationSuffix', message: 'to maximize damage efficiency.' })}
      </p>
    );

    const goodCasts = this.cooldownUses.filter(
      (it) => it.performance === QualitativePerformance.Good,
    ).length;
    const totalCasts = this.cooldownUses.length;

    return (
      <HideGoodCastsSpellUsageSubSection
        hideGoodCasts
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={<> - {t({ id: 'rogue.subtlety.eviscerate.redIsBadCast', message: 'Red is a bad cast.' })}</>}
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            <CastPerformanceSummary
              spell={SPELLS.EVISCERATE}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: t({ id: 'rogue.subtlety.eviscerate.allGoodCasts', message: 'All of your casts of this spell were good!' }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    this.cooldownUses.push(createSpellUse({ event }, []));
  }
}
