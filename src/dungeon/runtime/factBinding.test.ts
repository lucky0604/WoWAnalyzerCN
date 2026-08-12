import { computeFactSnapshotDigest, type FactSnapshot } from './factSnapshot';
import {
  bindFactSnapshotToDocument,
  factBindingIdentityDigestMatches,
  factBindingIdentityMatchesDocument,
  validateFactBindingManifest,
  type FactBindingManifest,
} from './factBinding';
import type { DungeonDocument } from '../schema/types';

const text = (zhCN: string) => ({ zhCN });

function makeDocument(): DungeonDocument {
  return {
    id: 'ruby-life-pools',
    slug: 'ruby-life-pools',
    name: text('红玉新生法池'),
    season: 'midnight-s2',
    dataStatus: 'draft',
    spatialStatus: 'pending',
    version: {
      season: 'midnight-s2',
      build: 'midnight-s2-test-build',
      revision: 3,
      status: 'draft',
    },
    totalEnemyForcesPoints: 1,
    floors: [
      {
        id: 'floor-1',
        name: text('大厅'),
        coordinateSpace: 'normalized-v1',
        bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
      },
    ],
    spawns: [
      {
        id: 'spawn-1',
        enemyId: 'enemy-1',
        floorId: 'floor-1',
        position: [10, 20],
        sourceId: 'source-spawn-1',
      },
    ],
    enemies: [
      {
        id: 'enemy-1',
        name: text('测试小怪'),
        forcesPoints: 0,
        forcesStatus: 'pending',
        isBoss: false,
        spawnIds: ['spawn-1'],
        abilityIds: ['ability-1'],
        provenance: [],
      },
    ],
    abilities: [
      {
        id: 'ability-1',
        name: text('测试技能'),
        casterEnemyIds: ['enemy-1'],
        decisionCritical: true,
        severity: 'critical',
        action: text('打断'),
        consequence: text('会受伤'),
        version: {
          season: 'midnight-s2',
          build: 'midnight-s2-test-build',
          revision: 1,
          status: 'draft',
        },
        provenance: [],
      },
    ],
    situations: [],
    routes: [
      {
        id: 'route-1',
        dungeonId: 'ruby-life-pools',
        name: text('学习路线'),
        intent: 'learning',
        steps: [
          {
            type: 'pull',
            id: 'pull-1',
            order: 1,
            title: text('第一波'),
            floorId: 'floor-1',
            spawnIds: ['spawn-1'],
            situationRefs: [],
            rationale: text('先处理'),
            focusAbilityIds: ['ability-1'],
          },
        ],
        expectedEnemyForcesPoints: 0,
        version: {
          season: 'midnight-s2',
          build: 'midnight-s2-test-build',
          revision: 1,
          status: 'draft',
        },
        provenance: [],
      },
    ],
    bosses: [],
    provenance: [],
  };
}

async function makeSnapshot(overrides: Partial<FactSnapshot> = {}): Promise<FactSnapshot> {
  const base: FactSnapshot = {
    version: 1,
    snapshotId: 'binding-test-snapshot-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'manual-test',
    licenseStatus: 'needs-review',
    evidenceRef: 'binding-test-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [{ enemyKey: 'source-enemy-1', npcId: 1001, isBoss: false, forcesPoints: 7 }],
    abilities: [
      { abilityKey: 'source-ability-1', spellId: 2001, casterEnemyKeys: ['source-enemy-1'] },
    ],
    totalEnemyForcesPoints: 7,
    ...overrides,
  };
  return { ...base, digest: await computeFactSnapshotDigest(base) };
}

function makeManifest(snapshot: FactSnapshot): FactBindingManifest {
  return {
    version: 1,
    snapshotId: snapshot.snapshotId,
    snapshotDigest: snapshot.digest,
    dungeonId: snapshot.dungeonId,
    season: snapshot.season,
    gameBuild: snapshot.gameBuild,
    enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
    abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
  };
}

describe('fact snapshot authoring binding', () => {
  it('maps source facts into a new draft and recalculates route forces', async () => {
    const document = makeDocument();
    const snapshot = await makeSnapshot();
    const result = await bindFactSnapshotToDocument(document, snapshot, makeManifest(snapshot));

    expect(result.ok).toBe(true);
    expect(result.document).toMatchObject({
      dataStatus: 'draft',
      version: { build: snapshot.gameBuild, revision: 4, status: 'draft' },
      forcesSnapshot: undefined,
      totalEnemyForcesPoints: 7,
    });
    expect(result.document?.review).toBeUndefined();
    expect(result.document?.factBinding).toMatchObject({
      snapshotId: snapshot.snapshotId,
      snapshotDigest: snapshot.digest,
      dungeonId: document.id,
      season: document.season,
      gameBuild: snapshot.gameBuild,
      enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
      abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
    });
    expect(await factBindingIdentityDigestMatches(result.document?.factBinding)).toBe(true);
    expect(factBindingIdentityMatchesDocument(result.document!, result.document?.factBinding)).toBe(
      true,
    );
    const tamperedIdentity = structuredClone(result.document!.factBinding!);
    tamperedIdentity.enemies[0]!.documentEnemyId = 'other-enemy';
    expect(await factBindingIdentityDigestMatches(tamperedIdentity)).toBe(false);
    expect(result.document?.enemies[0]).toMatchObject({
      npcId: 1001,
      factBuild: snapshot.gameBuild,
      forcesPoints: 7,
      forcesStatus: 'pending',
    });
    expect(result.document?.abilities[0]).toMatchObject({
      spellId: 2001,
      version: { build: snapshot.gameBuild, status: 'draft' },
    });
    expect(result.document?.routes[0]?.expectedEnemyForcesPoints).toBe(7);
    expect(result.document?.provenance.at(-1)?.snapshot).toBe(
      `${snapshot.snapshotId}:${snapshot.digest}`,
    );
    expect(document.version.revision).toBe(3);
  });

  it('rejects duplicate, unknown and caster-inconsistent bindings', async () => {
    const document = makeDocument();
    const snapshot = await makeSnapshot({
      enemies: [
        { enemyKey: 'source-enemy-1', npcId: 1001, isBoss: false, forcesPoints: 7 },
        { enemyKey: 'source-enemy-2', npcId: 1002, isBoss: false, forcesPoints: 0 },
      ],
      abilities: [
        { abilityKey: 'source-ability-1', spellId: 2001, casterEnemyKeys: ['source-enemy-2'] },
      ],
    });
    const manifest = makeManifest(snapshot);
    manifest.enemies.push({ sourceKey: 'source-enemy-2', documentEnemyId: 'missing-enemy' });
    manifest.enemies.push({ sourceKey: 'missing-enemy', documentEnemyId: 'enemy-1' });
    const result = await bindFactSnapshotToDocument(document, snapshot, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_BINDING_DUPLICATE_TARGET_ID',
        'FACT_BINDING_UNKNOWN_ENEMY_SOURCE',
      ]),
    );
    expect(result.document).toBeUndefined();

    const casterDocument = makeDocument();
    casterDocument.enemies.push({
      id: 'enemy-2',
      name: text('第二个测试小怪'),
      forcesPoints: 0,
      forcesStatus: 'pending',
      isBoss: false,
      spawnIds: [],
      abilityIds: [],
      provenance: [],
    });
    const casterManifest = makeManifest(snapshot);
    casterManifest.enemies.push({ sourceKey: 'source-enemy-2', documentEnemyId: 'enemy-2' });
    const casterResult = await bindFactSnapshotToDocument(casterDocument, snapshot, casterManifest);
    expect(casterResult.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_CASTER_MISMATCH',
    );
    expect(casterResult.document).toBeUndefined();
  });

  it('requires complete authoring coverage in release mode', async () => {
    const document = makeDocument();
    const snapshot = await makeSnapshot();
    const manifest = makeManifest(snapshot);
    manifest.abilities = [];
    const result = validateFactBindingManifest(manifest, snapshot, document, {
      requireCompleteDocument: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FACT_BINDING_UNMAPPED_SNAPSHOT_ABILITY',
        'FACT_BINDING_DOCUMENT_ABILITIES_UNMAPPED',
      ]),
    );
    expect(manifest.abilities).toEqual([]);
  });

  it('rejects a manifest bound to a different digest', async () => {
    const document = makeDocument();
    const snapshot = await makeSnapshot();
    const manifest = makeManifest(snapshot);
    manifest.snapshotDigest = `sha256:${'f'.repeat(64)}`;
    const result = validateFactBindingManifest(manifest, snapshot, document);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_SNAPSHOT_DIGEST_MISMATCH',
    );

    manifest.season = 'wrong-season';
    const identityResult = validateFactBindingManifest(manifest, snapshot, document);
    expect(identityResult.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_SNAPSHOT_IDENTITY_MISMATCH',
    );
  });

  it('fails closed instead of carrying old facts into a partial or sparse snapshot', async () => {
    const document = makeDocument();
    document.enemies[0] = {
      ...document.enemies[0]!,
      npcId: 9999,
      factBuild: 'old-build',
      forcesPoints: 42,
    };
    document.abilities[0] = {
      ...document.abilities[0]!,
      spellId: 9999,
      version: { ...document.abilities[0]!.version, build: 'old-build' },
    };
    document.totalEnemyForcesPoints = 42;
    document.routes[0]!.expectedEnemyForcesPoints = 42;
    const snapshot = await makeSnapshot({
      enemies: [{ enemyKey: 'source-enemy-1', npcId: 1001, isBoss: false }],
      abilities: [],
      totalEnemyForcesPoints: undefined,
    });
    const manifest = makeManifest(snapshot);
    manifest.abilities = [];
    const result = await bindFactSnapshotToDocument(document, snapshot, manifest);

    expect(result.ok).toBe(true);
    expect(result.document?.enemies[0]).toMatchObject({
      npcId: 1001,
      factBuild: snapshot.gameBuild,
      forcesPoints: 0,
      forcesStatus: 'pending',
    });
    expect(result.document?.abilities[0]?.spellId).toBeUndefined();
    expect(result.document?.totalEnemyForcesPoints).toBe(0);
    expect(result.document?.routes[0]?.expectedEnemyForcesPoints).toBe(0);
  });

  it('rejects Boss-to-non-Boss identity swaps and forged snapshots', async () => {
    const document = makeDocument();
    const bossSnapshot = await makeSnapshot({
      enemies: [{ enemyKey: 'source-enemy-1', npcId: 1001, isBoss: true, forcesPoints: 7 }],
    });
    const bossResult = await bindFactSnapshotToDocument(
      document,
      bossSnapshot,
      makeManifest(bossSnapshot),
    );
    expect(bossResult.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_ENEMY_KIND_MISMATCH',
    );

    const forged = await makeSnapshot();
    forged.enemies[0]!.npcId = 123456;
    const forgedResult = await bindFactSnapshotToDocument(document, forged, makeManifest(forged));
    expect(forgedResult.errors.map((error) => error.code)).toContain(
      'FACT_SNAPSHOT_DIGEST_MISMATCH',
    );
    expect(forgedResult.document).toBeUndefined();

    const malformedResult = await bindFactSnapshotToDocument(
      document,
      { malformed: true } as unknown as FactSnapshot,
      makeManifest(forged),
    );
    expect(malformedResult.errors.length).toBeGreaterThan(0);
    expect(malformedResult.document).toBeUndefined();
  });
});
