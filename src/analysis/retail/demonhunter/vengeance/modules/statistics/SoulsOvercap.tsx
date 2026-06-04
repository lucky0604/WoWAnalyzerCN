import { formatNumber, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS/demonhunter';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import Analyzer, { Options } from 'parser/core/Analyzer';
import { NumberThreshold, ThresholdStyle } from 'parser/core/ParseResults';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import SoulFragmentsTracker from '../features/SoulFragmentsTracker';

class SoulsOvercap extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
    soulFragmentsTracker: SoulFragmentsTracker,
  };

  protected abilityTracker!: AbilityTracker;
  protected soulFragmentsTracker!: SoulFragmentsTracker;

  constructor(options: Options) {
    super(options);
    this.active =
      this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.SPIRIT_BOMB_TALENT) &&
      !this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.FEED_THE_DEMON_TALENT);
  }

  get suggestionThresholdsEfficiency(): NumberThreshold {
    return {
      actual: this.wastePerGenerated(),
      isGreaterThan: {
        minor: 0.05,
        average: 0.1,
        major: 0.15,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  wastePerGenerated() {
    return this.soulFragmentsTracker.overcap / this.soulFragmentsTracker.soulsGenerated;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(5)}
        size="flexible"
        tooltip={
          <>
            <Trans id="demonhunter.vengeance.soulsOvercap.tooltip">
              You generated {formatNumber(this.soulFragmentsTracker.overcap)} souls at cap. These are
              absorbed automatically and aren't avalible to boost Spirit Bomb's damage.
            </Trans>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <Trans id="demonhunter.vengeance.soulsOvercap.totalGenerated">
              Total Soul Fragments generated:{' '}
              {formatNumber(this.soulFragmentsTracker.soulsGenerated)}
            </Trans>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <Trans id="demonhunter.vengeance.soulsOvercap.totalSpent">
              Total Soul Fragments spent:{' '}
              {formatNumber(this.soulFragmentsTracker.soulsSpent)}
            </Trans>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <Trans id="demonhunter.vengeance.soulsOvercap.endOfFight">
              At the end of the fight, you had{' '}
              {formatNumber(this.soulFragmentsTracker.currentSouls)} unused Soul Fragments.
            </Trans>
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.SOUL_FRAGMENT}>
          <>
            {formatPercentage(this.wastePerGenerated())}%{' '}
            <small>
              <Trans id="demonhunter.vengeance.soulsOvercap.soulsOverCapLabel">
                souls over cap
              </Trans>
            </small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default SoulsOvercap;
