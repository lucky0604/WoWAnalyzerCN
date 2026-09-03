import type { CSSProperties } from 'react';

import type { Priority } from 'site/demo/battle';

interface PriorityCardProps {
  data: Priority;
  index: number;
  focused: boolean;
  dimmed: boolean;
  onToggle: () => void;
}

/** P1–P4 优先改进项；点击进入 Focus Mode（紫描边，其余降噪） */
export function PriorityCard({ data, index, focused, dimmed, onToggle }: PriorityCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`priority-card hoverable enter ${focused ? 'is-focus' : ''} ${
        dimmed ? 'is-dimmed' : ''
      }`}
      style={{ '--i': index } as CSSProperties}
    >
      <span className={`priority-badge priority-badge--p${data.level} t-mono`}>P{data.level}</span>
      <h3 className="priority-title">{data.title}</h3>
      <div className="priority-metric">
        <span className={`priority-metric-value t-num priority-metric-value--${data.valueTone}`}>
          {data.value}
        </span>
        <span className="priority-metric-target">{data.target}</span>
      </div>
      <p className="priority-impact">{data.impact}</p>
      <div className="priority-foot">
        <span className="priority-time">时间窗 {data.at}</span>
        <span className="priority-detail">查看详情 →</span>
      </div>
    </button>
  );
}
