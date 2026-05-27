import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { Trans } from '@lingui/react/macro';
import Events, { ResourceChangeEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS';
import { ResourceLink, SpellLink } from 'interface';
import { TALENTS_DRUID } from 'common/TALENTS';
import DonutChart from 'parser/ui/DonutChart';
import { BadColor, GoodColor } from 'interface/guide';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { CP_GENERATORS } from '../../../constants';
import { isConvoking } from 'analysis/retail/druid/shared/spells/ConvokeSpirits';

/** Feral Frenzy produces 5 generator events within 1 second */
const FERAL_FRENZY_GENERATE_BUFFER_MS = 1000;

/**
 * Straightforward accounting of wasted CPs doesn't do a good job of portraying state of
 * player decision making, as there are a lot of forms of unavoidable waste.
 *
 * Better to look at individual cast decisions (don't use a builder at max CPs),
 * and need to work around some special casing like Convoke and Feral Frenzy.
 */
class BuilderUse extends Analyzer {
  /** Total hardcast builders (Convoke not included) */
  totalBuilderCasts = 0;
  /** Total hardcast builders that wasted all their CPs (Convoke not included) */
  wastedBuilderCasts = 0;

  lastFeralFrenzyStartTimestamp?: number;

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.resourcechange.by(SELECTED_PLAYER).spell(CP_GENERATORS),
      this.onBuilder,
    );
  }

  onBuilder(event: ResourceChangeEvent) {
    const isFeralFrenzy = event.ability.guid === SPELLS.FERAL_FRENZY_DEBUFF.id;
    const isFollowOnFeralFrenzyTick =
      isFeralFrenzy &&
      this.lastFeralFrenzyStartTimestamp &&
      this.lastFeralFrenzyStartTimestamp + FERAL_FRENZY_GENERATE_BUFFER_MS > event.timestamp;
    if (isFeralFrenzy && !isFollowOnFeralFrenzyTick) {
      this.lastFeralFrenzyStartTimestamp = event.timestamp;
    }

    // don't count Convoke builders, and don't count ticks of FF other than the first
    if (isConvoking(this.selectedCombatant) || isFollowOnFeralFrenzyTick) {
      return;
    }

    this.totalBuilderCasts += 1;
    if (event.resourceChange - event.waste === 0) {
      this.wastedBuilderCasts += 1;
    }
  }

  get effectiveBuilderCasts() {
    return this.totalBuilderCasts - this.wastedBuilderCasts;
  }

  get chart() {
    const items = [
      {
        color: GoodColor,
        label: <Trans id="druid.feral.builder_use.effective_builders">Effective Builders</Trans>,
        value: this.effectiveBuilderCasts,
        tooltip: (
          <>
            <Trans id="druid.feral.builder_use.hardcast_note">
              This only counts hardcasts -{' '}
              <SpellLink spell={TALENTS_DRUID.CONVOKE_THE_SPIRITS_TALENT} /> procs are omitted.
            </Trans>
          </>
        ),
      },
      {
        color: BadColor,
        label: <Trans id="druid.feral.builder_use.wasted_builders">Wasted Builders</Trans>,
        value: this.wastedBuilderCasts,
        tooltip: (
          <>
            <Trans id="druid.feral.builder_use.hardcast_note">
              This only counts hardcasts -{' '}
              <SpellLink spell={TALENTS_DRUID.CONVOKE_THE_SPIRITS_TALENT} /> procs are omitted.
            </Trans>
          </>
        ),
      },
    ];

    return <DonutChart items={items} />;
  }

  statistic() {
    return (
      <Statistic position={STATISTIC_ORDER.CORE(5)}>
        <div className="pad">
          <label>
            <Trans id="druid.feral.builder_use.label">
              <ResourceLink id={RESOURCE_TYPES.COMBO_POINTS.id} /> builder usage
            </Trans>
          </label>
          {this.chart}
        </div>
      </Statistic>
    );
  }
}

export default BuilderUse;
