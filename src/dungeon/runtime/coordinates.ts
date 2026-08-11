import aa from '../data/coordinates/aa.json';
import cavns from '../data/coordinates/cavns.json';
import fangS2 from '../data/coordinates/fang.s2.json';
import fangS2Identity from '../data/coordinates/fang.s2.identity.json';
import krS2 from '../data/coordinates/kr.s2.json';
import krS2Identity from '../data/coordinates/kr.s2.identity.json';
import magi from '../data/coordinates/magi.json';
import murdS2 from '../data/coordinates/murd.s2.json';
import murdS2Identity from '../data/coordinates/murd.s2.identity.json';
import naloS2 from '../data/coordinates/nalo.s2.json';
import naloS2Identity from '../data/coordinates/nalo.s2.identity.json';
import pit from '../data/coordinates/pit.json';
import rlp from '../data/coordinates/rlp.json';
import rlpIdentity from '../data/coordinates/rlp.identity.json';
import seat from '../data/coordinates/seat.json';
import sky from '../data/coordinates/sky.json';
import tosS2 from '../data/coordinates/tos.s2.json';
import tosS2Identity from '../data/coordinates/tos.s2.identity.json';
import valeS2 from '../data/coordinates/vale.s2.json';
import valeS2Identity from '../data/coordinates/vale.s2.identity.json';
import voidS2 from '../data/coordinates/void.s2.json';
import voidS2Identity from '../data/coordinates/void.s2.identity.json';
import wind from '../data/coordinates/wind.json';
import xenas from '../data/coordinates/xenas.json';
import type { SpawnIdentityRegistry } from './reconcile';
import type { Floor, Spawn } from '../schema/types';
import { checkSourceUse, dungeonSourceRegistry } from './sourceRegistry';

export interface CoordinateReferenceEntry {
  id: string;
  sourceKey: string;
  name: { zhCN: string; enUS?: string };
  mapAssetKey: string;
  coordinateSnapshotId?: string;
  coordinateSourceId?: 'threechest';
  coordinateSnapshotKey?: string;
  coordinateIdentityRegistryKey?: string;
  /** Legacy snapshots without a sidecar must opt into ephemeral IDs explicitly. */
  allowEphemeralIdentity?: boolean;
}

export interface CoordinateSnapshotSpawn {
  sourceId: string;
  sourceEnemyId: number;
  sourceEnemyIndex: number;
  floorId: 'default';
  position: [number, number];
  groupId?: string;
  patrol?: Array<[number, number]>;
}

export interface CoordinateSnapshot {
  source: 'threechest';
  snapshotId: string;
  retrievedAt: string;
  rawSha256: string;
  transformVersion: 'threechest-yx-to-normalized-v1';
  dungeonKey: string;
  dungeonIndex: number;
  sourceCoordinateSpace: 'threechest-yx';
  normalizedCoordinateSpace: 'normalized-v1';
  spawns: CoordinateSnapshotSpawn[];
}

const coordinateSnapshotTopLevelFields = new Set([
  'source',
  'snapshotId',
  'retrievedAt',
  'rawSha256',
  'transformVersion',
  'dungeonKey',
  'dungeonIndex',
  'sourceCoordinateSpace',
  'normalizedCoordinateSpace',
  'spawns',
]);

/** Stable JSON representation used by the release gate for normalized data. */
export function serializeCoordinateData(value: unknown): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, sortKeys(child)]),
      );
    }
    return value;
  };
  return JSON.stringify(sortKeys(value));
}

export function serializeCoordinateSnapshot(snapshot: CoordinateSnapshot): string {
  const payload = Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== 'rawSha256'),
  );
  return serializeCoordinateData(payload);
}

export function coordinateSnapshotUsesAllowedFields(
  snapshot: CoordinateSnapshot,
  allowedSpawnFields: readonly string[],
): boolean {
  const topLevelKeys = Object.keys(snapshot);
  if (topLevelKeys.some((key) => !coordinateSnapshotTopLevelFields.has(key))) return false;
  const allowed = new Set(allowedSpawnFields);
  return snapshot.spawns.every((spawn) => Object.keys(spawn).every((key) => allowed.has(key)));
}

const coordinateDefinitions: Array<{
  key: string;
  snapshot: CoordinateSnapshot;
  identity?: SpawnIdentityRegistry;
}> = [
  { key: 'aa', snapshot: aa as CoordinateSnapshot },
  { key: 'cavns', snapshot: cavns as CoordinateSnapshot },
  {
    key: 's2-fang',
    snapshot: fangS2 as CoordinateSnapshot,
    identity: fangS2Identity as SpawnIdentityRegistry,
  },
  {
    key: 's2-kr',
    snapshot: krS2 as CoordinateSnapshot,
    identity: krS2Identity as SpawnIdentityRegistry,
  },
  { key: 'magi', snapshot: magi as CoordinateSnapshot },
  {
    key: 's2-murd',
    snapshot: murdS2 as CoordinateSnapshot,
    identity: murdS2Identity as SpawnIdentityRegistry,
  },
  {
    key: 's2-nalo',
    snapshot: naloS2 as CoordinateSnapshot,
    identity: naloS2Identity as SpawnIdentityRegistry,
  },
  { key: 'pit', snapshot: pit as CoordinateSnapshot },
  {
    key: 'rlp',
    snapshot: rlp as CoordinateSnapshot,
    identity: rlpIdentity as SpawnIdentityRegistry,
  },
  { key: 'seat', snapshot: seat as CoordinateSnapshot },
  { key: 'sky', snapshot: sky as CoordinateSnapshot },
  {
    key: 's2-tos',
    snapshot: tosS2 as CoordinateSnapshot,
    identity: tosS2Identity as SpawnIdentityRegistry,
  },
  {
    key: 's2-vale',
    snapshot: valeS2 as CoordinateSnapshot,
    identity: valeS2Identity as SpawnIdentityRegistry,
  },
  {
    key: 's2-void',
    snapshot: voidS2 as CoordinateSnapshot,
    identity: voidS2Identity as SpawnIdentityRegistry,
  },
  { key: 'wind', snapshot: wind as CoordinateSnapshot },
  { key: 'xenas', snapshot: xenas as CoordinateSnapshot },
];

const snapshots = Object.fromEntries(
  coordinateDefinitions.map(({ key, snapshot }) => [key, snapshot]),
) as Record<string, CoordinateSnapshot>;
const identityRegistries = Object.fromEntries(
  coordinateDefinitions
    .filter((definition) => definition.identity)
    .map(({ key, identity }) => [key, identity]),
) as Record<string, SpawnIdentityRegistry>;

export function getCoordinateSnapshot(sourceKey: string): CoordinateSnapshot | undefined {
  return snapshots[sourceKey];
}

export function getCoordinateIdentityRegistry(key: string): SpawnIdentityRegistry | undefined {
  return identityRegistries[key];
}

function boundsForSnapshot(snapshot: CoordinateSnapshot): Floor['bounds'] {
  const coordinates = snapshot.spawns.map((spawn) => spawn.position);
  if (coordinates.length === 0) {
    return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
  }
  const xValues = coordinates.map(([x]) => x);
  const yValues = coordinates.map(([, y]) => y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  return {
    xMin,
    xMax: xMax === xMin ? xMax + 1 : xMax,
    yMin,
    yMax: yMax === yMin ? yMax + 1 : yMax,
  };
}

export interface CoordinateReference {
  snapshot: CoordinateSnapshot;
  floor: Floor;
  spawns: Spawn[];
}

/**
 * Validate the committed source→stable identity sidecar before it is used to
 * construct Spawn objects. This deliberately rejects duplicate source IDs as
 * well as duplicate stable IDs; a Map alone would silently overwrite a row.
 */
export function validateCoordinateIdentityRegistry(
  snapshot: CoordinateSnapshot,
  identityRegistry: SpawnIdentityRegistry,
): boolean {
  if (
    identityRegistry.version !== 1 ||
    !Array.isArray(identityRegistry.entries) ||
    identityRegistry.entries.length !== snapshot.spawns.length
  ) {
    return false;
  }
  const sourceIds = new Set(identityRegistry.entries.map((identity) => identity.sourceId));
  const stableIds = new Set(identityRegistry.entries.map((identity) => identity.stableId));
  if (
    sourceIds.size !== identityRegistry.entries.length ||
    stableIds.size !== identityRegistry.entries.length
  ) {
    return false;
  }
  if (sourceIds.size !== snapshot.spawns.length) {
    return false;
  }
  return snapshot.spawns.every((spawn) => {
    const identity = identityRegistry.entries.find(
      (candidate) => candidate.sourceId === spawn.sourceId,
    );
    return (
      identity?.enemyId === `${snapshot.dungeonKey}:source-enemy:${spawn.sourceEnemyId}` &&
      identity.floorId === `${snapshot.dungeonKey}:${spawn.floorId}`
    );
  });
}

export function getCoordinateReference(
  entry: CoordinateReferenceEntry,
): CoordinateReference | undefined {
  if (!entry.coordinateSnapshotId) {
    return undefined;
  }
  const snapshot = getCoordinateSnapshot(entry.coordinateSnapshotKey ?? entry.sourceKey);
  if (!snapshot || snapshot.snapshotId !== entry.coordinateSnapshotId) {
    return undefined;
  }
  const sourceCheck = checkSourceUse(
    dungeonSourceRegistry,
    entry.coordinateSourceId ?? 'threechest',
    snapshot.snapshotId,
    'local-research',
  );
  if (!sourceCheck.ok) {
    return undefined;
  }
  const identityRegistry = entry.coordinateIdentityRegistryKey
    ? identityRegistries[entry.coordinateIdentityRegistryKey]
    : undefined;
  if (!identityRegistry && !entry.allowEphemeralIdentity) {
    return undefined;
  }
  if (identityRegistry && !validateCoordinateIdentityRegistry(snapshot, identityRegistry)) {
    return undefined;
  }
  const identityBySource = identityRegistry
    ? new Map(identityRegistry.entries.map((identity) => [identity.sourceId, identity]))
    : undefined;
  const floorId = `${entry.id}:default`;
  const floor: Floor = {
    id: floorId,
    name: {
      zhCN: `${entry.name.zhCN} · 位置参考`,
      enUS: `${entry.name.enUS ?? entry.name.zhCN} · Reference`,
    },
    coordinateSpace: 'normalized-v1',
    bounds: boundsForSnapshot(snapshot),
    mapAssetKey: entry.mapAssetKey,
  };
  const spawns: Spawn[] = snapshot.spawns.map((spawn) => ({
    id: identityBySource?.get(spawn.sourceId)?.stableId ?? `${entry.id}:${spawn.sourceId}`,
    enemyId: `${entry.id}:source-enemy:${spawn.sourceEnemyId}`,
    floorId,
    position: spawn.position,
    sourceId: spawn.sourceId,
    ...(spawn.groupId ? { groupId: spawn.groupId } : {}),
    ...(spawn.patrol ? { patrol: { points: spawn.patrol } } : {}),
  }));
  return { snapshot, floor, spawns };
}
