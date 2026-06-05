import type { JSX } from 'react';

import { Trans } from '@lingui/react/macro';
import { formatNumber } from 'common/format';
import SPELLS from 'common/SPELLS';
import { encodeTargetString } from 'parser/shared/modules/Enemies';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, DamageEvent, GetRelatedEvents } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { BadColor, GoodColor } from 'interface/guide';
import {
  RAPTOR_SWIPE_CAST_IMPACT,
  RAPTOR_SWIPE_STRIKE_AS_ONE,
} from '../../normalizers/RaptorSwipeNormalizer';

/**
 * Raptor Swipe - A cone slash dealing physical damage to all nearby enemies.
 * Should always be cast with Tip of the Spear active to proc Strike as One.
 */

class RaptorSwipe extends Analyzer {
  private useEntries: BoxRowEntry[] = [];
  private casts = 0;
  private tippedCasts = 0;
  private missedCasts = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.RAPTOR_SWIPE_1_SURVIVAL_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.RAPTOR_SWIPE_DAMAGE),
      this.onCast,
    );
  }

  private onCast = (event: CastEvent) => {
    this.casts += 1;

    const damageEvents = GetRelatedEvents<DamageEvent>(event, RAPTOR_SWIPE_CAST_IMPACT);
    const strikeAsOneEvents = GetRelatedEvents<DamageEvent>(event, RAPTOR_SWIPE_STRIKE_AS_ONE);
    const strikeAsOneDamage = strikeAsOneEvents.reduce(
      (sum, dmg) => sum + dmg.amount + (dmg.absorbed ?? 0),
      0,
    );
    const hitSomething = damageEvents.length > 0;
    const wasTipped = this.selectedCombatant.hasBuff(
      SPELLS.TIP_OF_THE_SPEAR_CAST.id,
      event.timestamp,
    );

    if (wasTipped) {
      this.tippedCasts += 1;
    }
    if (!hitSomething) {
      this.missedCasts += 1;
    }

    let value: QualitativePerformance;
    let header: JSX.Element;
    let color: string;

    if (!hitSomething) {
      value = QualitativePerformance.Fail;
      header = <Trans id="hunter.survival.raptorSwipe.badMissedAll">Bad cast: missed all targets.</Trans>;
      color = BadColor;
    } else if (wasTipped) {
      value = QualitativePerformance.Good;
      header = <Trans id="hunter.survival.raptorSwipe.goodTipped">Good cast: tipped.</Trans>;
      color = GoodColor;
    } else {
      value = QualitativePerformance.Fail;
      header = <Trans id="hunter.survival.raptorSwipe.badNoTip">Bad cast: no tip.</Trans>;
      color = BadColor;
    }

    // Strike as One fires from both the Apex proc and the regular Tip spend, so
    // .length would double-count targets. Deduplicating by targetID + targetInstance
    // gives distinct targets hit (same-name mobs share a targetID but differ by instance).
    const uniqueTargets = (events: DamageEvent[]) =>
      new Set(events.map((e) => encodeTargetString(e.targetID, e.targetInstance))).size;

    const targetsHit = uniqueTargets(damageEvents);
    const swipeDamage = damageEvents.reduce(
      (sum, dmg) => sum + dmg.amount + (dmg.absorbed ?? 0),
      0,
    );
    const strikeAsOneTargets = uniqueTargets(strikeAsOneEvents);
    const tooltip = (
      <div>
        <h5 style={{ color }}>{header}</h5>
        <strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
        <div>
          <Trans id="hunter.survival.raptorSwipe.tooltipSwipeDamage">
            <SpellLink spell={SPELLS.RAPTOR_SWIPE_DAMAGE} />: <strong>{targetsHit}</strong> targets
            hit <small>({formatNumber(swipeDamage)} damage)</small>
          </Trans>
        </div>
        {strikeAsOneDamage > 0 && (
          <div>
            <Trans id="hunter.survival.raptorSwipe.tooltipStrikeAsOne">
              <SpellLink spell={SPELLS.STRIKE_AS_ONE} />: <strong>{strikeAsOneTargets}</strong>{' '}
              targets hit <small>({formatNumber(strikeAsOneDamage)} damage)</small>
            </Trans>
          </div>
        )}
      </div>
    );

    this.useEntries.push({ value, tooltip });
  };

  get guideSubsection() {
    const explanation = (
      <p>
        <Trans id="hunter.survival.raptorSwipe.guideExplanation">
          <strong>
            <SpellLink spell={TALENTS.RAPTOR_SWIPE_1_SURVIVAL_TALENT} />
          </strong>{' '}
          should always be cast with <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />.
        </Trans>
      </p>
    );

    const data = (
      <CastSummaryAndBreakdown
        spell={TALENTS.RAPTOR_SWIPE_1_SURVIVAL_TALENT}
        castEntries={this.useEntries}
        badExtraExplanation={
          <Trans id="hunter.survival.raptorSwipe.badExtraExplanation">
            without Tip of the Spear
          </Trans>
        }
        usesInsteadOfCasts
      />
    );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    const tippedPercentage = this.casts > 0 ? (this.tippedCasts / this.casts) * 100 : 0;

    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(1)}
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
      >
        <BoringSpellValueText spell={TALENTS.RAPTOR_SWIPE_1_SURVIVAL_TALENT}>
          <>
            {this.casts}{' '}
            <small>
              <Trans id="hunter.survival.raptorSwipe.casts">casts</Trans>
            </small>
            <p>
              {this.tippedCasts}{' '}
              <small>
                <Trans id="hunter.survival.raptorSwipe.tippedCasts">
                  tipped casts ({tippedPercentage.toFixed(1)}%)
                </Trans>
              </small>
            </p>
            {this.missedCasts > 0 && (
              <>
                <p>
                  {this.missedCasts}{' '}
                  <small>
                    <Trans id="hunter.survival.raptorSwipe.missed">missed (hit no targets)</Trans>
                  </small>
                </p>
              </>
            )}
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default RaptorSwipe;
