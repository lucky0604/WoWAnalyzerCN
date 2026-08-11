import type {
  AbilityKnowledge,
  DungeonDocument,
  Enemy,
  Role,
  RouteKnowledge,
  SituationKind,
  SituationKnowledge,
  PullStep,
  Spawn,
} from '../schema/types';
import type { LearningProgress, RecallRecord } from './progress';
import { getRouteStepAnchorSpawnIds } from './resolve';
import { getPullStepForces } from '../schema/validate';

export type LearningMode = 'quick' | 'overview' | 'full';

/**
 * The route context shown inside a lesson is deliberately not a second route
 * model. It resolves the existing PullStep into the smallest useful learning
 * surface: known spawns/enemies, source-plane anchors, and whether a complete
 * pull/forces fact is actually available for this document revision.
 */
export interface LearningWaveContext {
  route: RouteKnowledge;
  step: PullStep;
  anchorSpawnIds: string[];
  spawns: Spawn[];
  enemies: Enemy[];
  forcesPoints: number;
  hasCompletePull: boolean;
  hasVerifiedForces: boolean;
}

export interface LearningLesson {
  situation: SituationKnowledge;
  abilities: AbilityKnowledge[];
  routeSteps: PullStep[];
  waveContexts: LearningWaveContext[];
  route?: RouteKnowledge;
  index: number;
  fingerprint: string;
}

export interface LearningProgressSummary {
  completedCount: number;
  masteredCount: number;
  fuzzyCount: number;
  unknownCount: number;
  weakCount: number;
}

const quickKinds = new Set<SituationKind>(['critical', 'boss']);

function isIncluded(mode: LearningMode, kind: SituationKind): boolean {
  if (mode === 'full') return true;
  if (mode === 'overview') return kind !== 'routine';
  return quickKinds.has(kind);
}

export function getLearningWaveContexts(
  document: DungeonDocument,
  route: RouteKnowledge | undefined,
  routeSteps: PullStep[],
): LearningWaveContext[] {
  if (!route) return [];

  const spawnsById = new Map(document.spawns.map((spawn) => [spawn.id, spawn]));
  const enemiesById = new Map(document.enemies.map((enemy) => [enemy.id, enemy]));
  return routeSteps.map((step) => {
    const spawns = step.spawnIds.flatMap((spawnId) => {
      const spawn = spawnsById.get(spawnId);
      return spawn ? [spawn] : [];
    });
    const anchorSpawnIds = getRouteStepAnchorSpawnIds(document, step);
    const contextualSpawns = [
      ...spawns,
      ...anchorSpawnIds.flatMap((spawnId) => {
        const spawn = spawnsById.get(spawnId);
        return spawn ? [spawn] : [];
      }),
    ];
    const enemies = [...new Set(contextualSpawns.map((spawn) => spawn.enemyId))].flatMap(
      (enemyId) => {
        const enemy = enemiesById.get(enemyId);
        return enemy ? [enemy] : [];
      },
    );
    const hasCompletePull =
      document.spatialStatus === 'verified' &&
      step.spawnIds.length > 0 &&
      spawns.length === step.spawnIds.length;
    const hasVerifiedForces =
      hasCompletePull &&
      document.totalEnemyForcesPoints > 0 &&
      enemies.length > 0 &&
      enemies.every((enemy) => enemy.forcesStatus === 'verified');

    return {
      route,
      step,
      anchorSpawnIds,
      spawns,
      enemies,
      forcesPoints: getPullStepForces(document, step),
      hasCompletePull,
      hasVerifiedForces,
    };
  });
}

export function buildLearningPlan(document: DungeonDocument, mode: LearningMode): LearningLesson[] {
  const abilitiesById = new Map(document.abilities.map((ability) => [ability.id, ability]));
  const routeContextsBySituation = new Map<
    string,
    Array<{ route: RouteKnowledge; step: PullStep }>
  >();

  document.routes.forEach((route) => {
    route.steps.forEach((step) => {
      if (step.type !== 'pull') return;
      step.situationRefs.forEach(({ situationId }) => {
        const contexts = routeContextsBySituation.get(situationId) ?? [];
        contexts.push({ route, step });
        routeContextsBySituation.set(situationId, contexts);
      });
    });
  });

  const sortedSituations = [...document.situations]
    .filter((situation) => isIncluded(mode, situation.kind))
    .sort((a, b) => {
      const aOrder = routeContextsBySituation.get(a.id)?.[0]?.step.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = routeContextsBySituation.get(b.id)?.[0]?.step.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.id.localeCompare(b.id);
    });

  return sortedSituations.map((situation, index) => {
    const abilities = situation.focusAbilityIds.flatMap((abilityId) => {
      const ability = abilitiesById.get(abilityId);
      return ability ? [ability] : [];
    });
    const routeContexts = routeContextsBySituation.get(situation.id) ?? [];
    const routeSteps = routeContexts.map(({ step }) => step);
    const route = routeContexts[0]?.route;
    const waveContexts = routeContexts.flatMap(({ route: contextRoute, step }) =>
      getLearningWaveContexts(document, contextRoute, [step]),
    );
    return {
      situation,
      abilities,
      routeSteps,
      waveContexts,
      route,
      index,
      fingerprint: getKnowledgeFingerprint(situation, abilities, routeSteps, waveContexts),
    };
  });
}

function hashFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getKnowledgeFingerprint(
  situation: SituationKnowledge,
  abilities: AbilityKnowledge[],
  routeSteps: PullStep[],
  waveContexts: LearningWaveContext[] = [],
): string {
  const payload = JSON.stringify({
    situation,
    abilities,
    routeSteps,
    waveContexts: waveContexts.map((context) => ({
      routeId: context.route.id,
      stepId: context.step.id,
      anchorSpawnIds: context.anchorSpawnIds,
      spawnIds: context.spawns.map((spawn) => spawn.id),
      enemyIds: context.enemies.map((enemy) => enemy.id),
      forcesPoints: context.forcesPoints,
      hasCompletePull: context.hasCompletePull,
      hasVerifiedForces: context.hasVerifiedForces,
    })),
  });
  return `v1:${hashFingerprint(payload)}`;
}

export function getLessonRecallRecord(
  progress: LearningProgress,
  dungeonId: string,
  lesson: LearningLesson,
): RecallRecord | undefined {
  const record = progress.byDungeon[dungeonId]?.bySituation[lesson.situation.id];
  return record?.contentFingerprint === lesson.fingerprint ? record : undefined;
}

export function getLearningProgressSummary(
  plan: LearningLesson[],
  progress: LearningProgress,
  dungeonId: string,
): LearningProgressSummary {
  let completedCount = 0;
  let masteredCount = 0;
  let fuzzyCount = 0;
  let unknownCount = 0;

  plan.forEach((lesson) => {
    const record = getLessonRecallRecord(progress, dungeonId, lesson);
    if (!record) return;
    if (record.revealed) completedCount += 1;
    if (record.revealed && record.confidence === 'ready') masteredCount += 1;
    if (record.confidence === 'fuzzy') fuzzyCount += 1;
    if (record.confidence === 'unknown') unknownCount += 1;
  });

  return {
    completedCount,
    masteredCount,
    fuzzyCount,
    unknownCount,
    weakCount: plan.length - masteredCount,
  };
}

export function isRecallDue(record: RecallRecord | undefined, now = Date.now()): boolean {
  if (!record || record.confidence !== 'ready' || !record.revealed) return true;
  const updatedAt = Date.parse(record.updatedAt);
  return !Number.isFinite(updatedAt) || now - updatedAt >= 24 * 60 * 60 * 1000;
}

export function getDueLessons(
  plan: LearningLesson[],
  progress: LearningProgress,
  dungeonId: string,
  limit = 3,
  now = Date.now(),
): LearningLesson[] {
  return plan
    .filter((lesson) => isRecallDue(getLessonRecallRecord(progress, dungeonId, lesson), now))
    .sort((a, b) => {
      const aRecord = getLessonRecallRecord(progress, dungeonId, a);
      const bRecord = getLessonRecallRecord(progress, dungeonId, b);
      const priority = (record: RecallRecord | undefined) =>
        !record ? 0 : record.confidence === 'unknown' ? 1 : record.confidence === 'fuzzy' ? 2 : 3;
      return priority(aRecord) - priority(bRecord) || a.index - b.index;
    })
    .slice(0, limit);
}

/**
 * Returns only lessons that still need active recall. A lesson is weak until
 * the user has revealed it with `ready`; fuzzy/unknown answers and an
 * unrevealed confidence choice remain intentionally reviewable.
 */
export function getWeakLessons(
  plan: LearningLesson[],
  progress: LearningProgress,
  dungeonId: string,
): LearningLesson[] {
  return plan.filter((lesson) => {
    const record = getLessonRecallRecord(progress, dungeonId, lesson);
    return !record || !record.revealed || record.confidence !== 'ready';
  });
}

export function getRoleText(
  role: Role,
  situation: SituationKnowledge,
  ability: AbilityKnowledge,
): string | undefined {
  return ability.roleAdvice?.[role]?.zhCN ?? situation.roleAdvice?.[role]?.zhCN;
}

export function getLessonSharePath(
  dungeonId: string,
  mode: LearningMode,
  situationId: string,
  role?: Role,
): string {
  const params = new URLSearchParams({ mode, situation: situationId });
  if (role) params.set('role', role);
  return `/dungeons/${encodeURIComponent(dungeonId)}/learn?${params.toString()}`;
}
