import { describe, expect, it } from 'vitest';

import {
  getDungeonCatalogEntry,
  legacyThreechestCoordinateInventory,
  season2DungeonCatalog,
  validateSeason2DungeonCatalog,
} from './season2Catalog';
import { dungeonDocuments } from '../registry';

describe('season 2 dungeon catalog', () => {
  it('covers the official eight-dungeon S2 roster without publishing empty learning pages', () => {
    expect(season2DungeonCatalog).toHaveLength(8);
    expect(season2DungeonCatalog.map((entry) => entry.id)).toEqual([
      'altar-of-fangs',
      'murder-row',
      'den-of-nalorakk',
      'the-blinding-vale',
      'voidscar-arena',
      'ruby-life-pools',
      'kings-rest',
      'temple-of-sethraliss',
    ]);
    expect(season2DungeonCatalog.filter((entry) => entry.status === 'registered')).toHaveLength(7);
    expect(getDungeonCatalogEntry('ruby-life-pools')?.status).toBe('coordinate-ready');
    expect(season2DungeonCatalog.every((entry) => entry.updatedAt === '2026-08-10')).toBe(true);
    expect(season2DungeonCatalog.filter((entry) => entry.coordinateSnapshotId)).toHaveLength(1);
    expect(getDungeonCatalogEntry('ruby-life-pools')).toMatchObject({
      coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
      coordinateSnapshotKey: 'rlp',
      coordinateIdentityRegistryKey: 'rlp',
      coordinateSourceId: 'threechest',
    });
    expect(
      season2DungeonCatalog
        .map((entry) => entry.sourceKey)
        .filter((sourceKey) =>
          legacyThreechestCoordinateInventory.some((entry) => entry.sourceKey === sourceKey),
        ),
    ).toEqual([]);
    expect(
      validateSeason2DungeonCatalog(
        undefined,
        new Set(dungeonDocuments.map((document) => document.id)),
      ),
    ).toEqual([]);
  });

  it('keeps S2 keys and legacy coordinate inventory addressable independently', () => {
    expect(getDungeonCatalogEntry('kings-rest')?.sourceKey).toBe('kings-rest');
    expect(
      legacyThreechestCoordinateInventory.find((entry) => entry.sourceKey === 'magi')?.id,
    ).toBe('magisters-terrace');
    expect(getDungeonCatalogEntry('missing-dungeon')).toBeUndefined();
  });

  it('reports duplicate and premature published entries', () => {
    const diagnostics = validateSeason2DungeonCatalog(
      [...season2DungeonCatalog.slice(0, 6), { ...season2DungeonCatalog[0]!, status: 'published' }],
      new Set(dungeonDocuments.map((document) => document.id)),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'CATALOG_COUNT',
      'CATALOG_DUPLICATE_ID',
      'CATALOG_DUPLICATE_SOURCE_KEY',
      'CATALOG_PUBLISHED_WITHOUT_DOCUMENT',
    ]);
  });

  it('does not allow a non-registered knowledge status to look complete', () => {
    const diagnostics = validateSeason2DungeonCatalog(
      [{ ...season2DungeonCatalog[5]!, status: 'knowledge-draft' }],
      new Set(),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'CATALOG_STATUS_WITHOUT_DOCUMENT',
    );
  });
});
