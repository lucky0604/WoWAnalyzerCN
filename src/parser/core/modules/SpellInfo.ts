import { maybeGetSpell, registerSpell, updateSpellName } from 'common/SPELLS';
import Analyzer, { Options } from 'parser/core/Analyzer';
import Events, { Ability, AnyEvent } from 'parser/core/Events';
import { maybeGetTalent } from 'common/TALENTS/maybeGetTalent';

/**
 * We automatically discover spell info from the combat log so we can avoid many
 * calls to resolve missing spell info.
 * For CN fork: WCL's translate=true returns Chinese spell names for Chinese logs.
 * We override hardcoded English names with WCL's translated names.
 */
class SpellInfo extends Analyzer {
  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.any, this.onEvent);
  }

  onEvent(event: AnyEvent) {
    if ('ability' in event) {
      this.addSpellInfo(event.ability);
    }
    if ('extraAbility' in event) {
      this.addSpellInfo(event.extraAbility!);
    }
  }

  addSpellInfo(ability: Omit<Ability, 'type'>) {
    if (!ability.name || !ability.abilityIcon) {
      return;
    }

    const talent = maybeGetTalent(ability.guid);
    const name = talent?.name ?? ability.name;
    const icon = (talent?.icon ?? ability.abilityIcon).replace(/\.jpg$/, '');

    if (maybeGetSpell(ability.guid)) {
      updateSpellName(ability.guid, name, icon);
    } else {
      registerSpell(ability.guid, name, icon);
    }
  }
}

export default SpellInfo;
