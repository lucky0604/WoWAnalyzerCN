// Stub: minimal Combatant for MCP server (no JSX rendering, no full equipment model)
import type { CombatantInfoEvent, Buff, Item, TalentEntry } from 'parser/core/Events';
import type Spell from 'common/SPELLS/Spell';
import type { Talent } from 'common/TALENTS/types';
import Entity from 'parser/core/Entity';

export interface CombatantInfo {
  player: { id: number; name: string };
  fight: { id: number };
}

export default class Combatant extends Entity {
  id = 0;
  name = '';
  specId = 0;
  race: number | null = null;
  faction: number | null = null;
  combatantInfo: CombatantInfoEvent = {} as CombatantInfoEvent;
  _combatantInfo: CombatantInfoEvent = {} as CombatantInfoEvent;
  player = { id: 0, name: '', icon: '' };
  fight = { id: 0 };
  spec: { id: number; primaryStat: string } = { id: 0, primaryStat: 'intellect' };
  characterProfile: { race: number | null } = { race: null };
  gear: Item[] = [];
  talents: TalentEntry[] = [];
  auras: Buff[] = [];

  hasTalent(_talent: Talent | number | undefined): boolean {
    return false;
  }
  hasBuff(_buff: Spell | number | undefined): boolean {
    return false;
  }
  hasDebuff(_buff: Spell | number | undefined): boolean {
    return false;
  }
  hasMainHand(): boolean {
    return false;
  }
  hasOffHand(): boolean {
    return false;
  }
  hasRing(): boolean {
    return false;
  }
  hasTrinket(): boolean {
    return false;
  }
  hasLegendary(): boolean {
    return false;
  }
  hasTier(): boolean {
    return false;
  }
  getItem(_slot: number): Item | undefined {
    return undefined;
  }
}

export class FullCombatant extends Combatant {}
