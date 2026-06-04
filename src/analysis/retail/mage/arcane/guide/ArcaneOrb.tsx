import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { type JSX } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Analyzer from 'parser/core/Analyzer';
import GuideSection from 'interface/guide/components/GuideSection';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import CastOverview from 'interface/guide/components/CastOverview';

import ArcaneOrb, { ArcaneOrbCast } from '../analyzers/ArcaneOrb';
import { formatDurationMillisMinSec } from 'common/format';
import { CastDetail, PerCastData, type PerCastStat } from 'interface/guide/components';

const AOE_THRESHOLD_ORB_SPEC = 4;
const AOE_THRESHOLD_MISSILE_SPEC = 2;

class ArcaneOrbGuide extends Analyzer {
  static dependencies = {
    arcaneOrb: ArcaneOrb,
  };

  protected arcaneOrb!: ArcaneOrb;

  hasHighVoltage: boolean = this.selectedCombatant.hasTalent(TALENTS.HIGH_VOLTAGE_TALENT);
  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);
  isSpellslingerMissile: boolean =
    this.isSpellslinger && !this.selectedCombatant.hasTalent(TALENTS.ORB_MASTERY_TALENT);
  isSpellslingerOrb: boolean =
    this.isSpellslinger && this.selectedCombatant.hasTalent(TALENTS.ORB_MASTERY_TALENT);

  private evaluateOrbCast(cast: ArcaneOrbCast): CastEvaluation {
    const hitTargets = cast.targetsHit > 0;
    const isAOEMissileSpec =
      this.isSpellslingerMissile && cast.targetsHit >= AOE_THRESHOLD_MISSILE_SPEC;
    const isAOEOrbSpec = this.isSpellslingerOrb && cast.targetsHit >= AOE_THRESHOLD_ORB_SPEC;

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

    if (
      this.isSpellslingerMissile &&
      cast.clearcasting &&
      this.hasHighVoltage &&
      cast.salvoStacks < 12
    ) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Had Clearcasting with High Voltage talented.`,
      };
    }

    if (this.isSpellslingerMissile && cast.touchCD < 10000) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Touch of the Magi was available in ${formatDurationMillisMinSec(cast.touchCD)}.`,
      };
    }

    if (this.isSpellslingerOrb && !cast.recentBarrage && !isAOEOrbSpec) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Arcane Barrage was not your last cast and Orb did not hit 4 targets.`,
      };
    }

    if (
      this.isSpellslingerMissile &&
      ((!isAOEMissileSpec && cast.chargesBefore > 3) ||
        (isAOEMissileSpec && cast.chargesBefore > 2))
    ) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Had ${cast.chargesBefore} Arcane Charges & Hit ${cast.targetsHit} enemies.`,
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslingerMissile && this.hasHighVoltage && cast.clearcasting) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had Clearcasting with High Voltage talented.`,
      };
    }

    if (this.isSpellslingerMissile && !cast.clearcasting && cast.salvoStacks >= 12) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Did not have Clearcasting and had ${cast.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerMissile && isAOEMissileSpec) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Hit ${cast.targetsHit} enemies.`,
      };
    }

    if (this.isSunfury && cast.chargesBefore < 2) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had ${cast.chargesBefore} Arcane Charges.`,
      };
    }

    if (this.isSpellslingerOrb && cast.clearcasting && cast.salvoStacks <= 14) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had Clearcasting and ${cast.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerOrb && !cast.clearcasting && cast.orbCapped && cast.salvoStacks <= 18) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Didn't have Clearcasting, was capped (or almost capped) on Arcane Orb charges, and had ${cast.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    // OK CONDITIONS
    if (this.isSpellslingerMissile && cast.clearcasting && cast.salvoStacks < 12) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Had Clearcasting with ${cast.salvoStacks} Arcane Salvo Stacks.`,
      };
    }

    if (this.isSpellslingerOrb && cast.clearcasting && cast.salvoStacks > 14) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Had ${cast.salvoStacks} Arcane Salvo Stacks.`,
      };
    }

    if (this.isSpellslingerOrb && !cast.clearcasting && cast.orbCapped && cast.salvoStacks > 18) {
      return {
        timestamp: cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Didn't have Clearcasting, was capped (or almost capped) on Arcane Orb charges, and had ${cast.salvoStacks} Arcane Salvo stacks.`,
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
    const clearcasting = <SpellLink spell={SPELLS.CLEARCASTING_ARCANE} />;
    const highVoltage = <SpellLink spell={TALENTS.HIGH_VOLTAGE_TALENT} />;
    const arcaneSalvo = <SpellLink spell={TALENTS.ARCANE_SALVO_TALENT} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;
    const touchOfTheMagi = <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />;

    const explanation = (
      <>
        <p>
          <Trans id="mage.arcane.arcaneOrb.guide.explanation1">
            <b>{arcaneOrb}</b>'s primary purpose is to quickly generate {arcaneCharge}s, generating at
            least 2 charges per cast with an additional charge per target hit. The way you utilize{' '}
            {arcaneOrb} is heavily dependent on your talent build, so refer to the below guidelines
            based on your chosen talents.
          </Trans>
        </p>
        {this.isSunfury && (
          <p>
            <ul>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionSunfury1">
                  You have less than 2 {arcaneCharge}s
                </Trans>
              </li>
            </ul>
          </p>
        )}
        {this.isSpellslingerMissile && (
          <p>
            <Trans id="mage.arcane.arcaneOrb.guide.conditionMissileIntro">
              {touchOfTheMagi} will not be available in the next 10 seconds, you have &lt; 3{' '}
              {arcaneCharge}s (&lt; 4 if it will hit 2 or more enemies), and one of the below are
              true.
            </Trans>
            <ul>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionMissile1">
                  You don't have {clearcasting} and have {highVoltage} talented.
                </Trans>
              </li>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionMissile2">
                  You have {clearcasting} and 12 or more {arcaneSalvo} stacks.
                </Trans>
              </li>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionMissile3">
                  {arcaneOrb} will hit 2 or more enemies.
                </Trans>
              </li>
            </ul>
          </p>
        )}
        {this.isSpellslingerOrb && (
          <p>
            <Trans id="mage.arcane.arcaneOrb.guide.conditionOrbIntro">
              Your last cast was {arcaneBarrage} or {arcaneOrb} will hit 4 or more enemies, and also
              one of the below are true:
            </Trans>
            <ul>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionOrb1">
                  You have {clearcasting} and 14 or less {arcaneSalvo} stacks.
                </Trans>
              </li>
              <li>
                <Trans id="mage.arcane.arcaneOrb.guide.conditionOrb2">
                  You don't have {clearcasting}, you are capped (or almost capped) on {arcaneOrb}{' '}
                  charges, and have 18 or less {arcaneSalvo} stacks.
                </Trans>
              </li>
            </ul>
          </p>
        )}
      </>
    );

    if (this.arcaneOrb.orbData.length === 0) {
      return (
        <GuideSection
          spell={SPELLS.ARCANE_ORB}
          explanation={explanation}
          title={t({
            id: 'mage.arcane.arcaneOrb.guide.overviewTitle',
            message: 'Arcane Orb (Overview)',
          })}
        >
          <div style={{ fontSize: '2em', color: '#999', textAlign: 'center', padding: '20px' }}>
            <Trans id="mage.arcane.arcaneOrb.guide.noCasts">
              No Arcane Orb casts recorded
            </Trans>
          </div>
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
          <Trans id="mage.arcane.arcaneOrb.guide.stat.avgTargetsHitTooltip">
            Average number of targets hit per Arcane Orb cast.
          </Trans>
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
              <Trans id="mage.arcane.arcaneOrb.guide.stat.targetsHitTooltip">
                The number of enemies hit by the Arcane Orb.
              </Trans>
            ),
          },
          {
            value: cast.clearcasting ? 'Yes' : 'No',
            label: t({
              id: 'mage.arcane.arcaneOrb.guide.stat.hadClearcasting',
              message: 'Had Clearcasting',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneOrb.guide.stat.hadClearcastingTooltip">
                Whether the player had Clearcasting or not.
              </Trans>
            ),
          },
          {
            value: cast.chargesBefore,
            label: t({
              id: 'mage.arcane.arcaneOrb.guide.stat.arcaneCharges',
              message: 'Arcane Charges',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneOrb.guide.stat.arcaneChargesTooltip">
                The number of Arcane Charges the player had before Arcane Orb.
              </Trans>
            ),
          },
          {
            value: formatDurationMillisMinSec(cast.touchCD),
            label: t({
              id: 'mage.arcane.arcaneOrb.guide.stat.touchCd',
              message: 'Touch CD',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneOrb.guide.stat.touchCdTooltip">
                Cooldown remaining on Touch of the Magi.
              </Trans>
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
                  <Trans id="mage.arcane.arcaneOrb.guide.stat.arcaneSalvoStacksTooltip">
                    The number of Arcane Salvo stacks the player had.
                  </Trans>
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
        title={t({ id: 'mage.arcane.arcaneOrb.guide.title', message: 'Arcane Orb' })}
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
