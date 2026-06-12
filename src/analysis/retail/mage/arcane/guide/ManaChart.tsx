import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { JSX } from 'react';
import TALENTS from 'common/TALENTS/mage';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Analyzer from 'parser/core/Analyzer';
import GuideSection from 'interface/guide/components/GuideSection';
import { ManaChart as ManaChartComponent } from '../../shared/components';
import ManaValues from 'parser/shared/modules/ManaValues';
import ArcaneSurge from '../analyzers/ArcaneSurge';
import TouchOfTheMagi from '../analyzers/TouchOfTheMagi';
import Events, { CastEvent } from 'parser/core/Events';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import Spell from 'common/SPELLS/Spell';

const SPELL_COLORS = {
  ARCANE_SURGE: '#db35acff',
  EVOCATION: '#10B981',
  TOUCH_OF_THE_MAGI: '#F59E0B',
} as const;

class ManaChart extends Analyzer {
  static dependencies = {
    manaValues: ManaValues,
    arcaneSurge: ArcaneSurge,
    touchOfTheMagi: TouchOfTheMagi,
  };

  protected manaValues!: ManaValues;
  protected arcaneSurge!: ArcaneSurge;
  protected touchOfTheMagi!: TouchOfTheMagi;

  private manaUpdates: Array<{ timestamp: number; current: number; max: number; used: number }> =
    [];
  private evocationCasts: Array<{ timestamp: number; spell: Spell }> = [];

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this.onCast);
  }

  onCast(event: CastEvent) {
    if (event.prepull || !event.classResources) {
      return;
    }

    const manaResource = event.classResources.find(
      (resource) => resource.type === RESOURCE_TYPES.MANA.id,
    );

    if (manaResource) {
      const currentMana = manaResource.amount - (manaResource.cost || 0);
      this.manaUpdates.push({
        timestamp: event.timestamp,
        current: currentMana,
        max: manaResource.max,
        used: manaResource.cost || 0,
      });
    }

    if (event.ability.guid === TALENTS.EVOCATION_TALENT.id) {
      this.evocationCasts.push({
        timestamp: event.timestamp,
        spell: TALENTS.EVOCATION_TALENT,
      });
    }
  }

  get guideSubsection(): JSX.Element {
    const arcaneSurge = <SpellLink spell={TALENTS.ARCANE_SURGE_TALENT} />;
    const touchOfTheMagi = <SpellLink spell={TALENTS.TOUCH_OF_THE_MAGI_TALENT} />;
    const evocation = <SpellLink spell={TALENTS.EVOCATION_TALENT} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;

    const explanation = (
      <>
        <p>
          <>
            <strong>
              {t({
                id: 'mage.arcane.manaChart.explanation1.bold',
                message: 'Mana Management',
              })}
            </strong>
            {t({
              id: 'mage.arcane.manaChart.explanation1.p1',
              message: ' is crucial for Arcane Mage performance. Proper mana usage involves:',
            })}
          </>
        </p>
        <ul>
          <li>
              <>
                <strong>
                  {t({
                    id: 'mage.arcane.manaChart.burnPhase.bold',
                    message: 'Burn Phase:',
                  })}
                </strong>
                {t({
                  id: 'mage.arcane.manaChart.burnPhase.p1',
                  message: ' Use ',
                })}
                {arcaneSurge}
                {t({
                  id: 'mage.arcane.manaChart.burnPhase.p2',
                  message: ' and ',
                })}
                {touchOfTheMagi}
                {t({
                  id: 'mage.arcane.manaChart.burnPhase.p3',
                  message: ' while maintaining mana for the full duration. Don\'t go OOM during major cooldowns.',
                })}
              </>
          </li>
          <li>
              <>
                <strong>
                  {t({
                    id: 'mage.arcane.manaChart.conservePhase.bold',
                    message: 'Conserve Phase:',
                  })}
                </strong>
                {t({
                  id: 'mage.arcane.manaChart.conservePhase.p1',
                  message: ' Use ',
                })}
                {arcaneBarrage}
                {t({
                  id: 'mage.arcane.manaChart.conservePhase.p2',
                  message: ' at 4 stacks to maintain mana efficiency while waiting for cooldowns.',
                })}
              </>
            </li>
            <li>
              <>
                <strong>
                  {t({
                    id: 'mage.arcane.manaChart.manaRecovery.bold',
                    message: 'Mana Recovery:',
                  })}
                </strong>
                {t({
                  id: 'mage.arcane.manaChart.manaRecovery.p1',
                  message: ' Use ',
                })}
                {evocation}
                {t({
                  id: 'mage.arcane.manaChart.manaRecovery.p2',
                  message: ' to restore mana during conserve phases or between burn windows.',
                })}
              </>
            </li>
            <li>
              <>
                <strong>
                  {t({
                    id: 'mage.arcane.manaChart.fightEnding.bold',
                    message: 'Fight Ending:',
                  })}
                </strong>
                {t({
                  id: 'mage.arcane.manaChart.fightEnding.p1',
                  message: ' Aim to end fights with minimal mana remaining - unused mana is wasted potential damage.',
                })}
              </>
          </li>
        </ul>
      </>
    );

    const arcaneSurgeCasts = this.arcaneSurge.surgeData.map((cast) => ({
      timestamp: cast.cast,
      spell: TALENTS.ARCANE_SURGE_TALENT,
      color: SPELL_COLORS.ARCANE_SURGE,
    }));

    const evocationCasts = this.evocationCasts.map((cast) => ({
      ...cast,
      color: SPELL_COLORS.EVOCATION,
    }));

    return (
      <GuideSection
        spell={TALENTS.EVOCATION_TALENT}
        title={t({ id: 'mage.arcane.manaChart.title', message: 'Mana Management' })}
        explanation={explanation}
        verticalLayout
      >
        <ManaChartComponent
          manaUpdates={this.manaUpdates}
          startTime={this.owner.fight.start_time}
          endTime={this.owner.fight.end_time}
          annotations={[
            { events: arcaneSurgeCasts, type: 'cast' },
            { events: evocationCasts, type: 'cast' },
          ]}
          lowManaThreshold={0.1}
          showBossHealth
          reportCode={this.owner.report.code}
        />
      </GuideSection>
    );
  }
}

export default ManaChart;
