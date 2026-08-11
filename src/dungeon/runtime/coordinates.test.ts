import { describe, expect, it } from 'vitest';

import {
  getCoordinateReference,
  getCoordinateSnapshot,
  validateCoordinateIdentityRegistry,
} from './coordinates';
import { legacyThreechestCoordinateInventory, season2DungeonCatalog } from '../data/season2Catalog';
import { dungeonSourceRegistry } from './sourceRegistry';

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

  it('resolves a stable, read-only coordinate reference for every S2 catalog entry', () => {
    const expectedSpawnCounts: Record<string, number> = {
      'altar-of-fangs': 160,
      'murder-row': 221,
      'den-of-nalorakk': 116,
      'the-blinding-vale': 276,
      'voidscar-arena': 218,
      'ruby-life-pools': 166,
      'kings-rest': 101,
      'temple-of-sethraliss': 128,
    };

    season2DungeonCatalog.forEach((entry) => {
      const reference = getCoordinateReference(entry);
      expect(reference?.spawns).toHaveLength(expectedSpawnCounts[entry.id]);
      expect(reference?.spawns[0]?.id).toBe('spawn-1');
      expect(reference?.spawns.at(-1)?.id).toBe(`spawn-${expectedSpawnCounts[entry.id]}`);
      expect(reference?.snapshot.normalizedCoordinateSpace).toBe('normalized-v1');
    });
  });

  it('keeps every S2 snapshot limited to approved spatial fields', () => {
    season2DungeonCatalog.forEach((entry) => {
      const snapshot = getCoordinateSnapshot(entry.coordinateSnapshotKey ?? entry.sourceKey)!;
      const spawnFields = [
        ...new Set(snapshot.spawns.flatMap((spawn) => Object.keys(spawn))),
      ].sort();
      expect(spawnFields).toEqual(
        expect.arrayContaining(
          ['floorId', 'position', 'sourceEnemyId', 'sourceEnemyIndex', 'sourceId'].sort(),
        ),
      );
      expect(
        spawnFields.every((field) =>
          [
            'floorId',
            'groupId',
            'patrol',
            'position',
            'sourceEnemyId',
            'sourceEnemyIndex',
            'sourceId',
          ].includes(field),
        ),
      ).toBe(true);
      expect(snapshot).not.toHaveProperty('sourceUrl');
      expect(snapshot).not.toHaveProperty('forces');
      expect(snapshot).not.toHaveProperty('abilities');
      expect(snapshot).not.toHaveProperty('route');
    });
  });

  it.each([
    ['wrong version', { wrongVersion: true }],
    ['wrong entry count', { wrongEntryCount: true }],
    ['duplicate source IDs', { duplicateSource: true }],
    ['duplicate stable IDs', { duplicateStable: true }],
    ['enemy identity mismatch', { enemyMismatch: true }],
    ['floor identity mismatch', { floorMismatch: true }],
  ] as const)('rejects malformed identity sidecars (%s)', (_label, mutation) => {
    const flags = mutation as {
      wrongVersion?: boolean;
      wrongEntryCount?: boolean;
      duplicateSource?: boolean;
      duplicateStable?: boolean;
      enemyMismatch?: boolean;
      floorMismatch?: boolean;
    };
    const snapshot = getCoordinateSnapshot('s2-fang')!;
    const entries = snapshot.spawns.map((spawn, index) => ({
      stableId: `spawn-${index + 1}`,
      sourceId: spawn.sourceId,
      enemyId: `${snapshot.dungeonKey}:source-enemy:${spawn.sourceEnemyId}`,
      floorId: `${snapshot.dungeonKey}:${spawn.floorId}`,
    }));
    if (flags.wrongVersion) {
      expect(
        validateCoordinateIdentityRegistry(snapshot, {
          version: 2,
          entries,
        } as never),
      ).toBe(false);
      return;
    }
    if (flags.wrongEntryCount) entries.pop();
    if (flags.duplicateSource) entries[1]!.sourceId = entries[0]!.sourceId;
    if (flags.duplicateStable) entries[1]!.stableId = entries[0]!.stableId;
    if (flags.enemyMismatch) entries[0]!.enemyId = 'fang:source-enemy:999999';
    if (flags.floorMismatch) entries[0]!.floorId = 'fang:other-floor';
    expect(validateCoordinateIdentityRegistry(snapshot, { version: 1, entries })).toBe(false);
  });

  it('does not resolve an S2 entry when its explicit coordinate metadata is missing', () => {
    const entry = season2DungeonCatalog.find((candidate) => candidate.id === 'kings-rest')!;
    expect(getCoordinateReference({ ...entry, coordinateSnapshotId: undefined })).toBeUndefined();
    expect(
      getCoordinateReference({ ...entry, coordinateSnapshotKey: 'missing-coordinate-key' }),
    ).toBeUndefined();
  });

  it('fails closed when the source approval is revoked at runtime', () => {
    const entry = season2DungeonCatalog.find((candidate) => candidate.id === 'kings-rest')!;
    const source = dungeonSourceRegistry.snapshots.find(
      (candidate) => candidate.snapshotId === entry.coordinateSnapshotId,
    )!;
    const previousStatus = source.status;
    source.status = 'revoked';
    try {
      expect(getCoordinateReference(entry)).toBeUndefined();
    } finally {
      source.status = previousStatus;
    }
  });

  it('returns undefined for an unknown source key', () => {
    expect(getCoordinateSnapshot('unknown')).toBeUndefined();
  });
});
