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

  test('prefers VITE_WCL_API_BASE over the same-origin proxy when both are set', () => {
    vi.stubEnv('VITE_WCL_API_BASE', 'https://wcl-live-mp.rpglogs.cn');
    vi.stubEnv('VITE_WCL_DIRECT', 'true');

    expect(makeWclApiUrl('report/fights/abc123')).toBe(
      'https://wcl-live-mp.rpglogs.cn/v1/report/fights/abc123',
    );
  });

  test('throws with fix guidance naming both WCL variables', () => {
    vi.stubEnv('VITE_WCL_API_BASE', '');
    vi.stubEnv('VITE_WCL_DIRECT', '');

    expect(() => makeWclApiUrl('report/fights/abc123')).toThrow(
      /VITE_WCL_API_BASE[\s\S]*VITE_WCL_DIRECT/,
    );
  });
});
