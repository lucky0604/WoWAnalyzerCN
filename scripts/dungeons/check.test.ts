import { describe, expect, it } from 'vitest';

import { season2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';
import {
  getCoordinateIdentityRegistry,
  getCoordinateSnapshot,
} from '../../src/dungeon/runtime/coordinates';
import { checkSourceUse, dungeonSourceRegistry } from '../../src/dungeon/runtime/sourceRegistry';
import { validateS2CoordinateGate } from './check';

describe('dungeon coordinate release gate', () => {
  const entry = season2DungeonCatalog[0]!;
  const snapshot = getCoordinateSnapshot(entry.coordinateSnapshotKey!)!;
  const registeredSnapshot = dungeonSourceRegistry.snapshots.find(
    (candidate) => candidate.snapshotId === entry.coordinateSnapshotId,
  )!;

  it('accepts the committed payload, identity sidecar and approved use', () => {
    expect(
      validateS2CoordinateGate(
        entry,
        snapshot,
        registeredSnapshot,
        checkSourceUse(
          dungeonSourceRegistry,
          entry.coordinateSourceId!,
          entry.coordinateSnapshotId!,
          'commit-derived-data',
        ),
      ),
    ).toEqual([]);
  });

  it('rejects a normalized payload mutation through the immutable digest', () => {
    const mutated = structuredClone(snapshot);
    mutated.spawns[0]!.position[0] += 1;
    const errors = validateS2CoordinateGate(
      entry,
      mutated,
      registeredSnapshot,
      checkSourceUse(
        dungeonSourceRegistry,
        entry.coordinateSourceId!,
        entry.coordinateSnapshotId!,
        'commit-derived-data',
      ),
    );
    expect(errors.some((error) => error.includes('S2_COORDINATE_HASH_MISMATCH'))).toBe(true);
  });

  it('keeps the fixed raw-source digest bound to the registry', () => {
    const mutated = structuredClone(snapshot);
    mutated.rawSha256 = 'tampered';
    const errors = validateS2CoordinateGate(
      entry,
      mutated,
      registeredSnapshot,
      checkSourceUse(
        dungeonSourceRegistry,
        entry.coordinateSourceId!,
        entry.coordinateSnapshotId!,
        'commit-derived-data',
      ),
    );
    expect(errors).toContain('source registry: S2_COORDINATE_RAW_HASH_MISMATCH altar-of-fangs');
  });

  it('rejects a registry that omits the fixed raw-source digest', () => {
    const withoutRaw = structuredClone(registeredSnapshot);
    delete withoutRaw.rawSha256;
    const errors = validateS2CoordinateGate(
      entry,
      snapshot,
      withoutRaw,
      checkSourceUse(
        dungeonSourceRegistry,
        entry.coordinateSourceId!,
        entry.coordinateSnapshotId!,
        'commit-derived-data',
      ),
    );
    expect(errors).toContain('source registry: S2_COORDINATE_RAW_HASH_MISSING altar-of-fangs');
  });

  it('rejects non-spatial fields even when a registry is otherwise present', () => {
    const mutated = structuredClone(snapshot) as typeof snapshot & { forces?: number };
    mutated.forces = 0;
    const errors = validateS2CoordinateGate(
      entry,
      mutated,
      registeredSnapshot,
      checkSourceUse(
        dungeonSourceRegistry,
        entry.coordinateSourceId!,
        entry.coordinateSnapshotId!,
        'commit-derived-data',
      ),
    );
    expect(errors).toContain('source registry: S2_COORDINATE_FIELD_NOT_ALLOWED altar-of-fangs');
  });

  it('rejects a missing registry entry and a disabled use', () => {
    expect(
      validateS2CoordinateGate(entry, snapshot, undefined, {
        ok: false,
        reason: 'registry entry missing',
      }),
    ).toContain('source registry: S2_COORDINATE_SNAPSHOT_MISSING altar-of-fangs');
    expect(
      validateS2CoordinateGate(entry, snapshot, registeredSnapshot, {
        ok: false,
        reason: 'use disabled',
      }),
    ).toContain('source registry: use disabled');
  });

  it('binds stable SpawnId sidecars to the approved digest', () => {
    const registry = getCoordinateIdentityRegistry(entry.coordinateIdentityRegistryKey!)!;
    const original = registry.entries[0]!.stableId;
    registry.entries[0]!.stableId = 'spawn-tampered';
    try {
      const errors = validateS2CoordinateGate(
        entry,
        snapshot,
        registeredSnapshot,
        checkSourceUse(
          dungeonSourceRegistry,
          entry.coordinateSourceId!,
          entry.coordinateSnapshotId!,
          'commit-derived-data',
        ),
      );
      expect(errors).toContain(
        'source registry: S2_COORDINATE_IDENTITY_HASH_MISMATCH altar-of-fangs',
      );
    } finally {
      registry.entries[0]!.stableId = original;
    }
  });
});
