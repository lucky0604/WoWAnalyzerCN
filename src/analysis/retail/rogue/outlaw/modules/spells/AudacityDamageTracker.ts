import { FilteredDamageTracker } from 'analysis/retail/rogue/shared';
import SPELLS from 'common/SPELLS';
import { Options } from 'parser/core/Analyzer';
import { CastEvent, DamageEvent, HealEvent } from 'parser/core/Events';
import { t } from '@lingui/core/macro';

//--TODO: "minimalActiveTime" should be rogue current gcd, if the value is possible to get from somewhere, instead of a raw number

class AudacityDamageTracker extends FilteredDamageTracker {
  constructor(options: Options) {
    super(options);

    this.subscribeInefficientCast(
      [SPELLS.SINISTER_STRIKE],
      () =>
        t({
          id: 'rogue.outlaw.audacity.inefficientCast',
          message: 'Ambush should be used as your builder when audacity proc is up',
        }),
    );
    this.subscribeInefficientCast(
      [SPELLS.PISTOL_SHOT],
      () =>
        t({
          id: 'rogue.outlaw.audacity.inefficientCast',
          message: 'Ambush should be used as your builder when audacity proc is up',
        }),
    );
  }

  shouldProcessEvent(event: CastEvent | DamageEvent | HealEvent): boolean {
    return this.selectedCombatant.hasBuff(SPELLS.AUDACITY_TALENT_BUFF.id, null, undefined, 800);
  }
}

export default AudacityDamageTracker;
