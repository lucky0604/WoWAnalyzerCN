import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { rubyLifePoolsPhase1Draft } from '../data/phase1Prototypes';
import { getDungeonLearningAccess } from './access';
import type { StaleKnowledgeLedger } from './staleLedger';

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

  it('blocks knowledge IDs marked stale by the runtime ledger', () => {
    const ledger: StaleKnowledgeLedger = {
      version: 1,
      entries: [
        {
          knowledgeId: rubyLifePoolsPhase1Draft.situations[0]!.id,
          reason: 'coordinate snapshot changed',
          markedAt: '2026-08-12T00:00:00.000Z',
        },
      ],
    };
    const access = getDungeonLearningAccess(rubyLifePoolsPhase1Draft, ledger);
    expect(access).toMatchObject({ state: 'stale', canOpen: false, isFormal: false });
    expect(access.reason).toContain('coordinate snapshot changed');
  });

  it('fails closed when the runtime stale ledger is malformed', () => {
    const access = getDungeonLearningAccess(rubyLifePoolsPhase1Draft, null as never);
    expect(access).toMatchObject({ state: 'blocked', canOpen: false, isFormal: false });
    expect(access.reason).toContain('stale');

    const malformed = getDungeonLearningAccess(rubyLifePoolsPhase1Draft, {
      version: 1,
      entries: [null as never],
    });
    expect(malformed).toMatchObject({ state: 'blocked', canOpen: false, isFormal: false });

    const unknown = getDungeonLearningAccess(rubyLifePoolsPhase1Draft, {
      version: 1,
      entries: [
        {
          knowledgeId: 'typo-not-registered',
          reason: 'changed',
          markedAt: '2026-08-12T00:00:00.000Z',
        },
      ],
    });
    expect(unknown).toMatchObject({ state: 'blocked', canOpen: false, isFormal: false });
  });

  it('requires release validation and artifact identities for formal learning', () => {
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
    expect(access).toMatchObject({ state: 'blocked', canOpen: false, isFormal: false });
    expect(access.validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUNGEON_RELEASE_FACT_BINDING_INVALID' }),
        expect.objectContaining({ code: 'DUNGEON_RELEASE_COORDINATE_BINDING_INVALID' }),
      ]),
    );
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
