import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  computeFactSnapshotDigest,
  type FactSnapshot,
} from '../../src/dungeon/runtime/factSnapshot';
import type { FactBindingManifest } from '../../src/dungeon/runtime/factBinding';
import type { DungeonDocument } from '../../src/dungeon/schema/types';

const document: DungeonDocument = {
  id: 'ruby-life-pools',
  slug: 'ruby-life-pools',
  name: { zhCN: '红玉新生法池' },
  season: 'midnight-s2',
  dataStatus: 'draft',
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
      name: { zhCN: '测试小怪' },
      forcesPoints: 0,
      forcesStatus: 'pending',
      isBoss: false,
      spawnIds: [],
      abilityIds: ['ability-1'],
      provenance: [],
    },
  ],
  abilities: [
    {
      id: 'ability-1',
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
    snapshotId: 'cli-binding-test-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'game-data',
    licenseStatus: 'approved',
    evidenceRef: 'cli-binding-test-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [{ enemyKey: 'source-enemy-1', npcId: 1001, isBoss: false, forcesPoints: 0 }],
    abilities: [
      { abilityKey: 'source-ability-1', spellId: 2001, casterEnemyKeys: ['source-enemy-1'] },
    ],
    totalEnemyForcesPoints: 0,
  };
  return { ...snapshot, digest: await computeFactSnapshotDigest(snapshot) };
}

function runCli(directory: string, release = false) {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-bind.ts');
  const args = [
    '--import',
    'tsx/esm',
    scriptPath,
    `--snapshot=${join(directory, 'snapshot.json')}`,
    `--bindings=${join(directory, 'bindings.json')}`,
    `--document=${join(directory, 'document.json')}`,
    `--out=${join(directory, 'bound.json')}`,
    '--json',
  ];
  if (release) args.push('--release', '--build=midnight-s2-test-build');
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
}

describe('dungeon:fact-bind CLI', () => {
  it('writes a separate draft document from an approved snapshot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-bind-'));
    try {
      const snapshot = await makeSnapshot();
      const manifest: FactBindingManifest = {
        version: 1,
        snapshotId: snapshot.snapshotId,
        snapshotDigest: snapshot.digest,
        dungeonId: snapshot.dungeonId,
        season: snapshot.season,
        gameBuild: snapshot.gameBuild,
        enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
        abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
      };
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(snapshot), 'utf8'),
        writeFile(join(directory, 'bindings.json'), JSON.stringify(manifest), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory, true);

      expect(result.status).toBe(0);
      const cliResult = JSON.parse(result.stdout) as {
        ok: boolean;
        dataStatus: string;
        revision: number;
        warnings: Array<{ code: string; path: string }>;
      };
      expect(cliResult).toMatchObject({
        ok: true,
        dataStatus: 'draft',
        revision: 2,
      });
      const warningKeys = cliResult.warnings.map((warning) => `${warning.code}:${warning.path}`);
      expect(new Set(warningKeys).size).toBe(warningKeys.length);
      const output = JSON.parse(
        await readFile(join(directory, 'bound.json'), 'utf8'),
      ) as DungeonDocument;
      expect(output.version.status).toBe('draft');
      expect(output.enemies[0]?.npcId).toBe(1001);
      expect(output.abilities[0]?.spellId).toBe(2001);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not write output when the manifest is tampered', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-bind-'));
    try {
      const snapshot = await makeSnapshot();
      const manifest: FactBindingManifest = {
        version: 1,
        snapshotId: snapshot.snapshotId,
        snapshotDigest: `sha256:${'f'.repeat(64)}`,
        dungeonId: snapshot.dungeonId,
        season: snapshot.season,
        gameBuild: snapshot.gameBuild,
        enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
        abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
      };
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(snapshot), 'utf8'),
        writeFile(join(directory, 'bindings.json'), JSON.stringify(manifest), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_SNAPSHOT_DIGEST_MISMATCH' }),
        ]),
      );
      await expect(readFile(join(directory, 'bound.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects output paths that point at any source input', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-bind-'));
    try {
      const snapshot = await makeSnapshot();
      const manifest: FactBindingManifest = {
        version: 1,
        snapshotId: snapshot.snapshotId,
        snapshotDigest: snapshot.digest,
        dungeonId: snapshot.dungeonId,
        season: snapshot.season,
        gameBuild: snapshot.gameBuild,
        enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
        abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
      };
      const snapshotPath = join(directory, 'snapshot.json');
      const bindingsPath = join(directory, 'bindings.json');
      const documentPath = join(directory, 'document.json');
      await Promise.all([
        writeFile(snapshotPath, JSON.stringify(snapshot), 'utf8'),
        writeFile(bindingsPath, JSON.stringify(manifest), 'utf8'),
        writeFile(documentPath, JSON.stringify(document), 'utf8'),
      ]);
      for (const outputPath of [snapshotPath, bindingsPath, documentPath]) {
        const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-bind.ts');
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx/esm',
            scriptPath,
            `--snapshot=${snapshotPath}`,
            `--bindings=${bindingsPath}`,
            `--document=${documentPath}`,
            `--out=${outputPath}`,
            '--json',
          ],
          { cwd: process.cwd(), encoding: 'utf8' },
        );
        expect(result.status).toBe(1);
        expect(JSON.parse(result.stdout).errors[0].code).toBe('FACT_BINDING_OUTPUT_MUST_DIFFER');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a snapshot payload tampered without changing its digest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-bind-'));
    try {
      const snapshot = await makeSnapshot();
      snapshot.enemies[0]!.npcId = 999999;
      const manifest: FactBindingManifest = {
        version: 1,
        snapshotId: snapshot.snapshotId,
        snapshotDigest: snapshot.digest,
        dungeonId: snapshot.dungeonId,
        season: snapshot.season,
        gameBuild: snapshot.gameBuild,
        enemies: [{ sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' }],
        abilities: [{ sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' }],
      };
      await Promise.all([
        writeFile(join(directory, 'snapshot.json'), JSON.stringify(snapshot), 'utf8'),
        writeFile(join(directory, 'bindings.json'), JSON.stringify(manifest), 'utf8'),
        writeFile(join(directory, 'document.json'), JSON.stringify(document), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_SNAPSHOT_DIGEST_MISMATCH' }),
        ]),
      );
      await expect(readFile(join(directory, 'bound.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
