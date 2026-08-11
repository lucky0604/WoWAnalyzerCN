import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeFactBindingPlanDigest } from '../../src/dungeon/runtime/factBindingPlan';

function makePlan() {
  return {
    version: 1 as const,
    planDigest: `sha256:${'0'.repeat(64)}`,
    snapshot: {
      snapshotId: 'template-plan-v1',
      digest: `sha256:${'1'.repeat(64)}`,
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
      version: 1 as const,
      snapshotId: 'template-plan-v1',
      snapshotDigest: `sha256:${'1'.repeat(64)}`,
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
        status: 'suggested' as const,
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
    status: 'ready-for-review' as const,
  };
}

function runTemplateCli(directory: string, extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      resolve(process.cwd(), 'scripts/dungeons/fact-binding-decisions-template.ts'),
      `--plan=${join(directory, 'plan.json')}`,
      `--out=${join(directory, 'decisions.template.json')}`,
      '--reviewer=content-owner',
      '--reviewed-at=2026-08-11T12:00:00.000Z',
      '--json',
      ...extra,
    ],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, killSignal: 'SIGTERM' },
  );
}

describe('dungeon:fact-binding-decisions-template CLI', () => {
  it('writes every source key as a non-consumable TODO template', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-template-'));
    try {
      const plan = makePlan();
      plan.planDigest = await computeFactBindingPlanDigest(plan);
      await writeFile(join(directory, 'plan.json'), JSON.stringify(plan), 'utf8');

      const result = runTemplateCli(directory);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, template: true });
      const template = JSON.parse(
        await readFile(join(directory, 'decisions.template.json'), 'utf8'),
      );
      expect(template.plan.planDigest).toBe(plan.planDigest);
      expect(template.enemies).toEqual([
        expect.objectContaining({ sourceKey: 'source-enemy', decision: 'TODO' }),
      ]);

      const manifestResult = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx/esm',
          resolve(process.cwd(), 'scripts/dungeons/fact-binding-manifest.ts'),
          `--plan=${join(directory, 'plan.json')}`,
          `--decisions=${join(directory, 'decisions.template.json')}`,
          `--out=${join(directory, 'manifest.json')}`,
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, killSignal: 'SIGTERM' },
      );
      expect(manifestResult.status).toBe(1);
      expect(JSON.parse(manifestResult.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_ROW_INVALID' }),
        ]),
      );

      const incompleteOverride = structuredClone(template);
      incompleteOverride.enemies[0].decision = 'override';
      incompleteOverride.enemies[0].documentId = 'enemy-1';
      await writeFile(
        join(directory, 'decisions.override-incomplete.json'),
        JSON.stringify(incompleteOverride),
        'utf8',
      );
      const overrideResult = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx/esm',
          resolve(process.cwd(), 'scripts/dungeons/fact-binding-manifest.ts'),
          `--plan=${join(directory, 'plan.json')}`,
          `--decisions=${join(directory, 'decisions.override-incomplete.json')}`,
          `--out=${join(directory, 'override-manifest.json')}`,
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, killSignal: 'SIGTERM' },
      );
      expect(overrideResult.status).toBe(1);
      expect(JSON.parse(overrideResult.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_REASON_REQUIRED' }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not replace an existing template without --force', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-template-'));
    try {
      const plan = makePlan();
      plan.planDigest = await computeFactBindingPlanDigest(plan);
      await writeFile(join(directory, 'plan.json'), JSON.stringify(plan), 'utf8');
      const first = runTemplateCli(directory);
      expect(first.status).toBe(0);
      const second = runTemplateCli(directory);
      expect(second.status).toBe(1);
      expect(JSON.parse(second.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_TEMPLATE_OUTPUT_EXISTS' }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails closed for malformed or empty plans without writing output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-binding-template-'));
    try {
      const malformed = makePlan();
      malformed.enemies = [null as never];
      malformed.planDigest = `sha256:${'f'.repeat(64)}`;
      await writeFile(join(directory, 'plan.json'), JSON.stringify(malformed), 'utf8');
      const malformedResult = runTemplateCli(directory);
      expect(malformedResult.status).toBe(1);
      expect(JSON.parse(malformedResult.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_TEMPLATE_PLAN_INVALID' }),
        ]),
      );

      const empty = makePlan();
      empty.enemies = [];
      empty.planDigest = await computeFactBindingPlanDigest(empty);
      await writeFile(join(directory, 'plan.json'), JSON.stringify(empty), 'utf8');
      const emptyResult = runTemplateCli(directory, ['--force']);
      expect(emptyResult.status).toBe(1);
      expect(JSON.parse(emptyResult.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_BINDING_DECISION_TEMPLATE_NO_SOURCE_ROWS' }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
