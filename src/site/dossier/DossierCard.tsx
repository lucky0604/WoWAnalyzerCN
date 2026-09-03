import type { CSSProperties } from 'react';

import type { Dossier } from 'site/demo/battle';

interface DossierCardProps {
  data: Dossier;
  index: number;
  focused: boolean;
  onFocus: () => void;
}

/** 档案卡 240×170：分位大数字 + 副本名 + 日期 */
export function DossierCard({ data, index, focused, onFocus }: DossierCardProps) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={`panel hoverable dossier-card enter ${focused ? 'is-focus' : ''}`}
      style={{ '--i': index } as CSSProperties}
    >
      <div className="dossier-card-kind">
        <span className="t-eyebrow">{data.kind}</span>
        <span className="t-meta t-mono">{data.date}</span>
      </div>
      <h3 className="dossier-card-name">{data.name}</h3>
      <div className="dossier-card-meta">
        <span className="dossier-card-score t-num">{data.score}</span>
        <span className="t-meta">{data.meta}</span>
      </div>
    </button>
  );
}
