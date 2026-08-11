import { describe, expect, it } from 'vitest';

import { season2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';
import {
  getCoordinateIdentityRegistry,
  getCoordinateSnapshot,
} from '../../src/dungeon/runtime/coordinates';
import {
  checkSourceUse,
  dungeonSourceRegistry,
  validateForcesSnapshotRegistry,
} from '../../src/dungeon/runtime/sourceRegistry';
import { validatePublishedLearningGate, validateS2CoordinateGate } from './check';

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

  it('blocks a published catalog entry without a formal scoped document', () => {
    const publishedEntry = { ...entry, status: 'published' as const };
    expect(validatePublishedLearningGate(publishedEntry, undefined)).toEqual([
      expect.stringContaining('FORMAL_LEARNING_GATE_FAILED altar-of-fangs'),
    ]);
  });

  it('does not require formal content for a coordinate-only catalog entry', () => {
    expect(validatePublishedLearningGate(entry, undefined)).toEqual([]);
  });

  it('rejects duplicate or internally inconsistent forces registry entries', () => {
    const forceEntry = {
      registryKey: 'test-forces',
      dungeonId: entry.id,
      snapshotId: 'forces-snapshot',
      source: 'game-data' as const,
      gameBuild: 'midnight-s2-ptr-12.1',
      digest: 'sha256:' + 'a'.repeat(64),
      enemyForces: { enemy: 5 },
      totalEnemyForcesPoints: 4,
      evidenceRef: 'test-evidence',
      status: 'approved' as const,
    };
    const errors = validateForcesSnapshotRegistry([forceEntry, forceEntry]);

    expect(errors).toEqual(
      expect.arrayContaining([
        'FORCES_REGISTRY_DUPLICATE_KEY test-forces',
        'FORCES_REGISTRY_INVALID_PAYLOAD test-forces',
      ]),
    );
  });

  it('fails closed for a malformed forces payload instead of throwing', () => {
    const malformed = {
      registryKey: 'malformed-forces',
      dungeonId: entry.id,
      snapshotId: 'forces-snapshot',
      source: 'game-data' as const,
      gameBuild: 'midnight-s2-ptr-12.1',
      digest: 'sha256:' + 'a'.repeat(64),
      enemyForces: null,
      totalEnemyForcesPoints: 0,
      evidenceRef: 'test-evidence',
      status: 'approved' as const,
    } as never;

    expect(() => validateForcesSnapshotRegistry([malformed])).not.toThrow();
    expect(validateForcesSnapshotRegistry([malformed])).toContain(
      'FORCES_REGISTRY_INVALID_PAYLOAD malformed-forces',
    );
  });

  it('rejects unknown forces sources at the registry boundary', () => {
    const unknownSource = {
      registryKey: 'unknown-source',
      dungeonId: entry.id,
      snapshotId: 'forces-snapshot',
      source: 'bogus',
      gameBuild: 'midnight-s2-ptr-12.1',
      digest: 'sha256:' + 'a'.repeat(64),
      enemyForces: { enemy: 5 },
      totalEnemyForcesPoints: 5,
      evidenceRef: 'test-evidence',
      status: 'approved',
    } as never;

    expect(validateForcesSnapshotRegistry([unknownSource])).toContain(
      'FORCES_REGISTRY_INVALID_SOURCE unknown-source',
    );
  });
});
