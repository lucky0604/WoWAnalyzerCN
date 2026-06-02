import SPELLS from 'common/SPELLS';
import { Options } from 'parser/core/Analyzer';
import SelfHealTimingGraph from 'parser/shared/modules/features/SelfHealTimingGraph';
import { i18n } from '@lingui/core';
import { defineMessage } from '@lingui/core/macro';

class DeathStrikeTiming extends SelfHealTimingGraph {
  constructor(options: Options) {
    super(options);
    this.selfHealSpell = SPELLS.DEATH_STRIKE_HEAL;
    this.tabTitle = i18n._(
      defineMessage({
        id: 'deathknight.blood.deathStrikeTiming.tabTitle',
        message: 'Death Strike Timing',
      }),
    );
    this.tabURL = 'death-strike-timings';
    this.tabEnabled = false;
  }
}

export default DeathStrikeTiming;
