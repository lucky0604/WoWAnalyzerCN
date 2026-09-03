import type { CSSProperties } from 'react';

import type { Insight } from 'site/demo/battle';

interface InsightCardProps {
  data: Insight;
  index: number;
  focused: boolean;
  /** Focus Mode：其余洞察卡降噪 */
  dimmed?: boolean;
  onFocus: () => void;
}

/** 洞察轨卡片：编号 + 大数字指标 + 潜在收益；键盘 1–3 聚焦 */
export function InsightCard({ data, index, focused, dimmed, onFocus }: InsightCardProps) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={`panel hoverable insight-card enter ${focused ? 'is-focus' : ''} ${
        dimmed ? 'is-dimmed' : ''
      }`}
      style={{ '--i': index } as CSSProperties}
    >
      <div className="insight-card-top">
        <span className="insight-card-no t-mono">{data.no}</span>
        <span className="insight-card-title">{data.title}</span>
        <span className="t-meta t-mono">按 {index + 1}</span>
      </div>
      <div className="insight-card-metric">
        <span className={`insight-card-value t-num insight-card-value--${data.tone}`}>
          {data.value}
        </span>
        <span className="insight-card-target">{data.target}</span>
      </div>
      <p className="insight-card-desc">{data.desc}</p>
      <div className="insight-card-foot t-meta">
        <span className="gain">{data.gain}</span>
        <span className="t-mono">{data.at}</span>
      </div>
    </button>
  );
}
