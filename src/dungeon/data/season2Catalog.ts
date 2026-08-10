import type { LocalizedText } from '../schema/types';

export type DungeonCoverageStatus = 'building' | 'coordinate-ready' | 'reviewed' | 'published';

export interface DungeonCatalogEntry {
  id: string;
  slug: string;
  sourceKey: string;
  name: LocalizedText;
  season: 'midnight-s2';
  status: DungeonCoverageStatus;
  coordinateSnapshotId: string;
  coordinateSourceId: 'threechest';
  mapAssetKey: string;
  wclEncounterId?: number;
  summary: LocalizedText;
  nextMilestone: LocalizedText;
}

const text = (zhCN: string, enUS: string): LocalizedText => ({ zhCN, enUS });

/**
 * Coverage metadata is deliberately separate from DungeonDocument. An entry in this
 * catalog is not an invitation to browse an empty route: it only records what has
 * actually entered the local data pipeline and what still needs content review.
 */
export const season2DungeonCatalog: readonly DungeonCatalogEntry[] = [
  {
    id: 'algethar-academy',
    slug: 'algethar-academy',
    sourceKey: 'aa',
    name: text('艾杰斯亚学院', "Algeth'ar Academy"),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:aa',
    wclEncounterId: 112526,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'magisters-terrace',
    slug: 'magisters-terrace',
    sourceKey: 'magi',
    name: text('魔导师平台', "Magisters' Terrace"),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:magi',
    wclEncounterId: 12811,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'maisara-caverns',
    slug: 'maisara-caverns',
    sourceKey: 'cavns',
    name: text('迈萨拉洞窟', 'Maisara Caverns'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:cavns',
    wclEncounterId: 12874,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'nexuspoint-xenas',
    slug: 'nexuspoint-xenas',
    sourceKey: 'xenas',
    name: text('节点希纳斯', 'Nexus-Point Xenas'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:xenas',
    wclEncounterId: 12915,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'windrunner-spire',
    slug: 'windrunner-spire',
    sourceKey: 'wind',
    name: text('风行者之塔', 'Windrunner Spire'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:wind',
    wclEncounterId: 12805,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'pit-of-saron',
    slug: 'pit-of-saron',
    sourceKey: 'pit',
    name: text('萨隆矿坑', 'Pit of Saron'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:pit',
    wclEncounterId: 10658,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'seat-of-the-triumvirate',
    slug: 'seat-of-the-triumvirate',
    sourceKey: 'seat',
    name: text('执政团之座', 'Seat of the Triumvirate'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:seat',
    wclEncounterId: 361753,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
  },
  {
    id: 'skyreach',
    slug: 'skyreach',
    sourceKey: 'sky',
    name: text('通天峰', 'Skyreach'),
    season: 'midnight-s2',
    status: 'building',
    coordinateSnapshotId: 'local-coordinate-fixture-2026-08-10',
    coordinateSourceId: 'threechest',
    mapAssetKey: 'midnight-s2:sky',
    wclEncounterId: 61209,
    summary: text(
      '坐标与位置关系已进入本地导入链路，攻略知识尚未发布。',
      'Coordinates are in the local import pipeline; learning content is not published.',
    ),
    nextMilestone: text(
      '补齐稳定 Situation、技能动作和学习路线。',
      'Author reviewed Situations, ability actions, and a learning route.',
    ),
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
        message: `重复的 Threechest source key：${entry.sourceKey}`,
      });
    }
    sourceKeys.add(entry.sourceKey);
    if (!entry.coordinateSnapshotId || entry.coordinateSourceId !== 'threechest') {
      diagnostics.push({
        code: 'CATALOG_COORDINATE_PROVENANCE',
        path: `$[${index}]`,
        message: '坐标就绪条目必须带有 approved source snapshot 和 threechest source ID。',
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
