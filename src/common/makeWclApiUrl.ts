import { QueryParams } from 'common/makeApiUrl';
import makeUrl from 'common/makeUrl';

export default function makeWclApiUrl(endpoint: string, queryParams: QueryParams = {}) {
  // CN fork: 直连 WCL API，只允许两条路，禁止回退到原站 wowanalyzer.com 代理
  // 优先使用 VITE_WCL_API_BASE（完整URL，如 https://wcl-live-mp.rpglogs.cn）
  // 其次使用 VITE_WCL_DIRECT=true 走同源 /wcl-api/ 代理（dev 由 vite proxy 转 localhost:9528，
  // 生产由 nginx 转发）
  const wclApiBase = import.meta.env.VITE_WCL_API_BASE;
  if (wclApiBase) {
    // 直连模式：直接请求 WCL API 服务器（需 CORS 支持）
    const url = new URL(`/v1/${endpoint}`, wclApiBase);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
    return url.toString();
  }
  if (import.meta.env.VITE_WCL_DIRECT === 'true') {
    return makeUrl(`/wcl-api/${endpoint}`, queryParams);
  }
  throw new Error(
    'WCL API base is not configured. This build must not fall back to wowanalyzer.com. '
      + 'Set VITE_WCL_API_BASE (e.g. https://wcl-live-mp.rpglogs.cn) for direct access, '
      + 'or set VITE_WCL_DIRECT=true to route through the same-origin /wcl-api/ proxy '
      + '(dev: vite proxy -> localhost:9528 wcl-proxy-server; prod: nginx).',
  );
}
