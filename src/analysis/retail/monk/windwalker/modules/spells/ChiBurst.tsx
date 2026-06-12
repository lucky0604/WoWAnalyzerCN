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

class ChiBurst extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
  };

  protected spellUsable!: SpellUsable;

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <>
          <strong>
            <SpellLink spell={TALENTS_MONK.CHI_BURST_TALENT} />
          </strong>{' '}
          {t({
            id: 'monk.windwalker.chiburst.explanation.p1',
            message: 'is a filler spell that is also very good at resetting ',
          })}
          <SpellLink spell={TALENTS_MONK.JADEFIRE_STOMP_TALENT} />
          {t({
            id: 'monk.windwalker.chiburst.explanation.p2',
            message: '. ',
          })}
          <SpellLink spell={TALENTS_MONK.CHI_BURST_TALENT} />
          {t({
            id: 'monk.windwalker.chiburst.explanation.p3',
            message:
              ' ideally should be used when anything else would break mastery, or when movement is required.',
          })}
        </>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_MONK.CHI_BURST_TALENT} />{' '}
            {t({
              id: 'monk.windwalker.chiburst.cast_efficiency',
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
        spell={TALENTS_MONK.CHI_BURST_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default ChiBurst;
