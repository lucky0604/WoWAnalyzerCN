import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { JSX } from 'react';
import { formatPercentage, formatNumber, formatDurationMillisMinSec } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { EventType } from 'parser/core/Events';
import Analyzer from 'parser/core/Analyzer';
import TouchOfTheMagi, { TouchOfTheMagiData } from '../analyzers/TouchOfTheMagi';
import GuideSection from 'interface/guide/components/GuideSection';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import {
  SpellSequence,
  type CastSequenceEntry,
  type CastInSequence,
} from 'interface/guide/components/CastSequence';
import CastOverview from 'interface/guide/components/CastOverview';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';

import EventHistory from 'parser/shared/modules/EventHistory';

const TOUCH_WINDOW_BUFFER_MS = 7500; // 7.5 seconds before and after

class TouchOfTheMagiGuide extends Analyzer {
  static dependencies = {
    touchOfTheMagi: TouchOfTheMagi,
    eventHistory: EventHistory,
  };

  protected touchOfTheMagi!: TouchOfTheMagi;
  protected eventHistory!: EventHistory;

  isSunfury: boolean = this.selectedCombatant.hasTalent(TALENTS.MEMORY_OF_ALAR_TALENT);
  isSpellslinger: boolean = this.selectedCombatant.hasTalent(TALENTS.SPLINTERSTORM_TALENT);

  private evaluateTouchCast(cast: TouchOfTheMagiData): CastEvaluation {
    const activeTime = cast.activeTime || 0;
    const activeTimePerf = this.touchOfTheMagi.activeTimeUtil(activeTime) as QualitativePerformance;

    // Fail conditions (highest priority)

    if (activeTimePerf === QualitativePerformance.Fail) {
      return {
        timestamp: cast.applied,
        performance: QualitativePerformance.Fail,
        reason: `Very low active time during Touch of the Magi(${formatPercentage(activeTime, 1)}%)`,
      };
    }

    if (cast.surgeCD < 40000) {
      return {
        timestamp: cast.applied,
        performance: QualitativePerformance.Fail,
        reason: `Arcane Surge available soon (${formatDurationMillisMinSec(cast.surgeCD)} remaining)`,
      };
    }

    // Perfect conditions
    if (activeTimePerf === QualitativePerformance.Perfect) {
      return {
        timestamp: cast.applied,
        performance: QualitativePerformance.Perfect,
        reason: `Excellent uptime during Touch of the Magi(${formatPercentage(activeTime, 1)}%)`,
      };
    }

    // Good conditions
    if (activeTimePerf === QualitativePerformance.Good) {
      return {
        timestamp: cast.applied,
        performance: QualitativePerformance.Good,
        reason: `Good uptime during Touch of the Magi(${formatPercentage(activeTime, 1)}%)`,
      };
    }

    // Ok conditions
    if (activeTimePerf === QualitativePerformance.Ok) {
      return {
        timestamp: cast.applied,
        performance: QualitativePerformance.Ok,
        reason: `Low uptime during Touch of the Magi (${formatPercentage(activeTime, 1)}%)`,
      };
    }

    // Default fallback
    return {
      timestamp: cast.applied,
      performance: QualitativePerformance.Fail,
      reason: `Unknown performance condition. Please report this!`,
    };
  }

  get guideSubsection(): JSX.Element {
    const touchOfTheMagi = <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />;
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;
    const arcaneSurge = <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />;
    const sunfuryExecution = <SpellLink spell={TALENTS.SUNFURY_EXECUTION_TALENT} />;

    const explanation = (
      <>
        <strong>{touchOfTheMagi}</strong>
        {t({
          id: 'mage.arcane.touchOfTheMagi.guide.explanation.p1',
          message: ' is a short debuff available for each burn phase and grants you 4 ',
        })}
        {arcaneCharge}
        {t({
          id: 'mage.arcane.touchOfTheMagi.guide.explanation.p2',
          message: 's and accumulates 20% of your damage for the duration. When the debuff expires it explodes dealing damage to the target and reduced damage to nearby targets. Following the below guidelines will help you get the most out of the debuff:',
        })}
        <ul>
          {this.isSpellslinger && (
            <li>
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1',
                message: 'Just before casting ',
              })}
              {touchOfTheMagi}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1a',
                message: ', you should cast ',
              })}
              {arcaneBarrage}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1b',
                message: ' to expend all of your ',
              })}
              {arcaneCharge}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1c',
                message: 's and then cast ',
              })}
              {touchOfTheMagi}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1d',
                message: ' while ',
              })}
              {arcaneBarrage}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li1e',
                message: ' is in the air.',
              })}
            </li>
          )}
          {this.isSunfury && (
            <li>
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li2',
                message: 'Instead of using ',
              })}
              {arcaneBarrage}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li2a',
                message: ' just before ',
              })}
              {touchOfTheMagi}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li2b',
                message: ', you should use it immediately after to buff the damage of the ',
              })}
              {arcaneBarrage}
              {t({
                id: 'mage.arcane.touchOfTheMagi.guide.explanation.li2c',
                message: ' via ',
              })}
              {sunfuryExecution}
            </li>
          )}
          <li>
            {t({
              id: 'mage.arcane.touchOfTheMagi.guide.explanation.li3',
              message: 'If ',
            })}
            {arcaneSurge}
            {t({
              id: 'mage.arcane.touchOfTheMagi.guide.explanation.li3a',
              message: ' will be available within the next 40 seconds, you should hold ',
            })}
            {touchOfTheMagi}
            {t({
              id: 'mage.arcane.touchOfTheMagi.guide.explanation.li3b',
              message: ' to ensure ',
            })}
            {arcaneSurge}
            {t({
              id: 'mage.arcane.touchOfTheMagi.guide.explanation.li3c',
              message: ' can be used while the ',
            })}
            {touchOfTheMagi}
            {t({
              id: 'mage.arcane.touchOfTheMagi.guide.explanation.li3d',
              message: ' debuff is active.',
            })}
          </li>
        </ul>
      </>
    );

    const activeTimeTooltip = (
      <Trans id="mage.arcane.touchOfTheMagi.guide.activeTimeTooltip">
        {formatPercentage(this.touchOfTheMagi.averageActiveTime)}% average Active Time per Touch of
        the Magi cast.
      </Trans>
    );

    const activeTimePerf = this.touchOfTheMagi.activeTimeUtil(
      this.touchOfTheMagi.averageActiveTime,
    );

    const averageDamageTooltip = (
      <Trans id="mage.arcane.touchOfTheMagi.guide.averageDamageTooltip">
        {formatNumber(this.touchOfTheMagi.averageDamage)} average damage per Touch of the Magi cast.
      </Trans>
    );

    // Get cast sequences for each Touch of the Magi window
    const touchSequenceEvents: CastSequenceEntry<TouchOfTheMagiData>[] =
      this.touchOfTheMagi.touchData.map((cast) => {
        const windowStart = cast.applied - TOUCH_WINDOW_BUFFER_MS;
        const windowEnd = cast.applied + TOUCH_WINDOW_BUFFER_MS;

        // Filter for cast events during the Touch window
        const castEvents = this.eventHistory.getEvents([EventType.Cast], {
          searchBackwards: false,
          startTimestamp: windowStart,
          duration: windowEnd - windowStart,
        });

        // Convert to CastInSequence format
        const casts: CastInSequence[] = castEvents.map((event) => ({
          timestamp: event.timestamp,
          spellId: event.ability.guid,
          spellName: event.ability.name,
          icon: event.ability.abilityIcon.replace('.jpg', ''),
          performance: undefined, // Could add performance evaluation per cast if desired
        }));

        return {
          data: cast,
          start: windowStart,
          end: windowEnd,
          casts,
        };
      });

    // Prepare per-cast data for CastDetail
    const perCastData: PerCastData[] = this.touchOfTheMagi.touchData.map((cast, index) => {
      const evaluation = this.evaluateTouchCast(cast);
      const sequenceEntry = touchSequenceEvents[index];

      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(cast.applied),
        stats: [
          {
            value: `${cast.charges}`,
            label: t({ id: 'mage.arcane.touchOfTheMagi.guide.stat.charges', message: 'Charges' }),
            tooltip: (
              <Trans id="mage.arcane.touchOfTheMagi.guide.stat.chargesTooltip">
                Arcane Charges before Touch of the Magi cast
              </Trans>
            ),
          },
          {
            value: `${formatPercentage(cast.activeTime || 0, 0)}%`,
            label: t({ id: 'mage.arcane.touchOfTheMagi.guide.stat.active', message: 'Active' }),
            tooltip: (
              <Trans id="mage.arcane.touchOfTheMagi.guide.stat.activeTooltip">
                Percentage of time spent actively casting during the window
              </Trans>
            ),
          },
          {
            value: formatNumber(cast.totalDamage),
            label: t({ id: 'mage.arcane.touchOfTheMagi.guide.stat.damage', message: 'Damage' }),
            tooltip: (
              <Trans id="mage.arcane.touchOfTheMagi.guide.stat.damageTooltip">
                Total damage accumulated during this Touch of the Magi
              </Trans>
            ),
          },
          {
            value: formatDurationMillisMinSec(cast.surgeCD),
            label: t({ id: 'mage.arcane.touchOfTheMagi.guide.stat.surgeCd', message: 'Surge CD' }),
            tooltip: (
              <Trans id="mage.arcane.touchOfTheMagi.guide.stat.surgeCdTooltip">
                Arcane Surge Remaining Cooldown.
              </Trans>
            ),
          },
        ],
        details: evaluation.reason,
        additionalContent: sequenceEntry
          ? {
              title: t({
                id: 'mage.arcane.touchOfTheMagi.guide.castSequence',
                message: 'Cast Sequence',
              }),
              content: <SpellSequence casts={sequenceEntry.casts} iconSize={40} />,
            }
          : undefined,
      };
    });

    return (
      <GuideSection spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} explanation={explanation}>
        <CastOverview
          spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT}
          stats={[
            {
              value: `${formatPercentage(this.touchOfTheMagi.averageActiveTime)}%`,
              label: t({
                id: 'mage.arcane.touchOfTheMagi.guide.stat.averageActiveTime',
                message: 'Average Active Time',
              }),
              tooltip: activeTimeTooltip,
              performance: activeTimePerf,
            },
            {
              value: formatNumber(this.touchOfTheMagi.averageDamage),
              label: t({
                id: 'mage.arcane.touchOfTheMagi.guide.stat.averageDamage',
                message: 'Average Damage',
              }),
              tooltip: averageDamageTooltip,
            },
          ]}
        />
        <CastDetail
          title={t({
            id: 'mage.arcane.touchOfTheMagi.guide.castDetailTitle',
            message: 'Touch of the Magi Casts',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default TouchOfTheMagiGuide;
