import { t } from '@lingui/core/macro';
import { formatNumber, formatPercentage } from 'common/format';
import TALENTS from 'common/TALENTS/paladin';
import HIT_TYPES from 'game/HIT_TYPES';
import MAGIC_SCHOOLS from 'game/MAGIC_SCHOOLS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { AbsorbedEvent, DamageEvent } from 'parser/core/Events';
import BoringSpellValue from 'parser/ui/BoringSpellValue';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import type { ReactNode } from 'react';

const PHYSICAL_DAMAGE = MAGIC_SCHOOLS.ids.PHYSICAL;

/**
 * Analyzer to track the number of spells blocked as a result of selecting the
 * Holy Shield talent.
 */
class HolyShieldSpellBlock extends Analyzer {
  spellsHitPlayerCount = 0;
  holyShieldProcsCount = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.HOLY_SHIELD_TALENT);
    if (!this.active) {
      return;
    }
    this.addEventListener(
      Events.absorbed.by(SELECTED_PLAYER).spell(TALENTS.HOLY_SHIELD_TALENT),
      this.trackHolyShieldAbsorbs,
    );
    this.addEventListener(Events.damage.to(SELECTED_PLAYER), this.trackSpellsHitPlayer);
  }

  trackSpellsHitPlayer(event: DamageEvent) {
    if (event.ability.type !== PHYSICAL_DAMAGE) {
      this.spellsHitPlayerCount += 1;
      if (event.hitType === HIT_TYPES.BLOCKED_CRIT || event.hitType === HIT_TYPES.BLOCKED_NORMAL) {
        this.holyShieldProcsCount += 1;
      }
    }
  }

  trackHolyShieldAbsorbs(event: AbsorbedEvent) {
    if (event.ability.guid === TALENTS.HOLY_SHIELD_TALENT.id) {
      this.holyShieldProcsCount += 1;
    }
  }

  statistic(): ReactNode {
    return (
      <Statistic
        position={STATISTIC_ORDER.DEFAULT}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            {t({ id: 'paladin.protection.holyShield.tooltip.p1', message: 'Holy Shield blocked {blocked} out of {total} spells.', values: { blocked: formatNumber(this.holyShieldProcsCount), total: formatNumber(this.spellsHitPlayerCount) }})}
            <br />
            {t({ id: 'paladin.protection.holyShield.tooltip.p2', message: 'This represents ' })}
            <em>
              {t({ id: 'paladin.protection.holyShield.tooltip.pct', message: '{pct} %', values: { pct: formatPercentage(this.holyShieldProcsCount / this.spellsHitPlayerCount) }})}
            </em>
            {t({ id: 'paladin.protection.holyShield.tooltip.p3', message: ' of spells blocked.' })}
          </>
        }
      >
        <BoringSpellValue
          spell={TALENTS.HOLY_SHIELD_TALENT.id}
          value={this.holyShieldProcsCount}
          label={t({
            id: 'paladin.protection.holyShield.spellsBlocked',
            message: 'Spells Blocked',
          })}
        />
      </Statistic>
    );
  }
}

export default HolyShieldSpellBlock;
