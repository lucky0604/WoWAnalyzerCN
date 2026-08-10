import { describe, expect, it } from 'vitest';

import { rubyLifePoolsPhase1Draft } from '../data/phase1Prototypes';
import { phase0FixtureDocuments } from '../registry';
import { getDungeonContentCoverage } from './coverage';

describe('dungeon content coverage', () => {
  it('reports route-backed learning surfaces without treating enemy ownership as teaching', () => {
    const coverage = getDungeonContentCoverage(rubyLifePoolsPhase1Draft);

    expect(coverage.route.pullCount).toBe(5);
    expect(coverage.route.pullsWithSituation).toBe(5);
    expect(coverage.uncoveredSituationIds).toEqual(['rlp-situation-hatchery-transition']);
    expect(coverage.incompleteSituationIds).toEqual([]);
    expect(coverage.uncoveredDecisionCriticalAbilityIds).toEqual([]);
    expect(
      coverage.abilities.find((entry) => entry.ability.id === 'rlp-ability-hailbombs'),
    ).toMatchObject({ hasLearningSurface: true });
  });

  it('keeps complete fixture coverage clean', () => {
    const coverage = getDungeonContentCoverage(phase0FixtureDocuments.altarOfFangs);

    expect(coverage.uncoveredSituationIds).toEqual([]);
    expect(coverage.uncoveredDecisionCriticalAbilityIds).toEqual([]);
    expect(coverage.route.pullsWithoutSituation).toEqual([]);
    expect(coverage.bosses.withoutFocusAbilityIds).toEqual([]);
  });

  it('detects a critical ability that is only attached to an enemy', () => {
    const document = structuredClone(phase0FixtureDocuments.altarOfFangs);
    const abilityId = document.abilities[0]!.id;
    document.situations.forEach((situation) => {
      situation.focusAbilityIds = situation.focusAbilityIds.filter((id) => id !== abilityId);
    });
    document.routes.forEach((route) =>
      route.steps.forEach((step) => {
        if (step.type === 'pull') {
          step.focusAbilityIds = step.focusAbilityIds.filter((id) => id !== abilityId);
        }
      }),
    );
    document.bosses.forEach((boss) => {
      boss.focusAbilityIds = boss.focusAbilityIds.filter((id) => id !== abilityId);
    });

    expect(getDungeonContentCoverage(document).uncoveredDecisionCriticalAbilityIds).toContain(
      abilityId,
    );
  });

  it('distinguishes partial route coverage from a full learning context', () => {
    const document = structuredClone(phase0FixtureDocuments.altarOfFangs);
    const step = document.routes[0]!.steps[0]!;
    expect(step.type).toBe('pull');
    if (step.type === 'pull') step.situationRefs[0]!.coverage = 'partial';

    const coverage = getDungeonContentCoverage(document);
    expect(coverage.uncoveredSituationIds).toEqual([]);
    expect(coverage.incompleteSituationIds).toEqual(['altar-situation-coiled-approach']);
  });
});
