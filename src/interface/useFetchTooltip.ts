import { useCallback, useRef } from 'react';

const RPGLOGS_TOOLTIP_BASE = 'https://wcl-live-mp.rpglogs.cn/tooltip';

interface FetchTooltipOptions {
  type: 'item' | 'spell' | 'npc' | 'talent';
  id: number;
  dataEnv?: number;
  locale?: number;
}

export const useFetchTooltip = () => {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());

  const fetchTooltip = useCallback(
    async ({
      type,
      id,
      dataEnv = 1,
      locale = 4,
    }: FetchTooltipOptions): Promise<string | null> => {
      const cacheKey = `${type}-${id}-${dataEnv}-${locale}`;
      
      if (cacheRef.current.has(cacheKey)) {
        return cacheRef.current.get(cacheKey) || null;
      }
      
      if (loadingRef.current.has(cacheKey)) {
        return null;
      }
      
      loadingRef.current.add(cacheKey);
      
      try {
        const url = `${RPGLOGS_TOOLTIP_BASE}/${type}/${id}?dataEnv=${dataEnv}&locale=${locale}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch tooltip: ${response.status}`);
          return null;
        }
        
        const data = await response.json();
        
        if (data.tooltip) {
          cacheRef.current.set(cacheKey, data.tooltip);
          return data.tooltip;
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching tooltip:', error);
        return null;
      } finally {
        loadingRef.current.delete(cacheKey);
      }
    },
    [],
  );

  return fetchTooltip;
};
