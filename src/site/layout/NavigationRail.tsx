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

function AnalyzeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M3 18c5 0 4-9 9-9s5 5 9-4" />
      <circle cx="3" cy="18" r="1.6" />
      <circle cx="21" cy="5" r="1.6" />
    </svg>
  );
}

function DungeonsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4.5 20V9.5a7.5 7.5 0 0 1 15 0V20" />
      <path d="M9.5 20v-5.5a2.5 2.5 0 0 1 5 0V20" />
      <path d="M2.5 20h19" />
    </svg>
  );
}

function RaidsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M12 3l7 2.5v5.6c0 4.5-2.9 7.4-7 8.9-4.1-1.5-7-4.4-7-8.9V5.5z" />
      <path d="M12 7.5v6" />
      <path d="M9.5 10.5h5" />
    </svg>
  );
}

function ClassesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="12" cy="7.5" r="3" />
      <path d="M5.5 19.5c.9-3.8 3.4-5.7 6.5-5.7s5.6 1.9 6.5 5.7" />
    </svg>
  );
}

function IntelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4 10v4h3.5l6.5 4.5v-13L7.5 10H4z" />
      <path d="M17.5 9.5a4.2 4.2 0 0 1 0 5" />
      <path d="M19.8 7.5a7.4 7.4 0 0 1 0 9" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 18.5V5.5M9 8h7M9 11.5h5" />
    </svg>
  );
}

interface NavItem {
  title: string;
  sub: string;
  to: string;
  icon: () => ReactNode;
}

const NAV: NavItem[] = [
  { title: 'Analyze', sub: '分析', to: '/', icon: AnalyzeIcon },
  { title: 'Dungeons', sub: '大秘境', to: '#', icon: DungeonsIcon },
  { title: 'Raids', sub: '团本', to: '#', icon: RaidsIcon },
  { title: 'Classes', sub: '职业', to: '#', icon: ClassesIcon },
  { title: 'Intel', sub: '版本情报', to: '#', icon: IntelIcon },
  { title: 'Library', sub: '资料库', to: '#', icon: LibraryIcon },
];

/** 左侧导航轨：active = 左缘 2px 紫线 + 紫 6% 底 + icon 微光 */
export function NavigationRail() {
  const { pathname } = useLocation();
  const activeIndex = pathname.startsWith('/report') ? 0 : NAV.findIndex((n) => n.to === pathname);

  return (
    <nav className="rail" aria-label="ARC 主导航">
      <div className="rail-brand">
        <img src={logoUrl} alt="" className="rail-brand-logo" />
        <span className="rail-brand-name">ARC</span>
      </div>
      <span className="rail-brand-tag">World of Warcraft Research Companion</span>
      <div className="rail-nav">
        {NAV.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === activeIndex;
          const inner = (
            <>
              <span className="rail-item-icon">
                <Icon />
              </span>
              <span>
                <span className="rail-item-title">{item.title}</span>
                <span className="rail-item-sub">{item.sub}</span>
              </span>
            </>
          );
          return item.to === '#' ? (
            <a key={item.title} href="#" className="rail-item" onClick={(e) => e.preventDefault()}>
              {inner}
            </a>
          ) : (
            <Link
              key={item.title}
              to={item.to}
              className={`rail-item ${isActive ? 'is-active' : ''}`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
      <div className="rail-foot">
        <button type="button" className="btn btn-secondary btn-sm">
          升级专业版
        </button>
        <span className="t-meta">ARC v1 · 演示预览</span>
      </div>
    </nav>
  );
}
