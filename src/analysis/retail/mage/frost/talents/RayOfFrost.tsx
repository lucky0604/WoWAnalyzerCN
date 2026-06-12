import type { JSX } from 'react';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import TALENTS from 'common/TALENTS/mage';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, DamageEvent, GetRelatedEvents } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import Enemies from 'parser/shared/modules/Enemies';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from 'analysis/retail/mage/frost/Guide';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { PerformanceMark } from 'interface/guide';

class RayOfFrost extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };
  protected enemies!: Enemies;

  rayOfFrost: { timestamp: number; hits: number; damage: DamageEvent[] }[] = [];
  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.RAY_OF_FROST_TALENT);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.RAY_OF_FROST_TALENT),
      this.onRayCast,
    );
  }

  onRayCast(event: CastEvent) {
    const damage: DamageEvent[] | undefined = GetRelatedEvents(event, 'SpellDamage');

    const rayOfFrostDetails = {
      timestamp: event.timestamp,
      hits: damage.length,
      damage: damage,
    };
    this.rayOfFrost.push(rayOfFrostDetails);

    this.analyzeCastEntry(rayOfFrostDetails);
  }

  private analyzeCastEntry(rayOfFrostDetails: { timestamp: number; hits: number }) {
    let performance = QualitativePerformance.Fail;
    const count = `${rayOfFrostDetails.hits}/8 hits`;
    if (rayOfFrostDetails.hits === 8) {
      performance = QualitativePerformance.Perfect;
    } else if (rayOfFrostDetails.hits >= 7) {
      performance = QualitativePerformance.Good;
    }
    const tooltip = (
      <>
        <b>@ {this.owner.formatTimestamp(rayOfFrostDetails.timestamp)}</b>
        <p>
          <PerformanceMark perf={performance} /> {performance}: {count}
        </p>
      </>
    );
    this.castEntries.push({ value: performance, tooltip });
  }

  get badCasts() {
    return this.rayOfFrost.filter((r) => r.hits < 7).length;
  }

  get totalCasts() {
    return this.rayOfFrost.length;
  }

  get castUtilization() {
    return 1 - this.badCasts / this.totalCasts;
  }

  get rayOfFrostUtilizationThresholds() {
    return {
      actual: this.castUtilization,
      isLessThan: {
        minor: 0.9,
        average: 0.8,
        major: 0.7,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get guideSubsection(): JSX.Element {
    const rayOfFrost = <SpellLink spell={TALENTS.RAY_OF_FROST_TALENT} />;

    const explanation = (
      <>
        <p>
          <>
            <strong>{rayOfFrost}</strong>
            {t({
              id: 'mage.frost.rayOfFrost.explanation.p1',
              message: ' is the most important long cooldown spell in Frost. You want to cast it as soon as possible, but there are some rules to follow in order to get the most out of it.',
            })}
          </>
        </p>
        <ol>
          <li>
            <Trans id="mage.frost.rayOfFrost.rule1">
              Don't miss ticks. Stand still while casting. You have shimmer in case you need to
              avoid something
            </Trans>
          </li>
          <li>
            <Trans id="mage.frost.rayOfFrost.rule2">
              It generates 8 stacks of freeze, try to cast it with less than 12 stacks on the target
              to avoid wasting stacks
            </Trans>
          </li>
        </ol>
      </>
    );
    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <>
              {rayOfFrost}
              {t({
                id: 'mage.frost.rayOfFrost.castEfficiency.p1',
                message: ' cast efficiency',
              })}
            </>
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            {this.subStatistic()}
          </div>
          <strong>
            <>
              {rayOfFrost}
              {t({
                id: 'mage.frost.rayOfFrost.castDetails.p1',
                message: ' cast details',
              })}
            </>
          </strong>
          <PerformanceBoxRow values={this.castEntries} />
          <small>
            <Trans id="mage.frost.rayOfFrost.legend">
              blue (perfect) / green (good) / red (fail) mouseover the rectangles to see more
              details
            </Trans>
          </small>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(
      explanation,
      data,
      GUIDE_CORE_EXPLANATION_PERCENT,
      t({ id: 'mage.frost.rayOfFrost.title', message: 'Ray Of Frost' }),
    );
  }

  /** Guide subsection describing the proper usage of Ray of Frost */
  subStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS.RAY_OF_FROST_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default RayOfFrost;
