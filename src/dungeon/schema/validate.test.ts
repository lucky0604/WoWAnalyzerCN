import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { rubyLifePoolsPhase1Draft } from '../data/phase1Prototypes';
import { getPullStepForces, validateDungeonDocument } from './validate';

describe('Dungeon document validation', () => {
  it('accepts both Phase 0 learning fixtures', () => {
    for (const document of Object.values(phase0FixtureDocuments)) {
      const result = validateDungeonDocument(document);
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.warnings.some((warning) => warning.code === 'DUNGEON_FIXTURE_DATA')).toBe(true);
    }
  });

  it('derives Pull forces from spawn data', () => {
    const document = phase0FixtureDocuments.rubyLifePools;
    const route = document.routes[0]!;
    const pull = route.steps.find((step) => step.type === 'pull');
    expect(pull?.type).toBe('pull');
    if (pull?.type === 'pull') {
      expect(getPullStepForces(document, pull)).toBe(13);
    }
  });

  it('blocks a route whose declared forces drift from its spawn composition', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.routes[0]!.expectedEnemyForcesPoints = 999;
    const result = validateDungeonDocument(document);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUNGEON_ROUTE_FORCES_MISMATCH',
          entityId: 'rlp-learning-route',
        }),
      ]),
    );
  });

  it('reports unknown references with a copyable path', () => {
    const document = structuredClone(phase0FixtureDocuments.altarOfFangs);
    document.situations[0]!.focusAbilityIds = ['missing-ability'];
    const result = validateDungeonDocument(document);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUNGEON_UNKNOWN_SITUATION_ABILITY',
          path: 'situations.altar-situation-coiled-approach.focusAbilityIds',
        }),
      ]),
    );
  });

  it('rejects coordinates outside their normalized floor bounds', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.spawns[0]!.position = [101, 50];
    const result = validateDungeonDocument(document);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUNGEON_COORDINATE_OUT_OF_BOUNDS',
          entityId: 'rlp-spawn-flamer-1',
        }),
      ]),
    );
  });

  it('does not allow an incomplete draft to be relabeled as published', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.dataStatus = 'published';
    document.version.status = 'draft';
    document.abilities = [];
    document.situations = [];
    document.routes = [];
    document.bosses = [];
    document.provenance[0]!.licenseStatus = 'needs-review';
    const result = validateDungeonDocument(document);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'DUNGEON_RELEASE_VERSION_STATUS_MISMATCH',
        'DUNGEON_RELEASE_EMPTY_ABILITIES',
        'DUNGEON_RELEASE_EMPTY_SITUATIONS',
        'DUNGEON_RELEASE_EMPTY_ROUTES',
        'DUNGEON_RELEASE_EMPTY_BOSSES',
        'DUNGEON_PUBLISHED_SOURCE_NOT_APPROVED',
      ]),
    );
  });

  it('blocks a content draft from bypassing spatial and spell/forces gates', () => {
    const document = structuredClone(rubyLifePoolsPhase1Draft);
    document.dataStatus = 'reviewed';
    document.version.status = 'reviewed';
    const result = validateDungeonDocument(document);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'DUNGEON_RELEASE_SPATIAL_DATA_PENDING',
        'DUNGEON_FORCES_SNAPSHOT_PENDING',
        'DUNGEON_SPELL_ID_PENDING',
      ]),
    );
  });

  it('blocks a release when nested knowledge keeps a reference-only source', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.dataStatus = 'reviewed';
    document.version.status = 'reviewed';
    document.review = {
      author: 'author',
      reviewer: 'reviewer',
      reviewedAt: '2026-08-10T00:00:00.000Z',
      gameBuild: document.version.build,
    };
    document.enemies[0]!.provenance[0]!.licenseStatus = 'reference-only';

    const result = validateDungeonDocument(document);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUNGEON_NESTED_SOURCE_NOT_APPROVED',
          path: 'enemies.rlp-primalist-flamer.provenance[0]',
        }),
      ]),
    );
  });
});
