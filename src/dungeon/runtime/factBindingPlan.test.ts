import { computeFactSnapshotDigest, type FactSnapshot } from './factSnapshot';
import { buildFactBindingPlan } from './factBindingPlan';
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
      revision: 2,
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
    spawns: [],
    enemies: [
      {
        id: 'enemy-1',
        npcId: 1001,
        name: text('测试小怪'),
        forcesPoints: 1,
        isBoss: false,
        spawnIds: [],
        abilityIds: ['ability-1'],
        provenance: [],
      },
      {
        id: 'boss-1',
        npcId: 1002,
        name: text('测试 Boss'),
        forcesPoints: 0,
        isBoss: true,
        spawnIds: [],
        abilityIds: [],
        provenance: [],
      },
    ],
    abilities: [
      {
        id: 'ability-1',
        spellId: 2001,
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
    routes: [],
    bosses: [],
    provenance: [],
  };
}

async function makeSnapshot(overrides: Partial<FactSnapshot> = {}): Promise<FactSnapshot> {
  const base: FactSnapshot = {
    version: 1,
    snapshotId: 'binding-plan-test-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'manual-test',
    licenseStatus: 'needs-review',
    evidenceRef: 'binding-plan-test-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [{ enemyKey: 'source-enemy', npcId: 1001, isBoss: false }],
    abilities: [{ abilityKey: 'source-ability', spellId: 2001, casterEnemyKeys: ['source-enemy'] }],
    ...overrides,
  };
  return { ...base, digest: await computeFactSnapshotDigest(base) };
}

describe('fact binding plan', () => {
  it('reports exact candidates without accepting them into the manifest template', async () => {
    const result = await buildFactBindingPlan(makeDocument(), await makeSnapshot());

    expect(result.ok).toBe(true);
    expect(result.plan).toMatchObject({
      status: 'ready-for-review',
      manifestTemplate: { enemies: [], abilities: [] },
      coverage: {
        snapshotEnemies: 1,
        snapshotAbilities: 1,
        unambiguousEnemyCandidates: 1,
        unambiguousAbilityCandidates: 1,
      },
    });
    expect(result.plan?.enemies[0]).toMatchObject({
      sourceKey: 'source-enemy',
      status: 'suggested',
      candidates: [{ documentId: 'enemy-1', reasons: ['npc-id-exact', 'isBoss-exact'] }],
    });
    expect(result.plan?.abilities[0]).toMatchObject({
      status: 'suggested',
      candidates: [
        { documentId: 'ability-1', reasons: ['spell-id-exact', 'caster-npc-set-exact'] },
      ],
    });
  });

  it('blocks Boss kind and caster mismatches instead of suggesting a binding', async () => {
    const document = makeDocument();
    document.enemies[0]!.isBoss = true;
    document.abilities[0]!.casterEnemyIds = ['boss-1'];
    const snapshot = await makeSnapshot({
      enemies: [{ enemyKey: 'source-enemy', npcId: 1001, isBoss: false }],
      abilities: [
        { abilityKey: 'source-ability', spellId: 2001, casterEnemyKeys: ['source-enemy'] },
      ],
    });
    const result = await buildFactBindingPlan(document, snapshot);

    expect(result.ok).toBe(true);
    expect(result.plan?.status).toBe('blocked');
    expect(result.plan?.enemies[0]?.status).toBe('blocked');
    expect(result.plan?.abilities[0]?.status).toBe('blocked');
    expect(result.plan?.enemies[0]?.candidates[0]?.reasons).toContain('isBoss-mismatch');
    expect(result.plan?.abilities[0]?.candidates[0]?.reasons).toContain('caster-npc-set-mismatch');
  });

  it('marks multiple exact IDs as ambiguous even when one candidate has matching kind/casters', async () => {
    const document = makeDocument();
    document.enemies.push({ ...document.enemies[0]!, id: 'enemy-duplicate', abilityIds: [] });
    document.abilities.push({ ...document.abilities[0]!, id: 'ability-duplicate' });
    const result = await buildFactBindingPlan(document, await makeSnapshot());

    expect(result.ok).toBe(true);
    expect(result.plan?.status).toBe('needs-review');
    expect(result.plan?.enemies[0]?.status).toBe('ambiguous');
    expect(result.plan?.abilities[0]?.status).toBe('ambiguous');
  });

  it('fails closed when snapshot integrity is tampered', async () => {
    const snapshot = await makeSnapshot();
    snapshot.enemies[0]!.npcId = 9999;
    const result = await buildFactBindingPlan(makeDocument(), snapshot);

    expect(result.ok).toBe(false);
    expect(result.plan).toBeUndefined();
    expect(result.errors.map((error) => error.code)).toContain('FACT_SNAPSHOT_DIGEST_MISMATCH');
  });

  it('marks inverse target collisions as ambiguous instead of inflating suggestions', async () => {
    const snapshot = await makeSnapshot({
      enemies: [
        { enemyKey: 'source-enemy-a', npcId: 1001, isBoss: false },
        { enemyKey: 'source-enemy-b', npcId: 1001, isBoss: false },
      ],
      abilities: [
        {
          abilityKey: 'source-ability-a',
          spellId: 2001,
          casterEnemyKeys: ['source-enemy-a'],
        },
        {
          abilityKey: 'source-ability-b',
          spellId: 2001,
          casterEnemyKeys: ['source-enemy-b'],
        },
      ],
    });
    const result = await buildFactBindingPlan(makeDocument(), snapshot);

    expect(result.ok).toBe(true);
    expect(result.plan?.status).toBe('needs-review');
    expect(result.plan?.enemies.every((row) => row.status === 'ambiguous')).toBe(true);
    expect(result.plan?.abilities.every((row) => row.status === 'ambiguous')).toBe(true);
    expect(result.plan?.coverage.unambiguousEnemyCandidates).toBe(0);
    expect(result.plan?.coverage.unambiguousAbilityCandidates).toBe(0);
    expect(result.plan?.enemies[0]?.candidates[0]?.reasons).toContain('target-id-collision');
  });

  it('requires a registered catalog entry and keeps the snapshot build aligned to the document', async () => {
    const unknownDocument = { ...makeDocument(), id: 'not-registered' };
    const unknownResult = await buildFactBindingPlan(unknownDocument, await makeSnapshot());
    expect(unknownResult.ok).toBe(false);
    expect(unknownResult.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_PLAN_CATALOG_ENTRY_REQUIRED',
    );

    const mismatchedBuild = await makeSnapshot({ gameBuild: 'other-build' });
    const buildResult = await buildFactBindingPlan(makeDocument(), mismatchedBuild, {
      expectedGameBuild: 'other-build',
    });
    expect(buildResult.ok).toBe(false);
    expect(buildResult.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_PLAN_DOCUMENT_BUILD_MISMATCH',
    );
  });

  it('fails closed on a malformed document version instead of reading an undefined build', async () => {
    const malformed = { ...makeDocument(), version: [] } as unknown as DungeonDocument;
    const result = await buildFactBindingPlan(malformed, await makeSnapshot());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
    );
  });
});
