import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import Analyzer from 'parser/core/Analyzer';
import TALENTS from 'common/TALENTS/paladin';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { ResourceLink, SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../guide/Guide';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

class Judgment extends Analyzer {
  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={SPELLS.JUDGMENT_CAST_HOLY} />
          </b>
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p1', message: ' is one of your primary damaging spells but is also your highest priority healing spell (alongside ' })}
          <SpellLink spell={TALENTS.HOLY_SHOCK_TALENT} />
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p2', message: ') due to its synergy with generating ' })}
          <ResourceLink id={RESOURCE_TYPES.HOLY_POWER.id} />
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p3', message: ', ' })}
          <SpellLink spell={TALENTS.GREATER_JUDGMENT_HOLY_TALENT} />
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p4', message: ' and ' })}
          <SpellLink spell={SPELLS.INFUSION_OF_LIGHT} />
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p5', message: ', and ' })}
          <SpellLink spell={TALENTS.EMPYREAN_LEGACY_HOLY_TALENT} />
          {t({ id: 'paladin.holy.talents.judgment.guideExplanation.p6', message: '.' })}
        </p>
      </>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <>
              <SpellLink spell={SPELLS.JUDGMENT_CAST_HOLY} />
              {t({ id: 'paladin.holy.talents.judgment.castEfficiency', message: ' cast efficiency' })}
            </>
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            {this.subStatistic()}
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  subStatistic() {
    return (
      <CastEfficiencyBar
        spell={SPELLS.JUDGMENT_CAST_HOLY}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default Judgment;
