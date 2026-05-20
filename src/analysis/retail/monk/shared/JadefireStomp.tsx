import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import SPECS from 'game/SPECS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { HealEvent } from 'parser/core/Events';
import Abilities from 'parser/core/modules/Abilities';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import TalentSpellText from 'parser/ui/TalentSpellText';
import Combatants from 'parser/shared/modules/Combatants';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import { SpellLink, TooltipElement } from 'interface';
import { formatNumber } from 'common/format';
import { Trans } from '@lingui/react/macro';

class JadefireStomp extends Analyzer {
  static dependencies = {
    abilities: Abilities,
    spellUsable: SpellUsable,
    combatants: Combatants,
  };

  protected abilities!: Abilities;
  protected spellUsable!: SpellUsable;
  protected combatants!: Combatants;

  resets = 0;
  jfsCasts = 0;
  targetsDamaged = 0;
  targetsHealed = 0;

  ///mistweaver specific params
  specIsMW = false;
  healing = 0;
  overhealing = 0;
  gomHealing = 0;
  gomOverhealing = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.JADEFIRE_STOMP_TALENT);
    this.specIsMW = this.selectedCombatant.specId === SPECS.MISTWEAVER_MONK.id;
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_MONK.JADEFIRE_STOMP_TALENT),
      this.casts,
    );
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.FAELINE_STOMP_RESET),
      this.reset,
    );
    this.addEventListener(
      Events.damage
        .by(SELECTED_PLAYER)
        .spell([SPELLS.JADEFIRE_STOMP_HEAL, TALENTS_MONK.JADEFIRE_STOMP_TALENT]),
      this.damage,
    );
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(SPELLS.JADEFIRE_STOMP_HEAL),
      this.heal,
    );
  }

  get totalHealing() {
    return this.healing;
  }

  get rawHealing() {
    return this.overhealing + this.gomOverhealing;
  }
  get averageHealingPerCast() {
    return this.totalHealing / this.jfsCasts;
  }

  get rawHealingPerCast() {
    return (this.totalHealing + this.rawHealing) / this.jfsCasts;
  }

  casts() {
    this.jfsCasts += 1;
  }

  reset() {
    if (this.spellUsable.isOnCooldown(TALENTS_MONK.JADEFIRE_STOMP_TALENT.id)) {
      this.spellUsable.endCooldown(TALENTS_MONK.JADEFIRE_STOMP_TALENT.id);
      this.resets += 1;
    }
  }

  damage() {
    this.targetsDamaged += 1;
  }

  heal(event: HealEvent) {
    this.targetsHealed += 1;
    this.healing += event.amount + (event.absorbed || 0);
    this.overhealing += event.overheal || 0;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(99)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            {this.specIsMW && (
              <ul>
                <li>
                  {(() => {
                    const healing = formatNumber(this.healing);
                    const overheal = formatNumber(this.overhealing);
                    return (
                      <Trans id="monk.shared.jfs.healing">
                        {healing}{' '}
                        <SpellLink spell={TALENTS_MONK.JADEFIRE_STOMP_TALENT} /> healing (
                        {overheal} overheal){' '}
                      </Trans>
                    );
                  })()}
                </li>
                <li>
                  {(() => {
                    const healing = formatNumber(this.gomHealing);
                    const overheal = formatNumber(this.gomOverhealing);
                    return (
                      <Trans id="monk.shared.jfs.gom_healing">
                        {healing} <SpellLink spell={SPELLS.GUSTS_OF_MISTS} />{' '}
                        healing ({overheal} overheal)
                      </Trans>
                    );
                  })()}
                </li>
                <li>
                  {(() => {
                    const resets = this.resets;
                    return (
                      <Trans id="monk.shared.jfs.resets">
                        {resets} <small>resets</small>{' '}
                      </Trans>
                    );
                  })()}
                </li>
                <li>
                  {(() => {
                    const ratio = (this.targetsDamaged / this.jfsCasts).toFixed(2);
                    return (
                      <Trans id="monk.shared.jfs.foes_hit">
                        {ratio}{' '}
                        <small>Foes Hit per cast</small>
                      </Trans>
                    );
                  })()}
                </li>
                <li>
                  {(() => {
                    const ratio = (this.targetsHealed / this.jfsCasts).toFixed(2);
                    return (
                      <Trans id="monk.shared.jfs.allies_hit">
                        {ratio}{' '}
                        <small>Allies Hit per cast</small>
                      </Trans>
                    );
                  })()}
                </li>
              </ul>
            )}
          </>
        }
      >
        <TalentSpellText talent={TALENTS_MONK.JADEFIRE_STOMP_TALENT}>
          {this.specIsMW ? (
            <>
              <div>
                <ItemHealingDone amount={this.totalHealing} />
              </div>
              <TooltipElement
                content={
                  (() => {
                    const amount = formatNumber(this.rawHealingPerCast);
                    return (
                      <Trans id="monk.shared.jfs.raw_healing_per_cast">
                        {amount} <small>raw healing per cast</small>
                      </Trans>
                    );
                  })()
                }
              >
                {(() => {
                  const amount = formatNumber(this.averageHealingPerCast);
                  return (
                    <Trans id="monk.shared.jfs.healing_per_cast">
                      {amount} <small>healing per cast</small>
                    </Trans>
                  );
                })()}
              </TooltipElement>
            </>
          ) : (
            <>
              <div>
                {(() => {
                  const resets = this.resets;
                  return (
                    <Trans id="monk.shared.jfs.resets">
                      {resets} <small>resets</small>
                    </Trans>
                  );
                })()}
              </div>
              <div>
                {(() => {
                  const ratio = (this.targetsDamaged / this.jfsCasts).toFixed(2);
                  return (
                    <Trans id="monk.shared.jfs.foes_hit">
                      {ratio}{' '}
                      <small>Foes Hit per cast</small>{' '}
                    </Trans>
                  );
                })()}
              </div>
              <div>
                {(() => {
                  const ratio = (this.targetsHealed / this.jfsCasts).toFixed(2);
                  return (
                    <Trans id="monk.shared.jfs.allies_hit">
                      {ratio} <small>Allies Hit per cast</small>
                    </Trans>
                  );
                })()}
              </div>
            </>
          )}
        </TalentSpellText>
      </Statistic>
    );
  }
}

export default JadefireStomp;
