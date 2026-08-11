import { useEffect, useMemo, useState } from 'react';

import type { CoordinateBounds, Floor, Spawn } from '../schema/types';
import {
  coordinateToMapPoint,
  getConvexHull,
  getMapViewBox,
  getMapTiles,
  pointsToSvgPath,
} from '../runtime/map';
import type { DungeonAssetResult } from '../runtime/assetsTypes';

interface Props {
  floor: Floor;
  spawns: Spawn[];
  selectedSpawnIds: string[];
  asset: DungeonAssetResult;
  onSpawnSelect?: (spawnId: string) => void;
  viewBounds?: CoordinateBounds;
  hullSpawns?: Spawn[];
}

export function DungeonMap({
  floor,
  spawns,
  selectedSpawnIds,
  asset,
  onSpawnSelect,
  viewBounds = floor.bounds,
  hullSpawns = spawns,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const viewBox = useMemo(() => getMapViewBox(viewBounds), [viewBounds]);
  const hullPath = useMemo(() => pointsToSvgPath(getConvexHull(hullSpawns)), [hullSpawns]);
  const patrolPaths = useMemo(
    () =>
      spawns.flatMap((spawn) => {
        const points = spawn.patrol?.points.map(coordinateToMapPoint) ?? [];
        if (points.length < 2) return [];
        return [
          {
            id: spawn.id,
            path: points
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
              .join(' '),
          },
        ];
      }),
    [spawns],
  );
  const selected = new Set(selectedSpawnIds);
  const assetIdentity =
    asset.kind === 'remote'
      ? asset.url
      : asset.kind === 'remote-tiles'
        ? asset.urlTemplate
        : asset.kind;
  const showRemoteImage = asset.kind === 'remote' && !imageFailed;
  const showRemoteTiles = asset.kind === 'remote-tiles' && !imageFailed;
  const tiles = useMemo(
    () => (asset.kind === 'remote-tiles' ? getMapTiles(viewBounds, asset) : []),
    [asset, viewBounds],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [assetIdentity]);

  return (
    <div className="dungeon-map" data-asset-kind={asset.kind}>
      <svg
        aria-label={`${floor.name.zhCN} 地图`}
        className="dungeon-map__svg"
        role="group"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      >
        <defs>
          <pattern id="dungeon-map-grid" height="10" patternUnits="userSpaceOnUse" width="10">
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="rgba(250,183,0,.12)"
              strokeWidth="0.35"
            />
          </pattern>
          <filter id="dungeon-map-glow">
            <feGaussianBlur result="blur" stdDeviation="1.2" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          fill="url(#dungeon-map-grid)"
          height={viewBox.height}
          width={viewBox.width}
          x={viewBox.x}
          y={viewBox.y}
        />
        {showRemoteImage && (
          <image
            href={asset.url}
            height={viewBox.height}
            onError={() => setImageFailed(true)}
            preserveAspectRatio="none"
            width={viewBox.width}
            x={viewBox.x}
            y={viewBox.y}
          />
        )}
        {showRemoteTiles &&
          tiles.map((tile) => (
            <image
              href={tile.url}
              height={tile.size}
              key={tile.key}
              onError={() => setImageFailed(true)}
              preserveAspectRatio="none"
              width={tile.size}
              x={tile.x}
              y={tile.y}
            />
          ))}
        {hullPath && <path className="dungeon-map__hull" d={hullPath} />}
        {patrolPaths.map((patrol) => (
          <path
            aria-label={`${patrol.id} 巡逻路径`}
            className="dungeon-map__patrol"
            d={patrol.path}
            key={patrol.id}
          />
        ))}
        {spawns.map((spawn) => {
          const point = coordinateToMapPoint(spawn.position);
          const isSelected = selected.has(spawn.id);
          return (
            <g
              aria-label={`${spawn.id} 位置`}
              aria-pressed={isSelected}
              className={`dungeon-map__spawn ${isSelected ? 'is-selected' : ''}`}
              key={spawn.id}
              onClick={() => onSpawnSelect?.(spawn.id)}
              role={onSpawnSelect ? 'button' : undefined}
              tabIndex={onSpawnSelect ? 0 : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSpawnSelect?.(spawn.id);
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r={isSelected ? 2.7 : 2} />
              <title>{spawn.id}</title>
            </g>
          );
        })}
      </svg>
      {!showRemoteImage && !showRemoteTiles && (
        <div className="dungeon-map__placeholder">
          <strong>{imageFailed ? '地图背景加载失败' : '地图背景未配置'}</strong>
          <span>
            {imageFailed
              ? '远程资源不可用，仍可使用坐标层。'
              : (asset.reason ?? '坐标层仍可用于理解位置。')}
          </span>
        </div>
      )}
      <div className="dungeon-map__legend">
        <span>
          <i className="dungeon-map__legend-dot" /> spawn
        </span>
        {patrolPaths.length > 0 && <span>— 巡逻路径</span>}
        <span>{spawns.length} 个位置</span>
      </div>
    </div>
  );
}
