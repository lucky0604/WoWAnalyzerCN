import { dungeonDocuments } from '../../src/dungeon/registry';
import { getDungeonLearningAccess } from '../../src/dungeon/runtime/access';
import { resolveRoute } from '../../src/dungeon/runtime/resolve';
import { getDungeonContentCoverage } from '../../src/dungeon/schema/coverage';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

const report = dungeonDocuments.map((document) => {
  const validation = validateDungeonDocument(document);
  const learningAccess = getDungeonLearningAccess(document);
  const route = document.routes[0];
  const resolved = route ? resolveRoute(document, route) : undefined;
  const coverage = getDungeonContentCoverage(document);
  return {
    dungeonId: document.id,
    status: document.dataStatus,
    learningAccess: {
      state: learningAccess.state,
      canOpen: learningAccess.canOpen,
      isFormal: learningAccess.isFormal,
      label: learningAccess.label,
      reason: learningAccess.reason,
    },
    validation,
    counts: {
      floors: document.floors.length,
      enemies: document.enemies.length,
      spawns: document.spawns.length,
      abilities: document.abilities.length,
      situations: document.situations.length,
      routes: document.routes.length,
    },
    routeForces: resolved?.totalForcesPoints ?? 0,
    coverage: {
      situations: coverage.situations.length,
      routeBackedSituations: coverage.situations.filter((entry) => entry.hasRouteCoverage).length,
      uncoveredSituationIds: coverage.uncoveredSituationIds,
      incompleteSituationIds: coverage.incompleteSituationIds,
      abilities: coverage.abilities.length,
      uncoveredDecisionCriticalAbilityIds: coverage.uncoveredDecisionCriticalAbilityIds,
      pulls: coverage.route.pullCount,
      pullsWithoutSituation: coverage.route.pullsWithoutSituation.map((step) => step.id),
      bossesWithoutFocusAbilityIds: coverage.bosses.withoutFocusAbilityIds,
    },
  };
});

console.log(JSON.stringify(report, null, 2));
