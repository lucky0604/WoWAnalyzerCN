import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import Analyzer from 'parser/core/Analyzer';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';

class StrikeoftheWindlord extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  protected spellUsable!: SpellUsable;

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <>
          <strong>
            <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
          </strong>{' '}
          {t({
            id: 'monk.windwalker.strike_of_the_windlord.explanation',
            message: 'is one of your strongest medium-length cooldown dps abilities.',
          })}
        </>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />{' '}
            {t({
              id: 'monk.windwalker.strike_of_the_windlord.cast_efficiency',
              message: 'cast efficiency',
            })}
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
        spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default StrikeoftheWindlord;
