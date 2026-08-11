import aa from '../data/coordinates/aa.json';
import cavns from '../data/coordinates/cavns.json';
import magi from '../data/coordinates/magi.json';
import pit from '../data/coordinates/pit.json';
import rlp from '../data/coordinates/rlp.json';
import seat from '../data/coordinates/seat.json';
import sky from '../data/coordinates/sky.json';
import wind from '../data/coordinates/wind.json';
import xenas from '../data/coordinates/xenas.json';
import type { Floor, Spawn } from '../schema/types';

export interface CoordinateReferenceEntry {
  id: string;
  sourceKey: string;
  name: { zhCN: string; enUS?: string };
  mapAssetKey: string;
  coordinateSnapshotId?: string;
  coordinateSnapshotKey?: string;
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

const snapshots: Record<string, CoordinateSnapshot> = {
  aa: aa as CoordinateSnapshot,
  cavns: cavns as CoordinateSnapshot,
  magi: magi as CoordinateSnapshot,
  pit: pit as CoordinateSnapshot,
  rlp: rlp as CoordinateSnapshot,
  seat: seat as CoordinateSnapshot,
  sky: sky as CoordinateSnapshot,
  wind: wind as CoordinateSnapshot,
  xenas: xenas as CoordinateSnapshot,
};

export function getCoordinateSnapshot(sourceKey: string): CoordinateSnapshot | undefined {
  return snapshots[sourceKey];
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
    id: `${entry.id}:${spawn.sourceId}`,
    enemyId: `${entry.id}:source-enemy:${spawn.sourceEnemyId}`,
    floorId,
    position: spawn.position,
    sourceId: spawn.sourceId,
    ...(spawn.groupId ? { groupId: spawn.groupId } : {}),
    ...(spawn.patrol ? { patrol: { points: spawn.patrol } } : {}),
  }));
  return { snapshot, floor, spawns };
}
