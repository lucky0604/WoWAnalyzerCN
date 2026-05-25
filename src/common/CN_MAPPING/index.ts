import { BOSS_CN_NAMES } from './bossNames';
import { ZONE_CN_NAMES } from './zoneNames';
import { DUNGEON_CN_NAMES } from './dungeonNames';
import { MOB_CN_NAMES } from './mobNames';
import { getSpellCnName, getSpellCnNameByEnglish } from './spellNames';

export { getSpellCnName, getSpellCnNameByEnglish } from './spellNames';

export function getBossCnName(id: number): string | null {
  return BOSS_CN_NAMES[id] ?? null;
}

export function getZoneCnName(id: number): string | null {
  return ZONE_CN_NAMES[id] ?? null;
}

export function getDungeonCnName(slug: string): string | null {
  return DUNGEON_CN_NAMES[slug] ?? null;
}

export function getMobCnName(name: string): string | null {
  return MOB_CN_NAMES[name] ?? null;
}
