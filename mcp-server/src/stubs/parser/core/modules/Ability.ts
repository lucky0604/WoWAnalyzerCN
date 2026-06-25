// Stub: minimal Ability — not needed for MCP analysis (no UI/cast efficiency report)
import type { ReactNode } from 'react';

export interface SpellInfo {
  id: number;
  name: ReactNode;
  icon: string;
}

export default class Ability {
  spell: SpellInfo = { id: 0, name: '', icon: '' };
  primaryCoefficient = 0;
  category = 0;
  isUndetectable = false;

  // eslint-disable-next-line no-empty-function
  constructor(_abilities: unknown, _config: Partial<Ability>) {}
}

export interface SpellbookAbility {
  spell: number | SpellInfo;
  category: number;
  cooldown?: number | ((haste?: number) => number);
}
