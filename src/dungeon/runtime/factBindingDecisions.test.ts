import { describe, expect, it } from 'vitest';

import type { FactBindingPlan } from './factBindingPlan';
import {
  buildFactBindingManifestFromDecisions,
  type FactBindingDecisionFile,
} from './factBindingDecisions';
import { computeFactBindingPlanDigest } from './factBindingPlan';

const plan: FactBindingPlan = {
  version: 1,
  planDigest: `sha256:${'0'.repeat(64)}`,
  snapshot: {
    snapshotId: 'decision-plan-v1',
    digest: `sha256:${'1'.repeat(64)}`,
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
  },
  document: {
    id: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    revision: 2,
  },
  manifestTemplate: {
    version: 1,
    snapshotId: 'decision-plan-v1',
    snapshotDigest: `sha256:${'1'.repeat(64)}`,
    dungeonId: 'ruby-life-pools',
    season: 'midnight-s2',
    gameBuild: 'midnight-s2-test-build',
    enemies: [],
    abilities: [],
  },
  enemies: [
    {
      sourceKey: 'source-enemy-1',
      npcId: 1001,
      isBoss: false,
      candidates: [{ documentId: 'enemy-1', reasons: ['npc-id-exact', 'isBoss-exact'] }],
      status: 'suggested',
    },
    {
      sourceKey: 'source-enemy-2',
      npcId: 1002,
      isBoss: false,
      candidates: [
        { documentId: 'enemy-2', reasons: ['npc-id-exact'] },
        { documentId: 'enemy-3', reasons: ['npc-id-exact'] },
      ],
      status: 'ambiguous',
    },
  ],
  abilities: [
    {
      sourceKey: 'source-ability-1',
      spellId: 2001,
      casterEnemyKeys: ['source-enemy-1'],
      candidates: [
        { documentId: 'ability-1', reasons: ['spell-id-exact', 'caster-npc-set-exact'] },
      ],
      status: 'suggested',
    },
  ],
  coverage: {
    snapshotEnemies: 2,
    snapshotAbilities: 1,
    documentEnemies: 3,
    documentAbilities: 1,
    unambiguousEnemyCandidates: 1,
    unambiguousAbilityCandidates: 1,
  },
  status: 'needs-review',
};

async function decisions(
  overrides: Partial<FactBindingDecisionFile> = {},
): Promise<FactBindingDecisionFile> {
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
    enemies: [
      { sourceKey: 'source-enemy-1', decision: 'accept', documentId: 'enemy-1' },
      {
        sourceKey: 'source-enemy-2',
        decision: 'reject',
        reason: '当前证据无法区分两个同 NPC 目标。',
      },
    ],
    abilities: [{ sourceKey: 'source-ability-1', decision: 'accept', documentId: 'ability-1' }],
    ...overrides,
  };
}

describe('fact binding decision manifest', () => {
  it('only emits explicitly accepted mappings and preserves rejected rows as warnings', async () => {
    const result = await buildFactBindingManifestFromDecisions(plan, await decisions());

    expect(result.ok).toBe(true);
    expect(result.manifest?.enemies).toEqual([
      { sourceKey: 'source-enemy-1', documentEnemyId: 'enemy-1' },
    ]);
    expect(result.manifest?.abilities).toEqual([
      { sourceKey: 'source-ability-1', documentAbilityId: 'ability-1' },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'FACT_BINDING_DECISION_REJECTED' }),
    ]);
  });

  it('requires an explicit override for an ambiguous candidate', async () => {
    const value = await decisions({
      enemies: [
        { sourceKey: 'source-enemy-1', decision: 'accept', documentId: 'enemy-1' },
        { sourceKey: 'source-enemy-2', decision: 'accept', documentId: 'enemy-2' },
      ],
    });
    const result = await buildFactBindingManifestFromDecisions(plan, value);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FACT_BINDING_DECISION_ACCEPT_NOT_SUGGESTED' }),
      ]),
    );
  });

  it('allows a reviewed override but complete mode rejects rejected source facts', async () => {
    const value = await decisions({
      enemies: [
        { sourceKey: 'source-enemy-1', decision: 'accept', documentId: 'enemy-1' },
        {
          sourceKey: 'source-enemy-2',
          decision: 'override',
          documentId: 'enemy-3',
          reason: '人工核对了坐标与 Boss/小怪身份。',
        },
      ],
    });
    const overrideResult = await buildFactBindingManifestFromDecisions(plan, value);
    expect(overrideResult.ok).toBe(true);
    expect(overrideResult.manifest?.enemies).toHaveLength(2);

    const incompleteResult = await buildFactBindingManifestFromDecisions(plan, await decisions(), {
      requireComplete: true,
    });
    expect(incompleteResult.ok).toBe(false);
    expect(incompleteResult.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FACT_BINDING_DECISION_INCOMPLETE' }),
      ]),
    );
  });

  it('rejects a decision file from a different plan', async () => {
    const baseDecisions = await decisions();
    const value = await decisions({
      plan: { ...baseDecisions.plan, snapshotId: 'other-plan' },
    });
    const result = await buildFactBindingManifestFromDecisions(plan, value);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FACT_BINDING_DECISION_PLAN_IDENTITY_MISMATCH' }),
      ]),
    );
  });

  it('returns a structured error for a malformed candidate status', async () => {
    const malformed = structuredClone(plan);
    (malformed.enemies[0] as unknown as { status: string }).status = 'bogus';
    malformed.planDigest = await computeFactBindingPlanDigest(malformed);
    const result = await buildFactBindingManifestFromDecisions(malformed, await decisions());

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FACT_BINDING_DECISION_PLAN_ROW_INVALID' }),
      ]),
    );
  });
});
