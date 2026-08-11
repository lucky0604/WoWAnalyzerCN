import type { LocalizedText } from '../schema/types';

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
  wclEncounterId?: number;
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

const catalogSummary = (name: string): LocalizedText =>
  text(
    `${name} 已登记为 Midnight S2 副本；技能、波次和位置参考仍在建设中。`,
    `${name} is registered for Midnight S2; skills, pulls, and spatial references are still being built.`,
  );

const catalogMilestone = text(
  '先接入可核验的位置/地图来源，再补齐 Situation、技能动作和学习路线。',
  'Connect a verifiable map source, then author Situations, ability actions, and a learning route.',
);

const catalogUpdatedAt = '2026-08-10';

/** The eight dungeons in the current Midnight Season 2 Mythic+ rotation. */
export const season2DungeonCatalog: readonly DungeonCatalogEntry[] = [
  {
    id: 'altar-of-fangs',
    slug: 'altar-of-fangs',
    sourceKey: 'altar-of-fangs',
    name: text('尖牙祭坛', 'Altar of Fangs'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:altar-of-fangs',
    summary: catalogSummary('尖牙祭坛'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'murder-row',
    slug: 'murder-row',
    sourceKey: 'murder-row',
    name: text('谋杀街', 'Murder Row'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:murder-row',
    summary: catalogSummary('谋杀街'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'den-of-nalorakk',
    slug: 'den-of-nalorakk',
    sourceKey: 'den-of-nalorakk',
    name: text('纳洛拉克巢穴', 'Den of Nalorakk'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:den-of-nalorakk',
    summary: catalogSummary('纳洛拉克巢穴'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'the-blinding-vale',
    slug: 'the-blinding-vale',
    sourceKey: 'the-blinding-vale',
    name: text('盲谷', 'The Blinding Vale'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:the-blinding-vale',
    summary: catalogSummary('盲谷'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'voidscar-arena',
    slug: 'voidscar-arena',
    sourceKey: 'voidscar-arena',
    name: text('虚空裂痕竞技场', 'Voidscar Arena'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:voidscar-arena',
    summary: catalogSummary('虚空裂痕竞技场'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'ruby-life-pools',
    slug: 'ruby-life-pools',
    sourceKey: 'ruby-life-pools',
    name: text('红玉新生法池', 'Ruby Life Pools'),
    season: 'midnight-s2',
    status: 'coordinate-ready',
    updatedAt: catalogUpdatedAt,
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
    coordinateSourceId: 'threechest',
    coordinateSnapshotKey: 'rlp',
    coordinateIdentityRegistryKey: 'rlp',
    mapAssetKey: 'midnight-s2:ruby-life-pools',
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
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:kings-rest',
    summary: catalogSummary('诸王之眠'),
    nextMilestone: catalogMilestone,
  },
  {
    id: 'temple-of-sethraliss',
    slug: 'temple-of-sethraliss',
    sourceKey: 'temple-of-sethraliss',
    name: text('塞塔里斯神庙', 'Temple of Sethraliss'),
    season: 'midnight-s2',
    status: 'registered',
    updatedAt: catalogUpdatedAt,
    mapAssetKey: 'midnight-s2:temple-of-sethraliss',
    summary: catalogSummary('塞塔里斯神庙'),
    nextMilestone: catalogMilestone,
  },
];

export const legacyThreechestCoordinateInventory: readonly ThreechestCoordinateInventoryEntry[] = [
  {
    id: 'algethar-academy',
    slug: 'algethar-academy',
    sourceKey: 'aa',
    name: text('艾杰斯亚学院', "Algeth'ar Academy"),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:aa',
  },
  {
    id: 'magisters-terrace',
    slug: 'magisters-terrace',
    sourceKey: 'magi',
    name: text('魔导师平台', "Magisters' Terrace"),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:magi',
  },
  {
    id: 'maisara-caverns',
    slug: 'maisara-caverns',
    sourceKey: 'cavns',
    name: text('迈萨拉洞窟', 'Maisara Caverns'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:cavns',
  },
  {
    id: 'nexuspoint-xenas',
    slug: 'nexuspoint-xenas',
    sourceKey: 'xenas',
    name: text('节点希纳斯', 'Nexus-Point Xenas'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:xenas',
  },
  {
    id: 'windrunner-spire',
    slug: 'windrunner-spire',
    sourceKey: 'wind',
    name: text('风行者之塔', 'Windrunner Spire'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:wind',
  },
  {
    id: 'pit-of-saron',
    slug: 'pit-of-saron',
    sourceKey: 'pit',
    name: text('萨隆矿坑', 'Pit of Saron'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:pit',
  },
  {
    id: 'seat-of-the-triumvirate',
    slug: 'seat-of-the-triumvirate',
    sourceKey: 'seat',
    name: text('执政团之座', 'Seat of the Triumvirate'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'legacy-threechest:seat',
  },
  {
    id: 'skyreach',
    slug: 'skyreach',
    sourceKey: 'sky',
    name: text('通天峰', 'Skyreach'),
    coordinateSnapshotId: 'threechest-coordinate-snapshot-2026-08-10',
    coordinateSourceId: 'threechest',
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

export function validateSeason2DungeonCatalog(
  entries: readonly DungeonCatalogEntry[] = season2DungeonCatalog,
  registeredDocumentIds: ReadonlySet<string> = new Set(),
): CatalogDiagnostic[] {
  const diagnostics: CatalogDiagnostic[] = [];
  const ids = new Set<string>();
  const sourceKeys = new Set<string>();

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
