import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS';
import { SpellLink, SpellIcon } from 'interface';
import CrossIcon from 'interface/icons/Cross';
import UpArrowIcon from 'interface/icons/UpArrow';
import UptimeIcon from 'interface/icons/Uptime';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  DamageEvent,
  RefreshBuffEvent,
  CastEvent,
} from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemPercentDamageDone from 'parser/ui/ItemPercentDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

import { TALENTS_DRUID } from 'common/TALENTS';
import { formatPercentage } from 'common/format';
import { isConvoking } from 'analysis/retail/druid/shared/spells/ConvokeSpirits';
import { FB_SPELLS } from 'analysis/retail/druid/feral/constants';
import { getDamageHits } from 'analysis/retail/druid/feral/normalizers/CastLinkNormalizer';
import { getSotfEnergize } from 'analysis/retail/druid/feral/normalizers/SoulOfTheForestLinkNormalizer';
import { encodeEventTargetString } from 'parser/shared/modules/Enemies';

const BUFFER_MS = 50;

// TODO track Sabertooth procs due to Apex bites - this may be a non-trivial part of the damage
/**
 * **Apex Predator's Craving**
 * Spec Talent
 *
 * Rip damage has a 6% chance to make your next Ferocious Bite free and deal the maximum damage.
 */
class ApexPredatorsCraving extends Analyzer {
  hasSotf: boolean;
  hasRf: boolean;

  buffsGained = 0;
  buffsUsed = 0;
  buffsOverwritten = 0;

  /** Damage directly from Apex procced bite */
  biteDamage = 0;
  /** Damage from Rampant Ferocity splash of an Apex bite */
  rampantFerocityDamage = 0;

  sotfEnergyGained = 0;
  sotfEnergyEffective = 0;
  sotfEnergyWasted = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS_DRUID.APEX_PREDATORS_CRAVING_TALENT);
    this.hasSotf = this.selectedCombatant.hasTalent(TALENTS_DRUID.SOUL_OF_THE_FOREST_FERAL_TALENT);
    this.hasRf = this.selectedCombatant.hasTalent(TALENTS_DRUID.RAMPANT_FEROCITY_TALENT);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.APEX_PREDATORS_CRAVING_BUFF),
      this.onBuffApply,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.APEX_PREDATORS_CRAVING_BUFF),
      this.onBuffRefresh,
    );
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(FB_SPELLS), this.onFbCast);

    if (this.hasRf) {
      this.addEventListener(
        Events.damage.by(SELECTED_PLAYER).spell(SPELLS.RAMPANT_FEROCITY),
        this.onRfDamage,
      );
    }
  }

  onBuffApply(_: ApplyBuffEvent) {
    this.buffsGained += 1;
  }

  onBuffRefresh(_: RefreshBuffEvent) {
    this.buffsGained += 1;
    this.buffsOverwritten += 1;
  }

  // Convoke'd bites don't interact with APC, so it's fine we're missing them here
  onFbCast(event: CastEvent) {
    if (
      this.selectedCombatant.hasBuff(
        SPELLS.APEX_PREDATORS_CRAVING_BUFF.id,
        event.timestamp,
        BUFFER_MS,
      )
    ) {
      this.buffsUsed += 1;
      const sotfEnergize = getSotfEnergize(event);
      if (sotfEnergize) {
        this.sotfEnergyGained += sotfEnergize.resourceChange;
        this.sotfEnergyWasted += sotfEnergize.waste;
        this.sotfEnergyEffective += sotfEnergize.resourceChange - sotfEnergize.waste;
      }
      getDamageHits(event).forEach((hit) => {
        // Ravage cleave hits are from consumable proc - should not be attributed to APC
        if (encodeEventTargetString(hit) === encodeEventTargetString(event)) {
          this.biteDamage += hit.amount + (hit.absorbed || 0);
        }
      });
    }
  }

  onRfDamage(event: DamageEvent) {
    if (
      !isConvoking(this.selectedCombatant) &&
      this.selectedCombatant.hasBuff(
        SPELLS.APEX_PREDATORS_CRAVING_BUFF.id,
        event.timestamp,
        BUFFER_MS,
      )
    ) {
      this.rampantFerocityDamage += event.amount + (event.absorbed || 0);
    }
  }

  get buffsActive() {
    return this.selectedCombatant.hasBuff(SPELLS.APEX_PREDATORS_CRAVING_BUFF.id) ? 1 : 0;
  }

  get buffsExpired() {
    return this.buffsGained - this.buffsUsed - this.buffsActive - this.buffsOverwritten;
  }

  get buffsGainedPerMinute() {
    return this.owner.getPerMinute(this.buffsGained);
  }

  get sotfEnergyEffectivePerMinute() {
    return this.owner.getPerMinute(this.sotfEnergyEffective);
  }

  get totalDamage() {
    return this.biteDamage + this.rampantFerocityDamage;
  }

  get buffUptime() {
    return (
      this.selectedCombatant.getBuffUptime(SPELLS.APEX_PREDATORS_CRAVING_BUFF.id) /
      this.owner.fightDuration
    );
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(13)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            <Trans id="druid.feral.apc.tooltip_p1">
              This is the damage done by the free <SpellLink spell={SPELLS.FEROCIOUS_BITE} />{' '}
              procced by Apex Predator's Craving
            </Trans>
            {this.hasRf && (
              <>
                {' '}
                <Trans id="druid.feral.apc.rampant_ferocity_splash">
                  and the <SpellLink spell={SPELLS.RAMPANT_FEROCITY} /> splash from those free bites
                </Trans>
              </>
            )}
            {this.hasSotf && (
              <>
                <Trans id="druid.feral.apc.sotf_energy">
                  , and the effective energy gained due to{' '}
                  <SpellLink spell={SPELLS.SOUL_OF_THE_FOREST_FERAL_ENERGY} /> from those bites
                </Trans>
              </>
            )}
            <Trans id="druid.feral.apc.procs_summary">
              . You gained <strong>{this.buffsGainedPerMinute.toFixed(1)} procs per minute</strong>,
              for a total of <strong>{this.buffsGained} procs</strong>:
            </Trans>
            <ul>
              <li>
                <SpellIcon spell={SPELLS.FEROCIOUS_BITE} />{' '}
                <Trans id="druid.feral.apc.used">
                  Used: <strong>{this.buffsUsed}</strong>
                </Trans>
              </li>
              <li>
                <CrossIcon />{' '}
                <Trans id="druid.feral.apc.overwritten">
                  Overwritten: <strong>{this.buffsOverwritten}</strong>
                </Trans>
              </li>
              <li>
                <UptimeIcon />{' '}
                <Trans id="druid.feral.apc.expired">
                  Expired: <strong>{this.buffsExpired}</strong>
                </Trans>
              </li>
              {this.buffsActive > 0 && (
                <li>
                  <Trans id="druid.feral.apc.still_active">
                    Still active at fight end: <strong>{this.buffsActive}</strong>
                  </Trans>
                </li>
              )}
            </ul>
            {this.hasSotf && (
              <>
                <Trans id="druid.feral.apc.sotf_total">
                  Total <SpellLink spell={SPELLS.SOUL_OF_THE_FOREST_FERAL_ENERGY} /> energy gained
                  from free bites was <strong>{this.sotfEnergyGained}</strong>.
                </Trans>
                <ul>
                  <li>
                    <UpArrowIcon />{' '}
                    <Trans id="druid.feral.apc.sotf_effective">
                      Effective: <strong>{this.sotfEnergyEffective}</strong>
                    </Trans>
                  </li>
                  <li>
                    <CrossIcon />{' '}
                    <Trans id="druid.feral.apc.sotf_wasted">
                      Wasted: <strong>{this.sotfEnergyWasted}</strong>
                    </Trans>
                  </li>
                </ul>
              </>
            )}
            {this.hasRf && (
              <>
                <Trans id="druid.feral.apc.rf_breakdown">
                  Breakdown between direct bite damage and from{' '}
                  <SpellLink spell={SPELLS.RAMPANT_FEROCITY} />
                </Trans>
                <ul>
                  <li>
                    <SpellLink spell={SPELLS.FEROCIOUS_BITE} />:{' '}
                    <strong>
                      {formatPercentage(
                        this.owner.getPercentageOfTotalDamageDone(this.biteDamage),
                        2,
                      )}
                      %
                    </strong>
                  </li>
                  <li>
                    <SpellLink spell={SPELLS.RAMPANT_FEROCITY} />:{' '}
                    <strong>
                      {formatPercentage(
                        this.owner.getPercentageOfTotalDamageDone(this.rampantFerocityDamage),
                        2,
                      )}
                      %
                    </strong>
                  </li>
                </ul>
              </>
            )}
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS_DRUID.APEX_PREDATORS_CRAVING_TALENT}>
          <div>
            <ItemPercentDamageDone amount={this.totalDamage} />
          </div>
          <div>
            <UptimeIcon /> {formatPercentage(this.buffUptime, 1)}%{' '}
            <small>{t({ id: 'druid.feral.apc.buff_uptime_label', message: 'buff uptime' })}</small>
          </div>

          {this.hasSotf && (
            <div>
              <SpellIcon spell={SPELLS.SOUL_OF_THE_FOREST_FERAL_ENERGY} />{' '}
              {this.sotfEnergyEffectivePerMinute.toFixed(0)}{' '}
              <small>
                {t({ id: 'druid.feral.apc.energy_per_min', message: 'energy per minute' })}
              </small>
            </div>
          )}
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default ApexPredatorsCraving;
