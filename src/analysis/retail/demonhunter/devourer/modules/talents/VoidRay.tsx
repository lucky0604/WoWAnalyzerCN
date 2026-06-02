import type { JSX, ReactNode } from 'react';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import Events, { CastEvent } from 'parser/core/Events';
import { getVoidRayDamageEvents } from '../../normalizers/VoidRayEventLinkNormalizer';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { VOID_RAY_MAX_TICKS } from '../../constants';
import { formatPercentage } from 'common/format';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
class VoidRay extends Analyzer {
  #voidRayEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.VOID_RAY_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_DEMON_HUNTER.VOID_RAY_TALENT),
      this.#onVoidRayCast,
    );
  }

  #onVoidRayCast(event: CastEvent) {
    const damageEvents = getVoidRayDamageEvents(event);

    let value = QualitativePerformance.Good;
    let tooltip: ReactNode = defineMessage({
      id: 'guide.demonhunter.devourer.voidRay.goodCast',
      message: 'Great! Fully channeled cast.',
    });

    // The last two damage ticks aren't needed to proc related talents
    if (damageEvents.length < VOID_RAY_MAX_TICKS - 2) {
      value = QualitativePerformance.Fail;
      tooltip = (
        <Trans id="guide.demonhunter.devourer.voidRay.incomplete">
          You didn't let this cast finish! (
          {formatPercentage(damageEvents.length / VOID_RAY_MAX_TICKS, 0)}%)
        </Trans>
      );
    }

    this.#voidRayEntries.push({ value, tooltip });
  }

  guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <Trans id="guide.demonhunter.devourer.voidRay.explanation">
            <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_RAY_TALENT} /> should always be fully
            channeled due to interactions it has with different talents:
          </Trans>
          <ul>
            {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.FINAL_BREATH_TALENT) && (
              <li>
                <Trans id="guide.demonhunter.devourer.voidRay.finalBreath">
                  The last tick deals increased damage thanks to{' '}
                  <SpellLink spell={TALENTS_DEMON_HUNTER.FINAL_BREATH_TALENT} />.
                </Trans>
              </li>
            )}
            {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.MOMENT_OF_CRAVING_TALENT) && (
              <li>
                <Trans id="guide.demonhunter.devourer.voidRay.momentOfCraving">
                  You get the very important{' '}
                  <SpellLink spell={TALENTS_DEMON_HUNTER.MOMENT_OF_CRAVING_TALENT} />
                  {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.ERADICATE_TALENT) && (
                    <>
                      {' '}
                      and <SpellLink spell={TALENTS_DEMON_HUNTER.ERADICATE_TALENT} />
                    </>
                  )}
                  .
                </Trans>
              </li>
            )}
            {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.VOIDFALL_TALENT) && (
              <li>
                <Trans id="guide.demonhunter.devourer.voidRay.voidfall">
                  As Annihilator, fully channeling grants a{' '}
                  <SpellLink spell={TALENTS_DEMON_HUNTER.VOIDFALL_TALENT} /> stack.
                </Trans>
              </li>
            )}
          </ul>
        </p>
      </>
    );
    const data = (
      <RoundedPanel>
        <CastSummaryAndBreakdown
          spell={TALENTS_DEMON_HUNTER.VOID_RAY_TALENT}
          castEntries={this.#voidRayEntries}
        />
      </RoundedPanel>
    );
    return (
      <ExplanationAndDataSubSection
        explanation={explanation}
        data={data}
        explanationPercent={GUIDE_CORE_EXPLANATION_PERCENT}
        title={t({
          id: 'guide.demonhunter.devourer.voidRay.title',
          message: 'Void Ray',
        })}
      />
    );
  }
}

export default VoidRay;
