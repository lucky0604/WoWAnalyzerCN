import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  computeFactSnapshotDigest,
  type FactSnapshot,
} from '../../src/dungeon/runtime/factSnapshot';

async function makeSnapshot(): Promise<FactSnapshot> {
  const snapshot: FactSnapshot = {
    version: 1,
    snapshotId: 'cli-test-snapshot-v1',
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    source: 'game-data',
    licenseStatus: 'approved',
    evidenceRef: 'cli-test-evidence',
    capturedAt: '2026-08-11T00:00:00.000Z',
    digest: `sha256:${'0'.repeat(64)}`,
    enemies: [{ enemyKey: 'enemy', npcId: 1001, isBoss: false, forcesPoints: 3 }],
    abilities: [{ abilityKey: 'ability', spellId: 2001, casterEnemyKeys: ['enemy'] }],
    totalEnemyForcesPoints: 3,
  };
  return { ...snapshot, digest: await computeFactSnapshotDigest(snapshot) };
}

function runCli(inputPath: string, release = false) {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-preflight.ts');
  const args = ['--import', 'tsx/esm', scriptPath, `--input=${inputPath}`, '--json'];
  if (release) args.push('--release', '--build=midnight-s2-test-build');
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('dungeon:fact-check CLI', () => {
  it('accepts a catalog-bound approved snapshot in release mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-preflight-'));
    try {
      const inputPath = join(directory, 'snapshot.json');
      await writeFile(inputPath, JSON.stringify(await makeSnapshot()), 'utf8');
      const result = runCli(inputPath, true);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, releaseReady: true });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails when the canonical payload changes without updating digest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-preflight-'));
    try {
      const snapshot = await makeSnapshot();
      snapshot.enemies[0]!.npcId = 1002;
      const inputPath = join(directory, 'tampered.json');
      await writeFile(inputPath, JSON.stringify(snapshot), 'utf8');
      const result = runCli(inputPath);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_SNAPSHOT_DIGEST_MISMATCH' }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
