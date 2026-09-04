import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { iconUrl } from 'interface/Icon';
import { ROUTE_VIEWBOX, routeNodes, type RouteNode, type RouteNodeStatus } from 'site/demo/battle';
import { catmullRomPath, pathFractionAt, type Point } from 'site/ui/curve';

interface CombatRouteProps {
  /** 0–1，播放头位置；不传则不渲染播放头 */
  progress?: number;
  /** Focus Mode：当前聚焦问题 id（对应 node.issueId），其余节点降噪 */
  focusId?: string | null;
}

/** 图例（路线面板与战报页共用） */
export const ROUTE_LEGEND = [
  { label: '经过', color: 'rgba(255,255,255,.28)' },
  { label: '重点问题', color: 'var(--status-danger)' },
  { label: '首领', color: 'var(--gold-300)' },
  { label: '完美执行', color: 'var(--status-good)' },
];

const STATUS_CLASS: Record<RouteNodeStatus, string> = {
  good: 'route-node--good',
  info: 'route-node--info',
  warning: 'route-node--warning',
  problem: 'route-node--problem',
};

/** 路线数据是静态模块数据，路径串只需算一次 */
const ROUTE_D = catmullRomPath(routeNodes.map((n) => ({ x: n.x, y: n.y })));

export function CombatRoute({ progress, focusId }: CombatRouteProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [head, setHead] = useState<Point | null>(null);
  /** 焦点段在 pathLength=1000 上的 [start, end]，Focus Mode 只叠亮问题区间 */
  const [segment, setSegment] = useState<[number, number] | null>(null);

  /** 传入的 focusId 必须命中某个节点，否则视为无焦点（P4 等无路线的问题只高亮卡片） */
  const effectiveFocus =
    focusId != null && routeNodes.some((n) => n.issueId === focusId) ? focusId : null;

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (progress == null || !path) {
      setHead(null);
      return;
    }
    const pt = path.getPointAtLength(path.getTotalLength() * Math.min(1, Math.max(0, progress)));
    setHead({ x: pt.x, y: pt.y });
  }, [progress]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (effectiveFocus == null || !path) {
      setSegment(null);
      return;
    }
    const issueIdx = routeNodes.findIndex((n) => n.issueId === effectiveFocus);
    if (issueIdx < 0) {
      setSegment(null);
      return;
    }
    const from = routeNodes[Math.max(0, issueIdx - 1)];
    const to = routeNodes[issueIdx];
    const f1 = pathFractionAt(path, from);
    const f2 = pathFractionAt(path, to);
    const pad = 8; // 焦点段两端略微出头，避免正好切在节点圆心上
    const start = Math.max(0, Math.min(f1, f2) * 1000 - pad);
    const end = Math.min(1000, Math.max(f1, f2) * 1000 + pad);
    setSegment([start, end]);
  }, [effectiveFocus]);

  const segLen = segment ? segment[1] - segment[0] : 0;

  return (
    <svg
      className="route-svg"
      viewBox={`0 0 ${ROUTE_VIEWBOX.width} ${ROUTE_VIEWBOX.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path ref={pathRef} d={ROUTE_D} pathLength={1000} className="route-path" />
      <path
        d={ROUTE_D}
        pathLength={1000}
        className="route-path-focus"
        style={{
          opacity: effectiveFocus ? 1 : 0,
          strokeDasharray: segment ? `${segLen} ${1000 - segLen}` : undefined,
          strokeDashoffset: segment ? -segment[0] : undefined,
        }}
      />
      {routeNodes.map((node, i) => (
        <RouteNodeG key={node.id} node={node} index={i} focusId={effectiveFocus} />
      ))}
      {progress != null && head && (
        <g className="playhead" transform={`translate(${head.x} ${head.y})`}>
          <circle r="4.5" fill="var(--arcane-100)" />
          <circle r="9.5" fill="none" stroke="rgba(160, 110, 235, 0.4)" />
        </g>
      )}
    </svg>
  );
}

const RouteNodeG = memo(function RouteNodeG({
  node,
  index,
  focusId,
}: {
  node: RouteNode;
  index: number;
  focusId?: string | null;
}) {
  const active = focusId != null && node.issueId === focusId;
  const dimmed = focusId != null && node.issueId !== focusId;
  const statusCls = node.status ? STATUS_CLASS[node.status] : '';
  const r = node.kind === 'boss' ? 8 : 5;
  const isBoss = node.kind === 'boss';

  return (
    <g className={dimmed ? 'route-dim' : undefined}>
      <g
        className={`route-node route-node--${node.kind} ${statusCls} ${active ? 'is-active' : ''}`}
        style={{ '--i': index } as CSSProperties}
      >
        {node.status === 'problem' && (
          <circle
            className="node-pulse-ring"
            cx={node.x}
            cy={node.y}
            r={r + 3}
            fill="none"
            stroke="var(--arcane-500)"
            strokeWidth="1.5"
          />
        )}
        {isBoss && <circle className="node-ring" cx={node.x} cy={node.y} r={r + 5} />}
        <circle className="node-core" cx={node.x} cy={node.y} r={r} />
        {node.icon && <IconBadge node={node} r={r} />}
        <text className="node-time" x={node.x} y={node.y + r + 13}>
          {node.time}
        </text>
        {node.name && (
          <text className="node-name" x={node.x} y={node.y - r - (node.icon ? 34 : 8)}>
            {node.name}
          </text>
        )}
      </g>
    </g>
  );
});

/** 技能图标徽标：悬浮于问题节点上方（真实 WoW 素材，占位可换） */
function IconBadge({ node, r }: { node: RouteNode; r: number }) {
  if (!node.icon) {
    return null;
  }
  return (
    <g transform={`translate(${node.x - 9} ${node.y - r - 30})`}>
      <rect className="node-icon-frame" width="18" height="18" rx="3" />
      <image href={iconUrl(node.icon)} width="18" height="18" />
    </g>
  );
}
