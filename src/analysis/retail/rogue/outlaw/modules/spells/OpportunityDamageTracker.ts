import { FilteredDamageTracker } from 'analysis/retail/rogue/shared';
import SPELLS from 'common/SPELLS';
import { Options } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';

class OpportunityDamageTracker extends FilteredDamageTracker {
  constructor(options: Options) {
    super(options);

    this.subscribeInefficientCast(
      [SPELLS.SINISTER_STRIKE],
      () =>
        t({
          id: 'rogue.outlaw.opportunity.inefficientCast',
          message: 'Pistol Shot should be used as your builder during Opportunity',
        }),
    );
  }

  shouldProcessEvent(): boolean {
    return this.selectedCombatant.hasBuff(SPELLS.OPPORTUNITY.id);
  }
}

export default OpportunityDamageTracker;
