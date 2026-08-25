import { type JSX } from 'react';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Analyzer from 'parser/core/Analyzer';
import GuideSection from 'interface/guide/components/GuideSection';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import { TipBox } from 'interface/guide/components';

import PrismaticBolt, { PrismaticBoltCast } from '../analyzers/PrismaticBolt';
import { CastDetail, PerCastData, type PerCastStat } from 'interface/guide/components';
import { formatDurationMillisMinSec } from 'common/format';

class PrismaticBoltGuide extends Analyzer {
  static dependencies = {
    prismaticBolt: PrismaticBolt,
  };

  protected prismaticBolt!: PrismaticBolt;

  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);

  private evaluatePrismaticBolt(pb: PrismaticBoltCast): CastEvaluation {
    // FAIL CONDITIONS
    if (!pb.delay) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `No Prismatic Bolt cast found.`,
      };
    }

    if (pb.delay && pb.delay > 20000) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Fail,
        reason: `Prismatic Bolt delayed by ${formatDurationMillisMinSec(pb.delay)}`,
      };
    }

    // PERFECT CONDITIONS
    if (
      this.isSpellslinger &&
      pb.salvoStacks >= 13 &&
      (!pb.hasClearcasting || pb.cumulativePowerStacks >= 6 || !pb.has4pc)
    ) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `Had ${pb.salvoStacks} Arcane Salvo Stacks ${pb.hasClearcasting ? 'with Clearcasting' : 'without Clearcasting'} and ${pb.has4pc ? `and ${pb.cumulativePowerStacks} Cumulative Power stacks.` : 'no 4pc tier set bonus.'}`,
      };
    }

    if (this.isSunfury && pb.cumulativePowerStacks >= 8) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `Had ${pb.cumulativePowerStacks} Cumulative Power stacks.`,
      };
    }

    // GOOD CONDITIONS
    if (this.isSpellslinger && pb.targetsHit >= 2) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Hit ${pb.targetsHit} targets.`,
      };
    }

    if (this.isSunfury && !pb.has4pc) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Good,
        reason: `Did not have 4pc tier set bonus.`,
      };
    }

    // OK CONDITIONS
    if (this.isSpellslinger && pb.salvoStacks < 13) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Had ${pb.salvoStacks} Arcane Salvo stacks.`,
      };
    }

    if (
      this.isSpellslinger &&
      pb.salvoStacks >= 13 &&
      pb.has4pc &&
      pb.hasClearcasting &&
      pb.cumulativePowerStacks < 6
    ) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Had ${pb.salvoStacks} Arcane Salvo Stacks, had the 4pc set bonus, Clearcasting, and ${pb.cumulativePowerStacks} Cumulative Power stacks.`,
      };
    }

    if (this.isSpellslinger && pb.targetsHit < 2) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `Hit ${pb.targetsHit} targets.`,
      };
    }

    if (this.isSunfury && pb.cumulativePowerStacks < 8) {
      return {
        timestamp: pb.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `had ${pb.cumulativePowerStacks} targets.`,
      };
    }

    // DEFAULT
    return {
      timestamp: pb.timestamp,
      performance: QualitativePerformance.Fail,
      reason: `Unknown performance condition. Please report this!`,
    };
  }

  get guideSubsection(): JSX.Element {
    const prismaticBolt = <SpellLink spell={SPELLS.PRISMATIC_BOLT} />;
    const arcaneSalvo = <SpellLink spell={TALENTS.ARCANE_SALVO_TALENT} />;
    const clearcasting = <SpellLink spell={SPELLS.CLEARCASTING_ARCANE} />;
    const cumulativePower = <SpellLink spell={SPELLS.CUMULATIVE_POWER_BUFF} />;

    const explanation = (
      <>
        <p>
          <b>{prismaticBolt}</b>{' '}
          {t({
            id: 'mage.arcane.prismaticBolt.guide.explanation.p1',
            message:
              'is Arcane’s new apex talent, added in 12.1, and is very strong. It is a large contributor to your DPS and it does not stack, so you should make sure you are spending it as quickly as possible while following the below guidelines to get the most out of each cast.',
          })}
        </p>
        {this.isSpellslinger && (
          <p>
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.spellslinger.a',
              message:
                'You should cast ',
            })}
            {prismaticBolt}{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.spellslinger.b',
              message:
                'if it will hit 2 or more targets or if you have at least 13 stacks of ',
            })}
            {arcaneSalvo}{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.spellslinger.c',
              message: 'and one of the below are true:',
            })}
            <ul>
              <li>
                {t({
                  id: 'mage.arcane.prismaticBolt.guide.explanation.li1.a',
                  message: 'You have 6 or more stacks of ',
                })}
                {cumulativePower}.
              </li>
              <li>
                {t({
                  id: 'mage.arcane.prismaticBolt.guide.explanation.li2.a',
                  message: 'You do not have ',
                })}
                {clearcasting}.
              </li>
              <li>
                {t({
                  id: 'mage.arcane.prismaticBolt.guide.explanation.li3',
                  message: 'You do not have your 4pc tier set bonus.',
                })}
              </li>
            </ul>
          </p>
        )}
        {this.isSunfury && (
          <p>
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.sunfury.a',
              message: 'You should cast ',
            })}
            {prismaticBolt}{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.sunfury.b',
              message: 'if you have 8 or more stacks of ',
            })}
            {cumulativePower}.{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.sunfury.c',
              message:
                'If you do not have your 4pc tier set bonus, you can just cast ',
            })}
            {prismaticBolt}{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.explanation.sunfury.d',
              message: 'as soon as you get the buff.',
            })}
          </p>
        )}
      </>
    );

    if (this.prismaticBolt.prismaticBolts.length === 0) {
      return (
        <GuideSection
          spell={SPELLS.PRISMATIC_BOLT}
          explanation={explanation}
          title={t({
            id: 'mage.arcane.prismaticBolt.guide.title',
            message: 'Prismatic Bolt',
          })}
        >
          <TipBox
            type="note"
            title={t({
              id: 'mage.arcane.prismaticBolt.guide.noCastsFound.title',
              message: 'No Casts Found',
            })}
          >
            {t({
              id: 'mage.arcane.prismaticBolt.guide.noCastsFound.description',
              message: 'No ',
            })}
            {prismaticBolt}{' '}
            {t({
              id: 'mage.arcane.prismaticBolt.guide.noCastsFound.description2',
              message: 'casts were detected.',
            })}
          </TipBox>
        </GuideSection>
      );
    }

    const perCastData: PerCastData[] = this.prismaticBolt.prismaticBolts.map((cast, index) => {
      const evaluation = this.evaluatePrismaticBolt(cast);

      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(cast.timestamp),
        stats: [
          {
            value: formatDurationMillisMinSec(cast.delay || 0, 1),
            label: t({
              id: 'mage.arcane.prismaticBolt.guide.stat.delayLabel',
              message: 'Delay until Cast',
            }),
            tooltip:
              t({
                id: 'mage.arcane.prismaticBolt.guide.stat.delayTooltip',
                message:
                  'The amount of time from when the player got the Prismatic Bolt buff until they cast Prismatic Bolt.',
              }),
          },
          {
            value: cast.salvoStacks,
            label: t({
              id: 'mage.arcane.prismaticBolt.guide.stat.salvoLabel',
              message: 'Arcane Salvo Stacks',
            }),
            tooltip:
              t({
                id: 'mage.arcane.prismaticBolt.guide.stat.salvoTooltip',
                message: 'The number of Arcane Salvo stacks the player had.',
              }),
          },
          {
            value: cast.cumulativePowerStacks,
            label: t({
              id: 'mage.arcane.prismaticBolt.guide.stat.powerLabel',
              message: 'Cumulative Power Stacks',
            }),
            tooltip:
              t({
                id: 'mage.arcane.prismaticBolt.guide.stat.powerTooltip',
                message: 'The number of Cumulative Power stacks the player had.',
              }),
          },
        ].filter(Boolean) as PerCastStat[],
        details: evaluation.reason,
      };
    });

    return (
      <GuideSection
        spell={SPELLS.PRISMATIC_BOLT}
        explanation={explanation}
        title={t({
          id: 'mage.arcane.prismaticBolt.guide.title',
          message: 'Prismatic Bolt',
        })}
      >
        <CastDetail
          title={t({
            id: 'mage.arcane.prismaticBolt.guide.castDetailTitle',
            message: 'Prismatic Bolt Casts',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default PrismaticBoltGuide;
