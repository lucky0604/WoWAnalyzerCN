import { describe, expect, it } from 'vitest';

import {
  getDungeonCatalogEntry,
  season2DungeonCatalog,
  validateSeason2DungeonCatalog,
} from './season2Catalog';

describe('season 2 dungeon catalog', () => {
  it('covers the eight coordinate-ready Threechest keys without publishing empty learning pages', () => {
    expect(season2DungeonCatalog).toHaveLength(8);
    expect(season2DungeonCatalog.map((entry) => entry.sourceKey)).toEqual([
      'aa',
      'magi',
      'cavns',
      'xenas',
      'wind',
      'pit',
      'seat',
      'sky',
    ]);
    expect(season2DungeonCatalog.every((entry) => entry.status === 'building')).toBe(true);
    expect(validateSeason2DungeonCatalog()).toEqual([]);
  });

  it('keeps source keys and dungeon IDs addressable independently', () => {
    expect(getDungeonCatalogEntry('magisters-terrace')?.sourceKey).toBe('magi');
    expect(getDungeonCatalogEntry('missing-dungeon')).toBeUndefined();
  });

  it('reports duplicate and premature published entries', () => {
    const diagnostics = validateSeason2DungeonCatalog([
      ...season2DungeonCatalog.slice(0, 6),
      { ...season2DungeonCatalog[0]!, status: 'published' },
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'CATALOG_COUNT',
      'CATALOG_DUPLICATE_ID',
      'CATALOG_DUPLICATE_SOURCE_KEY',
      'CATALOG_PUBLISHED_WITHOUT_DOCUMENT',
    ]);
  });
});
