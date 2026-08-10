import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { rubyLifePoolsPhase1Draft } from '../data/phase1Prototypes';
import { getDungeonLearningAccess } from './access';

describe('dungeon learning access gates', () => {
  it('keeps fixtures out of the learning route', () => {
    const access = getDungeonLearningAccess(phase0FixtureDocuments.altarOfFangs);
    expect(access).toMatchObject({ state: 'fixture', canOpen: false, isFormal: false });
  });

  it('allows a valid draft as an explicit local preview', () => {
    const access = getDungeonLearningAccess(rubyLifePoolsPhase1Draft);
    expect(access).toMatchObject({ state: 'preview', canOpen: true, isFormal: false });
    expect(access.validation.errors).toEqual([]);
  });

  it('blocks stale content before any lesson is rendered', () => {
    const document = structuredClone(rubyLifePoolsPhase1Draft);
    document.version.status = 'stale';
    const access = getDungeonLearningAccess(document);
    expect(access).toMatchObject({ state: 'stale', canOpen: false, isFormal: false });
  });

  it('requires release validation for formal learning', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.dataStatus = 'reviewed';
    document.version.status = 'reviewed';
    document.review = {
      author: 'fixture-author',
      reviewer: 'fixture-reviewer',
      reviewedAt: '2026-08-10T00:00:00.000Z',
      gameBuild: document.version.build,
      selfTest: {
        completedAt: '2026-08-10T00:00:00.000Z',
        modes: ['quick', 'overview', 'full'],
        situationIds: document.situations.map((situation) => situation.id),
        routeIds: document.routes.map((route) => route.id),
      },
      authoringEffort: {
        totalMinutes: 30,
        situationMinutes: Object.fromEntries(
          document.situations.map((situation) => [situation.id, 1]),
        ),
      },
    };
    const access = getDungeonLearningAccess(document);
    expect(access).toMatchObject({ state: 'available', canOpen: true, isFormal: true });
  });

  it('does not treat a reviewed document with reference-only sources as formal', () => {
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.dataStatus = 'reviewed';
    document.version.status = 'reviewed';
    document.review = {
      author: 'fixture-author',
      reviewer: 'fixture-reviewer',
      reviewedAt: '2026-08-10T00:00:00.000Z',
      gameBuild: document.version.build,
      selfTest: {
        completedAt: '2026-08-10T00:00:00.000Z',
        modes: ['quick', 'overview', 'full'],
        situationIds: document.situations.map((situation) => situation.id),
        routeIds: document.routes.map((route) => route.id),
      },
      authoringEffort: {
        totalMinutes: 30,
        situationMinutes: Object.fromEntries(
          document.situations.map((situation) => [situation.id, 1]),
        ),
      },
    };
    document.provenance[0]!.licenseStatus = 'reference-only';
    const access = getDungeonLearningAccess(document);
    expect(access).toMatchObject({ state: 'blocked', canOpen: false, isFormal: false });
    expect(access.validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUNGEON_REVIEWED_SOURCE_NOT_APPROVED' }),
      ]),
    );
  });
});
