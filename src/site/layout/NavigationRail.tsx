import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import logoUrl from 'site/ui/logo.svg';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function RouteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M3 18c5 0 4-9 9-9s5 5 9-4" />
      <circle cx="3" cy="18" r="1.6" />
      <circle cx="21" cy="5" r="1.6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 18.5V5.5M9 8h7M9 11.5h5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8.5 16v-5M13 16V8M17.5 16v-8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M3 19c.6-3.4 2.9-5 5.5-5s4.9 1.6 5.5 5" />
      <path d="M15.5 14.5c2.4.1 4.4 1.6 5 4.5" />
    </svg>
  );
}

interface NavItem {
  label: string;
  sub: string;
  to: string;
  icon: () => ReactNode;
}

const NAV: NavItem[] = [
  { label: '成长地图', sub: '本次战斗路径', to: '/', icon: RouteIcon },
  { label: '学习宝库', sub: '指南与攻略', to: '#', icon: BookIcon },
  { label: '数据洞察', sub: '跨场次趋势', to: '#', icon: ChartIcon },
  { label: '装备模拟', sub: '收益对比', to: '#', icon: GearIcon },
  { label: '团队管理', sub: '成员与权限', to: '#', icon: TeamIcon },
];

/** 左侧导航轨：active = 左缘 2px 紫线 + 紫 6% 底 + icon 微光 */
export function NavigationRail() {
  const { pathname } = useLocation();
  const activeIndex = pathname.startsWith('/report') ? 0 : NAV.findIndex((n) => n.to === pathname);

  return (
    <nav className="rail" aria-label="战斗观测台主导航">
      <div className="rail-brand">
        <img src={logoUrl} alt="" className="rail-brand-logo" />
        <div>
          <span className="rail-brand-name">WoWAnalyzerCN</span>
          <span className="rail-brand-sub">观测台</span>
        </div>
      </div>
      <div className="rail-nav">
        {NAV.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === activeIndex;
          return item.to === '#' ? (
            <a key={item.label} href="#" className="rail-item" onClick={(e) => e.preventDefault()}>
              <span className="rail-item-icon">
                <Icon />
              </span>
              <span>
                <span className="rail-item-title">{item.label}</span>
                <span className="rail-item-sub">{item.sub}</span>
              </span>
            </a>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className={`rail-item ${isActive ? 'is-active' : ''}`}
            >
              <span className="rail-item-icon">
                <Icon />
              </span>
              <span>
                <span className="rail-item-title">{item.label}</span>
                <span className="rail-item-sub">{item.sub}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="rail-foot">
        <button type="button" className="btn btn-secondary btn-sm">
          升级专业版
        </button>
        <span className="t-meta">视觉稿 v1 · CN</span>
      </div>
    </nav>
  );
}
