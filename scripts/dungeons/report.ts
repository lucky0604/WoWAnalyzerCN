import { getDungeonDocument } from '../../src/dungeon/registry';
import { getDungeonContentReadiness } from '../../src/dungeon/runtime/contentReadiness';
import { getDungeonScopedLearningAccess } from '../../src/dungeon/runtime/formalAccess';
import { resolveRoute } from '../../src/dungeon/runtime/resolve';
import { getDungeonContentCoverage } from '../../src/dungeon/schema/coverage';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';
import { season2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';

const report = season2DungeonCatalog.map((entry) => {
  const registeredDocument = getDungeonDocument(entry.id);
  const document = registeredDocument?.dataStatus === 'fixture' ? undefined : registeredDocument;
  const readiness = getDungeonContentReadiness(entry, document);
  const validation = document ? validateDungeonDocument(document) : null;
  const learningAccess = getDungeonScopedLearningAccess(entry, registeredDocument);
  const route = document?.routes[0];
  const resolved = document && route ? resolveRoute(document, route) : undefined;
  const coverage = document ? getDungeonContentCoverage(document) : null;
  const learningCoverage = document
    ? getDungeonContentCoverage(document, { routeIntent: 'learning' })
    : null;
  return {
    dungeonId: entry.id,
    catalogStatus: entry.status,
    readiness,
    fixtureStatus: registeredDocument?.dataStatus === 'fixture' ? 'fixture' : null,
    status: document?.dataStatus ?? null,
    learningAccess: {
      state: learningAccess.state,
      canOpen: learningAccess.canOpen,
      isFormal: learningAccess.isFormal,
      label: learningAccess.label,
      reason: learningAccess.reason,
    },
    validation,
    counts: {
      floors: document?.floors.length ?? 0,
      enemies: document?.enemies.length ?? 0,
      spawns: document?.spawns.length ?? 0,
      abilities: document?.abilities.length ?? 0,
      situations: document?.situations.length ?? 0,
      routes: document?.routes.length ?? 0,
    },
    routeForces: resolved?.totalForcesPoints ?? 0,
    authoringEffort: document?.review?.authoringEffort ?? null,
    coverage: coverage
      ? {
          routeIntent: 'all',
          situations: coverage.situations.length,
          routeBackedSituations: coverage.situations.filter((entry) => entry.hasRouteCoverage)
            .length,
          uncoveredSituationIds: coverage.uncoveredSituationIds,
          incompleteSituationIds: coverage.incompleteSituationIds,
          abilities: coverage.abilities.length,
          uncoveredDecisionCriticalAbilityIds: coverage.uncoveredDecisionCriticalAbilityIds,
          pulls: coverage.route.pullCount,
          pullsWithoutSituation: coverage.route.pullsWithoutSituation.map((step) => step.id),
          bossesWithoutFocusAbilityIds: coverage.bosses.withoutFocusAbilityIds,
        }
      : null,
    learningCoverage: learningCoverage
      ? {
          routeIntent: 'learning',
          situations: learningCoverage.situations.length,
          routeBackedSituations: learningCoverage.situations.filter(
            (entry) => entry.hasRouteCoverage,
          ).length,
          uncoveredSituationIds: learningCoverage.uncoveredSituationIds,
          incompleteSituationIds: learningCoverage.incompleteSituationIds,
          abilities: learningCoverage.abilities.length,
          uncoveredDecisionCriticalAbilityIds: learningCoverage.uncoveredDecisionCriticalAbilityIds,
          pulls: learningCoverage.route.pullCount,
          pullsWithoutSituation: learningCoverage.route.pullsWithoutSituation.map(
            (step) => step.id,
          ),
          bossesWithoutFocusAbilityIds: learningCoverage.bosses.withoutFocusAbilityIds,
        }
      : null,
  };
});

console.log(JSON.stringify(report, null, 2));
