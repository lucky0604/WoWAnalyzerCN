import type { DungeonDocument, PullStep, RouteKnowledge, Spawn } from '../schema/types';
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
