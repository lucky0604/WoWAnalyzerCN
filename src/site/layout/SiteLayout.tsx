import { Outlet } from 'react-router-dom';

import arcCircleUrl from 'site/ui/arcane-circle.svg';

import { NavigationRail } from './NavigationRail';
import '../styles/tokens.css';
import '../styles/typography.css';
import '../styles/effects.css';
import '../styles/motion.css';
import '../styles/components.css';

/**
 * 战斗观测台布局根：所有样式令牌与组件样式都作用域在 .site 之下，
 * 与旧 interface 样式完全隔离（旧全局页脚通过 body:has(.site) 隐藏）。
 */
export function SiteLayout() {
  return (
    <div className="site">
      <div className="site-shell">
        <div className="site-bg" aria-hidden="true">
          <div className="bg-grid" />
          <div className="bg-noise" />
          <img src={arcCircleUrl} alt="" className="site-bg-arcane" />
        </div>
        <NavigationRail />
        <main className="site-main">
          <Outlet />
          <div className="site-footer-line t-meta">
            <span>ARC · World of Warcraft Research Companion</span>
            <span>
              核心分析引擎：WoWAnalyzer · 数据来自 Warcraft Logs（WCL） · ARC v1 视觉稿，演示数据
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
