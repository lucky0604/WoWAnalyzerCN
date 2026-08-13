import type { Coordinate, CoordinateBounds, Spawn } from '../schema/types';
import type { DungeonRemoteTilesAsset } from './assetsTypes';

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapTile {
  key: string;
  url: string;
  x: number;
  y: number;
  size: number;
}

export function getMapViewBox(bounds: CoordinateBounds, padding = 4): MapViewBox {
  return {
    x: bounds.xMin - padding,
    y: bounds.yMin - padding,
    width: bounds.xMax - bounds.xMin + padding * 2,
    height: bounds.yMax - bounds.yMin + padding * 2,
  };
}

/** Return a padded bounds around a pull without changing normalized coordinates. */
export function getSpawnBounds(spawns: Spawn[], fallback: CoordinateBounds): CoordinateBounds {
  if (spawns.length === 0) return fallback;
  const xValues = spawns.map((spawn) => spawn.position[0]);
  const yValues = spawns.map((spawn) => spawn.position[1]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xPadding = Math.max(4, (xMax - xMin) * 0.25);
  const yPadding = Math.max(4, (yMax - yMin) * 0.25);
  return {
    xMin: xMin - xPadding,
    xMax: xMax + xPadding,
    yMin: yMin - yPadding,
    yMax: yMax + yPadding,
  };
}

export function coordinateToMapPoint(coordinate: Coordinate): MapPoint {
  return { x: coordinate[0], y: coordinate[1] };
}

export function getMapTiles(bounds: CoordinateBounds, asset: DungeonRemoteTilesAsset): MapTile[] {
  const [originX, originY] = asset.origin;
  const epsilon = 1e-9;
  // flipY:调用方已把 bounds 翻转到屏幕空间(北/行 0 在上,y' 从顶部向下递增)。
  // 源瓦片行号与屏幕行一致,故行号随 y' 递增、位置从上往下排;非 flip(归一化负 y)则相反。
  const flipY = asset.flipY === true;
  const minTileX = Math.floor((bounds.xMin - originX) / asset.tileSize);
  const maxTileX = Math.floor((bounds.xMax - epsilon - originX) / asset.tileSize);
  const minTileY = flipY
    ? Math.floor((bounds.yMin - originY) / asset.tileSize)
    : Math.floor((originY - bounds.yMax + epsilon) / asset.tileSize);
  const maxTileY = flipY
    ? Math.floor((bounds.yMax - epsilon - originY) / asset.tileSize)
    : Math.floor((originY - bounds.yMin - epsilon) / asset.tileSize);
  const tiles: MapTile[] = [];
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const x = originX + tileX * asset.tileSize;
      const y = flipY
        ? originY + tileY * asset.tileSize
        : originY - (tileY + 1) * asset.tileSize;
      tiles.push({
        key: `${tileX}:${tileY}`,
        url: asset.urlTemplate.replace('{x}', String(tileX)).replace('{y}', String(tileY)),
        x,
        y,
        size: asset.tileSize,
      });
    }
  }
  return tiles;
}

function cross(origin: MapPoint, a: MapPoint, b: MapPoint): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

export function getConvexHull(spawns: Spawn[]): MapPoint[] {
  const points = spawns
    .map((spawn) => coordinateToMapPoint(spawn.position))
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter(
      (point, index, all) =>
        index === 0 || point.x !== all[index - 1]!.x || point.y !== all[index - 1]!.y,
    );
  if (points.length <= 2) return points;

  const lower: MapPoint[] = [];
  points.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper: MapPoint[] = [];
  [...points].reverse().forEach((point) => {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function pointsToSvgPath(points: MapPoint[]): string {
  if (points.length === 0) return '';
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  return points.length >= 3 ? `${path} Z` : path;
}
