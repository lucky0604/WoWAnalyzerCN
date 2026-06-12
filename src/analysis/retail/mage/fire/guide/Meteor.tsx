import type { JSX } from 'react';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummary, { type CastEvaluation } from 'interface/guide/components/CastSummary';
import GuideSection from 'interface/guide/components/GuideSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import Meteor, { MeteorCasts } from '../talents/Meteor';
import { formatDurationMillisMinSec } from 'common/format';

class MeteorGuide extends Analyzer {
  static dependencies = {
    meteor: Meteor,
  };
  protected meteor!: Meteor;

  hasBurnout: boolean = this.selectedCombatant.hasTalent(TALENTS.BURNOUT_TALENT);
  hasBlastZone: boolean = this.selectedCombatant.hasTalent(TALENTS.BLAST_ZONE_TALENT);

  private evaluateMeteor(m: MeteorCasts): CastEvaluation {
    // FAIL CONDITIONS
    if (m.targetsHit === 0) {
      return {
        timestamp: m.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.meteorGuide.noTargetsHit',
          message: 'Meteor did not hit any targets.',
        }),
      };
    }

    if (!this.hasBlastZone && !m.landedDuringCombust) {
      return {
        timestamp: m.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.meteorGuide.notLandedDuringCombust',
          message: 'Meteor did not land inside of Combustion',
        }),
      };
    }

    // PERFECT CONDITIONS
    if (this.hasBurnout && m.landedDuringCombust && (m.timeTillCombustEnd ?? Infinity) < 8000) {
      return {
        timestamp: m.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: t({
          id: 'mage.fire.meteorGuide.landedWithinBurnout',
          message: 'Meteor landed within Burnout range ({0} until Combust Ends)',
        }).replace('{0}', formatDurationMillisMinSec(m.timeTillCombustEnd!)),
      };
    }

    // GOOD CONDITIONS
    if (this.hasBlastZone && !m.landedDuringCombust && m.timeTillCombust > 20000) {
      return {
        timestamp: m.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.fire.meteorGuide.goodMeteorCast',
          message: 'Good Meteor Cast',
        }),
      };
    }

    if (m.landedDuringCombust) {
      return {
        timestamp: m.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.fire.meteorGuide.landedDuringCombust',
          message: 'Meteor landed during Combustion.',
        }),
      };
    }

    // DEFAULT
    return {
      timestamp: m.cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: t({
        id: 'mage.fire.meteorGuide.unknownPerformance',
        message: 'Unknown Performance Condition (Please report this)',
      }),
    };
  }

  get guideSubsection(): JSX.Element {
    const meteor = <SpellLink spell={TALENTS.METEOR_TALENT} />;
    const combustion = <SpellLink spell={TALENTS.COMBUSTION_TALENT} />;
    const burnout = <SpellLink spell={TALENTS.BURNOUT_TALENT} />;
    const blastZone = <SpellLink spell={TALENTS.BLAST_ZONE_TALENT} />;

    const explanation = (
      <>
        <strong>{meteor}</strong>
        {t({
          id: 'mage.fire.meteorGuide.explanation.p1',
          message: ' is on somewhat of an awkward cooldown cadence, so it is primarily used to prop up your ',
        })}
        {combustion}
        {t({
          id: 'mage.fire.meteorGuide.explanation.p2',
          message: ' damage. As a result, you will often be holding ',
        })}
        {meteor}
        {t({
          id: 'mage.fire.meteorGuide.explanation.p3',
          message: ' to ensure it lines up with ',
        })}
        {combustion}
        {t({
          id: 'mage.fire.meteorGuide.explanation.p4',
          message: '. Refer to the below guidelines to get the most out of ',
        })}
        {meteor}
        {t({
          id: 'mage.fire.meteorGuide.explanation.p5',
          message: '.',
        })}
        <ul>
          <li>
            {t({
              id: 'mage.fire.meteorGuide.explanation.li1',
              message: 'Ensure you are aiming ',
            })}
            {meteor}
            {t({
              id: 'mage.fire.meteorGuide.explanation.li1a',
              message: ' so that it will hit your primary target and as many additional targets as possible.',
            })}
          </li>
          {this.hasBurnout && (
            <li>
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2',
                message: 'If you have ',
              })}
              {burnout}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2a',
                message: ', you should ensure ',
              })}
              {meteor}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2b',
                message: ' lands within 8 seconds of ',
              })}
              {combustion}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2c',
                message: ' ending, so the ',
              })}
              {burnout}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2d',
                message: " explosion includes ",
              })}
              {meteor}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li2e',
                message: "'s ignite contributions.",
              })}
            </li>
          )}
          {!this.hasBurnout && (
            <li>
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3',
                message: 'Without ',
              })}
              {burnout}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3a',
                message: ', you should cast ',
              })}
              {meteor}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3b',
                message: ' just before you activate ',
              })}
              {combustion}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3c',
                message: ', ensuring ',
              })}
              {meteor}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3d',
                message: ' lands after ',
              })}
              {combustion}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li3e',
                message: ' is activated.',
              })}
            </li>
          )}
          {this.hasBlastZone && (
            <li>
              {t({
                id: 'mage.fire.meteorGuide.explanation.li4',
                message: 'If you have ',
              })}
              {blastZone}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li4a',
                message: ', it is acceptable to cast ',
              })}
              {meteor}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li4b',
                message: ' outside of ',
              })}
              {combustion}
              {t({
                id: 'mage.fire.meteorGuide.explanation.li4c',
                message: ' as long as it will be available again for ',
              })}
              {combustion}
            </li>
          )}
        </ul>
      </>
    );

    return (
      <GuideSection spell={TALENTS.METEOR_TALENT} explanation={explanation}>
        <CastSummary
          spell={TALENTS.METEOR_TALENT}
          casts={this.meteor.meteors.map((m) => this.evaluateMeteor(m))}
          showBreakdown
        />
      </GuideSection>
    );
  }
}

export default MeteorGuide;
