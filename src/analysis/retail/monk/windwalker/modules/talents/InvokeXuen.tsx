import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import SpellUsable from 'analysis/retail/monk/windwalker/modules/core/SpellUsable';
import { SpellLink } from 'interface';
import Analyzer, { Options } from 'parser/core/Analyzer';

import { TALENTS_MONK } from 'common/TALENTS';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';

class InvokeXuen extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  protected spellUsable!: SpellUsable;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT);
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <>
          <strong>
            <SpellLink spell={TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT} />
          </strong>{' '}
          {t({
            id: 'monk.windwalker.invoke_xuen.explanation',
            message: 'is one of your strongest cooldowns.',
          })}
        </>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT} />{' '}
            {t({
              id: 'monk.windwalker.invoke_xuen.cast_efficiency',
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
        spell={TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default InvokeXuen;
