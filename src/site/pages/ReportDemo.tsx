import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import DocumentTitle from 'interface/DocumentTitle';
import { EvidenceToolbox } from 'site/analysis/EvidenceToolbox';
import { PriorityCard } from 'site/analysis/PriorityCard';
import { CombatRoute, ROUTE_LEGEND } from 'site/combat/CombatRoute';
import { Playback } from 'site/combat/Playback';
import { DossierSpine } from 'site/dossier/DossierSpine';
import {
  evocationTicks,
  manaCurve,
  manaTrough,
  priorities,
  workbenchStats,
} from 'site/demo/battle';
import { Button } from 'site/ui/Button';
import { Panel } from 'site/ui/Panel';
import { catmullRomPath, type Point } from 'site/ui/curve';

const TABS = ['法力曲线', '技能时序', '团队协同', '原始事件'];

const CHART_W = 720;
const CHART_H = 210;
const CHART_PAD = 26;
const FIGHT_MIN = 32;
/** 演示战斗时长 31:42，回放条时钟由 progress 推算 */
const FIGHT_SECONDS = 31 * 60 + 42;

const formatClock = (totalSeconds: number) =>
  `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
    Math.floor(totalSeconds % 60),
  ).padStart(2, '0')}`;

export function Component() {
  const navigate = useNavigate();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.472);
  const [tab, setTab] = useState(TABS[0]);

  const focusTitle = priorities.find((p) => p.id === focusId)?.title;

  return (
    <>
      <DocumentTitle title="战报 · 塞塔利斯神庙 M+ 12 · ARC" />
      <div className="report-topbar">
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← 战报档案
        </Button>
        <span className="crumb-sep t-meta">/</span>
        <span className="crumb-here t-meta">塞塔利斯神庙 · M+ 12层 · 限时 31:42 · 09-02</span>
        <div className="report-topbar-actions">
          <Button variant="ghost" small>
            收藏
          </Button>
          <Button variant="secondary" small>
            对比上周
          </Button>
        </div>
      </div>

      <div className="report-grid">
        <aside className="report-spine">
          <DossierSpine />
        </aside>

        <section className="report-thread">
          <Panel corners className="thread-panel">
            <div className="route-head">
              <h2 className="t-card">路线概览 · 战斗主线程</h2>
              <span className="t-eyebrow">
                {focusTitle ? `聚焦 · ${focusTitle}` : '点击下方问题卡聚焦'}
              </span>
            </div>
            <div className="thread-stage">
              <CombatRoute progress={progress} focusId={focusId} />
            </div>
            <div className="route-legend">
              {ROUTE_LEGEND.map((item) => (
                <span key={item.label} className="route-legend-item">
                  <span className="route-legend-dot" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
            <Playback
              current={formatClock(FIGHT_SECONDS * progress)}
              duration={formatClock(FIGHT_SECONDS)}
              progress={progress}
              onSeek={setProgress}
            />
          </Panel>
        </section>

        <section className="report-priority">
          <div className="shelf-head">
            <h2 className="t-section">优先改进项</h2>
            <span className="t-meta">
              {focusId ? 'Focus Mode · 其余项已降噪' : '按影响排序 · 点击卡片聚焦'}
            </span>
          </div>
          <div className="priority-row">
            {priorities.map((data, i) => (
              <PriorityCard
                key={data.id}
                data={data}
                index={i}
                focused={focusId === data.id}
                dimmed={focusId != null && focusId !== data.id}
                onToggle={() => setFocusId(focusId === data.id ? null : data.id)}
              />
            ))}
          </div>
        </section>

        <section className="report-workbench">
          <div className="workbench-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`workbench-tab ${t === tab ? 'is-on' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Panel className="workbench-panel">
            {tab === '法力曲线' ? (
              <ManaCurve />
            ) : (
              <div className="workbench-body t-meta">{tab}视图等待真实数据接入 —— 视觉稿占位。</div>
            )}
          </Panel>
        </section>

        <aside className="report-toolbox">
          <EvidenceToolbox focusId={focusId} onFocus={setFocusId} />
          <Button className="btn-block">导出报告</Button>
        </aside>
      </div>
    </>
  );
}

/** 法力曲线：紫线 + 唤醒金线刻度 + 触底标记（全部代码绘制） */
function ManaCurve() {
  const toX = (min: number) => CHART_PAD + (min / FIGHT_MIN) * (CHART_W - CHART_PAD * 2);
  const toY = (mana: number) => CHART_H - CHART_PAD - (mana / 100) * (CHART_H - CHART_PAD * 2);

  const pts: Point[] = manaCurve.map(([min, mana]) => ({ x: toX(min), y: toY(mana) }));
  const line = catmullRomPath(pts);
  const bottom = CHART_H - CHART_PAD;
  const area = `${line} L ${pts[pts.length - 1].x} ${bottom} L ${pts[0].x} ${bottom} Z`;
  const troughX = toX(manaTrough.at);

  return (
    <div className="workbench-body workbench-mana">
      <div className="mana-chart">
        <svg
          className="mana-svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          aria-label="法力曲线"
          role="img"
        >
          <defs>
            <linearGradient id="mana-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(141,102,223,.22)" />
              <stop offset="100%" stopColor="rgba(141,102,223,0)" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((m) => (
            <line
              key={m}
              x1={CHART_PAD}
              x2={CHART_W - CHART_PAD}
              y1={toY(m)}
              y2={toY(m)}
              stroke="rgba(255,255,255,.05)"
            />
          ))}
          {evocationTicks.map((min) => (
            <g key={min}>
              <line
                x1={toX(min)}
                x2={toX(min)}
                y1={CHART_PAD - 10}
                y2={bottom}
                stroke="var(--gold-300)"
                strokeOpacity="0.5"
                strokeDasharray="3 4"
              />
              <text
                x={toX(min) + 4}
                y={CHART_PAD - 2}
                className="mana-tick-label"
                fill="var(--gold-300)"
              >
                唤醒
              </text>
            </g>
          ))}
          <path d={area} fill="url(#mana-fill)" />
          <path d={line} fill="none" stroke="var(--arcane-300)" strokeWidth="1.6" />
          <circle cx={troughX} cy={toY(manaTrough.value)} r="3.5" fill="var(--status-warning)" />
          <text
            x={troughX + 7}
            y={toY(manaTrough.value) + 3}
            className="mana-tick-label"
            fill="var(--status-warning)"
          >
            触底 {manaTrough.value}%
          </text>
        </svg>
        <div className="mana-axis t-mono">
          <span>00:00</span>
          <span>08:00</span>
          <span>16:00</span>
          <span>24:00</span>
          <span>31:42</span>
        </div>
      </div>
      <div className="mana-stats">
        {workbenchStats.map((stat) => (
          <div key={stat.label} className="mana-stat">
            <span className="t-meta">{stat.label}</span>
            <span className="mana-stat-value t-num">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
