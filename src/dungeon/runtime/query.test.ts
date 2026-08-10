import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { getAbilityReference, getEnemyReference, searchDungeon } from './query';

describe('dungeon knowledge query', () => {
  const document = phase0FixtureDocuments.rubyLifePools;

  it('searches the authored knowledge index without matching route order', () => {
    expect(searchDungeon(document, '冰霜护盾')[0]).toMatchObject({
      kind: 'ability',
      id: 'rlp-ability-ice-shield',
    });
    expect(searchDungeon(document, 'rlp-learning-route')[0]).toMatchObject({
      kind: 'route',
      id: 'rlp-learning-route',
    });
    expect(searchDungeon(document, '第 7 波')).toEqual([]);
  });

  it('resolves enemy references back to abilities, situations, spawns and pulls', () => {
    const reference = getEnemyReference(document, 'rlp-flashfrost-chillweaver');
    expect(reference?.abilities.map((ability) => ability.id)).toEqual(['rlp-ability-ice-shield']);
    expect(reference?.spawns).toHaveLength(1);
    expect(reference?.routeSteps.map(({ step }) => step.id)).toContain('rlp-route-step-1');
  });

  it('resolves ability references back to casters and learning situations', () => {
    const reference = getAbilityReference(document, 'rlp-ability-icy-devastation');
    expect(reference?.casters.map((enemy) => enemy.id)).toEqual(['rlp-melidrussa']);
    expect(reference?.situations.map((situation) => situation.id)).toContain(
      'rlp-situation-melidrussa-entrance',
    );
    expect(reference?.spawns).toHaveLength(1);
  });
});
