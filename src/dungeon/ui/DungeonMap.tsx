import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { t } from '@lingui/core/macro';

import {
  dungeonSpellIconUrl,
  getEnemyNameZh,
  getEnemyScale,
  getEnemySpellAttributes,
  getEnemySpellIds,
  getSpellFact,
  getSpellTooltipZh,
  isEnemyBoss,
  npcPortraitUrl,
} from '../data/spellReference';
import { RLP_SPELL_TOOLTIPS } from '../data/rlpSpellTooltips';
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
/** 浮层高度初始估算：卡片实际高度以内容自适应，渲染后由 ResizeObserver 实测覆盖。 */
const INITIAL_POPOVER_HEIGHT = 150;
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
  spells: Array<{
    spellId: number;
    icon: string;
    name: string;
    cnName?: string;
    /** MDT 参考层的技能属性：可打断 / 驱散类型等。 */
    interruptible: boolean;
    /** 预渲染技能说明(game-data 快照填充数值);仅在快照含描述时存在。 */
    description?: string;
  }>;
}

interface PopoverAnchor {
  x: number;
  y: number;
}

/** 浮层贴着 spawn 点展开，空间不足时改为朝地图中心一侧。
    翻转已直接算进 x/y：右/下空间不足时整体挪到图标左/上方（右缘/底缘留 8 单位间隙）。
    height 为卡片实际渲染高度（viewBox 单位），由调用方实测传入。 */
function anchorPopover(point: MapPoint, viewBox: MapViewBox, height: number): PopoverAnchor {
  const gap = 8;
  const flipX = point.x + gap + POPOVER_WIDTH > viewBox.x + viewBox.width;
  const flipY = point.y + gap + height > viewBox.y + viewBox.height;
  return {
    x: flipX ? point.x - gap - POPOVER_WIDTH : point.x + gap,
    y: flipY ? point.y - gap - height : point.y + gap,
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
  // 悬停/聚焦临时预览优先，其次落到“唯一选中”的常驻 tooltip——任何时候只显示一个。
  const [previewSpawnId, setPreviewSpawnId] = useState<string>();
  const tooltipTargetId =
    previewSpawnId ?? (selectedSpawnIds.length === 1 ? selectedSpawnIds[0] : undefined);
  // 卡片高度实测：overflow 下内容自适应，翻转判定需要真实高度(viewBox 单位)，
  // 不能依赖固定估算值，否则技能多/说明长时卡片会悬空或压住图标。
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(INITIAL_POPOVER_HEIGHT);
  useLayoutEffect(() => {
    const node = popoverRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0) return;
      // div 宽度恒等于 foreignObject 宽度(POPOVER_WIDTH viewBox 单位)，
      // 用渲染宽度反推 viewBox→屏幕缩放，再把实测高度换回 viewBox 单位。
      const scale = rect.width / POPOVER_WIDTH;
      setPopoverHeight(rect.height / scale);
    };
    measure();
    // 渐进增强：jsdom 等无 ResizeObserver 的环境跳过监听，回退到固定高度估算。
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [tooltipTargetId]);
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
  const abilitiesById = useMemo(
    () => new Map(abilities?.map((ability) => [ability.spellId, ability])),
    [abilities],
  );
  const selectedSpawnSet = useMemo(() => new Set(selectedSpawnIds), [selectedSpawnIds]);

  const resolvedSpawns = useMemo<ResolvedSpawn[]>(
    () =>
      spawns.map((spawn) => {
        const enemy = enemiesById.get(spawn.enemyId);
        // 位置参考只传坐标层（无 enemies prop）：spawn.enemyId 形如
        // `<dungeon>:source-enemy:<npcId>`，数字后缀就是坐标快照的
        // sourceEnemyId，据此也能解析出头像与技能浮层。
        const sourceNpcId = /:source-enemy:(\d+)$/.exec(spawn.enemyId)?.[1];
        const npcId = enemy?.npcId ?? (sourceNpcId === undefined ? undefined : Number(sourceNpcId));
        const attributes = getEnemySpellAttributes(npcId);
        const spells = (npcId === undefined ? [] : getEnemySpellIds(npcId))
          .map((spellId) => {
            const fact = getSpellFact(spellId);
            if (!fact) return undefined;
            const authored = abilitiesById.get(spellId);
            // 说明/中文名优先级：已审校 abilities > RLP 金标准快照 >
            // s2.zhTooltips 离线层（8 本 S2 通用，生成时已填充数值变量）。
            const tooltipZh = getSpellTooltipZh(spellId);
            return {
              spellId,
              icon: fact.icon,
              name: fact.name,
              cnName: authored?.name.zhCN ?? tooltipZh?.name,
              interruptible: attributes.get(spellId)?.includes('interruptible') ?? false,
              description: RLP_SPELL_TOOLTIPS[spellId]?.zh ?? tooltipZh?.desc,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        // 体型优先级：文档级 spawn.scale（rlp 快照）→ mdtFacts NPC mob.scale → 1。
        // Boss 判定：文档敌人字段优先，参考页无敌人目录时回退 mdtFacts isBoss。
        const spawnScale = spawn.scale ?? getEnemyScale(npcId) ?? 1;
        const isBoss = enemy?.isBoss ?? isEnemyBoss(npcId);
        return {
          id: spawn.id,
          point: toDisplayPoint(coordinateToMapPoint(spawn.position)),
          isSelected: selectedSpawnSet.has(spawn.id),
          enemy,
          npcId,
          size: BASE_PORTRAIT_SIZE * spawnScale * (isBoss ? BOSS_PORTRAIT_MULTIPLIER : 1),
          spells,
        };
      }),
    [spawns, enemiesById, abilitiesById, toDisplayPoint, selectedSpawnSet],
  );

  const resolvedById = useMemo(
    () => new Map(resolvedSpawns.map((spawn) => [spawn.id, spawn])),
    [resolvedSpawns],
  );

  return (
    <div className="dungeon-map" data-asset-kind={asset.kind}>
      <svg
        aria-label={t({
          id: 'dungeon.map.floorMapLabel',
          message: `${floor.name.zhCN} 地图`,
        })}
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
            aria-label={t({
              id: 'dungeon.map.patrolLabel',
              message: `${patrol.id} 巡逻路径`,
            })}
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
          } = resolved;
          const portraitBroken = brokenPortraits.has(id);
          const showPortrait = npcId !== undefined && !portraitBroken;
          // 金属环厚度与图标同比例（threechest borderWidth = 4%×icon）。
          const rimWidth = Math.max(0.3, size * 0.07);
          const rimRadius = size / 2 + rimWidth / 2;
          return (
            <g
              aria-label={t({
                id: 'dungeon.map.spawnPositionLabel',
                message: `${id} 位置`,
              })}
              aria-pressed={isSelected}
              className={`dungeon-map__spawn ${isSelected ? 'is-selected' : ''} ${
                tooltipTargetId === id ? 'is-active' : ''
              }`}
              key={id}
              onClick={() => {
                setPreviewSpawnId(id);
                onSpawnSelect?.(id);
              }}
              onBlur={() =>
                setPreviewSpawnId((current) => (current === id ? undefined : current))
              }
              onFocus={() => setPreviewSpawnId(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setPreviewSpawnId(id);
                  onSpawnSelect?.(id);
                }
              }}
              onMouseEnter={() => setPreviewSpawnId(id)}
              onMouseLeave={() =>
                setPreviewSpawnId((current) => (current === id ? undefined : current))
              }
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
                {enemy
                  ? `${enemy.name.zhCN} (${id})`
                  : t({
                      id: 'dungeon.map.spawnPositionTitle',
                      message: `${id} 位置`,
                    })}
              </title>
            </g>
          );
        })}
        {/* 单一 tooltip 固定在 SVG 顶层渲染：SVG 栈序即文档顺序，最后绘制的永远在最上，
            任何 spawn 图标都不会再盖住它；悬停/聚焦预览优先，失焦后回退到选中常驻。 */}
        {tooltipTargetId !== undefined &&
          (() => {
            const resolved = resolvedById.get(tooltipTargetId);
            if (!resolved || (resolved.enemy === undefined && resolved.npcId === undefined)) {
              return null;
            }
            const anchor = anchorPopover(resolved.point, viewBox, popoverHeight);
            const visibleSpells = resolved.spells.slice(0, MAX_POPOVER_SPELLS);
            const hiddenSpellCount = resolved.spells.length - visibleSpells.length;
            const interruptibleLabel = t({
              id: 'dungeon.map.interruptible',
              message: '可打断',
            });
            return (
              <foreignObject
                className="dungeon-map__popover-fo"
                height={INITIAL_POPOVER_HEIGHT}
                key={tooltipTargetId}
                width={POPOVER_WIDTH}
                x={anchor.x}
                y={anchor.y}
              >
                <div className="dungeon-map__popover" ref={popoverRef}>
                  <div className="dungeon-map__popover-head">
                    {resolved.npcId !== undefined && (
                      <img
                        alt=""
                        className="dungeon-map__popover-avatar"
                        height={22}
                        src={npcPortraitUrl(resolved.npcId)}
                        width={22}
                      />
                    )}
                    <div>
                      <strong>
                        {resolved.enemy?.name.zhCN ??
                          getEnemyNameZh(resolved.npcId) ??
                          `NPC ${resolved.npcId ?? ''}`}
                      </strong>
                      <span>
                        {resolved.npcId !== undefined ? `NPC ${resolved.npcId}` : resolved.id} ·{' '}
                        {t({
                          id: 'dungeon.map.spellCount',
                          message: `${resolved.spells.length} 个技能`,
                        })}
                      </span>
                    </div>
                  </div>
                  <ul className="dungeon-map__popover-spells">
                    {visibleSpells.map((spell) => (
                      <li key={spell.spellId} title={`${spell.name} · Spell ${spell.spellId}`}>
                        <span className="dungeon-map__popover-spell-row">
                          <img
                            alt=""
                            className="dungeon-map__popover-spell-icon"
                            height={14}
                            src={dungeonSpellIconUrl(spell.icon)}
                            width={14}
                          />
                          {spell.interruptible && (
                            <span
                              className="dungeon-map__spell-interrupt"
                              title={interruptibleLabel}
                            >
                              {interruptibleLabel}
                            </span>
                          )}
                          <em>{spell.cnName ?? spell.name}</em>
                        </span>
                        {spell.description && (
                          <p className="dungeon-map__popover-spell-desc">
                            {spell.description}
                          </p>
                        )}
                      </li>
                    ))}
                    {hiddenSpellCount > 0 && (
                      <li className="dungeon-map__popover-more">
                        {t({
                          id: 'dungeon.map.moreSpells',
                          message: `+${hiddenSpellCount} 更多技能`,
                        })}
                      </li>
                    )}
                    {resolved.spells.length === 0 && (
                      <li className="dungeon-map__popover-empty">
                        {t({ id: 'dungeon.map.spellbookPending', message: '技能清单待核验' })}
                      </li>
                    )}
                  </ul>
                </div>
              </foreignObject>
            );
          })()}
      </svg>
      {!showRemoteImage && !showRemoteTiles && (
        <div className="dungeon-map__placeholder">
          <strong>
            {imageFailed
              ? t({ id: 'dungeon.map.backdropFailed', message: '地图背景加载失败' })
              : t({ id: 'dungeon.map.backdropMissing', message: '地图背景未配置' })}
          </strong>
          <span>
            {imageFailed
              ? t({
                  id: 'dungeon.map.backdropFailedDetail',
                  message: '远程资源不可用，仍可使用坐标层。',
                })
              : (asset.reason ??
                t({
                  id: 'dungeon.map.backdropMissingDetail',
                  message: '坐标层仍可用于理解位置。',
                }))}
          </span>
        </div>
      )}
      <div className="dungeon-map__legend">
        <span>
          <i className="dungeon-map__legend-dot" /> spawn
        </span>
        {patrolPaths.length > 0 && (
          <span>{t({ id: 'dungeon.map.patrolLegend', message: '— 巡逻路径' })}</span>
        )}
        <span>
          {t({
            id: 'dungeon.map.spawnCountLabel',
            message: `${spawns.length} 个位置`,
          })}
        </span>
      </div>
    </div>
  );
}