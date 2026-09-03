export interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic bezier：让战斗路线/曲线呈平滑的有机弧线 */
export function catmullRomPath(points: Point[]): string {
  if (points.length < 2) {
    return '';
  }
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`,
    );
  }
  return d.join(' ');
}

/**
 * 沿路径均匀采样，求目标点在路径长度上的归一化位置（0–1）。
 * 用于把节点坐标换算成 pathLength=1000 的 dash 单位，实现"只亮某段路径"。
 */
export function pathFractionAt(path: SVGPathElement, target: Point, samples = 500): number {
  const total = path.getTotalLength();
  let bestFraction = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const fraction = i / samples;
    const pt = path.getPointAtLength(total * fraction);
    const dx = pt.x - target.x;
    const dy = pt.y - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestFraction = fraction;
    }
  }
  return bestFraction;
}
