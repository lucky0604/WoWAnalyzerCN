import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  computeFactSnapshotDigest,
  type FactSnapshot,
} from '../../src/dungeon/runtime/factSnapshot';
import type { DungeonDocument } from '../../src/dungeon/schema/types';

const document: DungeonDocument = {
  id: 'ruby-life-pools',
  slug: 'ruby-life-pools',
  name: { zhCN: '红玉新生法池' },
  season: 'midnight-s2',
  dataStatus: 'draft',
  spatialStatus: 'pending',
  version: { season: 'midnight-s2', build: 'midnight-s2-test-build', revision: 1, status: 'draft' },
  totalEnemyForcesPoints: 1,
  floors: [
    {
      id: 'floor-1',
      name: { zhCN: '大厅' },
      coordinateSpace: 'normalized-v1',
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
    },
  ],
  spawns: [],
  enemies: [
    {
      id: 'enemy-1',
      npcId: 1001,
      name: { zhCN: '测试小怪' },
      forcesPoints: 1,
      isBoss: false,
      spawnIds: [],
      abilityIds: ['ability-1'],
      provenance: [],
    },
  ],
  abilities: [
    {
      id: 'ability-1',
      spellId: 2001,
      name: { zhCN: '测试技能' },
      casterEnemyIds: ['enemy-1'],
      decisionCritical: true,
      severity: 'critical',
      action: { zhCN: '打断' },
      consequence: { zhCN: '会受伤' },
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

async function makeSnapshot(): Promise<FactSnapshot> {
  const snapshot: FactSnapshot = {
    version: 1,
    snapshotId: 'binding-plan-cli-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'game-data',
    licenseStatus: 'approved',
    evidenceRef: 'binding-plan-cli-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [{ enemyKey: 'source-enemy', npcId: 1001, isBoss: false }],
    abilities: [{ abilityKey: 'source-ability', spellId: 2001, casterEnemyKeys: ['source-enemy'] }],
  };
  return { ...snapshot, digest: await computeFactSnapshotDigest(snapshot) };
}

function runCli(directory: string, tamper = false, extra: string[] = []) {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-binding-plan.ts');
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      scriptPath,
      `--snapshot=${join(directory, 'snapshot.json')}`,
      `--document=${join(directory, 'document.json')}`,
      `--out=${join(directory, 'plan.json')}`,
      '--json',
      ...(tamper ? ['--release', '--build=midnight-s2-test-build'] : []),
      ...extra,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

describe('dungeon:fact-binding-plan CLI', () => {
  it('writes a reviewable plan with an empty manifest template', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-plan-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(await makeSnapshot()), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        status: 'ready-for-review',
        coverage: { snapshotEnemies: 1, snapshotAbilities: 1 },
      });
      const plan = JSON.parse(await readFile(join(directory, 'plan.json'), 'utf8')) as {
        manifestTemplate: { enemies: unknown[]; abilities: unknown[] };
      };
      expect(plan.manifestTemplate).toEqual({
        version: 1,
        snapshotId: 'binding-plan-cli-v1',
        snapshotDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        dungeonId: 'ruby-life-pools',
        season: 'midnight-s2',
        gameBuild: 'midnight-s2-test-build',
        enemies: [],
        abilities: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails release planning when the snapshot payload is tampered', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-plan-'));
    try {
      const snapshot = await makeSnapshot();
      snapshot.enemies[0]!.npcId = 9999;
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(snapshot), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory, true);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_SNAPSHOT_DIGEST_MISMATCH' }),
        ]),
      );
      await expect(readFile(join(directory, 'plan.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a --dungeon override that does not match the document', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-plan-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(await makeSnapshot()), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory, false, ['--dungeon=kings-rest']);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_PLAN_CATALOG_DOCUMENT_MISMATCH' }),
        ]),
      );
      await expect(readFile(join(directory, 'plan.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
