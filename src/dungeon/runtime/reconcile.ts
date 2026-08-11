import type { Coordinate, EnemyId, FloorId, SpawnId } from '../schema/types';

export interface IncomingSpawn {
  sourceId: string;
  enemyId: EnemyId;
  floorId: FloorId;
  position: Coordinate;
  groupId?: string;
}

export interface IdentityEntry {
  stableId: SpawnId;
  sourceId: string;
  enemyId: EnemyId;
  floorId: FloorId;
  aliases?: string[];
}

export interface SpawnIdentityRegistry {
  version: 1;
  entries: IdentityEntry[];
}

export type ReconciliationKind =
  | 'exact'
  | 'alias'
  | 'auto-match'
  | 'ambiguous'
  | 'drift'
  | 'new'
  | 'removed';

export interface ReconciliationItem {
  kind: ReconciliationKind;
  stableId?: SpawnId;
  sourceId: string;
  candidates?: SpawnId[];
  reason?: string;
}

export interface ReconciliationResult {
  items: ReconciliationItem[];
  nextRegistry: SpawnIdentityRegistry;
  blocked: boolean;
}

const distanceSquared = (a: Coordinate, b: Coordinate) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** Moves larger than this normalized-map distance require human review. */
export const SPAWN_DRIFT_DISTANCE_THRESHOLD = 15;

const identityKey = (spawn: Pick<IncomingSpawn, 'enemyId' | 'floorId'>) =>
  `${spawn.enemyId}|${spawn.floorId}`;

const factsMatch = (entry: IdentityEntry, spawn: IncomingSpawn) =>
  entry.enemyId === spawn.enemyId && entry.floorId === spawn.floorId;

export function reconcileSpawns(
  previous: IdentityEntry[],
  incoming: IncomingSpawn[],
  previousCoordinates: Record<SpawnId, Coordinate> = {},
): ReconciliationResult {
  const items: ReconciliationItem[] = [];
  const usedStableIds = new Set<SpawnId>();
  const nextEntries: IdentityEntry[] = [];
  const previousBySource = new Map(previous.map((entry) => [entry.sourceId, entry]));
  const previousByAlias = new Map<string, IdentityEntry>();
  let nextStableIndex =
    Math.max(
      0,
      ...previous.flatMap((entry) => {
        const match = entry.stableId.match(/^spawn-(\d+)$/);
        return match ? [Number(match[1])] : [];
      }),
    ) + 1;

  previous.forEach((entry) => entry.aliases?.forEach((alias) => previousByAlias.set(alias, entry)));

  for (const spawn of incoming) {
    const exact = previousBySource.get(spawn.sourceId);
    if (exact && !usedStableIds.has(exact.stableId)) {
      if (!factsMatch(exact, spawn)) {
        items.push({
          kind: 'drift',
          stableId: exact.stableId,
          sourceId: spawn.sourceId,
          reason: '来源 ID 对应的 enemy/floor 事实发生变化，必须人工确认。',
        });
        continue;
      }
      const previousCoordinate = previousCoordinates[exact.stableId];
      if (
        previousCoordinate &&
        distanceSquared(previousCoordinate, spawn.position) > SPAWN_DRIFT_DISTANCE_THRESHOLD ** 2
      ) {
        items.push({
          kind: 'drift',
          stableId: exact.stableId,
          sourceId: spawn.sourceId,
          reason: '来源 ID 的位置发生显著变化，必须人工确认。',
        });
        continue;
      }
      usedStableIds.add(exact.stableId);
      nextEntries.push({ ...exact, enemyId: spawn.enemyId, floorId: spawn.floorId });
      items.push({ kind: 'exact', stableId: exact.stableId, sourceId: spawn.sourceId });
      continue;
    }

    const alias = previousByAlias.get(spawn.sourceId);
    if (alias && !usedStableIds.has(alias.stableId)) {
      if (!factsMatch(alias, spawn)) {
        items.push({
          kind: 'drift',
          stableId: alias.stableId,
          sourceId: spawn.sourceId,
          reason: 'alias 对应的 enemy/floor 事实发生变化，必须人工确认。',
        });
        continue;
      }
      const previousCoordinate = previousCoordinates[alias.stableId];
      if (
        previousCoordinate &&
        distanceSquared(previousCoordinate, spawn.position) > SPAWN_DRIFT_DISTANCE_THRESHOLD ** 2
      ) {
        items.push({
          kind: 'drift',
          stableId: alias.stableId,
          sourceId: spawn.sourceId,
          reason: 'alias 对应的位置发生显著变化，必须人工确认。',
        });
        continue;
      }
      usedStableIds.add(alias.stableId);
      nextEntries.push({
        ...alias,
        sourceId: spawn.sourceId,
        enemyId: spawn.enemyId,
        floorId: spawn.floorId,
      });
      items.push({ kind: 'alias', stableId: alias.stableId, sourceId: spawn.sourceId });
      continue;
    }

    const candidates = previous.filter(
      (entry) =>
        !usedStableIds.has(entry.stableId) &&
        identityKey(entry) === identityKey(spawn) &&
        previousCoordinates[entry.stableId] !== undefined,
    );
    const sortedCandidates = candidates
      .map((entry) => ({
        entry,
        distance: distanceSquared(previousCoordinates[entry.stableId]!, spawn.position),
      }))
      .sort((a, b) => a.distance - b.distance);
    const nearest = sortedCandidates[0];
    const second = sortedCandidates[1];

    if (nearest && (!second || nearest.distance < second.distance * 0.25)) {
      if (nearest.distance > SPAWN_DRIFT_DISTANCE_THRESHOLD ** 2) {
        items.push({
          kind: 'drift',
          stableId: nearest.entry.stableId,
          sourceId: spawn.sourceId,
          reason: '自动匹配候选的位置发生显著变化，必须人工确认。',
        });
        continue;
      }
      usedStableIds.add(nearest.entry.stableId);
      nextEntries.push({
        ...nearest.entry,
        sourceId: spawn.sourceId,
        enemyId: spawn.enemyId,
        floorId: spawn.floorId,
      });
      items.push({
        kind: 'auto-match',
        stableId: nearest.entry.stableId,
        sourceId: spawn.sourceId,
      });
      continue;
    }
    if (nearest && second) {
      items.push({
        kind: 'ambiguous',
        sourceId: spawn.sourceId,
        candidates: sortedCandidates.map(({ entry }) => entry.stableId),
        reason: '多个候选位置距离过近，必须人工确认。',
      });
      continue;
    }

    const stableId = `spawn-${nextStableIndex++}`;
    usedStableIds.add(stableId);
    nextEntries.push({
      stableId,
      sourceId: spawn.sourceId,
      enemyId: spawn.enemyId,
      floorId: spawn.floorId,
    });
    items.push({ kind: 'new', stableId, sourceId: spawn.sourceId });
  }

  previous.forEach((entry) => {
    if (!usedStableIds.has(entry.stableId)) {
      items.push({ kind: 'removed', stableId: entry.stableId, sourceId: entry.sourceId });
    }
  });

  return {
    items,
    nextRegistry: { version: 1, entries: nextEntries },
    blocked: items.some((item) => item.kind === 'ambiguous' || item.kind === 'drift'),
  };
}
