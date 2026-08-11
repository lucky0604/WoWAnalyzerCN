import { season2DungeonCatalogById } from '../data/season2Catalog';
import {
  computeFactSnapshotDigest,
  validateFactSnapshot,
  validateFactSnapshotIntegrity,
  type FactSnapshot,
} from './factSnapshot';

async function makeSnapshot(overrides: Partial<FactSnapshot> = {}): Promise<FactSnapshot> {
  const base: FactSnapshot = {
    version: 1,
    snapshotId: 'test-fact-snapshot-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'manual-test',
    licenseStatus: 'needs-review',
    evidenceRef: 'test-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [
      { enemyKey: 'test-enemy', npcId: 1001, isBoss: false, forcesPoints: 5 },
      { enemyKey: 'test-boss', npcId: 1002, isBoss: true, forcesPoints: 0 },
    ],
    abilities: [
      {
        abilityKey: 'test-ability',
        spellId: 2001,
        casterEnemyKeys: ['test-enemy'],
        interruptible: true,
      },
    ],
    totalEnemyForcesPoints: 5,
    ...overrides,
  };
  return { ...base, digest: await computeFactSnapshotDigest(base) };
}

describe('fact snapshot preflight contract', () => {
  it('accepts a canonical draft snapshot bound to an S2 catalog entry', async () => {
    const snapshot = await makeSnapshot();
    const result = await validateFactSnapshotIntegrity(snapshot, {
      entry: season2DungeonCatalogById.get('ruby-life-pools'),
    });

    expect(result).toMatchObject({ ok: true, releaseReady: false });
    expect(result.errors).toEqual([]);
    expect(result.snapshot?.digest).toBe(snapshot.digest);
  });

  it('rejects catalog drift, duplicate identities and unknown casters', async () => {
    const snapshot = await makeSnapshot({
      dungeonId: 'murder-row',
      enemies: [
        { enemyKey: 'duplicate', npcId: 1001, isBoss: false },
        { enemyKey: 'duplicate', npcId: 1002, isBoss: false },
      ],
      abilities: [{ abilityKey: 'ability', spellId: 2001, casterEnemyKeys: ['missing'] }],
    });
    const result = await validateFactSnapshotIntegrity(snapshot, {
      entry: season2DungeonCatalogById.get('ruby-life-pools'),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_SNAPSHOT_CATALOG_MISMATCH',
        'FACT_SNAPSHOT_DUPLICATE_ENEMY_KEY',
        'FACT_SNAPSHOT_UNKNOWN_CASTER',
      ]),
    );
  });

  it('requires approved non-test provenance for a release candidate', async () => {
    const draft = await validateFactSnapshotIntegrity(await makeSnapshot(), {
      requireApproved: true,
      expectedGameBuild: 'midnight-s2-test-build',
      entry: season2DungeonCatalogById.get('ruby-life-pools'),
    });
    expect(draft.releaseReady).toBe(false);
    expect(draft.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_SNAPSHOT_TEST_SOURCE_FORBIDDEN',
        'FACT_SNAPSHOT_LICENSE_NOT_APPROVED',
      ]),
    );

    const approved = await makeSnapshot({ source: 'game-data', licenseStatus: 'approved' });
    const result = await validateFactSnapshotIntegrity(approved, {
      requireApproved: true,
      expectedGameBuild: 'midnight-s2-test-build',
      entry: season2DungeonCatalogById.get('ruby-life-pools'),
    });
    expect(result).toMatchObject({ ok: true, releaseReady: true });
  });

  it('rejects partial or inconsistent forces facts', async () => {
    const result = await validateFactSnapshot(
      await makeSnapshot({
        enemies: [
          { enemyKey: 'test-enemy', npcId: 1001, isBoss: false, forcesPoints: 5 },
          { enemyKey: 'test-boss', npcId: 1002, isBoss: true },
        ],
        totalEnemyForcesPoints: 99,
      }),
    );

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_SNAPSHOT_FORCES_PARTIAL',
        'FACT_SNAPSHOT_FORCES_TOTAL_MISMATCH',
      ]),
    );
  });

  it('rejects unknown fields and canonical payload tampering', async () => {
    const snapshot = await makeSnapshot();
    const unknownField = validateFactSnapshotIntegrity(
      { ...snapshot, route: ['must-not-be-here'] },
      {},
    );
    expect((await unknownField).errors.map((error) => error.code)).toContain(
      'FACT_SNAPSHOT_UNKNOWN_FIELD',
    );

    const tampered = { ...snapshot, gameBuild: 'different-build' };
    const result = await validateFactSnapshotIntegrity(tampered, {});
    expect(result.errors.map((error) => error.code)).toContain('FACT_SNAPSHOT_DIGEST_MISMATCH');
  });

  it('rejects duplicate caster keys instead of normalizing them away', async () => {
    const snapshot = await makeSnapshot({
      abilities: [
        {
          abilityKey: 'test-ability',
          spellId: 2001,
          casterEnemyKeys: ['test-enemy', 'test-enemy'],
        },
      ],
    });
    const result = await validateFactSnapshot(snapshot);
    expect(result.errors.map((error) => error.code)).toContain('FACT_SNAPSHOT_DUPLICATE_CASTER');
  });

  it('requires valid timestamps, complete forces totals and a non-empty release payload', async () => {
    const invalidTimestamp = await validateFactSnapshotIntegrity(
      await makeSnapshot({ capturedAt: 'yesterday' }),
      {},
    );
    expect(invalidTimestamp.errors.map((error) => error.code)).toContain(
      'FACT_SNAPSHOT_CAPTURED_AT_INVALID',
    );

    const missingTotal = await validateFactSnapshot(
      await makeSnapshot({ totalEnemyForcesPoints: undefined }),
    );
    expect(missingTotal.errors.map((error) => error.code)).toContain(
      'FACT_SNAPSHOT_TOTAL_FORCES_REQUIRED',
    );

    const totalWithoutValues = await validateFactSnapshot(
      await makeSnapshot({
        enemies: [
          { enemyKey: 'test-enemy', npcId: 1001, isBoss: false },
          { enemyKey: 'test-boss', npcId: 1002, isBoss: true },
        ],
        totalEnemyForcesPoints: 5,
      }),
    );
    expect(totalWithoutValues.errors.map((error) => error.code)).toContain(
      'FACT_SNAPSHOT_TOTAL_FORCES_WITHOUT_VALUES',
    );

    const emptyRelease = await validateFactSnapshotIntegrity(
      await makeSnapshot({ enemies: [], abilities: [], totalEnemyForcesPoints: undefined }),
      {
        requireApproved: true,
        expectedGameBuild: 'midnight-s2-test-build',
        entry: season2DungeonCatalogById.get('ruby-life-pools'),
      },
    );
    expect(emptyRelease.releaseReady).toBe(false);
    expect(emptyRelease.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_SNAPSHOT_ENEMIES_REQUIRED',
        'FACT_SNAPSHOT_ABILITIES_REQUIRED',
        'FACT_SNAPSHOT_FORCES_REQUIRED',
      ]),
    );
  });

  it('verifies digest inside the public release validator', async () => {
    const snapshot = await makeSnapshot({ source: 'game-data', licenseStatus: 'approved' });
    snapshot.gameBuild = 'different-build';
    const result = await validateFactSnapshot(snapshot, {
      requireApproved: true,
      expectedGameBuild: 'different-build',
      entry: season2DungeonCatalogById.get('ruby-life-pools'),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('FACT_SNAPSHOT_DIGEST_MISMATCH');
  });
});
