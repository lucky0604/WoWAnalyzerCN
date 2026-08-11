import { describe, expect, it } from 'vitest';

import { season2DungeonCatalogById } from '../data/season2Catalog';
import { rubyLifePoolsSpatialPreview } from '../data/rlpSpatialPreview';
import { phase0FixtureDocuments } from '../registry';
import { getDungeonScopedLearningAccess } from './formalAccess';

describe('dungeon scoped learning access', () => {
  it('keeps the RLP draft preview available locally without treating it as formal', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const access = getDungeonScopedLearningAccess(entry, rubyLifePoolsSpatialPreview);

    expect(access).toMatchObject({ canOpen: true, isFormal: false, state: 'preview' });
  });

  it('rejects a fixture even when a coordinate reference exists', () => {
    const entry = season2DungeonCatalogById.get('altar-of-fangs')!;
    const access = getDungeonScopedLearningAccess(entry, phase0FixtureDocuments.altarOfFangs);

    expect(access).toMatchObject({ canOpen: false, isFormal: false, state: 'fixture' });
  });

  it('does not authorize a formal document while the catalog remains coordinate-only', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.id = entry.id;
    document.season = entry.season;
    document.dataStatus = 'reviewed';
    document.version.status = 'reviewed';
    document.review = {
      author: 'author',
      reviewer: 'reviewer',
      reviewedAt: '2026-08-11T00:00:00.000Z',
      gameBuild: document.version.build,
      selfTest: {
        completedAt: '2026-08-11T00:00:00.000Z',
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

    const access = getDungeonScopedLearningAccess(entry, document);
    expect(access.canOpen).toBe(false);
    expect(access.isFormal).toBe(false);
    expect(access.reason).toContain('目录');
  });

  it('fails closed when a draft document does not match the catalog identity', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    document.id = 'other-dungeon';

    const access = getDungeonScopedLearningAccess(entry, document);
    expect(access).toMatchObject({ canOpen: false, isFormal: false });
    expect(access.reason).toContain('身份不匹配');
  });
});
