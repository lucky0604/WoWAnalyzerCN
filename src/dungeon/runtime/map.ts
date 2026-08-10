import type { Coordinate, CoordinateBounds, Spawn } from '../schema/types';

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

export function getMapViewBox(bounds: CoordinateBounds, padding = 4): MapViewBox {
  return {
    x: bounds.xMin - padding,
    y: bounds.yMin - padding,
    width: bounds.xMax - bounds.xMin + padding * 2,
    height: bounds.yMax - bounds.yMin + padding * 2,
  };
}

export function coordinateToMapPoint(coordinate: Coordinate): MapPoint {
  return { x: coordinate[0], y: coordinate[1] };
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
