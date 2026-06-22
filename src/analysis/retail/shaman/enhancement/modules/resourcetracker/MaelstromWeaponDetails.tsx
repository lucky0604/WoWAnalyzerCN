import Analyzer from 'parser/core/Analyzer';
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro';
import MaelstromWeaponTracker from './MaelstromWeaponTracker';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import SPELLS from 'common/SPELLS/shaman';

class MaelstromWeaponDetails extends Analyzer {
  static dependencies = {
    maelstromWeaponTracker: MaelstromWeaponTracker,
  };

  maelstromWeaponTracker!: MaelstromWeaponTracker;

  statistic() {
    const gainedPerSecond = this.maelstromWeaponTracker.rawGain / (this.owner.fightDuration / 1000);
    const spentPerSecond = this.maelstromWeaponTracker.spent / (this.owner.fightDuration / 1000);
    return (
      <Statistic
        size="flexible"
        position={STATISTIC_ORDER.CORE()}
        tooltip={
          <ul>
            <li>
              <Trans id="shaman.enhancement.maelstrom.gained">
                {this.maelstromWeaponTracker.generated} stacks gained
              </Trans>
            </li>
            <li>
              <Trans id="shaman.enhancement.maelstrom.wasted">
                {this.maelstromWeaponTracker.wasted} stacks wasted
              </Trans>
            </li>
            <li>
              <Trans id="shaman.enhancement.maelstrom.spent_ps">
                {spentPerSecond.toFixed(2)} spent per second
              </Trans>
            </li>
          </ul>
        }
      >
        <BoringSpellValueText spell={SPELLS.MAELSTROM_WEAPON_BUFF}>
          <>{gainedPerSecond.toFixed(2)}
            <small>{t({ id: 'shaman.enhancement.maelstrom.gained_ps.small', message: 'stacks per second' })}</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default MaelstromWeaponDetails;
