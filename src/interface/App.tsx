import { wrapCreateBrowserRouterV6 } from '@sentry/react';
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { dungeonLegacyRoutesEnabled, dungeonRoutesEnabled } from 'interface/dungeonFeatures';
import RouterErrorBoundary from 'interface/RouterErrorBoundary';
import { AppLayout } from 'interface/layouts/AppLayout';
import { HomeLayout } from 'interface/layouts/HomeLayout';
import { SiteLayout } from 'site/layout/SiteLayout';

const appRoutes = createRoutesFromElements(
  <Route path="/" element={<AppLayout />} errorElement={<RouterErrorBoundary />}>
    <Route path="character/:region/:realm/:name" lazy={() => import('./routes/character')} />
    <Route path="guild/:region/:realm/:name" lazy={() => import('./routes/guild')} />
    <Route path="report/:reportCode/:fightId?/:player?/:build?" lazy={() => import('./report')}>
      <Route index lazy={() => import('./routes/report/overview')} />
      <Route path="overview" lazy={() => import('./routes/report/overview')} />
      <Route path="statistics" lazy={() => import('./routes/report/statistics')} />
      <Route path="timeline" lazy={() => import('./routes/report/timeline')} />
      <Route path="events" lazy={() => import('./routes/report/events')} />
      <Route path="debug" lazy={() => import('./routes/report/debug')} />
      <Route path="character" lazy={() => import('./routes/report/character')} />
      <Route path="about" lazy={() => import('./routes/report/about')} />
      <Route path=":resultTab" lazy={() => import('./routes/report/dynamic')} />
    </Route>
    <Route path="privacy" lazy={() => import('./routes/privacy')} />
    {dungeonRoutesEnabled && <Route path="dungeons" lazy={() => import('./routes/dungeons')} />}
    {dungeonRoutesEnabled && (
      <Route path="dungeons/:dungeonId/learn" lazy={() => import('./routes/dungeon-learning')} />
    )}
    {dungeonRoutesEnabled && (
      <Route
        path="dungeons/:dungeonId/route/:routeId"
        lazy={() => import('./routes/dungeon-route')}
      />
    )}
    {dungeonRoutesEnabled && (
      <Route path="dungeons/:dungeonId/boss/:bossId" lazy={() => import('./routes/dungeon-boss')} />
    )}
    {dungeonRoutesEnabled && (
      <Route
        path="dungeons/:dungeonId/reference"
        lazy={() => import('./routes/dungeon-reference')}
      />
    )}
    {dungeonLegacyRoutesEnabled && (
      <Route
        path="dungeons/legacy/:sourceKey"
        lazy={() => import('./routes/dungeon-legacy-reference')}
      />
    )}
    {dungeonRoutesEnabled && (
      <Route path="dungeons/:dungeonId" lazy={() => import('./routes/dungeons')} />
    )}
    {/* 战斗观测台（site-refactor 视觉稿 v1）：接管首页 + 示例战报 */}
    <Route element={<SiteLayout />}>
      <Route index lazy={() => import('site/pages/Home')} />
      <Route path="report-demo" lazy={() => import('site/pages/ReportDemo')} />
    </Route>
    <Route element={<HomeLayout />}>
      <Route path="news" lazy={() => import('./routes/news')} />
      <Route path="specs" lazy={() => import('./routes/specs')} />
      <Route path="premium" lazy={() => import('./routes/premium')} />
      <Route path="about" lazy={() => import('./routes/about')} />
      <Route path="help-wanted" lazy={() => import('./routes/help-wanted')} />
      <Route path="contributor/:id" lazy={() => import('./routes/contributor')} />
      <Route path="search/:searchTerm?" lazy={() => import('./routes/search')} />
      <Route path="*" lazy={() => import('./routes/not-found')} />
    </Route>
    <Route path="support-stats" lazy={() => import('./routes/support-stats')} />
  </Route>,
);

const sentryCreateBrowserRouter = import.meta.env.SENTRY_DSN
  ? wrapCreateBrowserRouterV6(createBrowserRouter)
  : createBrowserRouter;
const router =
  import.meta.env.MODE === 'test'
    ? createMemoryRouter(appRoutes)
    : sentryCreateBrowserRouter(appRoutes);

const App = () => <RouterProvider router={router} />;

export default App;
