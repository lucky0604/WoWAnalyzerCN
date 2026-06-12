import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { NumberThreshold, ThresholdStyle } from 'parser/core/ParseResults';
import DamageTracker from 'parser/shared/modules/AbilityTracker';

import BetweenTheEyesDamageTracker from './BetweenTheEyesDamageTracker';
import talents from 'common/TALENTS/rogue';
import { t } from '@lingui/core/macro';

class Dispatch extends Analyzer {
  get thresholds(): NumberThreshold {
    const total = this.damageTracker.getAbility(SPELLS.DISPATCH.id);
    const filtered = this.betweenTheEyesDamageTracker.getAbility(SPELLS.DISPATCH.id);

    return {
      actual: filtered.casts / total.casts,
      isGreaterThan: {
        minor: 0,
        average: 0.1,
        major: 0.2,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get delayedCastSuggestion() {
    return (
      <>
        {t({
          id: 'rogue.outlaw.dispatch.delayedCastSuggestion.p1',
          message: 'You should delay Dispatch whenever ',
        })}
        <SpellLink spell={talents.GRAVEDIGGER_3_OUTLAW_TALENT} />{' '}
        {t({
          id: 'rogue.outlaw.dispatch.delayedCastSuggestion.p2',
          message: 'or ',
        })}
        <SpellLink spell={talents.ACE_UP_YOUR_SLEEVE_TALENT} />
        {t({
          id: 'rogue.outlaw.dispatch.delayedCastSuggestion.p3',
          message: ' procs and prioritize ',
        })}
        <SpellLink spell={SPELLS.BETWEEN_THE_EYES} />
        {t({
          id: 'rogue.outlaw.dispatch.delayedCastSuggestion.p4',
          message: ' as your damaging spender.',
        })}
      </>
    );
  }

  static dependencies = {
    damageTracker: DamageTracker,
    betweenTheEyesDamageTracker: BetweenTheEyesDamageTracker,
  };

  protected damageTracker!: DamageTracker;
  protected betweenTheEyesDamageTracker!: BetweenTheEyesDamageTracker;
}

export default Dispatch;
