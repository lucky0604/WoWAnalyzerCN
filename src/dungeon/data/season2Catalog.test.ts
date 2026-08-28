import { describe, expect, it } from 'vitest';

import {
  getDungeonCatalogEntry,
  legacyThreechestCoordinateInventory,
  season2DungeonCatalog,
  season2WclCatalogSource,
  serializeSeason2WclIdentity,
  serializeSeason2WclSourceIdentity,
  validateSeason2WclCatalogSource,
  validateSeason2DungeonCatalog,
} from './season2Catalog';
import { dungeonDocuments } from '../registry';
import season2WclIdentityEvidence from './wcl/season2.identity.json';

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
    expect(season2DungeonCatalog.filter((entry) => entry.status === 'registered')).toHaveLength(0);
    expect(getDungeonCatalogEntry('ruby-life-pools')?.status).toBe('coordinate-ready');
    expect(season2DungeonCatalog.every((entry) => entry.updatedAt === '2026-08-11')).toBe(true);
    expect(season2DungeonCatalog.map((entry) => entry.wclEncounterId)).toEqual([
      12993, 12813, 12825, 12859, 12923, 112521, 61762, 61877,
    ]);
    expect(season2DungeonCatalog.map((entry) => entry.wclPtrEncounterId)).toEqual([
      62993, 62813, 62825, 62859, 62923, 162521, 111762, 111877,
    ]);
    expect(season2DungeonCatalog.every((entry) => entry.wclZoneId === 55)).toBe(true);
    expect(season2DungeonCatalog.every((entry) => entry.wclPtrZoneId === 56)).toBe(true);
    expect(season2DungeonCatalog.filter((entry) => entry.coordinateSnapshotId)).toHaveLength(8);
    expect(getDungeonCatalogEntry('ruby-life-pools')).toMatchObject({
      coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-12-rlp-s2',
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
    // Index 1 still has no registered document, so a published duplicate of it
    // must keep raising CATALOG_PUBLISHED_WITHOUT_DOCUMENT.  Index 0
    // (altar-of-fangs) is registered and would legitimately pass that check.
    const diagnostics = validateSeason2DungeonCatalog(
      [...season2DungeonCatalog.slice(0, 6), { ...season2DungeonCatalog[1]!, status: 'published' }],
      new Set(dungeonDocuments.map((document) => document.id)),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'CATALOG_WCL_SOURCE_IDENTITY_MISMATCH',
      'CATALOG_WCL_SOURCE_CATALOG_BINDING_MISMATCH',
      'CATALOG_WCL_SOURCE_CATALOG_PAIR_MISMATCH',
      'CATALOG_COUNT',
      'CATALOG_DUPLICATE_ID',
      'CATALOG_DUPLICATE_SOURCE_KEY',
      'CATALOG_WCL_ENCOUNTER_DUPLICATE',
      'CATALOG_WCL_ENCOUNTER_DUPLICATE',
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

  it('keeps WCL source metadata strict and identity digest-backed', () => {
    expect(validateSeason2WclCatalogSource()).toEqual([]);
    expect(
      validateSeason2WclCatalogSource({
        ...season2WclCatalogSource,
        endpoint: '/v1/reports',
      } as unknown as typeof season2WclCatalogSource),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CATALOG_WCL_SOURCE_ENDPOINT_INVALID' }),
      ]),
    );
    expect(serializeSeason2WclIdentity()).toContain('ruby-life-pools|112521|162521|55|56');
    expect(season2WclCatalogSource.identityDigest).toBe(
      'sha256:50d752767a977668cc1c3acfacdb2f40c91622b2f7578e86a8b65f36876a4ed8',
    );
    expect(serializeSeason2WclSourceIdentity()).toContain('Mythic+ Season 2 (PTR)');
    expect(
      validateSeason2WclCatalogSource({
        ...season2WclCatalogSource,
        sourceId: 'rpglogs-midnight-s2-zones-55-57',
      } as unknown as typeof season2WclCatalogSource).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_ID_INVALID');
    expect(
      validateSeason2WclCatalogSource({
        ...season2WclCatalogSource,
        retrievedAt: '2026-02-31',
      } as unknown as typeof season2WclCatalogSource).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_RETRIEVED_AT_INVALID');
    expect(
      validateSeason2WclCatalogSource({
        ...season2WclCatalogSource,
        retrievedAt: '2026-08-12',
      } as unknown as typeof season2WclCatalogSource).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_METADATA_MISMATCH');
    expect(
      validateSeason2WclCatalogSource(season2WclCatalogSource, [
        { ...season2DungeonCatalog[0]!, wclEncounterId: 999999 },
        ...season2DungeonCatalog.slice(1),
      ]).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_IDENTITY_MISMATCH');
    const swappedEntries = [...season2DungeonCatalog];
    const first = swappedEntries[0]!;
    const second = swappedEntries[1]!;
    swappedEntries[0] = {
      ...first,
      wclEncounterId: second.wclEncounterId,
      wclPtrEncounterId: second.wclPtrEncounterId,
    };
    swappedEntries[1] = {
      ...second,
      wclEncounterId: first.wclEncounterId,
      wclPtrEncounterId: first.wclPtrEncounterId,
    };
    expect(
      validateSeason2DungeonCatalog(swappedEntries).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_CATALOG_PAIR_MISMATCH');
    expect(
      validateSeason2WclCatalogSource(season2WclCatalogSource, season2DungeonCatalog, {
        ...season2WclIdentityEvidence,
        zones: [...season2WclIdentityEvidence.zones, { ...season2WclIdentityEvidence.zones[1]! }],
      }).map((diagnostic) => diagnostic.code),
    ).toContain('CATALOG_WCL_SOURCE_EVIDENCE_SHAPE_INVALID');
    expect(
      validateSeason2WclCatalogSource(null, season2DungeonCatalog, null).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('CATALOG_WCL_SOURCE_EVIDENCE_SHAPE_INVALID');
    expect(
      validateSeason2WclCatalogSource(season2WclCatalogSource, null).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('CATALOG_WCL_SOURCE_IDENTITY_MISMATCH');
  });
});
