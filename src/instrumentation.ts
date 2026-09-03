import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],

    release: import.meta.env.VITE_VERSION,
    environment: import.meta.env.VITE_ENVIRONMENT_NAME,
    // CN fork: 不再按域名过滤，否则本站自身 bundle 的报错会被全部丢弃
    // (原值 'wowanalyzer.com/assets/' 会让 Sentry 对本站失效)。

    beforeSend(event) {
      // this is *an attempt* to keep sentry from sending up user info that we don't want & don't need
      if (event.user) {
        delete event.user;
      }

      return event;
    },

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    tracesSampleRate: 1.0,

    // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
    // CN fork: 只对本站同源请求传播 trace 头，去掉 wowanalyzer.com 正则，
    // 也不向 WCL API 等第三方传播。
    tracePropagationTargets: ['localhost', /^\//],

    ignoreErrors: [/TypeError: Failed to fetch/, /Failed to fetch/],
  });
}
