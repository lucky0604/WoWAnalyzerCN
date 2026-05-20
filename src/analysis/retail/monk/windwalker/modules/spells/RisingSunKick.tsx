import type { JSX } from 'react';
import { Trans } from '@lingui/react/macro';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import Analyzer from 'parser/core/Analyzer';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';

class RisingSunKick extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  protected spellUsable!: SpellUsable;

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <Trans id="monk.windwalker.rising_sun_kick.explanation">
          <b>
            <SpellLink spell={TALENTS_MONK.RISING_SUN_KICK_TALENT} />
          </b>{' '}
          is one of your primary dps skills and should be used immediately in most cases, as dictated
          by the APL.
        </Trans>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <Trans id="monk.windwalker.rising_sun_kick.cast_efficiency">
              <SpellLink spell={TALENTS_MONK.RISING_SUN_KICK_TALENT} /> cast efficiency
            </Trans>
          </strong>
          {this.guideSubStatistic()}
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  guideSubStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS_MONK.RISING_SUN_KICK_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default RisingSunKick;
