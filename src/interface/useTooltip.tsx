import { useWaSelector } from 'interface/utils/useWaSelector';
import {
  itemUrl,
  itemSetUrl,
  npcUrl,
  resourceUrl,
  setWowDbBaseUrl,
  spellUrl,
} from './wowDbProvider';

interface TooltipHelpers {
  // oxlint-disable-next-line typescript-eslint/no-explicit-any -- details ignored for damijing but kept for caller compat
  item: (id: number, _details?: any) => string;
  itemSet: (id: number) => string;
  npc: (id: number) => string;
  resource: (id: number) => string;
  // oxlint-disable-next-line typescript-eslint/no-explicit-any -- details ignored for damijing but kept for caller compat
  spell: (id: number, _details?: any) => string;
}

const useTooltip = (): TooltipHelpers => {
  const baseUrl = useWaSelector((state) => state.tooltips.baseUrl);
  setWowDbBaseUrl(baseUrl);

  return {
    item: (id, _details) => itemUrl(id),
    itemSet: (id) => itemSetUrl(id),
    npc: (id) => npcUrl(id),
    resource: (id) => resourceUrl(id) || '',
    spell: (id, _details) => spellUrl(id),
  };
};

export default useTooltip;
