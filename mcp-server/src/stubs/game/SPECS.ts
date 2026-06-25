import { PRIMARY_STAT } from 'parser/shared/modules/features/STAT';

export interface Spec {
  id: number;
  wclClassName?: string;
  wclSpecName?: string;
  branch?: string;
  primaryStat: PRIMARY_STAT;
}

const SPECS: Record<number, Spec> = {};

export default SPECS;
