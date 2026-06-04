import type { JSX } from 'react';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS';
import { TooltipElement } from 'interface';
import { SpellIcon, SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

import { getHitCount } from '../../normalizers/CastLinkNormalizer';
import { TALENTS_DRUID } from 'common/TALENTS';
import { SubSection } from 'interface/guide';
import DonutChart from 'parser/ui/DonutChart';
import { VeryBadColor, BadColor, PerfectColor } from 'interface/guide';
import Spell from 'common/SPELLS/Spell';
import { RoundedPanel, SideBySidePanels } from 'interface/guide/components/GuideDivs';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';

/**
 * Tracks the number of targets hit by Feral's AoE abilities.
 * Relies on CastLinkNormalizer linking casts to hits.
 */
class HitCountAoE extends Analyzer {
  swipeTracker?: SwipeTracker;
  pwTracker?: PwTracker;
  allTrackers: SpellAoeTracker[] = [];

  hasPw: boolean;

  constructor(options: Options) {
    super(options);

    this.hasPw = this.selectedCombatant.hasTalent(TALENTS_DRUID.PRIMAL_WRATH_TALENT);

    // fill the trackers relevant to talent setup
    this.swipeTracker = this._newAoeTracker(SPELLS.SWIPE_CAT);
    this.allTrackers.push(this.swipeTracker);

    if (this.hasPw) {
      this.pwTracker = this._newAoeTracker(TALENTS_DRUID.PRIMAL_WRATH_TALENT);
      this.allTrackers.push(this.pwTracker);
    }

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SWIPE_CAT), this.onSwipe);

    this.hasPw &&
      this.addEventListener(
        Events.cast.by(SELECTED_PLAYER).spell(TALENTS_DRUID.PRIMAL_WRATH_TALENT),
        this.onPrimalWrath,
      );
  }

  _newAoeTracker(spell: Spell): SpellAoeTracker {
    return {
      spell,
      casts: 0,
      hits: 0,
      zeroHitCasts: 0,
      oneHitCasts: 0,
      multiHitCasts: 0,
    };
  }

  onSwipe(event: CastEvent) {
    this._onAoeCast(event, this.swipeTracker!);
  }

  onPrimalWrath(event: CastEvent) {
    this._onAoeCast(event, this.pwTracker!);
  }

  /** Handles common AoE cast stuff, and returns number of targets hit */
  _onAoeCast(event: CastEvent, tracker: SpellAoeTracker): number {
    const hits = getHitCount(event);

    tracker.casts += 1;
    tracker.hits += hits;
    if (hits === 0) {
      tracker.zeroHitCasts += 1;
      addInefficientCastReason(
        event,
        t({
          id: 'druid.feral.aoe.hit_nothing_reason',
          message: 'This cast hit nothing!',
        }),
      );
    } else if (hits === 1) {
      tracker.oneHitCasts += 1;
    } else {
      tracker.multiHitCasts += 1;
    }
    return hits;
  }

  get swipeChart() {
    if (this.swipeTracker!.casts === 0) {
      return (
        <strong>
          {t({ id: 'druid.shared.spell_never_used', message: 'You never used this spell!' })}
        </strong>
      );
    }

    const items = [
      {
        color: PerfectColor,
        label: t({ id: 'druid.feral.aoe.hit_multi_targets', message: 'Hit 2+ Targets' }),
        value: this.swipeTracker!.multiHitCasts,
      },
      {
        color: BadColor,
        label: t({ id: 'druid.feral.aoe.hit_one_target', message: 'Hit 1 Target' }),
        value: this.swipeTracker!.oneHitCasts,
      },
      {
        color: VeryBadColor,
        label: t({ id: 'druid.feral.aoe.hit_zero_targets', message: 'Hit 0 Targets' }),
        value: this.swipeTracker!.zeroHitCasts,
      },
    ];
    return <DonutChart items={items} />;
  }

  get pwChart() {
    if (this.pwTracker!.casts === 0) {
      return (
        <strong>
          {t({ id: 'druid.shared.spell_never_used', message: 'You never used this spell!' })}
        </strong>
      );
    }

    const items = [
      {
        color: PerfectColor,
        label: t({ id: 'druid.feral.aoe.hit_multi_targets', message: 'Hit 2+ Targets' }),
        value: this.pwTracker!.multiHitCasts,
      },
      {
        color: BadColor,
        label: t({ id: 'druid.feral.aoe.hit_one_target', message: 'Hit 1 Target' }),
        value: this.pwTracker!.oneHitCasts,
      },
      {
        color: VeryBadColor,
        label: t({ id: 'druid.feral.aoe.hit_zero_targets', message: 'Hit 0 Targets' }),
        value: this.pwTracker!.zeroHitCasts,
      },
    ];
    return <DonutChart items={items} />;
  }

  get guideSubsection(): JSX.Element {
    const hasPw = this.selectedCombatant.hasTalent(TALENTS_DRUID.PRIMAL_WRATH_TALENT);

    return (
      <SubSection>
        <p>
          <Trans id="druid.feral.aoe.explanation">
            <strong>AoE Abilities</strong> should usually only be used when you can hit more than
            one target, but some of them have applications on single target. The following charts
            count only hardcasts - procs from{' '}
            <SpellLink spell={TALENTS_DRUID.CONVOKE_THE_SPIRITS_TALENT} /> are excluded.
          </Trans>
        </p>
        <SideBySidePanels>
          <RoundedPanel>
            <div>
              <Trans id="druid.feral.aoe.swipe_usage">
                <strong>
                  <SpellLink spell={SPELLS.SWIPE_CAT} />
                </strong>{' '}
                should only be used on multiple targets
              </Trans>
            </div>
            {this.swipeChart}
          </RoundedPanel>
          {hasPw && (
            <RoundedPanel>
              <div>
                <Trans id="druid.feral.aoe.pw_usage">
                  <strong>
                    <SpellLink spell={TALENTS_DRUID.PRIMAL_WRATH_TALENT} />
                  </strong>{' '}
                  should only be used on multiple targets
                </Trans>
              </div>
              {this.pwChart}
            </RoundedPanel>
          )}
        </SideBySidePanels>
      </SubSection>
    );
  }

  statistic() {
    return (
      <Statistic
        tooltip={
          <>
            <Trans id="druid.feral.aoe.tooltip">
              These counts consider hardcasts only - numbers from Convoke the Spirits are not
              included.
            </Trans>
          </>
        }
        size="flexible"
        position={STATISTIC_ORDER.CORE(10)}
      >
        <div className="pad boring-text">
          <label>{t({ id: 'druid.feral.aoe.label', message: 'AoE Ability Usage' })}</label>
          <div className="value">
            {this.allTrackers.map((tracker) => (
              <div key={tracker.spell.id}>
                <TooltipElement
                  content={
                    <>
                      <Trans id="druid.feral.aoe.tooltip_detail">
                        This statistic does not include casts from Convoke the Spirits. You cast{' '}
                        {tracker.spell.name} <strong>{tracker.casts}</strong> times.
                      </Trans>
                      <ul>
                        <li>
                          <Trans id="druid.feral.aoe.hit_nothing_count">
                            <strong>{tracker.zeroHitCasts}</strong> hit nothing
                          </Trans>
                        </li>
                        <li>
                          <Trans id="druid.feral.aoe.hit_one_count">
                            <strong>{tracker.oneHitCasts}</strong> hit one target
                          </Trans>
                        </li>
                        <li>
                          <Trans id="druid.feral.aoe.hit_multi_count">
                            <strong>{tracker.multiHitCasts}</strong> hit multiple targets
                          </Trans>
                        </li>
                      </ul>
                    </>
                  }
                >
                  <SpellIcon spell={tracker.spell} />{' '}
                  {(tracker.casts === 0 ? 0 : tracker.hits / tracker.casts).toFixed(1)}{' '}
                </TooltipElement>
                <small>
                  {t({ id: 'druid.feral.aoe.avg_targets_hit', message: 'avg targets hit' })}
                </small>
              </div>
            ))}
          </div>
        </div>
      </Statistic>
    );
  }
}

interface SpellAoeTracker {
  spell: Spell;
  casts: number;
  hits: number;
  zeroHitCasts: number;
  oneHitCasts: number;
  multiHitCasts: number;
}

type SwipeTracker = SpellAoeTracker;

type PwTracker = SpellAoeTracker;

export default HitCountAoE;
