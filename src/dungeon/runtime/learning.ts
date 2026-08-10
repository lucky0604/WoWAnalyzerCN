import type {
  AbilityKnowledge,
  DungeonDocument,
  Role,
  RouteKnowledge,
  SituationKind,
  SituationKnowledge,
  PullStep,
} from '../schema/types';
import type { LearningProgress, RecallRecord } from './progress';

export type LearningMode = 'quick' | 'overview' | 'full';

export interface LearningLesson {
  situation: SituationKnowledge;
  abilities: AbilityKnowledge[];
  routeSteps: PullStep[];
  route?: RouteKnowledge;
  index: number;
  fingerprint: string;
}

const quickKinds = new Set<SituationKind>(['critical', 'boss']);

function isIncluded(mode: LearningMode, kind: SituationKind): boolean {
  if (mode === 'full') return true;
  if (mode === 'overview') return kind !== 'routine';
  return quickKinds.has(kind);
}

export function buildLearningPlan(document: DungeonDocument, mode: LearningMode): LearningLesson[] {
  const abilitiesById = new Map(document.abilities.map((ability) => [ability.id, ability]));
  const routeStepsBySituation = new Map<string, PullStep[]>();
  const routeBySituation = new Map<string, RouteKnowledge>();

  document.routes.forEach((route) => {
    route.steps.forEach((step) => {
      if (step.type !== 'pull') return;
      step.situationRefs.forEach(({ situationId }) => {
        const steps = routeStepsBySituation.get(situationId) ?? [];
        steps.push(step);
        routeStepsBySituation.set(situationId, steps);
        routeBySituation.set(situationId, route);
      });
    });
  });

  const sortedSituations = [...document.situations]
    .filter((situation) => isIncluded(mode, situation.kind))
    .sort((a, b) => {
      const aOrder = routeStepsBySituation.get(a.id)?.[0]?.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = routeStepsBySituation.get(b.id)?.[0]?.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.id.localeCompare(b.id);
    });

  return sortedSituations.map((situation, index) => {
    const abilities = situation.focusAbilityIds.flatMap((abilityId) => {
      const ability = abilitiesById.get(abilityId);
      return ability ? [ability] : [];
    });
    const routeSteps = routeStepsBySituation.get(situation.id) ?? [];
    return {
      situation,
      abilities,
      routeSteps,
      route: routeBySituation.get(situation.id),
      index,
      fingerprint: getKnowledgeFingerprint(situation, abilities, routeSteps),
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
): string {
  const payload = JSON.stringify({
    situation,
    abilities,
    routeSteps,
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
