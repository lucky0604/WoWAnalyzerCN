import SPELLS from 'common/SPELLS/demonhunter';

import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import { TIERS } from 'game/TIERS';
import React from 'react';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import { formatPercentage } from 'common/format';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

/**
 * (4) Set Vengeance: Fracture has a 30% chance to spark a violent detonation, causing (200% of Attack Power) Fire damage onto nearby enemies.
 *                    Damage reduced beyond 5 targets.
 */

class MID1Vengeance4P extends Analyzer {
  #explosionProcs = 0;
  #fractureCount = 0;
  #lastExplosion = 0;

  static readonly EXPECTED_PROC_CHANCE = 0.3;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.has4PieceByTier(TIERS.MID1);

    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.MID1_EXPLOSION_OF_THE_SOUL),
      this.onDetonationDamage,
    );

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.FRACTURE),
      this.onFractureCast,
    );
  }
  private onDetonationDamage = (event: DamageEvent) => {
    // Only count the first hit within a small time window (200ms)
    // This prevents counting multiple targets hit by the same explosion
    if (this.#lastExplosion + 200 > event.timestamp) {
      return;
    }
    this.#lastExplosion = event.timestamp;
    this.#explosionProcs += 1;
  };

  private onFractureCast = (event: CastEvent) => {
    this.#fractureCount += 1;
  };

  statistic(): React.ReactNode {
    const fractures = this.#fractureCount;
    const realProcs = this.#explosionProcs;
    const expectedProcs = fractures * MID1Vengeance4P.EXPECTED_PROC_CHANCE;
    const actualRatePercent = this.#fractureCount === 0 ? 0 : realProcs / fractures;
    const expectedRatePct = MID1Vengeance4P.EXPECTED_PROC_CHANCE;

    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(2)}
        category={STATISTIC_CATEGORY.ITEMS}
        size="flexible"
        dropdown={
          <>
            <table className="table table-condensed">
              <thead>
                <tr>
                  <th>
                    {t({ id: 'demonhunter.vengeance.mid1Vengeance4P.metric', message: 'Metric' })}
                  </th>
                  <th className="text-right">
                    {t({ id: 'demonhunter.vengeance.mid1Vengeance4P.value', message: 'Value' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>
                    {t({ id: 'demonhunter.vengeance.mid1Vengeance4P.fractures', message: 'Fractures' })}
                  </th>
                  <td className="text-right">{fractures}</td>
                </tr>
                <tr>
                  <th>
                    <Trans id="demonhunter.vengeance.mid1Vengeance4P.expectedProcs">
                      Expected procs
                    </Trans>
                  </th>
                  <td className="text-right">{expectedProcs.toFixed(0)}</td>
                </tr>
                <tr>
                  <th>
                    {t({ id: 'demonhunter.vengeance.mid1Vengeance4P.realProcs', message: 'Real procs' })}
                  </th>
                  <td className="text-right">{realProcs}</td>
                </tr>
              </tbody>
            </table>
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.MID1_EXPLOSION_OF_THE_SOUL}>
          <Trans id="demonhunter.vengeance.mid1Vengeance4P.expectedProcRate">
            Expected: {formatPercentage(expectedRatePct)}% Actual:{' '}
          </Trans>
          <span
            style={{
              color:
                actualRatePercent >= expectedRatePct
                  ? 'hsla(120, 33%, 57%, 1)'
                  : 'hsla(0, 100%, 40%, 1.00)',
            }}
          >
            {formatPercentage(actualRatePercent)}%
          </span>
          <small>
            {' '}
            {t({ id: 'demonhunter.vengeance.mid1Vengeance4P.procRate', message: 'Proc rate' })}
          </small>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default MID1Vengeance4P;
