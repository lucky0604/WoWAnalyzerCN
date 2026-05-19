import { findByBossId } from 'game/raids';
import { getBossCnName } from 'common/CN_MAPPING';

export default function getBossDisplayName(fightBossId: number, fallbackName: string): string {
  return findByBossId(fightBossId)?.name ?? getBossCnName(fightBossId) ?? fallbackName;
}
