import { type JSX } from 'react';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Analyzer from 'parser/core/Analyzer';
import GuideSection from 'interface/guide/components/GuideSection';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import CastOverview from 'interface/guide/components/CastOverview';
import { TipBox } from 'interface/guide/components';

import ArcaneOrb, { ArcaneOrbCast } from '../analyzers/ArcaneOrb';
import { CastDetail, PerCastData, type PerCastStat } from 'interface/guide/components';

class ArcaneOrbGuide extends Analyzer {
  static dependencies = {
    arcaneOrb: ArcaneOrb,
  };

  protected arcaneOrb!: ArcaneOrb;

  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);

  private evaluateOrbCast(cast: ArcaneOrbCast): CastEvaluation {
    const hitTargets = cast.targetsHit > 0;

    // FAIL CONDITIONS
    if (!hitTargets) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: 'Arcane Orb did not hit any targets.',
      };
    }

    if (this.isSunfury && cast.chargesBefore >= 2) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Had ${cast.chargesBefore} Arcane Charges before Arcane Orb.`,
      };
    }

    if (this.isSpellslinger && cast.chargesBefore === 4 && cast.targetsHit < 2) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `You already had 4 Arcane Charges when you cast Arcane Orb and hit ${cast.targetsHit} targets.`,
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslinger && cast.targetsHit >= 2) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `You hit ${cast.targetsHit} targets.`,
      };
    }

    if (this.isSpellslinger && cast.chargesBefore < 4) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had ${cast.chargesBefore} Arcane Charges before Arcane Orb.`,
      };
    }

    if (this.isSunfury && cast.chargesBefore === 0) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had no Arcane Charges before Arcane Orb.`,
      };
    }

    // OK CONDITIONS
    if (this.isSunfury && cast.chargesBefore > 0) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Had ${cast.chargesBefore} Arcane Charges before Arcane Orb.`,
      };
    }

    // DEFAULT
    return {
      timestamp: cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: `Unknown performance condition. Please report this!`,
    };
  }

  get guideSubsection(): JSX.Element {
    const arcaneOrb = <SpellLink spell={SPELLS.ARCANE_ORB} />;
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;

    const explanation = (
      <>
        <p>
          <b>{arcaneOrb}</b>
          {t({
            id: 'mage.arcane.arcaneOrb.guide.explanation.p1',
            message:
              "'s primary purpose is to quickly generate ",
          })}
          {arcaneCharge}
          {t({
            id: 'mage.arcane.arcaneOrb.guide.explanation.p2',
            message:
              's, generating at least 2 charges per cast with an additional charge per target hit. Refer to the below conditions to determine when to cast ',
          })}
          {arcaneOrb}.
        </p>
        {this.isSpellslinger && (
          <ul>
            <li>
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.spellslinger.li1',
                message: 'It will cap your ',
              })}
              {arcaneCharge}
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.spellslinger.li1b',
                message: 's or you have no ',
              })}
              {arcaneCharge}
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.spellslinger.li1c',
                message: 's',
              })}
            </li>
            <li>
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.spellslinger.li2.a',
                message: 'The orb will hit at least 2 targets.',
              })}
            </li>
          </ul>
        )}
        {this.isSunfury && (
          <ul>
            <li>
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.sunfury.li1.a',
                message: 'You have no ',
              })}
              {arcaneCharge}
              {t({
                id: 'mage.arcane.arcaneOrb.guide.explanation.sunfury.li1.b',
                message: 's.',
              })}
            </li>
          </ul>
        )}
      </>
    );

    if (this.arcaneOrb.orbData.length === 0) {
      return (
        <GuideSection
          spell={TALENTS.ARCANE_MISSILES_TALENT}
          explanation={explanation}
          title={t({
            id: 'mage.arcane.arcaneOrb.guide.title',
            message: 'Arcane Orb',
          })}
        >
          <TipBox
            type="note"
            title={t({
              id: 'mage.arcane.arcaneOrb.guide.noCastsFound',
              message: 'No Casts Found',
            })}
          >
            {t({
              id: 'mage.arcane.arcaneOrb.guide.noCasts.title.a',
              message: 'No ',
            })}
            {arcaneOrb}
            {t({
              id: 'mage.arcane.arcaneOrb.guide.noCasts.title.b',
              message: ' casts were detected.',
            })}
          </TipBox>
        </GuideSection>
      );
    }

    const totalTargetsHit = this.arcaneOrb.orbData.reduce((sum, cast) => sum + cast.targetsHit, 0);
    const averageTargetsHit = totalTargetsHit / this.arcaneOrb.orbData.length;
    const overviewStats = [
      {
        value: averageTargetsHit.toFixed(1),
        label: t({
          id: 'mage.arcane.arcaneOrb.guide.stat.avgTargetsHit',
          message: 'Avg Targets Hit',
        }),
        tooltip: (
          <>
            {t({
              id: 'mage.arcane.arcaneOrb.guide.stat.avgTargetsHitTooltip',
              message: 'Average number of targets hit per Arcane Orb cast.',
            })}
          </>
        ),
      },
    ];

    const perCastData: PerCastData[] = this.arcaneOrb.orbData.map((cast, index) => {
      const evaluation = this.evaluateOrbCast(cast);

      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(cast.timestamp),
        stats: [
          {
            value: cast.targetsHit,
            label: t({
              id: 'mage.arcane.arcaneOrb.guide.stat.targetsHit',
              message: 'Targets Hit',
            }),
            tooltip: (
              <>
                {t({
                  id: 'mage.arcane.arcaneOrb.guide.stat.targetsHitTooltip',
                  message: 'The number of enemies hit by the Arcane Orb.',
                })}
              </>
            ),
          },
          {
            value: cast.chargesBefore,
            label: t({
              id: 'mage.arcane.arcaneOrb.guide.stat.arcaneCharges',
              message: 'Arcane Charges',
            }),
            tooltip: (
              <>
                {t({
                  id: 'mage.arcane.arcaneOrb.guide.stat.arcaneChargesTooltip',
                  message: 'The number of Arcane Charges the player had before Arcane Orb.',
                })}
              </>
            ),
          },
          this.selectedCombatant.hasTalent(TALENTS.ARCANE_SALVO_TALENT)
            ? {
                value: cast.salvoStacks,
                label: t({
                  id: 'mage.arcane.arcaneOrb.guide.stat.arcaneSalvoStacks',
                  message: 'Arcane Salvo Stacks',
                }),
                tooltip: (
                  <>
                    {t({
                      id: 'mage.arcane.arcaneOrb.guide.stat.arcaneSalvoStacksTooltip',
                      message: 'The number of Arcane Salvo stacks the player had.',
                    })}
                  </>
                ),
              }
            : undefined,
        ].filter(Boolean) as PerCastStat[],
        details: evaluation.reason,
      };
    });

    return (
      <GuideSection
        spell={SPELLS.ARCANE_ORB}
        explanation={explanation}
        title={t({
          id: 'mage.arcane.arcaneOrb.guide.title',
          message: 'Arcane Orb',
        })}
      >
        <CastOverview spell={SPELLS.ARCANE_ORB} stats={overviewStats} />
        <CastDetail
          title={t({
            id: 'mage.arcane.arcaneOrb.guide.castDetailTitle',
            message: 'Arcane Orb Casts',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default ArcaneOrbGuide;
