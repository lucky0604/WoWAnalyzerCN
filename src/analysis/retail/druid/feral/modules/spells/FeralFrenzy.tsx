import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import ComboPointTracker from 'analysis/retail/druid/feral/modules/core/combopoints/ComboPointTracker';
import { TALENTS_DRUID } from 'common/TALENTS';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS';
import Enemies, { encodeEventTargetString } from 'parser/shared/modules/Enemies';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { getLowestPerf, QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CooldownExpandable, {
  CooldownExpandableItem,
} from 'interface/guide/components/CooldownExpandable';
import { PassFailCheckmark, PerformanceMark } from 'interface/guide';
import EnergyTracker from 'analysis/retail/druid/feral/modules/core/energy/EnergyTracker';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemPercentDamageDone from 'parser/ui/ItemPercentDamageDone';
import { formatNumber } from 'common/format';

/**
 * **Feral Frenzy**
 * Spec Talent
 *
 * Unleash a furious frenzy, clawing your target 5 times for X Physical damage and
 * an additional X Bleed damage over 6 sec. Awards 5 combo points.
 */
export default class FeralFrenzy extends Analyzer {
  static dependencies = {
    comboPointTracker: ComboPointTracker,
    energyTracker: EnergyTracker,
    enemies: Enemies,
  };

  protected comboPointTracker!: ComboPointTracker;
  protected energyTracker!: EnergyTracker;
  protected enemies!: Enemies;
  isFrantic = false;
  isFocused = false;

  /** Tracker for each Feral Frenzy cast */
  ffTrackers: FeralFrenzyCast[] = [];
  /** Total damage dealt by Feral/Frantic Frenzy (all hits + bleed) */
  totalDamage = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS_DRUID.FERAL_FRENZY_TALENT);
    this.isFrantic = this.selectedCombatant.hasTalent(TALENTS_DRUID.FRANTIC_FRENZY_TALENT);
    this.isFocused = this.selectedCombatant.hasTalent(TALENTS_DRUID.FOCUSED_FRENZY_TALENT);

    const damageSpell = this.isFrantic ? SPELLS.FRANTIC_FRENZY_DEBUFF : SPELLS.FERAL_FRENZY_DEBUFF;
    this.addEventListener(Events.damage.by(SELECTED_PLAYER).spell(damageSpell), this.onFfDamage);

    if (!this.isFrantic) {
      this.addEventListener(
        Events.cast.by(SELECTED_PLAYER).spell(TALENTS_DRUID.FERAL_FRENZY_TALENT),
        this.onCastFf,
      );
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_DRUID.FRANTIC_FRENZY_TALENT),
      this.onCastFf,
    );
  }

  onFfDamage(event: DamageEvent) {
    const amount = event.amount + (event.absorbed || 0);
    this.totalDamage += amount;

    const currentCast = this.ffTrackers[this.ffTrackers.length - 1];
    if (!currentCast) {
      // bleed tick from a cast that happened before fight start — not attributable
      return;
    }
    currentCast.damage += amount;

    const enemy = this.enemies.getEntity(event);
    const name = enemy?.name ?? 'Unknown';
    const key = encodeEventTargetString(event);
    const existing = currentCast.damageByEnemy.get(key);
    if (existing) {
      existing.damage += amount;
    } else {
      currentCast.damageByEnemy.set(key, { name, damage: amount });
    }
  }

  onCastFf(event: CastEvent) {
    const tfOnCast = this.selectedCombatant.hasBuff(SPELLS.TIGERS_FURY.id);
    const cpsOnCast = this.comboPointTracker.current;
    const energyOnCast = this.energyTracker.current;
    const isFrantic = this.isFrantic;
    this.ffTrackers.push({
      timestamp: event.timestamp,
      tfOnCast,
      cpsOnCast,
      energyOnCast,
      isFrantic,
      damage: 0,
      damageByEnemy: new Map(),
    });
  }

  get talent() {
    if (this.isFrantic) {
      return TALENTS_DRUID.FRANTIC_FRENZY_TALENT;
    }
    return TALENTS_DRUID.FERAL_FRENZY_TALENT;
  }

  /** Guide fragment showing a breakdown of each Feral Frenzy cast */
  get guideCastBreakdown() {
    const talent = this.talent;

    const explanation = (
      <div>
        <p>
          <strong>
            <SpellLink spell={talent} />
          </strong>{' '}
          {t({
            id: 'druid.feral.ff.explanation',
            message:
              "is a brief but extremely powerful bleed. Use it on cooldown. As it gives 5 combo points, it's best used at 2 or fewer combo points in order not to waste them.",
          })}
          {this.isFrantic &&
            t({
              id: 'druid.feral.ff.explanation.frantic',
              message:
                ' Should be used within as large of packs as possible for you to gain the most benefit out of it.',
            })}
        </p>
        {this.isFocused && (
          <p>
            {' '}
            {t({
              id: 'druid.feral.ff.focused_explanation',
              message: 'With ',
            })}
            <SpellLink spell={TALENTS_DRUID.FOCUSED_FRENZY_TALENT} />
            {t({
              id: 'druid.feral.ff.focused_explanation.p2',
              message: ', always use it during ',
            })}
            <SpellLink spell={SPELLS.TIGERS_FURY} />.
          </p>
        )}
      </div>
    );

    const data = (
      <div>
        <strong>
          {t({ id: 'druid.feral.ff.per_cast_breakdown', message: 'Per-Cast Breakdown' })}
        </strong>
        <small>{t({ id: 'druid.feral.ff.click_expand', message: '- click to expand' })}</small>
        {this.ffTrackers.map((cast, ix) => {
          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.timestamp)} &mdash; <SpellLink spell={talent} />
            </>
          );

          let cpsPerf = QualitativePerformance.Good;
          if (cast.cpsOnCast > 4) {
            cpsPerf = QualitativePerformance.Fail;
          } else if (cast.cpsOnCast > 2) {
            cpsPerf = QualitativePerformance.Ok;
          }

          let overallPerf = QualitativePerformance.Good;
          overallPerf = getLowestPerf([overallPerf, cpsPerf]);

          const checklistItems: CooldownExpandableItem[] = [];

          if (this.isFocused) {
            checklistItems.push({
              label: (
                <>
                  <SpellLink spell={SPELLS.TIGERS_FURY} />
                  {t({ id: 'druid.feral.ff.tf_active', message: ' active' })}
                </>
              ),
              result: <PassFailCheckmark pass={cast.tfOnCast} />,
            });
            if (!cast.tfOnCast) {
              overallPerf = QualitativePerformance.Fail;
            }
          }

          checklistItems.push({
            label: t({ id: 'druid.feral.ff.cps_on_cast', message: 'Combo Points on cast' }),
            result: <PerformanceMark perf={cpsPerf} />,
            details: (
              <>
                <Trans id="druid.feral.ff.cps_and_targets">({cast.cpsOnCast} CPs)</Trans>
                {this.isFrantic && (
                  <Trans id="druid.feral.ff.targets_hit">
                    {' '}
                    ({cast.damageByEnemy.size} Targets hit)
                  </Trans>
                )}
              </>
            ),
          });

          return (
            <CooldownExpandable
              header={header}
              checklistItems={checklistItems}
              perf={overallPerf}
              key={ix}
            />
          );
        })}
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(1)}
        size="flexible"
        wide
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            {t({
              id: 'druid.feral.ff.damage_tooltip',
              message: 'Total damage dealt by ',
            })}
            <SpellLink spell={this.talent} />
            {t({
              id: 'druid.feral.ff.damage_tooltip.p2',
              message: ' (initial hits + bleed).',
            })}
          </>
        }
        dropdown={this.castBreakdownTable}
      >
        <BoringSpellValueText spell={this.talent}>
          <ItemPercentDamageDone amount={this.totalDamage} />
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get castBreakdownTable() {
    return (
      <table className="table table-condensed" style={{ textAlign: 'left' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center' }}>
              {t({ id: 'druid.shared.convoke.cast_num', message: 'Cast #' })}
            </th>
            <th style={{ textAlign: 'left' }}>
              {t({ id: 'druid.shared.convoke.time', message: 'Time' })}
            </th>
            <th style={{ textAlign: 'left' }}>
              {t({ id: 'druid.feral.ff.cast_damage', message: 'Cast Damage' })}
            </th>
            <th style={{ textAlign: 'left' }}>
              {t({ id: 'druid.feral.ff.enemy', message: 'Enemy' })}
            </th>
            <th style={{ textAlign: 'center' }}>
              {t({ id: 'druid.feral.ff.hit_count', message: '# Hit' })}
            </th>
            <th style={{ textAlign: 'left' }}>
              {t({ id: 'druid.shared.convoke.damage', message: 'Damage' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {this.ffTrackers.flatMap((cast, index) => {
            const grouped = Array.from(
              Array.from(cast.damageByEnemy.values())
                .reduce((acc, { name, damage }) => {
                  const existing = acc.get(name);
                  if (existing) {
                    existing.count += 1;
                    existing.damage += damage;
                  } else {
                    acc.set(name, { count: 1, damage });
                  }
                  return acc;
                }, new Map<string, { count: number; damage: number }>())
                .entries(),
            ).sort(([, a], [, b]) => b.damage - a.damage);

            if (grouped.length === 0) {
              return [
                <tr key={index}>
                  <th scope="row" style={{ textAlign: 'center' }}>
                    {index + 1}
                  </th>
                  <td style={{ textAlign: 'left' }}>
                    {this.owner.formatTimestamp(cast.timestamp)}
                  </td>
                  <td style={{ textAlign: 'left' }}>{formatNumber(cast.damage)}</td>
                  <td colSpan={3} style={{ textAlign: 'left' }}>
                    —
                  </td>
                </tr>,
              ];
            }

            return grouped.map(([name, { count, damage }], i) => {
              const subRowStyle = {
                textAlign: 'left' as const,
                ...(i > 0 ? { borderTopColor: 'transparent' } : {}),
                ...(i < grouped.length - 1 ? { borderBottomColor: 'transparent' } : {}),
              };
              return (
                <tr key={`${index}-${i}`}>
                  {i === 0 && (
                    <>
                      <th scope="row" rowSpan={grouped.length} style={{ textAlign: 'center' }}>
                        {index + 1}
                      </th>
                      <td rowSpan={grouped.length} style={{ textAlign: 'left' }}>
                        {this.owner.formatTimestamp(cast.timestamp)}
                      </td>
                      <td rowSpan={grouped.length} style={{ textAlign: 'left' }}>
                        {formatNumber(cast.damage)}
                      </td>
                    </>
                  )}
                  <td style={subRowStyle}>{name}</td>
                  <td style={{ ...subRowStyle, textAlign: 'center' }}>{count}</td>
                  <td style={subRowStyle}>{formatNumber(damage)}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    );
  }
}

interface FeralFrenzyCast {
  timestamp: number;
  tfOnCast: boolean;
  cpsOnCast: number;
  energyOnCast: number;
  isFrantic: boolean; // Feral Frenzy can be upgraded to Frantic Frenzy now
  /** Total damage (all hits + bleed ticks) attributed to this cast */
  damage: number;
  /** Damage broken down per enemy, keyed by `encodeEventTargetString` */
  damageByEnemy: Map<string, { name: string; damage: number }>;
}
