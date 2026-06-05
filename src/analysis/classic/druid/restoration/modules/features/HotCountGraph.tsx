import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS/classic/druid';
import SpellLink from 'interface/SpellLink';
import { Options } from 'parser/core/Module';
import BuffCountGraph, { GraphedSpellSpec } from 'parser/shared/modules/BuffCountGraph';
import Panel from 'parser/ui/Panel';

/**
 * Graph showing player's HoTs out over an encounter, with CD usage superimposed on top.
 * Useful for visualizing player "HoT ramps".
 */
class HotCountGraph extends BuffCountGraph {
  static dependencies = {
    ...BuffCountGraph.dependencies,
  };

  constructor(options: Options) {
    super(options);
  }

  buffSpecs(): GraphedSpellSpec[] {
    const buffSpecs: GraphedSpellSpec[] = [];
    buffSpecs.push({ spells: SPELLS.REJUVENATION, color: '#a010a0' });
    buffSpecs.push({ spells: SPELLS.WILD_GROWTH, color: '#20b020' });
    return buffSpecs;
  }

  castRuleSpecs(): GraphedSpellSpec[] {
    const castSpecs: GraphedSpellSpec[] = [];
    castSpecs.push({ spells: SPELLS.TRANQUILITY, color: '#bbbbbb' });
    return castSpecs;
  }

  statistic() {
    return (
      <Panel
        title={t({
          id: 'classic.druid.restoration.hotGraph.statisticTitle',
          message: 'Hot Graph',
        })}
        position={100}
        explanation={
          <>
            {t({
              id: 'classic.druid.restoration.hotGraph.statisticExplanation',
              message:
                'This graph shows the number of HoTs you had active over the course of the encounter. Maintaining a steady stream of Wild Growth and several Rejuvenations is best to maximise healing.',
            })}
          </>
        }
      >
        {this.plot}
      </Panel>
    );
  }
}

export default HotCountGraph;
