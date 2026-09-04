import { catmullRomPath, pathFractionAt } from './curve';

/** 线性假路径：总长 1000，长度 l 处的点即 (l, 0)，采样分数可精确预期 */
function fakePath(): SVGPathElement {
  return {
    getTotalLength: () => 1000,
    getPointAtLength: (len: number) => ({ x: len, y: 0 }),
  } as unknown as SVGPathElement;
}

describe('catmullRomPath', () => {
  it('少于两个点返回空串', () => {
    expect(catmullRomPath([])).toBe('');
    expect(catmullRomPath([{ x: 1, y: 2 }])).toBe('');
  });

  it('从 M 开始、C 段连接并精确经过全部端点', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 10 },
    ];
    const d = catmullRomPath(pts);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('C ');
    expect(d.endsWith('200 10')).toBe(true);
  });

  it('共线点的控制点也在线上，直线段不产生抖动', () => {
    const pts = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 250, y: 50 },
    ];
    const d = catmullRomPath(pts);
    const ys = d.match(/[-\d.]+ [-\d.]+/g)!.map((pair) => Number(pair.split(' ')[1]));
    expect(ys.every((y) => y === 50)).toBe(true);
  });
});

describe('pathFractionAt', () => {
  it('命中线上目标点返回对应归一化分数', () => {
    expect(pathFractionAt(fakePath(), { x: 500, y: 0 })).toBeCloseTo(0.5, 2);
  });

  it('目标点落在路径范围外时收敛到 0 / 1', () => {
    const path = fakePath();
    expect(pathFractionAt(path, { x: -999, y: 0 })).toBe(0);
    expect(pathFractionAt(path, { x: 99999, y: 0 })).toBe(1);
  });
});
