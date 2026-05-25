import { QueryParams } from 'common/makeApiUrl';
import makeApiUrl from 'common/makeApiUrl';
import makeUrl from 'common/makeUrl';

export default function makeWclApiUrl(endpoint: string, queryParams: QueryParams = {}) {
  // CN fork: 直连 cn.warcraftlogs.com（通过 Vite dev proxy 或生产环境 CN 代理）
  // 在 .env.local 中设置 VITE_WCL_DIRECT=true 启用
  // 设置 VITE_WCL_API_KEY=your_key 提供 v1 API key
  // 删掉 VITE_WCL_DIRECT 或设为 false 即可切回原版 wowanalyzer.com 代理
  if (import.meta.env.VITE_WCL_DIRECT === 'true') {
    return makeUrl(`/wcl-api/${endpoint}`, queryParams);
  }
  // 原版: 走 wowanalyzer.com 代理
  return makeApiUrl(`v1/${endpoint}`, queryParams);
}
