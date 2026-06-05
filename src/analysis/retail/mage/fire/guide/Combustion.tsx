import type { JSX } from 'react';
import { formatDurationMillisMinSec, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Analyzer from 'parser/core/Analyzer';
import { type CastEvaluation } from 'interface/guide/components/CastSummary';
import GuideSection from 'interface/guide/components/GuideSection';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import { SpellSequence, type CastInSequence } from 'interface/guide/components/CastSequence';
import { EventType, GetRelatedEvent, CastEvent } from 'parser/core/Events';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import CombustionCasts, { CombustionCast } from '../core/Combustion';

const HOT_STREAK_CASTS = [
  TALENTS.PYROBLAST_TALENT.id,
  SPELLS.FLAMESTRIKE.id,
  TALENTS.FLAMESTRIKE_1_FIRE_TALENT.id,
  TALENTS.FLAMESTRIKE_2_FIRE_TALENT.id,
];

class CombustionGuide extends Analyzer {
  static dependencies = {
    combustion: CombustionCasts,
  };

  protected combustion!: CombustionCasts;

  private evaluateCombustionCast(cb: CombustionCast): CastEvaluation {
    const combustDuration = cb.remove - cb.cast.timestamp;
    const activeTimePercent = cb.activeTime / combustDuration;

    const activeTimePerf = this.combustion.activeTimePerformance(cb.activeTime, combustDuration);
    const delayPerf = this.combustion.combustionCastDelayPerformance(cb.castDelay);

    // Check for hardcast Fireballs during Combustion (fail)
    const fireballCasts = cb.spellCasts.filter((sc: CastEvent) => {
      if (sc.ability.guid !== SPELLS.FIREBALL.id) {
        return false;
      }
      const beginCast = GetRelatedEvent(sc, EventType.BeginCast);
      if (this.selectedCombatant.hasBuff(TALENTS.COMBUSTION_TALENT.id, beginCast?.timestamp)) {
        return true;
      }
      return false;
    });

    // FAIL CONDITIONS
    if (fireballCasts.length > 0) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.combustionGuide.fireballInCombustion',
          message: '{0} Hardcast Fireball(s) during Combustion',
        }).replace('{0}', String(fireballCasts.length)),
      };
    }

    if (activeTimePerf === QualitativePerformance.Fail) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Fail,
        reason: t({
          id: 'mage.fire.combustionGuide.lowActiveTime',
          message: 'Low Active Time: {0} ({1} / {2})',
        })
          .replace('{0}', formatPercentage(activeTimePercent, 1) + '%')
          .replace('{1}', formatDurationMillisMinSec(cb.activeTime, 1))
          .replace('{2}', formatDurationMillisMinSec(combustDuration, 1)),
      };
    }

    // PERFECT CONDITIONS
    if (activeTimePerf === QualitativePerformance.Perfect) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Perfect,
        reason: `${formatPercentage(activeTimePercent, 1)}% Active Time`,
      };
    }

    // GOOD CONDITIONS
    if (activeTimePerf === QualitativePerformance.Good) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Good,
        reason: `${formatPercentage(activeTimePercent, 1)}% Active Time`,
      };
    }

    // OK CONDITIONS
    if (delayPerf === QualitativePerformance.Fail) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: t({
          id: 'mage.fire.combustionGuide.highCastDelay',
          message: 'High Cast Delay: {0} - wasted Combustion duration',
        }).replace('{0}', formatDurationMillisMinSec(cb.castDelay, 2)),
      };
    }

    if (activeTimePerf === QualitativePerformance.Ok) {
      return {
        timestamp: cb.cast.timestamp,
        performance: QualitativePerformance.Ok,
        reason: `${formatPercentage(activeTimePercent, 1)}% Active Time`,
      };
    }

    return {
      timestamp: cb.cast.timestamp,
      performance: QualitativePerformance.Fail,
      reason: t({
        id: 'mage.fire.combustionGuide.unknownPerformance',
        message: 'Unknown Performance Conditions (Please report this)',
      }),
    };
  }

  get guideSubsection(): JSX.Element {
    const fireblast = <SpellLink spell={SPELLS.FIRE_BLAST} />;
    const combustion = <SpellLink spell={TALENTS.COMBUSTION_TALENT} />;
    const hotStreak = <SpellLink spell={SPELLS.HOT_STREAK} />;
    const scorch = <SpellLink spell={SPELLS.SCORCH} />;
    const fireball = <SpellLink spell={SPELLS.FIREBALL} />;
    const pyroblast = <SpellLink spell={TALENTS.PYROBLAST_TALENT} />;
    const flamestrike = <SpellLink spell={SPELLS.FLAMESTRIKE} />;

    const explanation = (
      <Trans id="mage.fire.combustionGuide.explanation">
        <b>{combustion}</b> is a very strong burst cooldown with a short duration. To maximize your
        burst, use as many instant casts as possible to maximize {hotStreak}s gained and spent
        before {combustion} ends.
        <ul>
          <li>
            Hardcast an ability like {fireball} or {pyroblast} and activate {combustion} as close to
            the end of your hardcast as possible. This will give you maximum uptime of {combustion}{' '}
            and allow your hardcast to land while {combustion} is active.
          </li>
          <li>
            Spend as many {hotStreak}s as possible during {combustion} and avoid any downtime.
          </li>
          <li>
            Don't hardcast {fireball}, {pyroblast}, or {flamestrike} during {combustion}. Use{' '}
            {scorch} if you are running low on {fireblast} charges.
          </li>
        </ul>
      </Trans>
    );

    const combustSequences = this.combustion.combustCasts.map((cb) => {
      const mapEvent = (castEvent: CastEvent): CastInSequence => {
        const beginCast = GetRelatedEvent(castEvent, EventType.BeginCast);
        const isHardcastFireball =
          castEvent.ability.guid === SPELLS.FIREBALL.id &&
          this.selectedCombatant.hasBuff(TALENTS.COMBUSTION_TALENT.id, beginCast?.timestamp);
        return {
          timestamp: castEvent.timestamp,
          spellId: castEvent.ability.guid,
          spellName: castEvent.ability.name,
          icon: castEvent.ability.abilityIcon.replace('.jpg', ''),
          performance: isHardcastFireball ? QualitativePerformance.Fail : undefined,
          tooltip: isHardcastFireball ? (
            <Trans id="mage.fire.combustionGuide.hardcastFireballTooltip">
              Hardcast Fireball during Combustion — significant DPS loss
            </Trans>
          ) : undefined,
        };
      };

      // The precast lands after Combustion activates and may appear in spellCasts.
      // Filter it out and prepend it so it always displays first in the sequence.
      const spellCastsWithoutPrecast = cb.precast
        ? cb.spellCasts.filter(
            (sc) =>
              sc.timestamp !== cb.precast!.timestamp ||
              sc.ability.guid !== cb.precast!.ability.guid,
          )
        : cb.spellCasts;

      const casts: CastInSequence[] = [
        ...(cb.precast ? [mapEvent(cb.precast)] : []),
        ...spellCastsWithoutPrecast.map(mapEvent),
      ];
      return { casts };
    });

    const perCastData: PerCastData[] = this.combustion.combustCasts.map((cb, index) => {
      const evaluation = this.evaluateCombustionCast(cb);
      const combustDuration = cb.remove - cb.cast.timestamp;
      const activeTimePercent = cb.activeTime / combustDuration;
      const activeTimePerf = this.combustion.activeTimePerformance(cb.activeTime, combustDuration);
      const delayPerf = this.combustion.combustionCastDelayPerformance(cb.castDelay);
      const hotStreakCasts = cb.spellCasts.filter((sc) => {
        return HOT_STREAK_CASTS.includes(sc.ability.guid);
      });
      const sequenceEntry = combustSequences[index];

      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(cb.cast.timestamp),
        stats: [
          {
            value: `${formatPercentage(activeTimePercent, 0)}%`,
            label: t({ id: 'mage.fire.combustionGuide.activeTimeLabel', message: 'Active Time' }),
            tooltip: (
              <Trans id="mage.fire.combustionGuide.activeTimeTooltip">
                {formatDurationMillisMinSec(cb.activeTime, 1)} active out of{' '}
                {formatDurationMillisMinSec(combustDuration, 1)} total Combustion duration
              </Trans>
            ),
            performance: activeTimePerf,
          },
          ...(cb.precast
            ? [
                {
                  value: formatDurationMillisMinSec(cb.castDelay, 2),
                  label: t({ id: 'mage.fire.combustionGuide.castDelayLabel', message: 'Cast Delay' }),
                  tooltip: (
                    <Trans id="mage.fire.combustionGuide.castDelayTooltip">
                      Time wasted between Combustion cast and the precast landing
                    </Trans>
                  ),
                  performance: delayPerf,
                },
              ]
            : [
                {
                  value: t({ id: 'mage.fire.combustionGuide.noPrecastValue', message: 'No' }),
                  label: t({
                    id: 'mage.fire.combustionGuide.precastFoundLabel',
                    message: 'Precast Found',
                  }),
                  tooltip: t({
                    id: 'mage.fire.combustionGuide.noPrecastFoundTooltip',
                    message: 'No Precast Found',
                  }),
                  performance: QualitativePerformance.Fail,
                },
              ]),
          {
            value: `${hotStreakCasts.length}`,
            label: t({
              id: 'mage.fire.combustionGuide.hotStreakCastsLabel',
              message: 'Hot Streak Casts',
            }),
            tooltip: (
              <Trans id="mage.fire.combustionGuide.hotStreakCastsTooltip">
                Total number of Pyroblasts and/or Flamestrikes cast during Combustion.
              </Trans>
            ),
          },
        ],
        details: evaluation.reason,
        additionalContent: sequenceEntry
          ? {
              title: t({ id: 'mage.fire.combustionGuide.castSequence', message: 'Cast Sequence' }),
              content: <SpellSequence casts={sequenceEntry.casts} iconSize={40} />,
            }
          : undefined,
      };
    });

    return (
      <GuideSection spell={TALENTS.COMBUSTION_TALENT} explanation={explanation}>
        <CastDetail
          title={t({ id: 'mage.fire.combustionGuide.combustionCasts', message: 'Combustion Casts' })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default CombustionGuide;
