import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { type JSX } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink, SpellIcon } from 'interface';
import {
  formatPercentage,
  formatDuration,
  formatNumber,
  formatDurationMillisMinSec,
} from 'common/format';
import GuideSection from 'interface/guide/components/GuideSection';
import CastDetail, {
  type PerCastData,
  type PerCastStat,
} from 'interface/guide/components/CastDetail';
import Analyzer from 'parser/core/Analyzer';
import ArcaneBarrage, { ArcaneBarrageData } from '../analyzers/ArcaneBarrage';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { CastEvaluation, TipBox } from 'interface/guide/components';

class ArcaneBarrageGuide extends Analyzer {
  static dependencies = {
    arcaneBarrage: ArcaneBarrage,
  };

  protected arcaneBarrage!: ArcaneBarrage;

  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);
  hasArcaneSalvo: boolean = this.selectedCombatant.hasTalent(TALENTS.ARCANE_SALVO_TALENT);
  hasHighVoltage: boolean = this.selectedCombatant.hasTalent(TALENTS.HIGH_VOLTAGE_TALENT);
  hasOverpoweredMissiles: boolean = this.selectedCombatant.hasTalent(
    TALENTS.OVERPOWERED_MISSILES_TALENT,
  );
  hasOrbMastery: boolean = this.selectedCombatant.hasTalent(TALENTS.ORB_MASTERY_TALENT);
  hasOrbBarrage: boolean = this.selectedCombatant.hasTalent(TALENTS.ORB_BARRAGE_TALENT);
  isSpellslingerMissile: boolean = this.isSpellslinger && !this.hasOrbMastery;
  isSpellslingerOrb: boolean = this.isSpellslinger && this.hasOrbMastery;

  private readonly MAX_ARCANE_CHARGES = 4;
  private readonly NO_MANA_THRESHOLD = 0.1;

  private evaluateBarrageCast(cast: ArcaneBarrageData): CastEvaluation {
    const hasMaxCharges = cast.charges >= this.MAX_ARCANE_CHARGES;
    const hasNoMana = cast.mana !== undefined && cast.mana <= this.NO_MANA_THRESHOLD;
    const hasClearcasting = cast.activeBuffs.includes(SPELLS.CLEARCASTING_ARCANE.id);
    const hasOPMissiles = cast.activeBuffs.includes(SPELLS.OVERPOWERED_MISSILES_BUFF.id);

    // NO MANA
    if (cast.mana && hasNoMana) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.veryLowMana',
          message: 'Very Low Mana ({manaPct}%)',
          values: { manaPct: formatPercentage(cast.mana) },
        }),
      };
    }

    // FAIL CONDITIONS
    if (cast.touchCD < 5000 && cast.touchCD > 0) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.touchSoon',
          message: 'Touch of the Magi available soon ({touchCd})',
          values: { touchCd: formatDurationMillisMinSec(cast.touchCD) },
        }),
      };
    }

    // PERFECT CONDITIONS
    if (this.isSpellslinger && cast.salvoStacks === 20 && (hasMaxCharges || this.hasOrbBarrage)) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: hasMaxCharges
          ? t({
              id: 'mage.arcane.arcaneBarrage.reason.perfectMaxCharges',
              message: 'Had 20 Arcane Salvo Stacks and 4 Arcane Charges.',
            })
          : t({
              id: 'mage.arcane.arcaneBarrage.reason.perfectOrbBarrage',
              message: 'Had 20 Arcane Salvo Stacks and Orb Barrage Talented.',
            }),
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslinger && cast.touchApply && cast.barrageBefore) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.barrageBeforeTouch',
          message: 'Barrage was cast immediately before Touch of the Magi.',
        }),
      };
    }

    if (this.isSpellslinger && cast.touchApply && cast.barrageAfter) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.barrageAfterTouch',
          message: 'Barrage was cast immediately after Touch of the Magi.',
        }),
      };
    }

    if (
      this.isSpellslingerMissile &&
      hasMaxCharges &&
      hasOPMissiles &&
      hasClearcasting &&
      cast.salvoStacks >= 5
    ) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.spellslingerMissileGood',
          message:
            'Had 4 Arcane Charges, Overpowered Missiles, Clearcasting, and {salvoStacks} Arcane Salvo Stacks.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    if (
      this.isSpellslingerOrb &&
      cast.touchRemaining &&
      cast.touchRemaining < 2000 &&
      cast.salvoStacks >= 15
    ) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.touchEnding',
          message:
            'Touch of the Magi about to end ({touchRemaining}) with {salvoStacks} Arcane Salvo stacks.',
          values: {
            touchRemaining: formatDurationMillisMinSec(cast.touchRemaining),
            salvoStacks: cast.salvoStacks,
          },
        }),
      };
    }

    if (
      this.isSpellslingerOrb &&
      cast.surgeRemaining &&
      cast.surgeRemaining < 2000 &&
      cast.salvoStacks >= 15
    ) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.surgeEnding',
          message:
            'Arcane Surge about to end ({surgeRemaining}) with {salvoStacks} Arcane Salvo stacks.',
          values: {
            surgeRemaining: formatDurationMillisMinSec(cast.surgeRemaining),
            salvoStacks: cast.salvoStacks,
          },
        }),
      };
    }

    if (this.isSunfury && cast.salvoStacks >= 25) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryMaxStacks',
          message: 'Had {salvoStacks} Arcane Salvo stacks and 4 Arcane Charges.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    if (this.isSunfury && cast.barrageAfter) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryBeforeBarrage',
          message: 'Touch of the Magi cast immediately before Arcane Barrage.',
        }),
      };
    }

    if (this.isSunfury && cast.touchRemaining && cast.touchRemaining < 2000) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryTouchEnding',
          message: 'Touch of the Magi ends in {touchRemaining}.',
          values: { touchRemaining: formatDurationMillisMinSec(cast.touchRemaining) },
        }),
      };
    }

    if (this.isSunfury && cast.activeBuffs.includes(SPELLS.ARCANE_SOUL_BUFF.id)) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryArcaneSoul',
          message: 'Had Arcane Soul.',
        }),
      };
    }

    if (
      this.isSunfury &&
      !cast.activeBuffs.includes(SPELLS.TOUCH_OF_THE_MAGI_DEBUFF.id) &&
      !cast.activeBuffs.includes(SPELLS.ARCANE_SURGE_BUFF.id) &&
      cast.salvoStacks < 19
    ) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryNoBurnLowStacks',
          message:
            'Had {salvoStacks} Arcane Salvo stacks without Touch of the Magi or Arcane Surge.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    if (
      this.isSunfury &&
      !cast.activeBuffs.includes(SPELLS.TOUCH_OF_THE_MAGI_DEBUFF.id) &&
      !cast.activeBuffs.includes(SPELLS.ARCANE_SURGE_BUFF.id) &&
      cast.targetsHit >= 3 &&
      cast.arcaneOrbAvail
    ) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.sunfuryNoBurnWithOrb',
          message:
            'Had {salvoStacks} Arcane Salvo stacks and an Arcane Orb charge without Touch of the Magi or Arcane Surge.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    // OK CONDITIONS
    if (this.isSpellslinger && cast.salvoStacks < 20) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.okSpellslingerStacks',
          message: 'Had {salvoStacks} Arcane Salvo stacks.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    if (this.isSunfury && cast.salvoStacks < 25) {
      return {
        timestamp: cast.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: t({
          id: 'mage.arcane.arcaneBarrage.reason.okSunfuryStacks',
          message: 'Had {salvoStacks} Arcane Salvo stacks.',
          values: { salvoStacks: cast.salvoStacks },
        }),
      };
    }

    // DEFAULT FAIL
    return {
      timestamp: cast.cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: t({
        id: 'mage.arcane.arcaneBarrage.reason.unknown',
        message: 'Performance Condition Unknown. Please report this!',
      }),
    };
  }

  get guideSubsection(): JSX.Element {
    const arcaneBlast = <SpellLink spell={SPELLS.ARCANE_BLAST} />;
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;
    const touchOfTheMagi = <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;
    const clearcasting = <SpellLink spell={SPELLS.CLEARCASTING_ARCANE} />;
    const arcaneOrb = <SpellLink spell={SPELLS.ARCANE_ORB} />;
    const arcaneSalvo = <SpellLink spell={TALENTS.ARCANE_SALVO_TALENT} />;
    const overpoweredMissiles = <SpellLink spell={TALENTS.OVERPOWERED_MISSILES_TALENT} />;
    const orbBarrage = <SpellLink spell={TALENTS.ORB_BARRAGE_TALENT} />;
    const arcaneSurge = <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />;
    const arcaneSoul = <SpellLink spell={SPELLS.ARCANE_SOUL_BUFF} />;
    const gloriousIncandescence = <SpellLink spell={TALENTS.GLORIOUS_INCANDESCENCE_TALENT} />;

    const explanation = (
      <>
        <p>
          <>
            <strong>{arcaneBarrage}</strong>
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation1.p1',
              message: ' is your ',
            })}
            {arcaneCharge}
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation1.p2',
              message: ' spender, removing the associated increased mana costs and damage. In order to maintain the damage increase as long as possible, you should only cast ',
            })}
            {arcaneBarrage}
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation1.p3',
              message: ' under the below conditions, which are tailored to your current talent build.',
            })}
          </>
        </p>
        <p>
          <>
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation2.p1',
              message: 'Regardless of the below, if ',
            })}
            {touchOfTheMagi}
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation2.p2',
              message: ' will be available in the next 4-5 seconds, you should hold ',
            })}
            {arcaneBarrage}
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation2.p3',
              message: ' for ',
            })}
            {touchOfTheMagi}
            {t({
              id: 'mage.arcane.arcaneBarrage.guide.explanation2.p4',
              message: '.',
            })}
          </>
        </p>
        {this.isSpellslingerMissile && (
          <ul>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile1.p1',
                  message: 'You have 20 stacks of ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile1.p2',
                  message: ' and either 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile1.p3',
                  message: 's or have the ',
                })}
                {orbBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile1.p4',
                  message: ' talent.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile2.p1',
                  message: 'You just casted, or are about to cast, ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile2.p2',
                  message: ' (',
                })}
                {arcaneBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile2.p3',
                  message: ' should be within a GCD of ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile2.p4',
                  message: ', either before it or after it).',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile3.p1',
                  message: "You don't have enough mana for ",
                })}
                {arcaneBlast}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile4.p1',
                  message: 'You have 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile4.p2',
                  message: 's, an ',
                })}
                {overpoweredMissiles}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile4.p3',
                  message: ' and ',
                })}
                {clearcasting}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile4.p4',
                  message: ' proc, and at least 5 ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionMissile4.p5',
                  message: ' stacks.',
                })}
              </>
            </li>
          </ul>
        )}
        {this.isSpellslingerOrb && (
          <ul>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb1.p1',
                  message: 'You have 20 stacks of ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb1.p2',
                  message: ' and either 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb1.p3',
                  message: 's or have the ',
                })}
                {orbBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb1.p4',
                  message: ' talent.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb2.p1',
                  message: 'You just casted, or are about to cast, ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb2.p2',
                  message: ' (',
                })}
                {arcaneBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb2.p3',
                  message: ' should be within a GCD of ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb2.p4',
                  message: ', either before it or after it).',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb3.p1',
                  message: "You don't have enough mana for ",
                })}
                {arcaneBlast}
              </>
            </li>
            <li>
              <>
                {arcaneSurge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb4.p1',
                  message: ' or ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb4.p2',
                  message: ' will end in the next 1-2 seconds and you have 15 or more ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionOrb4.p3',
                  message: ' stacks.',
                })}
              </>
            </li>
          </ul>
        )}
        {this.isSunfury && (
          <ul>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury1.p1',
                  message: 'You have 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury1.p2',
                  message: 's and 25 stacks of ',
                })}
                {arcaneSalvo}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury2.p1',
                  message: 'Your last cast was ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury2.p2',
                  message: ' or the ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury2.p3',
                  message: ' debuff will end in 1-2 seconds.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury3.p1',
                  message: 'You have ',
                })}
                {arcaneSoul}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury3.p2',
                  message: '.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury4.p1',
                  message: "You don't have enough mana for ",
                })}
                {arcaneBlast}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury5.p1',
                  message: 'You have 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury5.p2',
                  message: 's, are not in a burn phase (',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury5.p3',
                  message: ' and ',
                })}
                {arcaneSurge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury5.p4',
                  message: ' are not active), and < 19 stacks of ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury5.p5',
                  message: '.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p1',
                  message: 'You have 4 ',
                })}
                {arcaneCharge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p2',
                  message: 's, are not in a burn phase (',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p3',
                  message: ' and ',
                })}
                {arcaneSurge}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p4',
                  message: ' are not active), ',
                })}
                {arcaneBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p5',
                  message: ' will hit 3 or more enemies, and you have a charge of ',
                })}
                {arcaneOrb}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.conditionSunfury6.p6',
                  message: ' available.',
                })}
              </>
            </li>
          </ul>
        )}
        {this.isSunfury && (
          <div>
            <TipBox
              type="note"
              title={t({
                id: 'mage.arcane.arcaneBarrage.guide.meteoritesTitle',
                message: 'Meteorites',
              })}
            >
              <>
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.meteoritesDescription.p1',
                  message: 'If you are close to a multiple of 6 ',
                })}
                {arcaneSalvo}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.meteoritesDescription.p2',
                  message: ' stacks (6, 12, 18), it is beneficial to hold ',
                })}
                {arcaneBarrage}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.meteoritesDescription.p3',
                  message: ' until you are above that threshold to maximize the number of meteorites generated by ',
                })}
                {gloriousIncandescence}
                {t({
                  id: 'mage.arcane.arcaneBarrage.guide.meteoritesDescription.p4',
                  message: '.',
                })}
              </>
            </TipBox>
          </div>
        )}
      </>
    );

    const perCastData: PerCastData[] = this.arcaneBarrage.barrageData.map((cast) => {
      const evaluation = this.evaluateBarrageCast(cast);
      const stats: PerCastStat[] = [
        {
          label: t({
            id: 'mage.arcane.arcaneBarrage.guide.stat.arcaneCharges',
            message: 'Arcane Charges',
          }),
          value: `${cast.charges} / ${this.MAX_ARCANE_CHARGES}`,
          tooltip: (
            <Trans id="mage.arcane.arcaneBarrage.guide.stat.arcaneChargesTooltip">
              The number of Arcane Charge you had when Arcane Barrage was cast.
            </Trans>
          ),
        },
        cast.targetsHit > 0
          ? {
              label: t({
                id: 'mage.arcane.arcaneBarrage.guide.stat.targetsHit',
                message: 'Targets Hit',
              }),
              value: `${cast.targetsHit}`,
              tooltip: (
                <Trans id="mage.arcane.arcaneBarrage.guide.stat.targetsHitTooltip">
                  The number of targets hit by the Arcane Barrage cast
                </Trans>
              ),
            }
          : undefined,
        cast.mana !== undefined
          ? {
              label: t({ id: 'mage.arcane.arcaneBarrage.guide.stat.mana', message: 'Mana' }),
              value: `${formatPercentage(cast.mana, 0)}%`,
              tooltip: (
                <Trans id="mage.arcane.arcaneBarrage.guide.stat.manaTooltip">
                  The player's mana before Arcane Barrage was cast.
                </Trans>
              ),
            }
          : undefined,
        this.hasArcaneSalvo && cast.salvoStacks
          ? {
              label: t({
                id: 'mage.arcane.arcaneBarrage.guide.stat.arcaneSalvoStacks',
                message: 'Arcane Salvo Stacks',
              }),
              value: formatNumber(cast.salvoStacks),
              tooltip: (
                <Trans id="mage.arcane.arcaneBarrage.guide.stat.arcaneSalvoStacksTooltip">
                  The number of Arcane Salvo stacks the player had before Arcane Barrage was cast.
                </Trans>
              ),
            }
          : undefined,
        cast.precast
          ? {
              label: t({
                id: 'mage.arcane.arcaneBarrage.guide.stat.precastSpell',
                message: 'Precast Spell',
              }),
              value: <SpellIcon spell={cast.precast.ability.guid} />,
              tooltip: t({
            id: 'mage.arcane.arcaneBarrage.stat.precastSpellTooltip',
            message: 'Precast: {spellName}',
            values: { spellName: cast.precast.ability.name },
          }),
            }
          : undefined,
        cast.activeBuffs.length > 0
          ? {
              label: t({
                id: 'mage.arcane.arcaneBarrage.guide.stat.activeBuffs',
                message: 'Active Buffs',
              }),
              value: `${cast.activeBuffs.length}`,
              tooltip: (
                <>
                  {cast.activeBuffs.map((buff, i) => (
                    <div key={i}>{<SpellLink spell={SPELLS[buff]} />}</div>
                  ))}
                </>
              ),
            }
          : undefined,
        cast.touchCD
          ? {
              label: t({
                id: 'mage.arcane.arcaneBarrage.guide.stat.touchCd',
                message: 'Touch CD',
              }),
              value: formatDuration(cast.touchCD),
              tooltip: (
                <Trans id="mage.arcane.arcaneBarrage.guide.stat.touchCdTooltip">
                  Cooldown Remaining on Touch of the Magi
                </Trans>
              ),
            }
          : undefined,
      ].filter(Boolean) as PerCastStat[];

      return {
        performance: evaluation.performance,
        details: evaluation.reason,
        timestamp: this.owner.formatTimestamp(cast.cast.timestamp),
        stats,
      };
    });

    return (
      <GuideSection
        spell={SPELLS.ARCANE_BARRAGE}
        explanation={explanation}
        title={t({ id: 'mage.arcane.arcaneBarrage.guide.title', message: 'Arcane Barrage' })}
      >
        <CastDetail
          title={t({
            id: 'mage.arcane.arcaneBarrage.guide.castDetailTitle',
            message: 'Arcane Barrage Casts',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default ArcaneBarrageGuide;
