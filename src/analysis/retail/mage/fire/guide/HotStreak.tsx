import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import Spell from 'common/SPELLS/Spell';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummary, { type CastEvaluation } from 'interface/guide/components/CastSummary';
import GuideSection from 'interface/guide/components/GuideSection';
import { i18n } from '@lingui/core';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import HotStreak, { HotStreakProc } from '../core/HotStreak';
import { CastOverview, StackedBar, type StackedBarSegment } from 'interface/guide/components';
import { formatDurationMillisMinSec } from 'common/format';

class HotStreakGuide extends Analyzer {
  static dependencies = {
    hotStreak: HotStreak,
  };

  protected hotStreak!: HotStreak;

  isFrostfire: boolean = this.selectedCombatant.hasTalent(TALENTS.FROSTFIRE_BOLT_TALENT);

  private buildStats() {
    const stats = [];

    const totalUptime = this.selectedCombatant.getBuffUptime(SPELLS.HOT_STREAK);
    const averageUptime = totalUptime / this.hotStreak.hotStreaks.length;

    stats.push({
      value: `${this.hotStreak.expiredProcs}`,
      label: defineMessage({ id: 'mage.fire.hotStreakGuide.expiredProcs', message: 'Expired Procs' }),
      tooltip: (
        <Trans id="mage.fire.hotStreakGuide.expiredProcsTooltip">
          Number of Hot Streak procs that expired before they could be spent.
        </Trans>
      ),
      performance: this.hotStreak.expiredProcsPerformance,
    });
    stats.push({
      value: `${this.hotStreak.wastedCrits.length}`,
      label: defineMessage({ id: 'mage.fire.hotStreakGuide.wastedCrits', message: 'Wasted Crits' }),
      tooltip: (
        <Trans id="mage.fire.hotStreakGuide.wastedCritsTooltip">
          Number of times a direct damage fire spell crit against your target while you already had
          Hot Streak.
        </Trans>
      ),
      performance: this.hotStreak.wastedCritsPerformance,
    });
    stats.push({
      value: formatDurationMillisMinSec(averageUptime, 2),
      label: defineMessage({
        id: 'mage.fire.hotStreakGuide.averageProcUptime',
        message: 'Average Proc Uptime',
      }),
      tooltip: (
        <Trans id="mage.fire.hotStreakGuide.averageProcUptimeTooltip">
          Average amount of time Hot Streak was active before it was used (or expired).
        </Trans>
      ),
    });

    return stats;
  }

  private buildSpenderBar(): StackedBarSegment[] {
    const pyroblastCount = this.hotStreak.hotStreaks.filter(
      (hs) => hs.spender?.ability.guid === TALENTS.PYROBLAST_TALENT.id,
    ).length;
    const flamestrikeCount = this.hotStreak.hotStreaks.filter(
      (hs) =>
        hs.spender?.ability.guid === TALENTS.FLAMESTRIKE_1_FIRE_TALENT.id ||
        hs.spender?.ability.guid === TALENTS.FLAMESTRIKE_2_FIRE_TALENT.id,
    ).length;

    return [
      {
        label: defineMessage({ id: 'mage.fire.hotStreakGuide.pyroblast', message: 'Pyroblast' }),
        value: pyroblastCount,
        color: '#e38d4b',
        tooltip: (
          <Trans id="mage.fire.hotStreakGuide.pyroblastTooltip">
            {pyroblastCount} Hot Streak procs spent on Pyroblast
          </Trans>
        ),
      },
      {
        label: defineMessage({ id: 'mage.fire.hotStreakGuide.flamestrike', message: 'Flamestrike' }),
        value: flamestrikeCount,
        color: '#a84444',
        tooltip: (
          <Trans id="mage.fire.hotStreakGuide.flamestrikeTooltip">
            {flamestrikeCount} Hot Streak procs spent on Flamestrike
          </Trans>
        ),
      },
    ];
  }

  private evaluateHotStreakProc(hs: HotStreakProc): CastEvaluation {
    // FAIL CONDITIONS
    if (hs.expired) {
      return {
        timestamp: hs.remove.timestamp,
        performance: QualitativePerformance.Fail,
        reason: defineMessage({
          id: 'mage.fire.hotStreakGuide.procExpired',
          message: 'Hot Streak Proc Expired',
        }),
      };
    }

    // GOOD CONDITIONS
    if (hs.activeBuffs.length > 0) {
      const buffs = hs.activeBuffs.map((buff: Spell) => buff.name);
      return {
        timestamp: hs.remove.timestamp,
        performance: QualitativePerformance.Good,
        reason: i18n._(
          defineMessage({
            id: 'mage.fire.hotStreakGuide.guaranteedCritBuff',
            message: 'Had Guaranteed Crit Buff: {buffs}',
            values: { buffs: buffs.join(', ') },
          }),
        ),
      };
    }

    if (hs.precast) {
      return {
        timestamp: hs.remove.timestamp,
        performance: QualitativePerformance.Good,
        reason: i18n._(
          defineMessage({
            id: 'mage.fire.hotStreakGuide.precasteUsed',
            message: 'Hot Streak used with precast ({precastAbility})',
            values: { precastAbility: hs.precast.ability.name },
          }),
        ),
      };
    }

    // OK CONDITIONS
    if (!hs.precast) {
      return {
        timestamp: hs.remove.timestamp,
        performance: QualitativePerformance.Ok,
        reason: defineMessage({
          id: 'mage.fire.hotStreakGuide.noPrecastOrCritBuff',
          message: 'Hot Streak used without a precast or guaranteed crit buff',
        }),
      };
    }

    // DEFAULT
    return {
      timestamp: hs.remove.timestamp,
      performance: QualitativePerformance.Fail,
      reason: defineMessage({
        id: 'mage.fire.hotStreakGuide.unknownPerformance',
        message: 'Unknown Performance Condition (Please report this).',
      }),
    };
  }

  get guideSubsection(): JSX.Element {
    const combustion = <SpellLink spell={TALENTS.COMBUSTION_TALENT} />;
    const firestarter = <SpellLink spell={TALENTS.FIRESTARTER_TALENT} />;
    const heatingUp = <SpellLink spell={SPELLS.HEATING_UP} />;
    const hotStreak = <SpellLink spell={SPELLS.HOT_STREAK} />;
    const fireball = <SpellLink spell={SPELLS.FIREBALL} />;
    const frostfireBolt = <SpellLink spell={TALENTS.FROSTFIRE_BOLT_TALENT} />;
    const pyroblast = <SpellLink spell={TALENTS.PYROBLAST_TALENT} />;
    const flamestrike = <SpellLink spell={SPELLS.FLAMESTRIKE} />;
    const ignite = <SpellLink spell={SPELLS.IGNITE} />;

    const explanation = (
      <>
        <strong>{hotStreak}</strong>
        {t({
          id: 'mage.fire.hotStreakGuide.explanation.p1',
          message: ' makes your next ',
        })}
        {pyroblast}
        {t({
          id: 'mage.fire.hotStreakGuide.explanation.p2',
          message: ' or ',
        })}
        {flamestrike}
        {t({
          id: 'mage.fire.hotStreakGuide.explanation.p3',
          message:
            ' instant cast, making it a large contributor to your direct damage and ticking ',
        })}
        {ignite}
        {t({
          id: 'mage.fire.hotStreakGuide.explanation.p4',
          message:
            ' damage. The majority of your rotation revolves around getting as many of these procs as possible.',
        })}
        <ul>
          <li>
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li1',
              message: "Use your procs and don't let them expire.",
            })}
          </li>
          <li>
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li2',
              message: "You can't generate ",
            })}
            {heatingUp}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li2a',
              message: ' while you have ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li2b',
              message: ', so spend ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li2c',
              message: ' quickly to avoid wasted crits.',
            })}
          </li>
          <li>
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3',
              message: 'When you have ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3a',
              message: ' and are not guaranteed to crit, you should cast ',
            })}
            {this.isFrostfire ? frostfireBolt : fireball}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3b',
              message: ' immediately before your instant ',
            })}
            {pyroblast}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3c',
              message: ' to increase the chance of getting another ',
            })}
            {heatingUp}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3d',
              message: ' or ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li3e',
              message: '.',
            })}
          </li>
          <li>
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4',
              message: 'If you have ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4a',
              message: ' and are guaranteed to crit via ',
            })}
            {combustion}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4b',
              message: ' or ',
            })}
            {firestarter}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4c',
              message: ' you can press ',
            })}
            {pyroblast}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4d',
              message: ' twice at the end of your ',
            })}
            {this.isFrostfire ? frostfireBolt : fireball}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4e',
              message: ' cast since both spells will crit and immediately give you another ',
            })}
            {hotStreak}
            {t({
              id: 'mage.fire.hotStreakGuide.explanation.li4f',
              message: '.',
            })}
          </li>
        </ul>
      </>
    );

    return (
      <GuideSection spell={SPELLS.HOT_STREAK} explanation={explanation}>
        <CastOverview
          spell={SPELLS.HOT_STREAK}
          stats={this.buildStats()}
          additionalContent={{
            title: t({
              id: 'mage.fire.hotStreakGuide.spenderBreakdown',
              message: 'Spender Breakdown',
            }),
            content: <StackedBar segments={this.buildSpenderBar()} />,
          }}
        />
        <CastSummary
          spell={SPELLS.HOT_STREAK}
          casts={this.hotStreak.hotStreaks.map((proc) => this.evaluateHotStreakProc(proc))}
          showBreakdown
        />
      </GuideSection>
    );
  }
}

export default HotStreakGuide;
