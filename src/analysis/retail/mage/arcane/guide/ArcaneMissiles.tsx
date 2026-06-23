import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { formatDurationMillisMinSec } from 'common/format';
import Analyzer from 'parser/core/Analyzer';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import GuideSection from 'interface/guide/components/GuideSection';
import CastOverview from 'interface/guide/components/CastOverview';
import CastDetail, {
  type PerCastData,
  type PerCastStat,
} from 'interface/guide/components/CastDetail';

import ArcaneMissiles, { ArcaneMissilesData } from '../analyzers/ArcaneMissiles';
import { TipBox } from 'interface/guide/components';

const MISSILE_EARLY_CLIP_DELAY = 200;

class ArcaneMissilesGuide extends Analyzer {
  static dependencies = {
    arcaneMissiles: ArcaneMissiles,
  };

  protected arcaneMissiles!: ArcaneMissiles;

  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);
  hasOrbMastery: boolean = this.selectedCombatant.hasTalent(TALENTS.ORB_MASTERY_TALENT);
  isSpellslingerMissile: boolean = this.isSpellslinger && !this.hasOrbMastery;
  isSpellslingerOrb: boolean = this.isSpellslinger && this.hasOrbMastery;
  hasAetherAttunement: boolean = this.selectedCombatant.hasTalent(TALENTS.AETHER_ATTUNEMENT_TALENT);
  hasHighVoltage: boolean = this.selectedCombatant.hasTalent(TALENTS.HIGH_VOLTAGE_TALENT);
  hasOverpoweredMissiles: boolean = this.selectedCombatant.hasTalent(
    TALENTS.OVERPOWERED_MISSILES_TALENT,
  );

  private evaluateMissilesCast(am: ArcaneMissilesData): CastEvaluation {
    const clippedBeforeGCD =
      am.channelEnd && am.gcdEnd && am.gcdEnd - am.channelEnd > MISSILE_EARLY_CLIP_DELAY;

    // TALENT CONFLICTS
    // The return has dummy values as these will never actually be used
    if (
      (this.isSpellslingerOrb && this.hasOverpoweredMissiles) ||
      (this.isSpellslingerOrb && this.hasHighVoltage)
    ) {
      return {
        timestamp: 0,
        performance: QualitativePerformance.Fail,
        reason: '',
      };
    }

    // FAIL CONDITIONS
    if (clippedBeforeGCD) {
      return {
        performance: QualitativePerformance.Fail,
        reason: 'Arcane Missiles Clipped during GCD',
        timestamp: am.cast.timestamp,
      };
    }

    if (this.isSpellslingerMissile && am.opMissiles && am.salvoStacks > 10) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `You had Overpowered Missiles and ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerMissile && !am.opMissiles && am.salvoStacks > 15) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `You didn't have Overpowered Missiles and had ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerMissile && this.hasHighVoltage && am.arcaneCharges >= 2) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `You had ${am.arcaneCharges} Arcane Charges with High Voltage talented.`,
      };
    }

    if (this.isSunfury && !am.clearcastingProcs) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `You did not have Clearcasting`,
      };
    }

    // PERFECT CONDITIONS
    if (this.isSunfury && am.arcaneSoul && am.salvoStacks <= 20) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `Had Clearcasting, Arcane Soul, and had ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSunfury && am.salvoStacks <= 15) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `Had Clearcasting and ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslingerMissile && am.opMissiles && am.salvoStacks <= 10) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had Overpowered Missiles and ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerMissile && !am.opMissiles && am.salvoStacks <= 15) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Didn't have Overpowered Missiles and had ${am.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (this.isSpellslingerMissile && this.hasHighVoltage && am.arcaneCharges < 2) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Has High Voltage talented and has ${am.arcaneCharges} Arcane Charges`,
      };
    }

    if (this.isSunfury && am.clearcastingProcs) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Had Clearcasting`,
      };
    }

    // OK CONDITIONS
    if (this.isSpellslingerOrb) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `We did not actually check any conditions. You realistically should not be casting Arcane Missiles so we are just defaulting to "Ok" for all Arcane Missiles casts.`,
      };
    }

    // DEFAULT
    return {
      performance: QualitativePerformance.Ok,
      reason: am.channelEndDelay
        ? `Standard usage - ${formatDurationMillisMinSec(am.channelEndDelay, 3)} delay to next cast`
        : 'Standard Arcane Missiles usage',
      timestamp: am.cast.timestamp,
    };
  }

  get guideSubsection(): JSX.Element {
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;
    const arcaneMissiles = <SpellLink spell={TALENTS.ARCANE_MISSILES_TALENT} />;
    const clearcasting = <SpellLink spell={SPELLS.CLEARCASTING_ARCANE} />;
    const highVoltage = <SpellLink spell={TALENTS.HIGH_VOLTAGE_TALENT} />;
    const overpoweredMissiles = <SpellLink spell={TALENTS.OVERPOWERED_MISSILES_TALENT} />;
    const arcaneSalvo = <SpellLink spell={TALENTS.ARCANE_SALVO_TALENT} />;
    const orbMastery = <SpellLink spell={TALENTS.ORB_MASTERY_TALENT} />;
    const arcaneSurge = <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />;
    const arcaneOrb = <SpellLink spell={TALENTS.ARCANE_ORB_TALENT} />;
    const arcaneSoul = <SpellLink spell={SPELLS.ARCANE_SOUL_BUFF} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;

    const explanation = (
      <>
        <p>
          <>
            <strong>{arcaneMissiles}</strong>
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.explanation1.p1',
              message: ' is a channelled rotational ability that generates ',
            })}
            {arcaneSalvo}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.explanation1.p2',
              message: ' stacks and also spends your ',
            })}
            {clearcasting}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.explanation1.p3',
              message: ' procs. Your use of ',
            })}
            {arcaneMissiles}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.explanation1.p4',
              message: ' will vary depending on your talent build, so you should refer to the below information to determine when/if you should cast ',
            })}
            {arcaneMissiles}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.explanation1.p5',
              message: ' depening on your current talent build.',
            })}
          </>
        </p>
        {this.isSpellslingerMissile && (
          <div>
            <>
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.spellslingerMissileExplanation.p1',
                message: 'Cast ',
              })}
              {arcaneMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.spellslingerMissileExplanation.p2',
                message: ' if one of the below are true:',
              })}
            </>
            <ul>
              <li>
                <>
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile1.p1',
                    message: 'You have an ',
                  })}
                  {overpoweredMissiles}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile1.p2',
                    message: ' proc and < 10 ',
                  })}
                  {arcaneSalvo}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile1.p3',
                    message: ' stacks.',
                  })}
                </>
              </li>
              <li>
                <>
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile2.p1',
                    message: "You don't have an ",
                  })}
                  {overpoweredMissiles}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile2.p2',
                    message: ' proc and have < 15 ',
                  })}
                  {arcaneSalvo}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile2.p3',
                    message: ' stacks.',
                  })}
                </>
              </li>
              <li>
                <>
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile3.p1',
                    message: 'You have < 2 ',
                  })}
                  {arcaneCharge}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile3.p2',
                    message: 's and have ',
                  })}
                  {highVoltage}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.conditionMissile3.p3',
                    message: ' talented',
                  })}
                </>
              </li>
            </ul>
          </div>
        )}
        {(this.isSpellslingerOrb && this.hasOverpoweredMissiles && (
          <>
            <TipBox
              type="warning"
              title={t({
                id: 'mage.arcane.arcaneMissiles.guide.talentConflictTitle',
                message: 'Talent Build Conflict',
              })}
            >
              <>
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictOverpoweredMissiles.p1',
                  message: 'You currently have both ',
                })}
                {orbMastery}
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictOverpoweredMissiles.p2',
                  message: ' and ',
                })}
                {overpoweredMissiles}
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictOverpoweredMissiles.p3',
                  message: ' talented. These two talents represent two different playstyles with different rotations, so taking both of them creeates conflict within your rotation. It is highly recommended to either choose the Spellslinger Missiles build with ',
                })}
                {overpoweredMissiles}
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictOverpoweredMissiles.p4',
                  message: ' or the Spellslinger Orb build with ',
                })}
                {orbMastery}
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictOverpoweredMissiles.p5',
                  message: '.',
                })}
              </>
            </TipBox>
          </>
        )) ||
          (this.isSpellslingerOrb && this.hasHighVoltage && (
            <>
              <TipBox
                type="warning"
                title={t({
                  id: 'mage.arcane.arcaneMissiles.guide.talentConflictTitle',
                  message: 'Talent Build Conflict',
                })}
              >
                <>
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p1',
                    message: 'You currently have both ',
                  })}
                  {orbMastery}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p2',
                    message: ' and ',
                  })}
                  {highVoltage}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p3',
                    message: ' talented. These two talents represent two different playstyles with different rotations, so taking both of them creeates conflict within your rotation. It is highly recommended to either choose the Spellslinger Missiles build with ',
                  })}
                  {overpoweredMissiles}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p4',
                    message: ' and ',
                  })}
                  {highVoltage}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p5',
                    message: ' or the Spellslinger Orb build with ',
                  })}
                  {orbMastery}
                  {t({
                    id: 'mage.arcane.arcaneMissiles.guide.talentConflictHighVoltage.p6',
                    message: '.',
                  })}
                </>
              </TipBox>
            </>
          )) ||
          (this.isSpellslingerOrb && (
            <div>
              <Trans id="mage.arcane.arcaneMissiles.guide.spellslingerOrbExplanation">
                true Only cast {arcaneMissiles} if all of the below are true. Realistically you should
                never cast {arcaneMissiles} if you are using the Spellslinger Orb build, so we arent
                actually going to check these conditions to see if you met them or not, and will just
                mark every cast as OK.
              </Trans>
              <ul>
                <li>
                  <Trans id="mage.arcane.arcaneMissiles.guide.conditionOrb1">
                    You have {highVoltage} talented or {clearcasting}.
                  </Trans>
                </li>
                <li>
                  <Trans id="mage.arcane.arcaneMissiles.guide.conditionOrb2">
                    You have 15 or less {arcaneSalvo} stacks.
                  </Trans>
                </li>
                <li>
                  <Trans id="mage.arcane.arcaneMissiles.guide.conditionOrb3">
                    Your previous cast was not {arcaneOrb}
                  </Trans>
                </li>
                <li>
                  <Trans id="mage.arcane.arcaneMissiles.guide.conditionOrb4">
                    {arcaneSurge} is not active
                  </Trans>
                </li>
                <li>
                  <Trans id="mage.arcane.arcaneMissiles.guide.conditionOrb5">
                    There is only one target.
                  </Trans>
                </li>
              </ul>
            </div>
          ))}
        {this.isSunfury && (
          <div>
            <Trans id="mage.arcane.arcaneMissiles.guide.sunfuryExplanation">
              You should generally cast {arcaneMissiles} whenever you have {clearcasting}, but should
              prioritize {arcaneMissiles} if the below is true:
            </Trans>
            <ul>
              <li>
                <Trans id="mage.arcane.arcaneMissiles.guide.conditionSunfury1">
                  You have {clearcasting} and {arcaneSurge} is about to end.
                </Trans>
              </li>
              <li>
                <Trans id="mage.arcane.arcaneMissiles.guide.conditionSunfury2">
                  You have {clearcasting} and {arcaneSoul} and are not capped on {arcaneSalvo} (this
                  is to help make your {arcaneBarrage} deal more damage when you spend your{' '}
                  {arcaneSoul}).
                </Trans>
              </li>
              <li>
                <Trans id="mage.arcane.arcaneMissiles.guide.conditionSunfury3">
                  You have &lt; 15 {arcaneSalvo} stacks.
                </Trans>
              </li>
            </ul>
          </div>
        )}
      </>
    );

    if (this.arcaneMissiles.missileData.length === 0) {
      return (
        <GuideSection
          spell={TALENTS.ARCANE_MISSILES_TALENT}
          explanation={explanation}
          title={t({
            id: 'mage.arcane.arcaneMissiles.guide.title',
            message: 'Arcane Missiles',
          })}
        >
          <TipBox
            type="note"
            title={t({
              id: 'mage.arcane.arcaneMissiles.guide.noCastsFound',
              message: 'No Casts Found',
            })}
          >
            <Trans id="mage.arcane.arcaneMissiles.guide.noCastsFoundDescription">
              No {arcaneMissiles} casts were detected.
            </Trans>
          </TipBox>
        </GuideSection>
      );
    }

    if (
      (this.isSpellslingerOrb && this.hasHighVoltage) ||
      (this.isSpellslingerOrb && this.hasOverpoweredMissiles)
    ) {
      return (
        <GuideSection
          spell={TALENTS.ARCANE_MISSILES_TALENT}
          explanation={explanation}
          title={t({
            id: 'mage.arcane.arcaneMissiles.guide.title',
            message: 'Arcane Missiles',
          })}
        >
          <TipBox
            type="warning"
            title={t({
              id: 'mage.arcane.arcaneMissiles.guide.talentConflictDetected',
              message: 'Talent Conflict Detected',
            })}
          >
            <Trans id="mage.arcane.arcaneMissiles.guide.talentConflictDetectedDescription">
              We are unable to evaluate your {arcaneMissiles} casts due to a talent conflict.
            </Trans>
          </TipBox>
        </GuideSection>
      );
    }

    const overviewStats = [
      {
        value: formatDurationMillisMinSec(this.arcaneMissiles.averageChannelDelay, 3),
        label: t({
          id: 'mage.arcane.arcaneMissiles.guide.stat.avgChannelEndDelay',
          message: 'Avg Channel End Delay ',
        }),
        tooltip: (
          <Trans id="mage.arcane.arcaneMissiles.guide.stat.avgChannelEndDelayTooltip">
            {formatDurationMillisMinSec(this.arcaneMissiles.averageChannelDelay, 3)} Average Delay
            from End Channel to Next Cast.
          </Trans>
        ),
        performance: this.arcaneMissiles.channelDelayUtil(this.arcaneMissiles.averageChannelDelay),
      },
    ];

    const perCastData: PerCastData[] = this.arcaneMissiles.missileData.map((cast) => {
      const evaluation = this.evaluateMissilesCast(cast);

      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(cast.cast.timestamp),
        details: evaluation.reason,
        stats: [
          {
            value: cast.arcaneCharges,
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.arcaneCharges',
              message: 'Arcane Charges',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneMissiles.guide.stat.arcaneChargesTooltip">
                The number of Arcane Charges at the time of cast.
              </Trans>
            ),
          },
          {
            value: cast.salvoStacks,
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.arcaneSalvoStacks',
              message: 'Arcane Salvo Stacks',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneMissiles.guide.stat.arcaneSalvoStacksTooltip">
                The number of Arcane Salvo stacks at the time of cast.
              </Trans>
            ),
          },
          {
            value: cast.clearcastingProcs > 0 ? 'Yes' : 'No',
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.hadClearcasting',
              message: 'Had Clearcasting',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneMissiles.guide.stat.hadClearcastingTooltip">
                Whether the player had a Clearcasting proc or not.
              </Trans>
            ),
          },
          {
            value: cast.opMissiles ? 'Yes' : 'No',
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.hadOverpoweredMissiles',
              message: 'Had Overpowered Missiles',
            }),
            tooltip: (
              <Trans id="mage.arcane.arcaneMissiles.guide.stat.hadOverpoweredMissilesTooltip">
                Whether the player had an Overpowered Missiles proc or not.
              </Trans>
            ),
          },
          cast.channelEndDelay !== undefined
            ? {
                value: formatDurationMillisMinSec(cast.channelEndDelay, 3),
                label: t({
                  id: 'mage.arcane.arcaneMissiles.guide.stat.channelEndDelay',
                  message: 'Channel End Delay',
                }),
                tooltip: (
                  <Trans id="mage.arcane.arcaneMissiles.guide.stat.channelEndDelayTooltip">
                    Time between channel end and next cast.
                  </Trans>
                ),
                performance: this.arcaneMissiles.channelDelayUtil(cast.channelEndDelay),
              }
            : undefined,
          this.isSunfury
            ? {
                value: cast.arcaneSoul ? 'Yes' : 'No',
                label: t({
                  id: 'mage.arcane.arcaneMissiles.guide.stat.arcaneSoul',
                  message: 'Arcane Soul',
                }),
                tooltip: (
                  <Trans id="mage.arcane.arcaneMissiles.guide.stat.arcaneSoulTooltip">
                    Whether Arcane Soul was active during this cast.
                  </Trans>
                ),
              }
            : undefined,
        ].filter(Boolean) as PerCastStat[],
      };
    });

    return (
      <GuideSection spell={TALENTS.ARCANE_MISSILES_TALENT} explanation={explanation}>
        <CastOverview spell={TALENTS.ARCANE_MISSILES_TALENT} stats={overviewStats} />
        <CastDetail
          title={t({
            id: 'mage.arcane.arcaneMissiles.guide.castDetailTitle',
            message: 'Arcane Missiles Casts',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default ArcaneMissilesGuide;
