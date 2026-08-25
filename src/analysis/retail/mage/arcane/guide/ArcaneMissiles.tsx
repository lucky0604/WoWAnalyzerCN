import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
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
  hasOverpoweredMissiles: boolean = this.selectedCombatant.hasTalent(
    TALENTS.OVERPOWERED_MISSILES_TALENT,
  );

  private evaluateMissilesCast(am: ArcaneMissilesData): CastEvaluation {
    const clippedBeforeGCD =
      am.channelEnd && am.gcdEnd && am.gcdEnd - am.channelEnd > MISSILE_EARLY_CLIP_DELAY;

    // FAIL CONDITIONS
    if (clippedBeforeGCD) {
      return {
        performance: QualitativePerformance.Fail,
        reason: 'Arcane Missiles Clipped during GCD',
        timestamp: am.cast.timestamp,
      };
    }

    // PERFECT CONDITIONS
    if (this.isSpellslinger && am.salvoStacks < 15 && !am.opMissiles && am.clipped) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `You clipped your channel properly, had ${am.salvoStacks} Arcane Salvo stacks, and ${am.clearcastingProcs} Clearcasting procs.`,
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslinger && am.salvoStacks < 15) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `You had ${am.salvoStacks} Arcane Salvo stacks and ${am.clearcastingProcs} Clearcasting procs.`,
      };
    }

    if (this.isSunfury && am.salvoStacks < 12) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `You had ${am.salvoStacks} Arcane Salvo stacks and ${am.clearcastingProcs} Clearcasting procs.`,
      };
    }

    // OK CONDITIONS
    if (this.isSpellslinger && am.salvoStacks >= 15) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `You had ${am.salvoStacks} Arcane Salvo stacks and ${am.clearcastingProcs} Clearcasting procs.`,
      };
    }

    if (this.isSunfury && am.salvoStacks >= 12) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `You had ${am.salvoStacks} Arcane Salvo stacks and ${am.clearcastingProcs} Clearcasting procs.`,
      };
    }

    if (am.clearcastingCapped) {
      return {
        timestamp: am.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `You were capped on Clearcasting procs.`,
      };
    }

    // DEFAULT FAIL
    return {
      timestamp: am.cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: `Performance Condition Unknown. Please report this!`,
    };
  }

  get guideSubsection(): JSX.Element {
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;
    const arcaneMissiles = <SpellLink spell={TALENTS.ARCANE_MISSILES_TALENT} />;
    const clearcasting = <SpellLink spell={SPELLS.CLEARCASTING_ARCANE} />;
    const overpoweredMissiles = <SpellLink spell={TALENTS.OVERPOWERED_MISSILES_TALENT} />;
    const arcaneSalvo = <SpellLink spell={TALENTS.ARCANE_SALVO_TALENT} />;

    const explanation = (
      <>
        <p>
          <b>{arcaneMissiles}</b>
          {t({
            id: 'mage.arcane.arcaneMissiles.guide.explanation.p1',
            message: ' is a channelled rotational ability that generates ',
          })}
          {arcaneSalvo}
          {t({
            id: 'mage.arcane.arcaneMissiles.guide.explanation.p2',
            message: ' stacks and also spends your ',
          })}
          {clearcasting}
          {t({
            id: 'mage.arcane.arcaneMissiles.guide.explanation.p3',
            message:
              ' procs. In order to maximize your ',
          })}
          {arcaneCharge}
          {t({
            id: 'mage.arcane.arcaneMissiles.guide.explanation.p4',
            message: ' and ',
          })}
          {arcaneSalvo}
          {t({
            id: 'mage.arcane.arcaneMissiles.guide.explanation.p5',
            message: ' generation, use the below to determine when to use ',
          })}
          {arcaneMissiles}.
        </p>
        {this.isSpellslinger && (
          <ul>
            <li>
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.spellslinger.li1.a',
                message: 'You have less than 15 ',
              })}
              {arcaneSalvo}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.spellslinger.li1.b',
                message: ' stacks and a ',
              })}
              {clearcasting}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.spellslinger.li1.c',
                message: ' proc.',
              })}
            </li>
          </ul>
        )}
        {this.isSunfury && (
          <ul>
            <li>
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.sunfury.li1.a',
                message: 'You have less than 12 ',
              })}
              {arcaneSalvo}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.sunfury.li1.b',
                message: ' stacks and a ',
              })}
              {clearcasting}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.explanation.sunfury.li1.c',
                message: ' proc.',
              })}
            </li>
          </ul>
        )}
        {this.isSpellslinger && this.hasOverpoweredMissiles && (
          <>
            <TipBox
              type="note"
              title={t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileClipping.title',
                message: 'Missile Clipping',
              })}
            >
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileClipping.p1',
                message: "If you don't have an ",
              })}
              {overpoweredMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileClipping.p2',
                message: ' proc, you should clip your ',
              })}
              {arcaneMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileClipping.p3',
                message: ' channel once the ',
              })}
              {arcaneMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileClipping.p4',
                message: ' GCD ends.',
              })}
            </TipBox>
          </>
        )}
        {this.isSunfury && (
          <>
            <TipBox
              type="note"
              title={t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileChaining.title',
                message: 'Missile Chaining',
              })}
            >
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileChaining.p1',
                message: 'If you are casting ',
              })}
              {arcaneMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileChaining.p2',
                message:
                  ' back to back, you can attempt to cast ',
              })}
              {arcaneMissiles}
              {t({
                id: 'mage.arcane.arcaneMissiles.guide.tipbox.missileChaining.p3',
                message:
                  ' just before the last tick of the previous cast. This will chain into the second channel and will still result in the same number of missile waves.',
              })}
            </TipBox>
          </>
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
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.noCasts.title.a',
              message: 'No ',
            })}
            {arcaneMissiles}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.noCasts.title.b',
              message: ' casts were detected.',
            })}
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
          <>
            {formatDurationMillisMinSec(this.arcaneMissiles.averageChannelDelay, 3)}
            {t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.avgChannelEndDelayTooltip',
              message: ' Average Delay from End Channel to Next Cast.',
            })}
          </>
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
            value: cast.salvoStacks,
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.arcaneSalvoStacks',
              message: 'Arcane Salvo Stacks',
            }),
            tooltip: (
              <>
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.stat.arcaneSalvoStacksTooltip',
                  message: 'The number of Arcane Salvo stacks at the time of cast.',
                })}
              </>
            ),
          },
          {
            value: cast.clearcastingProcs,
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.clearcastingProcs',
              message: 'Clearcasting Procs',
            }),
            tooltip: (
              <>
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.stat.clearcastingProcsTooltip',
                  message: 'The number of Clearcasting procs the player had.',
                })}
              </>
            ),
          },
          {
            value: cast.opMissiles ? 'Yes' : 'No',
            label: t({
              id: 'mage.arcane.arcaneMissiles.guide.stat.hadOverpoweredMissiles',
              message: 'Had Overpowered Missiles',
            }),
            tooltip: (
              <>
                {t({
                  id: 'mage.arcane.arcaneMissiles.guide.stat.hadOverpoweredMissilesTooltip',
                  message: 'Whether the player had an Overpowered Missiles proc or not.',
                })}
              </>
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
                  <>
                    {t({
                      id: 'mage.arcane.arcaneMissiles.guide.stat.channelEndDelayTooltip',
                      message: 'Time between channel end and next cast.',
                    })}
                  </>
                ),
                performance: this.arcaneMissiles.channelDelayUtil(cast.channelEndDelay),
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
