import { describe, expect, it } from 'vitest';

import { getCoordinateReference, getCoordinateSnapshot } from './coordinates';
import { legacyThreechestCoordinateInventory, season2DungeonCatalog } from '../data/season2Catalog';

describe('coordinate references', () => {
  it('has a normalized snapshot for every legacy Threechest inventory entry', () => {
    legacyThreechestCoordinateInventory.forEach((entry) => {
      const snapshot = getCoordinateSnapshot(entry.sourceKey);
      expect(snapshot?.normalizedCoordinateSpace).toBe('normalized-v1');
      expect(snapshot?.transformVersion).toBe('threechest-yx-to-normalized-v1');
      expect(snapshot?.spawns.length).toBeGreaterThan(0);
      expect('sourceUrl' in (snapshot ?? {})).toBe(false);
    });
  });

  it('converts source positions into a read-only Floor/Spawn reference', () => {
    const entry = legacyThreechestCoordinateInventory.find(
      (candidate) => candidate.sourceKey === 'magi',
    )!;
    const reference = getCoordinateReference(entry)!;
    expect(reference.floor.id).toBe('magisters-terrace:default');
    expect(reference.spawns).toHaveLength(reference.snapshot.spawns.length);
    expect(reference.spawns[0]?.id).toContain('magisters-terrace:magi:');
    expect(reference.floor.bounds.yMin).toBeLessThan(0);
  });

  it('does not resolve a current S2 entry without a coordinate snapshot', () => {
    const entry = season2DungeonCatalog.find((candidate) => candidate.id === 'kings-rest')!;
    expect(getCoordinateReference(entry)).toBeUndefined();
    expect(getCoordinateReference({ ...entry, sourceKey: 'magi' })).toBeUndefined();
  });

  it('returns undefined for an unknown source key', () => {
    expect(getCoordinateSnapshot('unknown')).toBeUndefined();
  });
});
