import { instruments } from 'site/demo/battle';
import { Panel } from 'site/ui/Panel';

function Spark({ data }: { data: number[] }) {
  const w = 84;
  const h = 20;
  // 单点没有可展开的区间，x 会除以 0 产生 NaN 坐标
  const pts = (data.length < 2 ? [] : data)
    .map(
      (v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - v * h * 0.85 - 2).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg
      className="instrument-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <polyline points={pts} fill="none" stroke="var(--status-good)" strokeWidth="1.5" />
    </svg>
  );
}

/** 仪器条：连续数据带（非 KPI 卡片），竖分隔线切分 6 格 */
export function InstrumentStrip() {
  return (
    <Panel className="instruments home-strip">
      {instruments.map((inst) => (
        <div key={inst.label} className="instrument">
          <span className="t-eyebrow">{inst.label}</span>
          <span
            className={`instrument-value t-num ${
              inst.tone === 'gold' ? 'instrument-value--gold' : ''
            } ${inst.tone === 'good' ? 'instrument-value--good' : ''}`}
          >
            {inst.value}
            {inst.unit && <small>{inst.unit}</small>}
          </span>
          {inst.spark ? <Spark data={inst.spark} /> : <span className="t-meta">{inst.sub}</span>}
        </div>
      ))}
    </Panel>
  );
}
