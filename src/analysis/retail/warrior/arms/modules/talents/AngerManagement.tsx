import { t } from '@lingui/core/macro';
import { formatDuration } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warrior';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { SpellLink } from 'interface';
import Analyzer, { SELECTED_PLAYER, Options } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import StatisticListBoxItem from 'parser/ui/StatisticListBoxItem';
import { Fragment } from 'react';

/**
 * Every 20 Rage you spend reduces the remaining cooldown on Colossus Smash and Avatar by 1 sec.
 */

const RAGE_NEEDED_FOR_A_PROC = 20;
const CDR_PER_PROC = 1000; // ms

class AngerManagement extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  protected spellUsable!: SpellUsable;

  cooldownsAffected = [SPELLS.COLOSSUS_SMASH.id, SPELLS.AVATAR_SHARED.id];

  totalRageSpend = 0;
  wastedReduction: Map<number, number> = new Map<number, number>();
  effectiveReduction: Map<number, number> = new Map<number, number>();

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.ANGER_MANAGEMENT_TALENT);
    this.cooldownsAffected.forEach((e) => {
      this.wastedReduction.set(e, 0);
      this.effectiveReduction.set(e, 0);
    });

    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this._onCast);
  }

  get tooltip() {
    return this.cooldownsAffected.map((id) => {
      const effectiveRed = formatDuration(this.effectiveReduction.get(id) || 0);
      const wastedRed = formatDuration(this.wastedReduction.get(id) || 0);
      const spellName = SPELLS[id].name;
      return (
        <Fragment key={id}>
          {t({
            id: 'warrior.arms.angerManagement.tooltip',
            message: '{spellName}: {effectiveRed} reduction ({wastedRed} wasted)',
            values: {
              spellName,
              effectiveRed,
              wastedRed,
            },
          })}
          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
          <br />
        </Fragment>
      );
    });
  }

  _onCast(event: CastEvent) {
    if (!event.classResources) {
      return;
    }
    const rage = event.classResources.find((e) => e.type === RESOURCE_TYPES.RAGE.id);
    if (!rage || !rage.cost) {
      return;
    }

    const rageSpend = rage.cost / 10;
    const reduction = (rageSpend / RAGE_NEEDED_FOR_A_PROC) * CDR_PER_PROC;
    this.cooldownsAffected.forEach((e) => {
      if (!this.spellUsable.isOnCooldown(e)) {
        this.wastedReduction.set(e, (this.wastedReduction.get(e) || 0) + reduction);
      } else {
        const effectiveReduction = this.spellUsable.reduceCooldown(e, reduction);
        this.effectiveReduction.set(e, (this.effectiveReduction.get(e) || 0) + effectiveReduction);
        this.wastedReduction.set(
          e,
          (this.wastedReduction.get(e) || 0) + reduction - effectiveReduction,
        );
      }
    });
    this.totalRageSpend += rageSpend;
  }

  subStatistic() {
    return (
      <StatisticListBoxItem
        title={
          <>
            <SpellLink spell={TALENTS.ANGER_MANAGEMENT_TALENT} />{' '}
            {t({
              id: 'warrior.arms.angerManagement.cdr',
              message: 'CDR',
            })}
          </>
        }
        value={t({
          id: 'warrior.arms.angerManagement.cdrValue',
          message: '{duration} min',
          values: {
            duration: formatDuration(
              (this.effectiveReduction.get(TALENTS.BLADESTORM_TALENT.id) || 0) +
                (this.wastedReduction.get(TALENTS.BLADESTORM_TALENT.id) || 0),
            ),
          },
        })}
        valueTooltip={<>{this.tooltip}</>}
      />
    );
  }
}

export default AngerManagement;
