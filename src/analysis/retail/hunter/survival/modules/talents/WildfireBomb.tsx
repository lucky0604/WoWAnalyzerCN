import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, DamageEvent, GetRelatedEvents } from 'parser/core/Events';
import Enemies from 'parser/shared/modules/Enemies';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { BadColor, GoodColor, PerfectColor } from 'interface/guide';
import { WILDFIRE_BOMB_CAST_IMPACT } from '../../normalizers/WildfireBombNormalizer';

const DAMAGE_GROUPING_WINDOW_MS = 200;

/**
 * Hurl a bomb at the target, exploding for (45% of Attack power) Fire damage in a cone and coating enemies in wildfire, scorching them for (90% of Attack power) Fire damage over 6 sec.
 *
 * Example log:
 * https://www.warcraftlogs.com/reports/6GjD12YkQCnJqPTz#fight=25&type=damage-done&source=19&translate=true&ability=-259495
 */

class WildfireBomb extends Analyzer.withDependencies({
  enemies: Enemies,
}) {
  private useEntries: BoxRowEntry[] = [];
  private casts = 0;
  private tippedCasts = 0;
  private totalDamage = 0;
  private totalTargetsHit = 0;
  private sentinelProcs = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.WILDFIRE_BOMB_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.WILDFIRE_BOMB_TALENT),
      this.onCast,
    );
  }

  private onCast = (event: CastEvent) => {
    this.casts += 1;

    const allDamageEvents = GetRelatedEvents<DamageEvent>(event, WILDFIRE_BOMB_CAST_IMPACT);
    // Bomb can take up to 2000ms to hit so normalizer requires a wide link window.
    // This can cause overlapping damage events on a back to back cast so we only keep events near first impact.
    // Therefore if we collect only events within a short window, we keep them with their cast.
    const firstDamageEvent = allDamageEvents.length > 0 ? allDamageEvents[0] : undefined;
    const damageEvents = firstDamageEvent
      ? allDamageEvents.filter(
          (dmg) => dmg.timestamp - firstDamageEvent.timestamp <= DAMAGE_GROUPING_WINDOW_MS,
        )
      : [];

    const wasTipped = firstDamageEvent
      ? this.selectedCombatant.hasBuff(SPELLS.TIP_OF_THE_SPEAR_CAST.id, firstDamageEvent.timestamp)
      : false;

    // Check if any target had Sentinel's Mark debuff when impact hit
    const hadSentinelProc = damageEvents.some((dmg) => {
      const enemy = this.deps.enemies.getEntity(dmg);
      return enemy?.hasBuff(SPELLS.SENTINELS_MARK_DEBUFF.id, dmg.timestamp) ?? false;
    });

    const targetsHit = damageEvents.length;
    const castDamage = damageEvents.reduce((sum, dmg) => sum + dmg.amount + (dmg.absorbed ?? 0), 0);

    this.totalTargetsHit += targetsHit;
    this.totalDamage += castDamage;

    if (wasTipped) {
      this.tippedCasts += 1;
    }

    if (hadSentinelProc) {
      this.sentinelProcs += 1;
    }

    // Classify performance: pre-pull (first bomb within 5s of fight start) is always Good;
    // This lets us deal with throwing a bomb late due to an early pull or other shenanigans on pull.
    const isPrePull =
      this.casts === 1 && !wasTipped && event.timestamp - this.owner.fight.start_time <= 5_000;
    let value: QualitativePerformance;
    let header: JSX.Element;
    let color: string;

    if (isPrePull) {
      value = QualitativePerformance.Good;
      header = <Trans id="hunter.survival.wildfireBomb.goodPrePull">Good: pre-pull cast.</Trans>;
      color = GoodColor;
    } else if (wasTipped && hadSentinelProc) {
      value = QualitativePerformance.Perfect;
      header = (
        <Trans id="hunter.survival.wildfireBomb.perfectTippedSentinel">
          Perfect: tipped and proc'd Sentinel's Mark.
        </Trans>
      );
      color = PerfectColor;
    } else if (wasTipped) {
      value = QualitativePerformance.Good;
      header = <Trans id="hunter.survival.wildfireBomb.goodTipped">Good cast: tipped.</Trans>;
      color = GoodColor;
    } else {
      value = QualitativePerformance.Fail;
      header = <Trans id="hunter.survival.wildfireBomb.badNoTip">Bad cast: no tip.</Trans>;
      color = BadColor;
    }

    const targetName = this.owner.getTargetName(event);
    const tooltip = (
      <div>
        <h5 style={{ color }}>{header}</h5>
        <Trans id="hunter.survival.wildfireBomb.tooltipTargeting">
          <strong>{this.owner.formatTimestamp(event.timestamp)}</strong> targeting{' '}
          <strong>{targetName || 'unknown'}</strong>
        </Trans>
        <div>
          <Trans id="hunter.survival.wildfireBomb.tooltipTargetsHit">
            <strong>{targetsHit}</strong> targets hit{' '}
            <small>({formatNumber(castDamage)} damage)</small>
          </Trans>
        </div>
        <div>
          <Trans id="hunter.survival.wildfireBomb.tooltipTotalDamage">
            <strong>Total Damage:</strong> {formatNumber(castDamage)}
          </Trans>
        </div>
      </div>
    );

    this.useEntries.push({ value, tooltip });
  };

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <Trans id="hunter.survival.wildfireBomb.guideExplanation">
          <strong>
            <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
          </strong>{' '}
          should always be cast with <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST.id} />.
        </Trans>
        {this.selectedCombatant.hasTalent(TALENTS.SENTINEL_TALENT) && (
          <>
            {' '}
            <Trans id="hunter.survival.wildfireBomb.guideSentinelNote">
              Bombs that hit a target with <SpellLink spell={SPELLS.SENTINELS_MARK_DEBUFF} /> are
              perfect casts.
            </Trans>
          </>
        )}
      </p>
    );

    const data = (
      <div>
        <CastSummaryAndBreakdown
          spell={TALENTS.WILDFIRE_BOMB_TALENT}
          castEntries={this.useEntries}
          badExtraExplanation={
            <Trans id="hunter.survival.wildfireBomb.badExtraExplanation">
              without Tip of the Spear
            </Trans>
          }
          usesInsteadOfCasts
        />
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    const avgTargetsHit = this.casts > 0 ? this.totalTargetsHit / this.casts : 0;
    const tippedPercentage = this.casts > 0 ? (this.tippedCasts / this.casts) * 100 : 0;
    const sentinelPercentage = this.casts > 0 ? (this.sentinelProcs / this.casts) * 100 : 0;

    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(0)}
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
      >
        <BoringSpellValueText spell={TALENTS.WILDFIRE_BOMB_TALENT}>
          <>
            <div>
              <ItemDamageDone amount={this.totalDamage} />
            </div>
            <p>
              {this.casts}{' '}
              <small>
                <Trans id="hunter.survival.wildfireBomb.casts">casts</Trans>
              </small>
            </p>
            <p>
              {this.tippedCasts}{' '}
              <small>
                <Trans id="hunter.survival.wildfireBomb.tippedCasts">
                  tipped casts ({tippedPercentage.toFixed(1)}%)
                </Trans>
              </small>
            </p>
            <p>
              {this.sentinelProcs}{' '}
              <small>
                <Trans id="hunter.survival.wildfireBomb.sentinelProcs">
                  Sentinel's Mark procs ({sentinelPercentage.toFixed(1)}%)
                </Trans>
              </small>
            </p>
            <p>
              {avgTargetsHit.toFixed(2)}{' '}
              <small>
                <Trans id="hunter.survival.wildfireBomb.avgTargetsHit">avg targets hit</Trans>
              </small>
            </p>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default WildfireBomb;
