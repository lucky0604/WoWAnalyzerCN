import { describe, expect, it } from 'vitest';

import type { DungeonDocument } from '../schema/types';
import { buildFactIntakeBundle } from './factIntake';
import type { WclFactSourceResult } from './wclFactSource';

const text = (zhCN: string) => ({ zhCN });

const document: DungeonDocument = {
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

const source: WclFactSourceResult = {
  ok: true,
  report: {
    code: 'INTAKE1',
    start: 100,
    end: 200,
    fights: [{ id: 1, start_time: 100, end_time: 200 }],
    enemies: [{ id: 11, guid: 1001, type: 'NPC', fights: [{ id: 1 }] }],
  },
  events: {
    code: 'INTAKE1',
    events: [{ type: 'cast', timestamp: 120, sourceID: 11, ability: { guid: 2001 } }],
  },
  fightId: 1,
  eventPages: 1,
  errors: [],
  warnings: [],
};

const options = {
  reportCode: 'INTAKE1',
  dungeonId: 'ruby-life-pools',
  season: 'midnight-s2',
  gameBuild: 'midnight-s2-test-build',
  snapshotId: 'wcl:intake1:ruby-life-pools:midnight-s2-test-build:fight-1',
  evidenceRef: 'wcl-report:INTAKE1',
  capturedAt: '2026-08-11T00:00:00.000Z',
  licenseStatus: 'reference-only' as const,
};

describe('WCL fact intake bundle', () => {
  it('builds a snapshot, plan, and non-consumable decision template with shared identity', async () => {
    const result = await buildFactIntakeBundle(source, {
      ...options,
      document,
      reviewer: 'content-owner',
      reviewedAt: '2026-08-11T01:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.artifacts?.snapshot.fightId).toBe(1);
    expect(result.artifacts?.plan?.snapshot.snapshotId).toBe(options.snapshotId);
    expect(result.artifacts?.decisionsTemplate?.plan.planDigest).toBe(
      result.artifacts?.plan?.planDigest,
    );
    expect(result.artifacts?.decisionsTemplate?.enemies[0]).toMatchObject({
      sourceKey: 'wcl:npc:1001',
      decision: 'TODO',
      reason: '',
    });
    expect(result.artifacts?.manifest).toMatchObject({
      status: 'template-ready',
      snapshot: { digest: result.artifacts?.snapshot.digest, fightId: 1 },
      plan: { planDigest: result.artifacts?.plan?.planDigest },
      files: {
        snapshot: 'snapshot.json',
        plan: 'binding-plan.json',
        decisionsTemplate: 'decisions.template.json',
        authoringDocument: 'authoring-document.json',
      },
      diagnostics: { errors: [] },
    });
  });

  it('supports a snapshot-only bundle without inventing a binding plan', async () => {
    const result = await buildFactIntakeBundle(source, options);

    expect(result.ok).toBe(true);
    expect(result.artifacts?.manifest.status).toBe('snapshot-only');
    expect(result.artifacts?.plan).toBeUndefined();
    expect(result.artifacts?.decisionsTemplate).toBeUndefined();
    expect(result.warnings.map((item) => item.code)).toContain('WCL_FACT_FORCES_NOT_DERIVED');
    expect(result.artifacts?.manifest).toMatchObject({
      files: { snapshot: 'snapshot.json' },
      skipped: {
        plan: 'document-not-provided',
        decisionsTemplate: 'document-not-provided',
      },
      diagnostics: {
        errors: [],
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: 'WCL_FACT_FORCES_NOT_DERIVED' }),
        ]),
      },
    });
  });

  it('fails closed when a document bundle lacks reviewer metadata', async () => {
    const result = await buildFactIntakeBundle(source, { ...options, document });

    expect(result.ok).toBe(false);
    expect(result.artifacts).toBeUndefined();
    expect(result.errors.map((item) => item.code)).toContain(
      'FACT_INTAKE_REVIEW_METADATA_REQUIRED',
    );
  });

  it('does not create artifacts after source capture errors', async () => {
    const result = await buildFactIntakeBundle(
      {
        ok: false,
        eventPages: 0,
        errors: [
          {
            severity: 'error',
            code: 'WCL_FACT_API_TIMEOUT',
            path: 'report',
            message: 'timeout',
          },
        ],
        warnings: [],
      },
      options,
    );

    expect(result.ok).toBe(false);
    expect(result.artifacts).toBeUndefined();
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WCL_FACT_API_TIMEOUT' })]),
    );
  });

  it('rejects source identity and diagnostic-envelope drift before snapshot creation', async () => {
    const mismatch = await buildFactIntakeBundle(
      {
        ...source,
        report: { ...source.report, code: 'OTHER' },
      },
      options,
    );
    expect(mismatch.ok).toBe(false);
    expect(mismatch.errors.map((item) => item.code)).toContain(
      'FACT_INTAKE_SOURCE_REPORT_CODE_MISMATCH',
    );

    const errorState = await buildFactIntakeBundle(
      {
        ...source,
        ok: true,
        errors: [
          {
            severity: 'error',
            code: 'WCL_FACT_API_TIMEOUT',
            path: 'report',
            message: 'timeout',
          },
        ],
      },
      options,
    );
    expect(errorState.ok).toBe(false);
    expect(errorState.errors.map((item) => item.code)).toContain('FACT_INTAKE_SOURCE_ERROR_STATE');

    const fightMismatch = await buildFactIntakeBundle(source, { ...options, fightId: 2 });
    expect(fightMismatch.ok).toBe(false);
    expect(fightMismatch.errors.map((item) => item.code)).toContain(
      'FACT_INTAKE_FIGHT_ID_MISMATCH',
    );
  });

  it('returns a structured diagnostic when source errors are malformed', async () => {
    const malformed = await buildFactIntakeBundle(
      {
        ...source,
        errors: null as unknown as WclFactSourceResult['errors'],
      },
      options,
    );

    expect(malformed.ok).toBe(false);
    expect(malformed.artifacts).toBeUndefined();
    expect(malformed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'FACT_INTAKE_SOURCE_INVALID',
          path: 'source.errors',
        }),
      ]),
    );
  });

  it('returns structured diagnostics for malformed runtime options', async () => {
    const malformedValues = [
      null,
      [],
      { ...options, reportCode: '' },
      { ...options, fightId: 0 },
      { ...options, snapshotId: '' },
      { ...options, evidenceRef: '' },
      { ...options, capturedAt: '' },
      { ...options, capturedAt: 'yesterday' },
      { ...options, capturedAt: '2026-02-31T00:00:00.000Z' },
      { ...options, reviewer: 1, document },
      { ...options, reviewedAt: {}, document },
      { ...options, reviewedAt: 'yesterday', document },
      { ...options, reviewedAt: '2026-02-31T00:00:00.000Z', document },
      { ...options, licenseStatus: 'untrusted' },
      { ...options, requireApproved: 'yes' },
      { ...options, document: null },
    ];

    for (const malformedOptions of malformedValues) {
      const result = await buildFactIntakeBundle(
        source,
        malformedOptions as unknown as typeof options,
      );

      expect(result.ok).toBe(false);
      expect(result.artifacts).toBeUndefined();
      expect(result.errors[0]?.code).toBe('FACT_INTAKE_OPTIONS_INVALID');
    }
  });
});
