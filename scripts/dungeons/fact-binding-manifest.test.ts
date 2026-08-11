import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeFactBindingPlanDigest } from '../../src/dungeon/runtime/factBindingPlan';

const plan = {
  version: 1,
  planDigest: `sha256:${'0'.repeat(64)}`,
  snapshot: {
    snapshotId: 'manifest-cli-plan-v1',
    digest: `sha256:${'2'.repeat(64)}`,
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
  },
  document: {
    id: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    revision: 1,
  },
  manifestTemplate: {
    version: 1,
    snapshotId: 'manifest-cli-plan-v1',
    snapshotDigest: `sha256:${'2'.repeat(64)}`,
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    enemies: [],
    abilities: [],
  },
  enemies: [
    {
      sourceKey: 'source-enemy',
      npcId: 1001,
      isBoss: false,
      candidates: [{ documentId: 'enemy-1', reasons: ['npc-id-exact', 'isBoss-exact'] }],
      status: 'suggested',
    },
  ],
  abilities: [],
  coverage: {
    snapshotEnemies: 1,
    snapshotAbilities: 0,
    documentEnemies: 1,
    documentAbilities: 0,
    unambiguousEnemyCandidates: 1,
    unambiguousAbilityCandidates: 0,
  },
  status: 'ready-for-review',
};

async function makeDecisions() {
  plan.planDigest = await computeFactBindingPlanDigest(plan);
  return {
    version: 1,
    plan: {
      planDigest: await computeFactBindingPlanDigest(plan),
      snapshotId: plan.snapshot.snapshotId,
      snapshotDigest: plan.snapshot.digest,
      dungeonId: plan.snapshot.dungeonId,
      season: plan.snapshot.season,
      gameBuild: plan.snapshot.gameBuild,
      documentId: plan.document.id,
      documentSeason: plan.document.season,
      documentGameBuild: plan.document.gameBuild,
      documentRevision: plan.document.revision,
    },
    reviewer: 'content-owner',
    reviewedAt: '2026-08-11T12:00:00.000Z',
    enemies: [{ sourceKey: 'source-enemy', decision: 'accept', documentId: 'enemy-1' }],
    abilities: [],
  };
}

function runCli(directory: string, extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      resolve(process.cwd(), 'scripts/dungeons/fact-binding-manifest.ts'),
      `--plan=${join(directory, 'plan.json')}`,
      `--decisions=${join(directory, 'decisions.json')}`,
      `--out=${join(directory, 'manifest.json')}`,
      '--json',
      ...extra,
    ],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, killSignal: 'SIGTERM' },
  );
}

describe('dungeon:fact-binding-manifest CLI', () => {
  it('writes a manifest only after explicit decision rows', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-manifest-'));
    try {
      const decisions = await makeDecisions();
      await Promise.all([
        writeFile(join(directory, 'plan.json'), JSON.stringify(plan), 'utf8'),
        writeFile(join(directory, 'decisions.json'), JSON.stringify(decisions), 'utf8'),
      ]);
      const result = runCli(directory, ['--complete']);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, summary: { enemyAccepted: 1 } });
      expect(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))).toEqual({
        version: 1,
        snapshotId: 'manifest-cli-plan-v1',
        snapshotDigest: `sha256:${'2'.repeat(64)}`,
        dungeonId: 'ruby-life-pools',
        season: 'midnight-s2',
        gameBuild: 'midnight-s2-test-build',
        enemies: [{ sourceKey: 'source-enemy', documentEnemyId: 'enemy-1' }],
        abilities: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not create output when a decision row is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-manifest-'));
    try {
      const decisions = await makeDecisions();
      decisions.enemies = [];
      await Promise.all([
        writeFile(join(directory, 'plan.json'), JSON.stringify(plan), 'utf8'),
        writeFile(join(directory, 'decisions.json'), JSON.stringify(decisions), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_MISSING_SOURCE_KEY' }),
        ]),
      );
      await expect(readFile(join(directory, 'manifest.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
