import { TALENTS_MONK } from 'common/TALENTS';
import { Options } from 'parser/core/Module';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { t } from '@lingui/core/macro';
import {
  CastInfo,
  default as CommonCelestialConduit,
} from '../../../shared/hero/ConduitOfTheCelestials/talents/CelestialConduit';
import SpellLink from 'interface/SpellLink';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';

class CelestialConduit extends CommonCelestialConduit {
  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(
      TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT,
    );
  }

  private castEntries(casts: CastInfo[]): BoxRowEntry[] {
    const entries: BoxRowEntry[] = [];

    casts.forEach((cast) => {
      let value = QualitativePerformance.Fail;
      if (!cast.cancelled) {
        value = QualitativePerformance.Perfect;
      }

      entries.push({
        value,
      });
    });

    return entries;
  }

  get clipAnalysis() {
    return (
      <>
        <strong>
          <SpellLink spell={TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT} />{' '}
          {t({
            id: 'monk.windwalker.celestial_conduit.utilization',
            message: 'utilization',
          })}
        </strong>
        <div>
          <strong>
            {t({
              id: 'monk.windwalker.celestial_conduit.clip_analysis',
              message: 'Clip Analysis',
            })}{' '}
          </strong>
          <small>
            <>
              {t({
                id: 'monk.windwalker.celestial_conduit.blue_perfect.p1',
                message: '- Blue indicates a perfect cast (',
              })}
              <SpellLink spell={TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT} />
              {t({
                id: 'monk.windwalker.celestial_conduit.blue_perfect.p2',
                message: ' was channeled to completion)',
              })}
            </>
          </small>
          <PerformanceBoxRow values={this.castEntries(this.castInfoList)} />
        </div>
      </>
    );
  }

  get guideCastBreakdown() {
    const explanation = (
      <p>
        <>
          <SpellLink spell={TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT} />
          {t({
            id: 'monk.windwalker.celestial_conduit.explanation.p1',
            message: ' should be cast towards the end of a ',
          })}
          <SpellLink spell={TALENTS_MONK.HEART_OF_THE_JADE_SERPENT_TALENT} />
          {t({
            id: 'monk.windwalker.celestial_conduit.explanation.p2',
            message: ' window, so that the secondary cast of ',
          })}
          <SpellLink spell={TALENTS_MONK.UNITY_WITHIN_TALENT} />
          {t({
            id: 'monk.windwalker.celestial_conduit.explanation.p3',
            message:
              ' triggers a new window. The channel should always be fully completed when possible.',
          })}
        </>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>{this.clipAnalysis}</RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}

export default CelestialConduit;
