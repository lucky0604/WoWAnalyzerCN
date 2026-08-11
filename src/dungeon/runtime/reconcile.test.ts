import { describe, expect, it } from 'vitest';

import { reconcileSpawns } from './reconcile';

describe('spawn reconciliation', () => {
  it('preserves identity when source order changes', () => {
    const previous = [
      { stableId: 'spawn-a', sourceId: 'old-a', enemyId: 'enemy', floorId: 'floor' },
      { stableId: 'spawn-b', sourceId: 'old-b', enemyId: 'enemy', floorId: 'floor' },
    ] as const;
    const result = reconcileSpawns(
      [...previous],
      [
        { sourceId: 'new-b', enemyId: 'enemy', floorId: 'floor', position: [20, 20] },
        { sourceId: 'new-a', enemyId: 'enemy', floorId: 'floor', position: [10, 10] },
      ],
      { 'spawn-a': [10, 10], 'spawn-b': [20, 20] },
    );
    expect(result.blocked).toBe(false);
    expect(result.items.map((item) => item.kind)).toEqual(['auto-match', 'auto-match']);
    expect(result.items.map((item) => item.stableId)).toEqual(['spawn-b', 'spawn-a']);
  });

  it('blocks ambiguous identity matches instead of guessing', () => {
    const result = reconcileSpawns(
      [
        { stableId: 'spawn-a', sourceId: 'old-a', enemyId: 'enemy', floorId: 'floor' },
        { stableId: 'spawn-b', sourceId: 'old-b', enemyId: 'enemy', floorId: 'floor' },
      ],
      [{ sourceId: 'new', enemyId: 'enemy', floorId: 'floor', position: [10, 10] }],
      { 'spawn-a': [9, 10], 'spawn-b': [11, 10] },
    );
    expect(result.blocked).toBe(true);
    expect(result.items[0]).toMatchObject({
      kind: 'ambiguous',
      candidates: ['spawn-a', 'spawn-b'],
    });
  });

  it('blocks an exact source ID whose enemy or floor facts drift', () => {
    const result = reconcileSpawns(
      [{ stableId: 'spawn-a', sourceId: 'same-source', enemyId: 'enemy-a', floorId: 'floor' }],
      [{ sourceId: 'same-source', enemyId: 'enemy-b', floorId: 'floor', position: [10, 10] }],
    );
    expect(result.blocked).toBe(true);
    expect(result.items[0]).toMatchObject({
      kind: 'drift',
      stableId: 'spawn-a',
      sourceId: 'same-source',
    });
  });

  it('creates a new stable identity when no candidate exists', () => {
    const result = reconcileSpawns(
      [],
      [{ sourceId: 'new', enemyId: 'enemy', floorId: 'floor', position: [1, 2] }],
    );
    expect(result.items[0]).toMatchObject({ kind: 'new', stableId: 'spawn-1' });
  });
});
