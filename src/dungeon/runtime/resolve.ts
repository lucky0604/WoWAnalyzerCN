import type { DungeonDocument, PullStep, RouteKnowledge, RouteStep, Spawn } from '../schema/types';
import { getPullStepForces } from '../schema/validate';

export interface ResolvedPull {
  step: PullStep;
  spawns: Spawn[];
  forcesPoints: number;
  forcesPercent: number;
}

export interface ResolvedRoute {
  route: RouteKnowledge;
  pulls: ResolvedPull[];
  totalForcesPoints: number;
}

/**
 * A route step may have a small set of learning anchors even while its full
 * pull composition is still pending. These anchors come from the referenced
 * Situation, so the map can explain the learning context without presenting
 * an incomplete source snapshot as a complete pull.
 */
export function getRouteStepAnchorSpawnIds(document: DungeonDocument, step: RouteStep): string[] {
  if (step.type === 'transition') return [];
  const situationById = new Map(document.situations.map((situation) => [situation.id, situation]));
  const knownSpawnIds = new Set(document.spawns.map((spawn) => spawn.id));
  return [
    ...new Set(
      step.situationRefs.flatMap(
        ({ situationId }) => situationById.get(situationId)?.anchorSpawnIds ?? [],
      ),
    ),
  ].filter((spawnId) => knownSpawnIds.has(spawnId));
}

export function resolveRoute(document: DungeonDocument, route: RouteKnowledge): ResolvedRoute {
  const spawnsById = new Map(document.spawns.map((spawn) => [spawn.id, spawn]));
  const pulls = route.steps
    .filter((step): step is PullStep => step.type === 'pull')
    .map((step) => {
      const forcesPoints = getPullStepForces(document, step);
      return {
        step,
        spawns: step.spawnIds.flatMap((spawnId) => {
          const spawn = spawnsById.get(spawnId);
          return spawn ? [spawn] : [];
        }),
        forcesPoints,
        forcesPercent: document.totalEnemyForcesPoints
          ? forcesPoints / document.totalEnemyForcesPoints
          : 0,
      };
    });
  return {
    route,
    pulls,
    totalForcesPoints: pulls.reduce((total, pull) => total + pull.forcesPoints, 0),
  };
}
