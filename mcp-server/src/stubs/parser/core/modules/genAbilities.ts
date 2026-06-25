import Abilities from 'parser/core/modules/Abilities';

export type GenTalent = { type: 'talent'; id: number; name: string; icon: string };

export interface GenSpell {
  id: number;
  name: string;
  icon: string;
  type?: string;
  hidden?: boolean;
  passive?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GenAbilityConfig {}

export default function genAbilities(_config: GenAbilityConfig): typeof Abilities {
  return Abilities;
}
