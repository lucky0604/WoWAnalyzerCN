import { describe, expect, it } from 'vitest';

import type { Spawn } from '../schema/types';
import {
  coordinateToMapPoint,
  getConvexHull,
  getMapTiles,
  getMapViewBox,
  getSpawnBounds,
  pointsToSvgPath,
} from './map';

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

  it('resolves a top-left tile grid for Threechest-like negative Y coordinates', () => {
    const tiles = getMapTiles(
      { xMin: 0, xMax: 128, yMin: -128, yMax: 0 },
      {
        kind: 'remote-tiles',
        assetKey: 'map',
        urlTemplate: 'https://example.test/maps/magi/{x}_{y}.jpg',
        tileSize: 64,
        origin: [0, 0],
      },
    );
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toMatchObject({
      key: '0:0',
      url: 'https://example.test/maps/magi/0_0.jpg',
      x: 0,
      y: -64,
      size: 64,
    });
    expect(tiles[3]).toMatchObject({
      key: '1:1',
      url: 'https://example.test/maps/magi/1_1.jpg',
      x: 64,
      y: -128,
    });
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

  it('creates a padded focus window and falls back for an empty pull', () => {
    const fallback = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    expect(getSpawnBounds([spawn('focus', [20, 30])], fallback)).toEqual({
      xMin: 16,
      xMax: 24,
      yMin: 26,
      yMax: 34,
    });
    expect(getSpawnBounds([], fallback)).toBe(fallback);
  });
});
