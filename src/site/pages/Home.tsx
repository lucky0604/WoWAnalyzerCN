import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import DocumentTitle from 'interface/DocumentTitle';
import { InsightCard } from 'site/analysis/InsightCard';
import { CombatRoute, ROUTE_LEGEND } from 'site/combat/CombatRoute';
import { InstrumentStrip } from 'site/combat/InstrumentStrip';
import { dossiers, insights } from 'site/demo/battle';
import { DossierCard } from 'site/dossier/DossierCard';
import { Button } from 'site/ui/Button';
import { Panel } from 'site/ui/Panel';
import { REPORT_DEMO_URL } from 'site/routes';

const ANALYZE_STEPS = ['读取战报…', '识别副本与路线…', '分析战斗决策…'];
const STEP_INTERVAL_MS = 640;
/** 导航须晚于最后一步（(N-1)*INTERVAL），另留一拍缓冲 */
const ANALYZE_MS = ANALYZE_STEPS.length * STEP_INTERVAL_MS + 130;

export function Component() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const [focusInsight, setFocusInsight] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const startAnalyze = () => {
    if (!url.trim()) {
      setPhase('error');
      return;
    }
    setPhase('analyzing');
    setStep(0);
    clearTimers();
    ANALYZE_STEPS.forEach((_, i) => {
      if (i > 0) {
        timers.current.push(window.setTimeout(() => setStep(i), i * STEP_INTERVAL_MS));
      }
    });
    timers.current.push(window.setTimeout(() => navigate(REPORT_DEMO_URL), ANALYZE_MS));
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= insights.length) {
        setFocusInsight(insights[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      startAnalyze();
    }
  };

  return (
    <>
      <DocumentTitle title="ARC · World of Warcraft Research Companion" />
      <div className="home-grid">
        <section className="home-stage">
          <div className="hero-copy">
            <span className="t-eyebrow">ARC · World of Warcraft Research Companion</span>
            <h1 className="t-hero">
              <span className="hero-line">看见规律，</span>
              <span className="hero-line">
                找到自己的<span className="hero-title-accent">打法</span>。
              </span>
            </h1>
            <p className="hero-sub">
              See the pattern. Find your path. 把一场战斗，变成可探索的成长地图。
            </p>
            <Panel corners sunken className={`console ${phase === 'error' ? 'is-error' : ''}`}>
              <div className="console-label">
                <span className="t-eyebrow">WCL Console · 战报链接</span>
                <span className="t-meta t-mono">warcraftlogs.com/reports/…</span>
              </div>
              <div className="console-row">
                <input
                  className="console-input"
                  value={url}
                  placeholder="粘贴 Warcraft Logs 报告链接或代码"
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (phase === 'error') {
                      setPhase('idle');
                    }
                  }}
                  onKeyDown={onInputKeyDown}
                  disabled={phase === 'analyzing'}
                />
                <Button
                  className="console-cta"
                  analyzing={phase === 'analyzing'}
                  disabled={phase === 'analyzing'}
                  onClick={startAnalyze}
                >
                  {phase === 'analyzing' ? ANALYZE_STEPS[step] : '开始解析'}
                </Button>
              </div>
              <div className="console-status">
                {phase === 'error' ? (
                  <span className="console-error-text t-meta">
                    请粘贴有效的 Warcraft Logs 链接后再解析。
                  </span>
                ) : (
                  <span className="t-meta">
                    支持 M+ / 团本 / 木桩 · 平均解析 30s · 演示中即时完成
                  </span>
                )}
              </div>
              {phase === 'analyzing' && (
                <div className="console-scan-zone">
                  <div className="scan-line" />
                </div>
              )}
            </Panel>
          </div>
          <Panel corners className="route-panel">
            <div className="route-head">
              <h2 className="t-card">战斗路线 · 塞塔利斯神庙</h2>
              <span className="t-eyebrow">Route · M+ 12</span>
            </div>
            <div className="thread-stage route-panel-stage">
              <CombatRoute progress={0.42} />
            </div>
            <div className="route-legend">
              {ROUTE_LEGEND.map((item) => (
                <span key={item.label} className="route-legend-item">
                  <span className="route-legend-dot" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </Panel>
        </section>

        <aside className="home-rail">
          <div className="intel-head">
            <h2>
              AI 洞察<small>实时生成</small>
            </h2>
            <span className="t-meta t-mono">按 1–3 聚焦</span>
          </div>
          {insights.map((data, i) => (
            <InsightCard
              key={data.id}
              data={data}
              index={i}
              focused={focusInsight === data.id}
              dimmed={focusInsight != null && focusInsight !== data.id}
              onFocus={() => setFocusInsight(focusInsight === data.id ? null : data.id)}
            />
          ))}
          <span className="t-meta intel-more">洞察基于本场 3,182 万事件生成 · 演示数据</span>
        </aside>

        <InstrumentStrip />

        <section className="home-shelf">
          <div className="shelf-head">
            <h2 className="t-section">战报档案</h2>
            <span className="t-meta">最近 5 场 · 09-02 → 08-29 · 点击任意档案查看示例报告</span>
          </div>
          <div className="shelf-row">
            {dossiers.map((data, i) => (
              <DossierCard
                key={data.id}
                data={data}
                index={i}
                onFocus={() => navigate(REPORT_DEMO_URL)}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
