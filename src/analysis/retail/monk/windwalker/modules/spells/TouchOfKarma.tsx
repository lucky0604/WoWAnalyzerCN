import type { JSX } from 'react';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import HealingDone from 'parser/shared/modules/throughput/HealingDone';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';

const TOUCH_OF_KARMA_HP_SCALING = 0.5;

class TouchOfKarma extends Analyzer {
  static dependencies = {
    healingDone: HealingDone,
  };

  protected healingDone!: HealingDone;

  totalPossibleAbsorb = 0;

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.TOUCH_OF_KARMA_CAST),
      this.onCast,
    );
  }

  onCast(event: CastEvent) {
    this.totalPossibleAbsorb += (event.maxHitPoints || 0) * TOUCH_OF_KARMA_HP_SCALING;
  }

  get absorbUsed() {
    return (
      this.healingDone.byAbility(SPELLS.TOUCH_OF_KARMA_CAST.id).effective / this.totalPossibleAbsorb
    );
  }

  get suggestionThresholds() {
    return {
      actual: this.absorbUsed,
      isLessThan: {
        minor: 0.8,
        average: 0.65,
        major: 0.5,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(2)}
        size="flexible"
        tooltip={t({
          id: 'monk.windwalker.karma.tooltip',
          message: 'This does not account for possible absorbs from missed Touch of Karma casts',
        })}
      >
        <BoringSpellValueText spell={SPELLS.TOUCH_OF_KARMA_CAST}>
          {formatPercentage(this.absorbUsed, 0)}%{' '}
          <small>{t({ id: 'monk.windwalker.karma.absorb_used', message: 'Absorb used' })}</small>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <Trans id="monk.windwalker.karma.explanation">
          <b>
            <SpellLink spell={SPELLS.TOUCH_OF_KARMA_CAST} />
          </b>{' '}
          is both a defensive and offensive cooldown, although it is mostly used offensively. It
          should be used any time enough damage will be taken to break the shield.
        </Trans>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <Trans id="monk.windwalker.karma.efficiency">
              <SpellLink spell={SPELLS.TOUCH_OF_KARMA_CAST} /> cast efficiency
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
        spell={SPELLS.TOUCH_OF_KARMA_CAST}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default TouchOfKarma;
