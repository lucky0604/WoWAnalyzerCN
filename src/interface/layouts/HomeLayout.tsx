import { t } from '@lingui/core/macro';
import Ad, { AdErrorBoundary, Location } from 'interface/Ad';
import ErrorBoundary from 'interface/ErrorBoundary';
import { dungeonRoutesEnabled } from 'interface/dungeonFeatures';
import DungeonIcon from 'interface/icons/Dungeon';
import FingerprintFilledIcon from 'interface/icons/FingerprintFilled';
import HelpWantedIcon from 'interface/icons/Information';
import NewsIcon from 'interface/icons/Megaphone';
import PremiumIcon from 'interface/icons/Premium';
import Logo from 'interface/images/logo.svg?react';
import NavigationBar from 'interface/NavigationBar';
import { hasPremium } from 'interface/selectors/user';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useWaSelector } from 'interface/utils/useWaSelector';

import './HomeLayout.scss';
import LanguageSwitcher from '../LanguageSwitcher';
import ReportSelectionHeader from '../ReportSelectionHeader';

export function HomeLayout() {
  const pages = [
    {
      icon: NewsIcon,
      name: t({ id: 'interface.home.page.news', message: 'News' }),
      url: 'news',
    },
    ...(dungeonRoutesEnabled
      ? [
          {
            icon: DungeonIcon,
            name: t({ id: 'interface.home.page.dungeons', message: 'Dungeon Learning' }),
            url: 'dungeons',
          },
        ]
      : []),
    {
      icon: FingerprintFilledIcon,
      name: t({ id: 'interface.home.page.specs', message: 'Specs' }),
      url: 'specs',
    },
    {
      icon: Logo,
      name: t({ id: 'interface.home.page.about', message: 'About' }),
      url: 'about',
    },
    {
      icon: PremiumIcon,
      name: t({ id: 'interface.home.page.premium', message: 'Premium' }),
      url: 'premium',
    },
    {
      icon: HelpWantedIcon,
      name: t({ id: 'interface.home.page.helpWanted', message: 'Help wanted' }),
      url: 'help-wanted',
    },
  ];
  const premium = useWaSelector((state) => hasPremium(state));
  const location = useLocation();

  const url = location.pathname === '/' ? 'news' : location.pathname.replace(/^\/|\/$/g, '');

  return (
    <div className="home-page">
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <LanguageSwitcher />
      </NavigationBar>

      <ReportSelectionHeader />

      {premium === false && (
        <AdErrorBoundary>
          <Ad location={Location.Top} style={{ marginTop: '-20px' }} />
        </AdErrorBoundary>
      )}

      <main className="container">
        <nav>
          <ul>
            {pages.map((page) => {
              const Icon = page.icon;
              const isRelativeLink = !page.url.includes('://');
              const content = (
                <>
                  <Icon className="icon" />
                  {page.name}
                </>
              );

              return (
                <li key={page.url} className={page.url === url ? 'active' : undefined}>
                  {isRelativeLink ? (
                    <Link to={page.url} preventScrollReset>
                      {content}
                    </Link>
                  ) : (
                    <a href={page.url}>{content}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
