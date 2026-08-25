import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import TALENTS from 'common/TALENTS/mage';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Analyzer from 'parser/core/Analyzer';
import GuideSection from 'interface/guide/components/GuideSection';
import { TimelineHeatmapGrid, type TimelineHeatmapBracket } from 'interface/guide/components';
import ArcaneSurge from '../analyzers/ArcaneSurge';
import Events, { CastEvent } from 'parser/core/Events';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import Spell from 'common/SPELLS/Spell';

const SPELL_COLORS = {
  ARCANE_SURGE: '#db35acff', // Pinkish purple
  EVOCATION: '#10B981', // Green
} as const;

const MANA_BRACKETS: TimelineHeatmapBracket[] = [
  { label: '81–100%', min: 80, color: '#4CAF50' },
  { label: '61–79%', min: 60, color: '#8BC34A' },
  { label: '41–59%', min: 40, color: '#FFC107' },
  { label: '21–39%', min: 20, color: '#FF9800' },
  { label: '<20%', min: 0, color: '#F44336' },
];

class ManaChart extends Analyzer {
  static dependencies = {
    arcaneSurge: ArcaneSurge,
  };

  protected arcaneSurge!: ArcaneSurge;

  private manaUpdates: Array<{ timestamp: number; current: number; max: number }> = [];
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
    const arcaneCharge = <SpellLink spell={SPELLS.ARCANE_CHARGE} />;
    const evocation = <SpellLink spell={TALENTS.EVOCATION_TALENT} />;
    const arcaneBarrage = <SpellLink spell={SPELLS.ARCANE_BARRAGE} />;

    const explanation = (
      <>
        <p>
          <b>{t({ id: 'mage.arcane.manaChart.guide.explanation.bold', message: 'Mana Management' })}</b>
          {t({
            id: 'mage.arcane.manaChart.guide.explanation.p1',
            message:
              ' plays a large role in your Arcane rotation, but is relatively simple to manage if you are doing your rotation properly. However, if you are hanging onto your ',
          })}
          {arcaneCharge}
          {t({
            id: 'mage.arcane.manaChart.guide.explanation.p2',
            message:
              ' stacks for too long, you can easily burn through all your mana without realizing it. If you are having trouble managing your mana, focus on the below items first:',
          })}
        </p>
        <ul>
          <li>
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li1.a',
              message: 'Focus on your ',
            })}
            {arcaneBarrage}
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li1.b',
              message: ' usage as that will help regulate your mana.',
            })}
          </li>
          <li>
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li2.a',
              message: 'Make sure you are using ',
            })}
            {arcaneSurge}
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li2.b',
              message: ' as quickly as possible.',
            })}
          </li>
          <li>
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li3.a',
              message:
                'If you are still struggling, consider taking ',
            })}
            {evocation}
            {t({
              id: 'mage.arcane.manaChart.guide.explanation.li3.b',
              message:
                ' until you get used to the rotation and no longer need it.',
            })}
          </li>
        </ul>
      </>
    );

    const arcaneSurgeCasts = this.arcaneSurge.surgeData.map((cast) => cast.cast);
    const evocationCasts = this.evocationCasts.map((cast) => cast.timestamp);
    const manaDataPoints = this.manaUpdates.map((update) => ({
      timestamp: update.timestamp,
      value: (update.current / update.max) * 100,
    }));

    return (
      <GuideSection
        spell={TALENTS.EVOCATION_TALENT}
        title={t({
          id: 'mage.arcane.manaChart.guide.title',
          message: 'Mana Management',
        })}
        explanation={explanation}
        verticalLayout
      >
        <TimelineHeatmapGrid
          dataPoints={manaDataPoints}
          brackets={MANA_BRACKETS}
          valueLabel={t({
            id: 'mage.arcane.manaChart.guide.valueLabel',
            message: 'Mana',
          })}
          startTime={this.owner.fight.start_time}
          endTime={this.owner.fight.end_time}
          bucketCount={25}
          markerGroups={[
            {
              label: t({
                id: 'mage.arcane.manaChart.guide.marker.arcaneSurge',
                message: 'Arcane Surge',
              }),
              color: SPELL_COLORS.ARCANE_SURGE,
              timestamps: arcaneSurgeCasts,
            },
            {
              label: t({
                id: 'mage.arcane.manaChart.guide.marker.evocation',
                message: 'Evocation',
              }),
              color: SPELL_COLORS.EVOCATION,
              timestamps: evocationCasts,
            },
          ]}
        />
      </GuideSection>
    );
  }
}

export default ManaChart;
