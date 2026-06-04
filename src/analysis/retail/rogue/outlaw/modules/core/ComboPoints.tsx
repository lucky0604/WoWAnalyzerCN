import { ComboPointTracker } from 'analysis/retail/rogue/shared';
import Spell from 'common/SPELLS/Spell';
import { SpellLink } from 'interface';
import Analyzer from 'parser/core/Analyzer';
import { Trans } from '@lingui/react/macro';

class ComboPoints extends Analyzer {
  static dependencies = {
    comboPointTracker: ComboPointTracker,
  };
  protected comboPointTracker!: ComboPointTracker;

  makeExtraSuggestion(spell: Spell) {
    return (
      <Trans id="rogue.outlaw.comboPoints.avoidWasting">
        Avoid wasting combo points when casting <SpellLink spell={spell} />.
      </Trans>
    );
  }
}

export default ComboPoints;
