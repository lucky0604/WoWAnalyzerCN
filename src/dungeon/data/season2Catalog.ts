import type { LocalizedText } from '../schema/types';
import season2WclIdentityEvidence from './wcl/season2.identity.json';

export type DungeonCoverageStatus =
  | 'registered'
  | 'raw-ready'
  | 'route-ready'
  | 'knowledge-draft'
  | 'coordinate-ready'
  | 'reviewed'
  | 'published'
  | 'stale';

export const dungeonCoverageStatusLabel: Record<DungeonCoverageStatus, string> = {
  registered: '已登记',
  'raw-ready': '基础事实已接入',
  'route-ready': '路线已接入',
  'knowledge-draft': '知识草稿',
  'coordinate-ready': '坐标已接入',
  reviewed: '已审校',
  published: '已发布',
  stale: '内容过期',
};

/**
 * The catalog is the product's season roster. It deliberately does not imply that
 * a coordinate snapshot, route, or learning document exists for every entry.
 *
 * `sourceKey` is a stable internal key for future data adapters. It is not a
 * Threechest key and must not be used as proof that a coordinate source exists.
 */
export interface DungeonCatalogEntry {
  id: string;
  slug: string;
  sourceKey: string;
  name: LocalizedText;
  season: 'midnight-s2';
  status: DungeonCoverageStatus;
  updatedAt: string;
  coordinateSnapshotId?: string;
  coordinateSourceId?: 'threechest';
  /**
   * Explicit key used to resolve the coordinate snapshot when a source's
   * dungeon key differs from WoWAnalyzerCN's stable catalog sourceKey.
   * Keeping this in the catalog avoids a hidden alias in the runtime adapter.
   */
  coordinateSnapshotKey?: string;
  /** Committed source→stable SpawnId registry used by the reference adapter. */
  coordinateIdentityRegistryKey?: string;
  mapAssetKey: string;
  /** WCL encounter identity used for report-side dungeon matching. */
  wclEncounterId?: number;
  /** PTR WCL encounter identity for local/pre-release report matching. */
  wclPtrEncounterId?: number;
  /** Live WCL zone identity for the season pack. */
  wclZoneId?: number;
  /** PTR WCL zone identity for local/pre-release report matching. */
  wclPtrZoneId?: number;
  summary: LocalizedText;
  nextMilestone: LocalizedText;
}

/**
 * Threechest snapshots already committed to this repository are kept as a
 * separately named inventory. The clone currently contains an older dungeon
 * pool, so these entries are useful for importer/renderer regression tests but
 * are not members of the Midnight S2 roster.
 */
export interface ThreechestCoordinateInventoryEntry {
  id: string;
  slug: string;
  sourceKey: string;
  name: LocalizedText;
  coordinateSnapshotId: string;
  coordinateSourceId: 'threechest';
  allowEphemeralIdentity: true;
  mapAssetKey: string;
}

const text = (zhCN: string, enUS: string): LocalizedText => ({ zhCN, enUS });

export const season2RotationSource = {
  sourceId: 'blizzard-midnight-s2-rotation',
  title: 'The Shadows Deepen: Midnight Season 2 Begins August 18',
  url: 'https://news.blizzard.com/en-us/article/24294369/the-shadows-deepen-midnight-season-2-begins-august-18',
  retrievedAt: '2026-08-10',
  fieldAllowlist: ['season', 'dungeon id', 'dungeon name', 'rotation membership'],
} as const;

/**
 * WCL metadata retrieved from the configured CN service's `/v1/zones` response
 * on 2026-08-11. Only zone/encounter identity is retained; no combat facts are
 * inferred from this response.
 */
export const season2WclCatalogSource = {
  sourceId: 'rpglogs-midnight-s2-zones-55-56',
  endpoint: '/v1/zones',
  zoneId: 55,
  ptrZoneId: 56,
  retrievedAt: '2026-08-11',
  fieldAllowlist: ['zone.id', 'zone.name', 'zone.encounters.id', 'zone.encounters.name'],
  // Host-neutral evidence reference; the configured local/production WCL
  // provider supplies the base URL at runtime.
  evidenceRef: 'wcl-api:/v1/zones',
  identityDigest: 'sha256:50d752767a977668cc1c3acfacdb2f40c91622b2f7578e86a8b65f36876a4ed8',
} as const;

const coordinateSummary = (name: string): LocalizedText =>
  text(
    `${name} 已接入只读位置参考；技能、forces、波次和学习路线仍需独立核验。`,
    `${name} has a read-only spatial reference; skills, forces, pulls, and the learning route still require independent review.`,
  );

const coordinateMilestone = text(
  '先绑定自有 Floor/Enemy 语义并核对当前 build，再补齐 forces、Situation 和学习路线。',
  'Bind the snapshot to owned Floor/Enemy semantics and verify the current build before adding forces, Situations, and the learning route.',
);

const catalogUpdatedAt = '2026-08-11';

/** The eight dungeons in the current Midnight Season 2 Mythic+ rotation. */
export const season2DungeonCatalog: readonly DungeonCatalogEntry[] = [
  {
    id: 'altar-of-fangs',
    slug: 'altar-of-fangs',
    sourceKey: 'altar-of-fangs',
    name: text('尖牙祭坛', 'Altar of Fangs'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-fang-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-fang',
    coordinateIdentityRegistryKey: 's2-fang',
    mapAssetKey: 'midnight-s2:altar-of-fangs',
    wclEncounterId: 12993,
    wclPtrEncounterId: 62993,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('尖牙祭坛'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'murder-row',
    slug: 'murder-row',
    sourceKey: 'murder-row',
    name: text('谋杀街', 'Murder Row'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-murd-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-murd',
    coordinateIdentityRegistryKey: 's2-murd',
    mapAssetKey: 'midnight-s2:murder-row',
    wclEncounterId: 12813,
    wclPtrEncounterId: 62813,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('谋杀街'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'den-of-nalorakk',
    slug: 'den-of-nalorakk',
    sourceKey: 'den-of-nalorakk',
    name: text('纳洛拉克巢穴', 'Den of Nalorakk'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-nalo-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-nalo',
    coordinateIdentityRegistryKey: 's2-nalo',
    mapAssetKey: 'midnight-s2:den-of-nalorakk',
    wclEncounterId: 12825,
    wclPtrEncounterId: 62825,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('纳洛拉克巢穴'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'the-blinding-vale',
    slug: 'the-blinding-vale',
    sourceKey: 'the-blinding-vale',
    name: text('盲谷', 'The Blinding Vale'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-vale-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-vale',
    coordinateIdentityRegistryKey: 's2-vale',
    mapAssetKey: 'midnight-s2:the-blinding-vale',
    wclEncounterId: 12859,
    wclPtrEncounterId: 62859,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('盲谷'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'voidscar-arena',
    slug: 'voidscar-arena',
    sourceKey: 'voidscar-arena',
    name: text('虚空裂痕竞技场', 'Voidscar Arena'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-void-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-void',
    coordinateIdentityRegistryKey: 's2-void',
    mapAssetKey: 'midnight-s2:voidscar-arena',
    wclEncounterId: 12923,
    wclPtrEncounterId: 62923,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('虚空裂痕竞技场'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'ruby-life-pools',
    slug: 'ruby-life-pools',
    sourceKey: 'ruby-life-pools',
    name: text('红玉新生法池', 'Ruby Life Pools'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-12-rlp-s2',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 'rlp',
    coordinateIdentityRegistryKey: 'rlp',
    mapAssetKey: 'midnight-s2:ruby-life-pools',
    wclEncounterId: 112521,
    wclPtrEncounterId: 162521,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: text(
      '红玉新生法池已有来源化知识草稿和当前 S2 坐标快照；forces、作者自测和第二审校仍未完成。',
      'Ruby Life Pools has a sourced knowledge draft and current S2 coordinate snapshot; forces, author self-test, and second review remain open.',
    ),
    nextMilestone: text(
      '核对当前 S2 坐标与自有 spawn 身份，补齐 forces，完成作者自测与第二审校后再进入 reviewed。',
      'Reconcile current S2 coordinates with owned spawn identities, complete forces, author self-test, and second review before reviewed.',
    ),
  },
  {
    id: 'kings-rest',
    slug: 'kings-rest',
    sourceKey: 'kings-rest',
    name: text('诸王之眠', "Kings' Rest"),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-kr-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-kr',
    coordinateIdentityRegistryKey: 's2-kr',
    mapAssetKey: 'midnight-s2:kings-rest',
    wclEncounterId: 61762,
    wclPtrEncounterId: 111762,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('诸王之眠'),
    nextMilestone: coordinateMilestone,
  },
  {
    id: 'temple-of-sethraliss',
    slug: 'temple-of-sethraliss',
    sourceKey: 'temple-of-sethraliss',
    name: text('塞塔里斯神庙', 'Temple of Sethraliss'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-s2-tos-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 's2-tos',
    coordinateIdentityRegistryKey: 's2-tos',
    mapAssetKey: 'midnight-s2:temple-of-sethraliss',
    wclEncounterId: 61877,
    wclPtrEncounterId: 111877,
    wclZoneId: season2WclCatalogSource.zoneId,
    wclPtrZoneId: season2WclCatalogSource.ptrZoneId,
    summary: coordinateSummary('塞塔里斯神庙'),
    nextMilestone: coordinateMilestone,
  },
];

const verifiedWclIdentitySerialization = [
  'altar-of-fangs|12993|62993|55|56',
  'murder-row|12813|62813|55|56',
  'den-of-nalorakk|12825|62825|55|56',
  'the-blinding-vale|12859|62859|55|56',
  'voidscar-arena|12923|62923|55|56',
  'ruby-life-pools|112521|162521|55|56',
  'kings-rest|61762|111762|55|56',
  'temple-of-sethraliss|61877|111877|55|56',
].join('\n');

const verifiedWclCatalogBinding = [
  { catalogId: 'altar-of-fangs', liveEncounterId: 12993, ptrEncounterId: 62993 },
  { catalogId: 'murder-row', liveEncounterId: 12813, ptrEncounterId: 62813 },
  { catalogId: 'den-of-nalorakk', liveEncounterId: 12825, ptrEncounterId: 62825 },
  { catalogId: 'the-blinding-vale', liveEncounterId: 12859, ptrEncounterId: 62859 },
  { catalogId: 'voidscar-arena', liveEncounterId: 12923, ptrEncounterId: 62923 },
  { catalogId: 'ruby-life-pools', liveEncounterId: 112521, ptrEncounterId: 162521 },
  { catalogId: 'kings-rest', liveEncounterId: 61762, ptrEncounterId: 111762 },
  { catalogId: 'temple-of-sethraliss', liveEncounterId: 61877, ptrEncounterId: 111877 },
] as const;

const verifiedWclIdentityDigest =
  'sha256:50d752767a977668cc1c3acfacdb2f40c91622b2f7578e86a8b65f36876a4ed8';

export const legacyThreechestCoordinateInventory: readonly ThreechestCoordinateInventoryEntry[] = [
  {
    id: 'algethar-academy',
    slug: 'algethar-academy',
    sourceKey: 'aa',
    name: text('艾杰斯亚学院', "Algeth'ar Academy"),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:aa',
  },
  {
    id: 'magisters-terrace',
    slug: 'magisters-terrace',
    sourceKey: 'magi',
    name: text('魔导师平台', "Magisters' Terrace"),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:magi',
  },
  {
    id: 'maisara-caverns',
    slug: 'maisara-caverns',
    sourceKey: 'cavns',
    name: text('迈萨拉洞窟', 'Maisara Caverns'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:cavns',
  },
  {
    id: 'nexuspoint-xenas',
    slug: 'nexuspoint-xenas',
    sourceKey: 'xenas',
    name: text('节点希纳斯', 'Nexus-Point Xenas'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:xenas',
  },
  {
    id: 'windrunner-spire',
    slug: 'windrunner-spire',
    sourceKey: 'wind',
    name: text('风行者之塔', 'Windrunner Spire'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:wind',
  },
  {
    id: 'pit-of-saron',
    slug: 'pit-of-saron',
    sourceKey: 'pit',
    name: text('萨隆矿坑', 'Pit of Saron'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:pit',
  },
  {
    id: 'seat-of-the-triumvirate',
    slug: 'seat-of-the-triumvirate',
    sourceKey: 'seat',
    name: text('执政团之座', 'Seat of the Triumvirate'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:seat',
  },
  {
    id: 'skyreach',
    slug: 'skyreach',
    sourceKey: 'sky',
    name: text('通天峰', 'Skyreach'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    allowEphemeralIdentity: true,
    mapAssetKey: 'legacy-threechest:sky',
  },
];

export const season2DungeonCatalogById = new Map(
  season2DungeonCatalog.map((entry) => [entry.id, entry]),
);

export function getDungeonCatalogEntry(id: string): DungeonCatalogEntry | undefined {
  return season2DungeonCatalogById.get(id);
}

export function isLearningPublished(status: DungeonCoverageStatus): boolean {
  return status === 'reviewed' || status === 'published';
}

export interface CatalogDiagnostic {
  code: string;
  path: string;
  message: string;
}

const expectedWclIdentityFields = [
  'zone.id',
  'zone.name',
  'zone.encounters.id',
  'zone.encounters.name',
] as const;

export function serializeSeason2WclIdentity(
  entries: readonly DungeonCatalogEntry[] = season2DungeonCatalog,
): string {
  return entries
    .map(
      (entry) =>
        `${entry.id}|${entry.wclEncounterId ?? ''}|${entry.wclPtrEncounterId ?? ''}|${entry.wclZoneId ?? ''}|${entry.wclPtrZoneId ?? ''}`,
    )
    .join('\n');
}

/** Canonical payload retained from the configured /v1/zones identity response. */
export function serializeSeason2WclSourceIdentity(): string {
  return JSON.stringify({
    sourceId: season2WclIdentityEvidence.sourceId,
    endpoint: season2WclIdentityEvidence.endpoint,
    retrievedAt: season2WclIdentityEvidence.retrievedAt,
    zones: [...season2WclIdentityEvidence.zones]
      .sort((left, right) => left.id - right.id)
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        encounters: [...zone.encounters].sort((left, right) => left.id - right.id),
      })),
  });
}

export function validateSeason2WclCatalogSource(
  source: typeof season2WclCatalogSource | null = season2WclCatalogSource,
  entries: readonly DungeonCatalogEntry[] | null = season2DungeonCatalog,
  evidence: typeof season2WclIdentityEvidence | null = season2WclIdentityEvidence,
): CatalogDiagnostic[] {
  source = source ?? ({} as typeof season2WclCatalogSource);
  entries = Array.isArray(entries) ? entries : [];
  evidence = evidence ?? ({} as typeof season2WclIdentityEvidence);
  const diagnostics: CatalogDiagnostic[] = [];
  const evidenceZones = Array.isArray(evidence?.zones) ? evidence.zones : [];
  const evidenceZoneIds = new Set(evidenceZones.map((zone) => zone.id));
  const evidenceEncounterIds = new Set<number>();
  const evidenceShapeValid =
    evidenceZones.length === 2 &&
    evidenceZones.every((zone) => {
      const encounters = Array.isArray(zone.encounters) ? zone.encounters : [];
      const validZone =
        Number.isInteger(zone.id) &&
        zone.id > 0 &&
        typeof zone.name === 'string' &&
        zone.name.trim().length > 0 &&
        encounters.length === verifiedWclCatalogBinding.length;
      return (
        validZone &&
        encounters.every((encounter) => {
          const validEncounter =
            Number.isInteger(encounter.id) &&
            encounter.id > 0 &&
            typeof encounter.name === 'string' &&
            encounter.name.trim().length > 0 &&
            !evidenceEncounterIds.has(encounter.id);
          if (validEncounter) evidenceEncounterIds.add(encounter.id);
          return validEncounter;
        })
      );
    });
  if (!evidenceShapeValid) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_EVIDENCE_SHAPE_INVALID',
      path: '$.season2WclCatalogSource.evidence',
      message:
        'WCL S2 identity evidence 必须包含两个唯一 zone，每个 zone 恰好八个带名称的唯一 encounter。',
    });
  }
  const sourceIdMatch =
    typeof source.sourceId === 'string'
      ? source.sourceId.match(/^rpglogs-midnight-s2-zones-(\d+)-(\d+)$/)
      : null;
  if (
    !sourceIdMatch ||
    Number(sourceIdMatch[1]) !== source.zoneId ||
    Number(sourceIdMatch[2]) !== source.ptrZoneId
  ) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_ID_INVALID',
      path: '$.season2WclCatalogSource.sourceId',
      message: 'WCL S2 sourceId 必须明确绑定 live/PTR zone。',
    });
  }
  if (source.endpoint !== '/v1/zones') {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_ENDPOINT_INVALID',
      path: '$.season2WclCatalogSource.endpoint',
      message: 'WCL S2 identity 来源 endpoint 必须为 /v1/zones。',
    });
  }
  if (
    !Number.isInteger(source.zoneId) ||
    source.zoneId <= 0 ||
    !Number.isInteger(source.ptrZoneId) ||
    source.ptrZoneId <= 0 ||
    (source.zoneId as number) === (source.ptrZoneId as number) ||
    evidenceZoneIds.size !== 2 ||
    !evidenceZoneIds.has(source.zoneId) ||
    !evidenceZoneIds.has(source.ptrZoneId)
  ) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_ZONE_INVALID',
      path: '$.season2WclCatalogSource',
      message: 'WCL S2 source 必须包含两个不同的正整数 live/PTR zone ID。',
    });
  }
  const retrievedAt =
    typeof source.retrievedAt === 'string' ? source.retrievedAt : String(source.retrievedAt ?? '');
  const retrievedAtDate = new Date(`${retrievedAt}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt) ||
    !Number.isFinite(Date.parse(retrievedAt)) ||
    retrievedAtDate.toISOString().slice(0, 10) !== retrievedAt
  ) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_RETRIEVED_AT_INVALID',
      path: '$.season2WclCatalogSource.retrievedAt',
      message: 'WCL S2 source retrievedAt 必须是 YYYY-MM-DD 日期。',
    });
  }
  if (
    source.sourceId !== evidence.sourceId ||
    source.endpoint !== evidence.endpoint ||
    source.retrievedAt !== evidence.retrievedAt
  ) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_METADATA_MISMATCH',
      path: '$.season2WclCatalogSource',
      message: 'WCL S2 source metadata 必须与已提交的 identity evidence envelope 一致。',
    });
  }
  if (
    source.evidenceRef !== 'wcl-api:/v1/zones' ||
    !Array.isArray(source.fieldAllowlist) ||
    source.fieldAllowlist.length !== expectedWclIdentityFields.length ||
    source.fieldAllowlist.some((field, index) => field !== expectedWclIdentityFields[index])
  ) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_FIELDS_INVALID',
      path: '$.season2WclCatalogSource',
      message: 'WCL S2 source 必须保留固定的 identity 字段白名单和 host-neutral evidenceRef。',
    });
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(source.identityDigest)) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_DIGEST_INVALID',
      path: '$.season2WclCatalogSource.identityDigest',
      message: 'WCL S2 identity source 必须记录 sha256 digest。',
    });
  } else if (source.identityDigest !== verifiedWclIdentityDigest) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_DIGEST_MISMATCH',
      path: '$.season2WclCatalogSource.identityDigest',
      message: `WCL S2 identity source digest 与已审计值不一致：${source.identityDigest} !== ${verifiedWclIdentityDigest}。`,
    });
  }
  if (serializeSeason2WclIdentity(entries) !== verifiedWclIdentitySerialization) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_IDENTITY_MISMATCH',
      path: '$.season2WclCatalogSource.identityDigest',
      message: 'WCL S2 catalog identity 与已审计的 /v1/zones identity manifest 不一致。',
    });
  }
  const sourceEncounterBinding = evidenceZones
    .flatMap((zone) =>
      (Array.isArray(zone.encounters) ? zone.encounters : []).map(
        (encounter) => `${zone.id}|${encounter.id}`,
      ),
    )
    .sort()
    .join('\n');
  const catalogEncounterBinding = entries
    .flatMap((entry) => [
      `${entry.wclZoneId ?? ''}|${entry.wclEncounterId ?? ''}`,
      `${entry.wclPtrZoneId ?? ''}|${entry.wclPtrEncounterId ?? ''}`,
    ])
    .sort()
    .join('\n');
  if (sourceEncounterBinding !== catalogEncounterBinding) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_CATALOG_BINDING_MISMATCH',
      path: '$.season2WclCatalogSource',
      message: 'WCL /v1/zones identity payload 与 S2 catalog 的 zone/encounter 集合不一致。',
    });
  }
  const expectedBindingByCatalogId = new Map<string, (typeof verifiedWclCatalogBinding)[number]>(
    verifiedWclCatalogBinding.map((binding) => [binding.catalogId, binding]),
  );
  if (entries.length !== verifiedWclCatalogBinding.length) {
    diagnostics.push({
      code: 'CATALOG_WCL_SOURCE_CATALOG_PAIR_MISMATCH',
      path: '$.season2WclCatalogSource',
      message: 'WCL S2 catalog 条目数量与已审计逐条 identity binding 不一致。',
    });
  }
  entries.forEach((entry, index) => {
    const expected = expectedBindingByCatalogId.get(entry.id);
    if (
      !expected ||
      entry.wclEncounterId !== expected.liveEncounterId ||
      entry.wclPtrEncounterId !== expected.ptrEncounterId
    ) {
      diagnostics.push({
        code: 'CATALOG_WCL_SOURCE_CATALOG_PAIR_MISMATCH',
        path: `$[${index}]`,
        message: `S2 catalog 条目 ${entry.id} 的 live/PTR encounter 未通过逐条 identity binding。`,
      });
    }
  });
  return diagnostics;
}

export function validateSeason2DungeonCatalog(
  entries: readonly DungeonCatalogEntry[] | null = season2DungeonCatalog,
  registeredDocumentIds: ReadonlySet<string> = new Set(),
): CatalogDiagnostic[] {
  entries = Array.isArray(entries) ? entries : [];
  const diagnostics: CatalogDiagnostic[] = [
    ...validateSeason2WclCatalogSource(season2WclCatalogSource, entries),
  ];
  const ids = new Set<string>();
  const sourceKeys = new Set<string>();
  const wclEncounterIds = new Set<number>();

  if (entries.length !== 8) {
    diagnostics.push({
      code: 'CATALOG_COUNT',
      path: '$',
      message: `Midnight S2 覆盖路线应登记 8 个副本，当前为 ${entries.length} 个。`,
    });
  }

  entries.forEach((entry, index) => {
    if (ids.has(entry.id)) {
      diagnostics.push({
        code: 'CATALOG_DUPLICATE_ID',
        path: `$[${index}].id`,
        message: `重复的副本 ID：${entry.id}`,
      });
    }
    ids.add(entry.id);
    if (sourceKeys.has(entry.sourceKey)) {
      diagnostics.push({
        code: 'CATALOG_DUPLICATE_SOURCE_KEY',
        path: `$[${index}].sourceKey`,
        message: `重复的副本 source key：${entry.sourceKey}`,
      });
    }
    sourceKeys.add(entry.sourceKey);
    const encounterFields = [
      ['wclEncounterId', entry.wclEncounterId, 'CATALOG_WCL_ENCOUNTER_REQUIRED'],
      ['wclPtrEncounterId', entry.wclPtrEncounterId, 'CATALOG_WCL_PTR_ENCOUNTER_REQUIRED'],
    ] as const;
    encounterFields.forEach(([field, encounterId, requiredCode]) => {
      if (typeof encounterId !== 'number' || !Number.isInteger(encounterId) || encounterId <= 0) {
        diagnostics.push({
          code: requiredCode,
          path: `$[${index}].${field}`,
          message: `S2 条目必须绑定正整数 WCL encounter ID：${entry.id}`,
        });
      } else if (wclEncounterIds.has(encounterId)) {
        diagnostics.push({
          code: 'CATALOG_WCL_ENCOUNTER_DUPLICATE',
          path: `$[${index}].${field}`,
          message: `重复的 WCL encounter ID：${encounterId}`,
        });
      } else {
        wclEncounterIds.add(encounterId);
      }
    });
    if (entry.wclZoneId !== season2WclCatalogSource.zoneId) {
      diagnostics.push({
        code: 'CATALOG_WCL_ZONE_INVALID',
        path: `$[${index}].wclZoneId`,
        message: `S2 条目的 WCL zone ID 必须为 ${season2WclCatalogSource.zoneId}。`,
      });
    }
    if (entry.wclPtrZoneId !== season2WclCatalogSource.ptrZoneId) {
      diagnostics.push({
        code: 'CATALOG_WCL_PTR_ZONE_INVALID',
        path: `$[${index}].wclPtrZoneId`,
        message: `S2 条目的 PTR WCL zone ID 必须为 ${season2WclCatalogSource.ptrZoneId}。`,
      });
    }
    if (!Number.isFinite(Date.parse(entry.updatedAt))) {
      diagnostics.push({
        code: 'CATALOG_UPDATED_AT_INVALID',
        path: `$[${index}].updatedAt`,
        message: `目录条目的 updatedAt 必须是可解析日期：${entry.updatedAt}`,
      });
    }
    if (
      legacyThreechestCoordinateInventory.some((legacy) => legacy.sourceKey === entry.sourceKey)
    ) {
      diagnostics.push({
        code: 'CATALOG_LEGACY_SOURCE_KEY_REUSED',
        path: `$[${index}].sourceKey`,
        message: `S2 条目不能复用 legacy Threechest source key：${entry.sourceKey}`,
      });
    }
    if (entry.coordinateSourceId && !entry.coordinateSnapshotId) {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_PROVENANCE',
        path: `$[${index}]`,
        message: '坐标来源 ID 不能脱离 coordinate snapshot 单独存在。',
      });
    }
    if (entry.coordinateSnapshotKey && !entry.coordinateSnapshotId) {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_PROVENANCE',
        path: `$[${index}].coordinateSnapshotKey`,
        message: '坐标快照解析 key 不能脱离 coordinate snapshot 单独存在。',
      });
    }
    if (entry.coordinateIdentityRegistryKey && !entry.coordinateSnapshotId) {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_PROVENANCE',
        path: `$[${index}].coordinateIdentityRegistryKey`,
        message: '坐标 identity registry key 不能脱离 coordinate snapshot 单独存在。',
      });
    }
    if (entry.coordinateSnapshotId && entry.coordinateSourceId !== 'threechest') {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_PROVENANCE',
        path: `$[${index}]`,
        message: '当前坐标快照只允许显式标记为 threechest 来源。',
      });
    }
    if (entry.status === 'coordinate-ready' && !entry.coordinateSnapshotId) {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_STATUS_INVALID',
        path: `$[${index}].status`,
        message: 'coordinate-ready 条目必须带有坐标快照。',
      });
    }
    if (entry.status === 'coordinate-ready' && !entry.coordinateIdentityRegistryKey) {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_IDENTITY_REQUIRED',
        path: `$[${index}].coordinateIdentityRegistryKey`,
        message:
          'coordinate-ready 条目必须绑定 committed identity registry，禁止生成临时 SpawnId。',
      });
    }
    if (
      ['raw-ready', 'route-ready', 'knowledge-draft'].includes(entry.status) &&
      !registeredDocumentIds.has(entry.id)
    ) {
      diagnostics.push({
        code: 'CATALOG_STATUS_WITHOUT_DOCUMENT',
        path: `$[${index}].status`,
        message: `${entry.status} 条目必须同时注册 DungeonDocument，避免目录状态脱离实际内容。`,
      });
    }
    if (isLearningPublished(entry.status) && !registeredDocumentIds.has(entry.id)) {
      diagnostics.push({
        code: 'CATALOG_PUBLISHED_WITHOUT_DOCUMENT',
        path: `$[${index}].status`,
        message: `目录条目 ${entry.id} 不能单独标记为可学习；published/reviewed 必须同时注册 DungeonDocument。`,
      });
    }
  });

  return diagnostics;
}
