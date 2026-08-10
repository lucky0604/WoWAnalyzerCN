import type {
  AbilityKnowledge,
  DungeonDocument,
  Role,
  RouteKnowledge,
  SituationKind,
  SituationKnowledge,
  PullStep,
} from '../schema/types';

export type LearningMode = 'quick' | 'overview' | 'full';

export interface LearningLesson {
  situation: SituationKnowledge;
  abilities: AbilityKnowledge[];
  routeSteps: PullStep[];
  route?: RouteKnowledge;
  index: number;
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

  return sortedSituations.map((situation, index) => ({
    situation,
    abilities: situation.focusAbilityIds.flatMap((abilityId) => {
      const ability = abilitiesById.get(abilityId);
      return ability ? [ability] : [];
    }),
    routeSteps: routeStepsBySituation.get(situation.id) ?? [],
    route: routeBySituation.get(situation.id),
    index,
  }));
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
