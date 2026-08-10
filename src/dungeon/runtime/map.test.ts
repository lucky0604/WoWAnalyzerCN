import { describe, expect, it } from 'vitest';

import type { Spawn } from '../schema/types';
import { coordinateToMapPoint, getConvexHull, getMapViewBox, pointsToSvgPath } from './map';

const spawn = (id: string, position: [number, number]): Spawn => ({
  id,
  enemyId: 'enemy',
  floorId: 'floor',
  position,
  sourceId: id,
});

describe('map coordinate utilities', () => {
  it('creates a padded viewBox without changing coordinate direction', () => {
    expect(getMapViewBox({ xMin: 0, xMax: 100, yMin: 10, yMax: 80 }, 5)).toEqual({
      x: -5,
      y: 5,
      width: 110,
      height: 80,
    });
    expect(coordinateToMapPoint([20, 30])).toEqual({ x: 20, y: 30 });
  });

  it('computes a stable convex hull for pull highlighting', () => {
    const hull = getConvexHull([
      spawn('a', [0, 0]),
      spawn('b', [10, 0]),
      spawn('c', [10, 10]),
      spawn('d', [0, 10]),
      spawn('inside', [5, 5]),
    ]);
    expect(hull).toHaveLength(4);
    expect(pointsToSvgPath(hull)).toMatch(/^M /);
    expect(pointsToSvgPath([])).toBe('');
    expect(pointsToSvgPath([{ x: 1, y: 2 }])).toBe('M 1 2');
  });
});
