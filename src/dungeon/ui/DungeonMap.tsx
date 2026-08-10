import { useEffect, useMemo, useState } from 'react';

import type { Floor, Spawn } from '../schema/types';
import {
  coordinateToMapPoint,
  getConvexHull,
  getMapViewBox,
  pointsToSvgPath,
} from '../runtime/map';
import type { DungeonAssetResult } from '../runtime/assetsTypes';

interface Props {
  floor: Floor;
  spawns: Spawn[];
  selectedSpawnIds: string[];
  asset: DungeonAssetResult;
  onSpawnSelect?: (spawnId: string) => void;
}

export function DungeonMap({ floor, spawns, selectedSpawnIds, asset, onSpawnSelect }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const viewBox = useMemo(() => getMapViewBox(floor.bounds), [floor.bounds]);
  const hullPath = useMemo(() => pointsToSvgPath(getConvexHull(spawns)), [spawns]);
  const selected = new Set(selectedSpawnIds);
  const showRemoteImage = asset.kind === 'remote' && !!asset.url && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [asset.url]);

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
        {showRemoteImage && asset.url && (
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
        {hullPath && <path className="dungeon-map__hull" d={hullPath} />}
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
      {!showRemoteImage && (
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
        <span>{spawns.length} 个位置</span>
      </div>
    </div>
  );
}
