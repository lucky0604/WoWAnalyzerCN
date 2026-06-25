export interface TrackedAbility {
  casts: number;
  manaUsed?: number;
}

export default class AbilityTracker {
  abilities: Record<number, TrackedAbility> = {};
}
