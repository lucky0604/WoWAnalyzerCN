import { useState } from 'react';

import { Divider } from 'site/ui/Divider';
import { IconSlot } from 'site/ui/IconSlot';
import { Panel } from 'site/ui/Panel';

const FILTERS = ['伤害输出', '承受伤害', '治疗输出', '资源管理'];

/** 档案脊：副本头 + 分位大数字 + 关键元数据 + 视图过滤 */
export function DossierSpine() {
  const [filter, setFilter] = useState(FILTERS[0]);

  return (
    <Panel corners className="spine-panel">
      <div className="spine-dungeon">
        <IconSlot size={40} alt="副本图标（素材待补充）" />
        <div>
          <div className="spine-dungeon-name">塞塔利斯神庙</div>
          <div className="spine-dungeon-mode t-mono">M+ 12层 · 限时 31:42</div>
        </div>
      </div>
      <Divider className="spine-divider" />
      <div className="spine-percentile">
        <span className="spine-percentile-num t-num">98</span>
        <span className="spine-percentile-label">
          <span>最佳分位</span>
          <span>奥法 · 国服前 2%</span>
        </span>
      </div>
      <div className="spine-rows">
        <div className="spine-row">
          <span>物品等级</span>
          <b>518</b>
        </div>
        <div className="spine-row">
          <span>队伍伤害占比</span>
          <b>31.4%</b>
        </div>
        <div className="spine-row">
          <span>阵亡</span>
          <b>0 次</b>
        </div>
        <div className="spine-row">
          <span>解析版本</span>
          <b>12.0.5</b>
        </div>
      </div>
      <Divider className="spine-divider" />
      <div className="spine-filters-label t-eyebrow">视图过滤</div>
      <div className="spine-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`spine-filter ${f === filter ? 'is-on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
    </Panel>
  );
}
