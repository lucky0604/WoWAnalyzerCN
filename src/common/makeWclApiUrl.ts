import { QueryParams } from 'common/makeApiUrl';
import makeApiUrl from 'common/makeApiUrl';
import makeUrl from 'common/makeUrl';

export default function makeWclApiUrl(endpoint: string, queryParams: QueryParams = {}) {
  // CN fork: 直连 WCL API
  // 优先使用 VITE_WCL_API_BASE（完整URL，如 https://wcl-live-mp.rpglogs.cn）
  // 其次使用 VITE_WCL_DIRECT=true 走 /wcl-api/ 代理
  // 都没设置则走原版 wowanalyzer.com 代理
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
  // 原版: 走 wowanalyzer.com 代理
  return makeApiUrl(`v1/${endpoint}`, queryParams);
}
