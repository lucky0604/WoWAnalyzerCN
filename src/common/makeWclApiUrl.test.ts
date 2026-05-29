import makeWclApiUrl from './makeWclApiUrl';

describe('makeWclApiUrl', () => {
  test('uses the configured direct WCL API base when provided', () => {
    vi.stubEnv('VITE_WCL_API_BASE', 'https://wcl-live-mp.rpglogs.cn');
    vi.stubEnv('VITE_WCL_DIRECT', 'false');

    expect(makeWclApiUrl('report/fights/abc123', { translate: true })).toBe(
      'https://wcl-live-mp.rpglogs.cn/v1/report/fights/abc123?translate=true',
    );
  });

  test('uses the local /wcl-api proxy when direct mode has no API base', () => {
    vi.stubEnv('VITE_WCL_API_BASE', '');
    vi.stubEnv('VITE_WCL_DIRECT', 'true');

    expect(makeWclApiUrl('report/fights/abc123', { translate: true })).toBe(
      '/wcl-api/report/fights/abc123?translate=true',
    );
  });
});
