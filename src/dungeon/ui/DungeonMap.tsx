import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  RLP_SPELL_FACTS,
  dungeonSpellIconUrl,
  getEnemySpellIds,
  npcPortraitUrl,
} from '../data/rlpSpellReference';
import type { AbilityKnowledge, CoordinateBounds, Enemy, Floor, Spawn } from '../schema/types';
import type { MapPoint, MapViewBox } from '../runtime/map';
import {
  coordinateToMapPoint,
  getConvexHull,
  getMapViewBox,
  getMapTiles,
  pointsToSvgPath,
} from '../runtime/map';
import type { DungeonAssetResult } from '../runtime/assetsTypes';

/** 地图上怪物头像的基础边长（viewBox 坐标单位，对应 scale≈1 的小怪）。 */
const BASE_PORTRAIT_SIZE = 5.5;
/** Boss 额外放大倍数（threechest 同款语义：boss 图标比同体型普通怪更醒目）。 */
const BOSS_PORTRAIT_MULTIPLIER = 1.7;
/** 技能浮层的固定宽度（viewBox 坐标单位）。 */
const POPOVER_WIDTH = 168;
/** 浮层只作布局视口与锚点参考；卡片高度由内容自适应，短内容不留空。 */
const POPOVER_HEIGHT = 100;
/** 浮层内最多展示的技能数量，超出部分折叠成“+N 更多技能”。 */
const MAX_POPOVER_SPELLS = 4;

interface Props {
  floor: Floor;
  spawns: Spawn[];
  selectedSpawnIds: string[];
  asset: DungeonAssetResult;
  /** 敌人目录，用于把 spawn.enemyId 解析成 npcId/名字并在地图上渲染头像。 */
  enemies?: Enemy[];
  /** 已审校技能知识；浮层里优先显示中文名（按 spellId 匹配）。 */
  abilities?: AbilityKnowledge[];
  onSpawnSelect?: (spawnId: string) => void;
  viewBounds?: CoordinateBounds;
  hullSpawns?: Spawn[];
}

interface ResolvedSpawn {
  id: string;
  point: MapPoint;
  isSelected: boolean;
  enemy: Enemy | undefined;
  npcId: number | undefined;
  /**
   * 图标边长（viewBox 单位）：基础尺寸 × MDT 体型比例 × Boss 系数。
   * 普通小怪约 5~6.5，法系怪约 8.4，精英 10~16，Boss 约 22。
   */
  size: number;
  spells: Array<{ spellId: number; icon: string; name: string; cnName?: string }>;
}

interface PopoverAnchor {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}

/** 浮层贴着 spawn 点展开，空间不足时改为朝地图中心一侧。 */
function anchorPopover(point: MapPoint, viewBox: MapViewBox): PopoverAnchor {
  const gap = 8;
  const flipX = point.x + gap + POPOVER_WIDTH > viewBox.x + viewBox.width;
  const flipY = point.y + gap + POPOVER_HEIGHT > viewBox.y + viewBox.height;
  return {
    x: flipX ? point.x - gap - POPOVER_WIDTH : point.x + gap,
    y: flipY ? point.y - gap - POPOVER_HEIGHT : point.y + gap,
    flipX,
    flipY,
  };
}

export function DungeonMap({
  floor,
  spawns,
  selectedSpawnIds,
  asset,
  enemies,
  abilities,
  onSpawnSelect,
  viewBounds = floor.bounds,
  hullSpawns = spawns,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  // threechest 源(RLP)以"屏幕 y 向下为正"定义瓦片行,而 normalized 坐标 y 为负(北在上),
  // 二者镜像。flipY 时把整个渲染面(瓦片位置、spawn、hull、patrol)一起翻转。
  const flipY = asset.kind === 'remote-tiles' && asset.flipY === true;
  const displayBounds = useMemo<CoordinateBounds>(() => {
    if (!flipY) return viewBounds;
    return {
      xMin: viewBounds.xMin,
      xMax: viewBounds.xMax,
      yMin: -viewBounds.yMax,
      yMax: -viewBounds.yMin,
    };
  }, [flipY, viewBounds]);
  const toDisplayPoint = useCallback(
    (point: MapPoint): MapPoint => (flipY ? { x: point.x, y: -point.y } : point),
    [flipY],
  );
  const viewBox = useMemo(() => getMapViewBox(displayBounds), [displayBounds]);
  const hullPath = useMemo(
    () => pointsToSvgPath(getConvexHull(hullSpawns).map(toDisplayPoint)),
    [hullSpawns, toDisplayPoint],
  );
  const patrolPaths = useMemo(
    () =>
      spawns.flatMap((spawn) => {
        const points =
          spawn.patrol?.points.map(coordinateToMapPoint).map(toDisplayPoint) ?? [];
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
    [spawns, toDisplayPoint],
  );
  const [activeSpawnId, setActiveSpawnId] = useState<string>();
  const [brokenPortraits, setBrokenPortraits] = useState<Set<string>>(() => new Set());
  const assetIdentity =
    asset.kind === 'remote'
      ? asset.url
      : asset.kind === 'remote-tiles'
        ? asset.urlTemplate
        : asset.kind;
  const showRemoteImage = asset.kind === 'remote' && !imageFailed;
  const showRemoteTiles = asset.kind === 'remote-tiles' && !imageFailed;
  const tiles = useMemo(
    () => (asset.kind === 'remote-tiles' ? getMapTiles(displayBounds, asset) : []),
    [asset, displayBounds],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [assetIdentity]);

  const enemiesById = useMemo(() => new Map(enemies?.map((enemy) => [enemy.id, enemy])), [enemies]);

  const resolvedSpawns = useMemo<ResolvedSpawn[]>(
    () =>
      spawns.map((spawn) => {
        const enemy = enemiesById.get(spawn.enemyId);
        const npcId = enemy?.npcId;
        const spells = (npcId === undefined ? [] : getEnemySpellIds(npcId))
          .map((spellId) => {
            const fact = RLP_SPELL_FACTS[spellId];
            if (!fact) return undefined;
            const authored = abilities?.find((ability) => ability.spellId === spellId);
            return { spellId, icon: fact.icon, name: fact.name, cnName: authored?.name.zhCN };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        return {
          id: spawn.id,
          point: toDisplayPoint(coordinateToMapPoint(spawn.position)),
          isSelected: selectedSpawnIds.includes(spawn.id),
          enemy,
          npcId,
          size:
            BASE_PORTRAIT_SIZE *
            (spawn.scale ?? 1) *
            (enemy?.isBoss ? BOSS_PORTRAIT_MULTIPLIER : 1),
          spells,
        };
      }),
    [spawns, enemiesById, abilities, toDisplayPoint, selectedSpawnIds],
  );

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
          {/* 头像金属边框，参照 threechest MobBorder 的 vertical gradient。 */}
          <linearGradient id="dungeon-map-rim-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e8e8ec" />
            <stop offset="1" stopColor="#373738" />
          </linearGradient>
          {/* 圆形头像裁剪：objectBoundingBox 下 r=0.5 就是内切圆，适配任意图标尺寸。 */}
          <clipPath id="dungeon-map-portrait-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
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
            className="dungeon-map__background"
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
              className="dungeon-map__tile"
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
        {resolvedSpawns.map((resolved) => {
          const {
            id,
            point,
            isSelected,
            enemy,
            npcId,
            size,
            spells,
          } = resolved;
          const portraitBroken = brokenPortraits.has(id);
          const showPortrait = npcId !== undefined && !portraitBroken;
          // 金属环厚度与图标同比例（threechest borderWidth = 4%×icon）。
          const rimWidth = Math.max(0.3, size * 0.07);
          const rimRadius = size / 2 + rimWidth / 2;
          const visibleSpells = spells.slice(0, MAX_POPOVER_SPELLS);
          const hiddenSpellCount = spells.length - visibleSpells.length;
          // 只有悬停/键盘聚焦或“唯一选中”时显示浮层，避免 pull 多选时铺满地图。
          const showPopover =
            (activeSpawnId === id || (isSelected && selectedSpawnIds.length === 1)) &&
            (enemy !== undefined || npcId !== undefined);
          const anchor = showPopover ? anchorPopover(point, viewBox) : undefined;
          return (
            <g
              aria-label={`${id} 位置`}
              aria-pressed={isSelected}
              className={`dungeon-map__spawn ${isSelected ? 'is-selected' : ''} ${
                showPopover ? 'is-active' : ''
              }`}
              key={id}
              onClick={() => {
                setActiveSpawnId(id);
                onSpawnSelect?.(id);
              }}
              onBlur={() => setActiveSpawnId(undefined)}
              onFocus={() => setActiveSpawnId(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActiveSpawnId(id);
                  onSpawnSelect?.(id);
                }
              }}
              onMouseEnter={() => setActiveSpawnId(id)}
              onMouseLeave={() => setActiveSpawnId(undefined)}
              role={onSpawnSelect ? 'button' : undefined}
              tabIndex={onSpawnSelect ? 0 : undefined}
            >
              {showPortrait ? (
                <g className="dungeon-map__icon">
                  <circle
                    className="dungeon-map__icon-rim"
                    cx={point.x}
                    cy={point.y}
                    r={rimRadius}
                  />
                  <image
                    className="dungeon-map__portrait"
                    clipPath="url(#dungeon-map-portrait-clip)"
                    height={size}
                    href={npcPortraitUrl(npcId!)}
                    onError={() => setBrokenPortraits((current) => new Set(current).add(id))}
                    preserveAspectRatio="xMidYMid meet"
                    width={size}
                    x={point.x - size / 2}
                    y={point.y - size / 2}
                  />
                </g>
              ) : (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? Math.max(2.2, size * 0.3) : Math.max(1.6, size * 0.28)}
                />
              )}
              <title>
                {enemy ? `${enemy.name.zhCN} (${id})` : `${id} 位置`}
              </title>
              {showPopover && anchor && (
                <foreignObject
                  className="dungeon-map__popover-fo"
                  height={POPOVER_HEIGHT}
                  style={{ transform: anchor.flipX ? 'translateX(-100%)' : undefined }}
                  width={POPOVER_WIDTH}
                  x={anchor.x}
                  y={anchor.y}
                >
                  <div className="dungeon-map__popover">
                    <div className="dungeon-map__popover-head">
                      {npcId !== undefined && (
                        <img
                          alt=""
                          className="dungeon-map__popover-avatar"
                          height={22}
                          src={npcPortraitUrl(npcId)}
                          width={22}
                        />
                      )}
                      <div>
                        <strong>{enemy?.name.zhCN ?? `NPC ${npcId ?? ''}`}</strong>
                        <span>
                          {npcId !== undefined ? `NPC ${npcId}` : id} · {spells.length} 个技能
                        </span>
                      </div>
                    </div>
                    <ul className="dungeon-map__popover-spells">
                      {visibleSpells.map((spell) => (
                        <li key={spell.spellId} title={`${spell.name} · Spell ${spell.spellId}`}>
                          <img
                            alt=""
                            className="dungeon-map__popover-spell-icon"
                            height={14}
                            src={dungeonSpellIconUrl(spell.icon)}
                            width={14}
                          />
                          <em>{spell.cnName ?? spell.name}</em>
                        </li>
                      ))}
                      {hiddenSpellCount > 0 && (
                        <li className="dungeon-map__popover-more">
                          +{hiddenSpellCount} 更多技能
                        </li>
                      )}
                      {spells.length === 0 && (
                        <li className="dungeon-map__popover-empty">技能清单待核验</li>
                      )}
                    </ul>
                  </div>
                </foreignObject>
              )}
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