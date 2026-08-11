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

  it('resolves the current S2 RLP coordinate snapshot through explicit source metadata', () => {
    const entry = season2DungeonCatalog.find((candidate) => candidate.id === 'ruby-life-pools')!;
    const reference = getCoordinateReference(entry)!;
    expect(reference.snapshot.snapshotId).toBe(
      'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
    );
    expect(reference.snapshot.dungeonKey).toBe('rlp');
    expect(reference.spawns).toHaveLength(166);
    expect(reference.floor.id).toBe('ruby-life-pools:default');
    expect(reference.spawns[0]?.id).toBe('spawn-1');
    expect(reference.spawns[165]?.id).toBe('spawn-166');
    expect(
      getCoordinateReference({ ...entry, coordinateIdentityRegistryKey: 'missing-registry' }),
    ).toBeUndefined();
  });

  it('keeps the RLP snapshot limited to approved spatial fields', () => {
    const snapshot = getCoordinateSnapshot('rlp')!;
    const spawnFields = [...new Set(snapshot.spawns.flatMap((spawn) => Object.keys(spawn)))].sort();
    expect(spawnFields).toEqual(
      [
        'floorId',
        'groupId',
        'patrol',
        'position',
        'sourceEnemyId',
        'sourceEnemyIndex',
        'sourceId',
      ].sort(),
    );
    expect(snapshot).not.toHaveProperty('sourceUrl');
    expect(snapshot).not.toHaveProperty('forces');
    expect(snapshot).not.toHaveProperty('route');
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
