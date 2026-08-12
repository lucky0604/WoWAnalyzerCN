import type {
  AbilityKnowledge,
  DungeonDocument,
  PullStep,
  RouteKnowledge,
  SituationKnowledge,
} from './types';

export interface DungeonContentCoverageOptions {
  /** Restrict route-backed references to one route intent when a gate needs it. */
  routeIntent?: RouteKnowledge['intent'];
}

export interface KnowledgeCoverageReferences {
  routeIds: string[];
  situationIds: string[];
  bossIds: string[];
  enemyIds: string[];
}

export interface SituationCoverageEntry {
  situation: SituationKnowledge;
  references: KnowledgeCoverageReferences;
  hasRouteCoverage: boolean;
  hasFullRouteCoverage: boolean;
}

export interface AbilityCoverageEntry {
  ability: AbilityKnowledge;
  references: KnowledgeCoverageReferences;
  hasLearningSurface: boolean;
}

export interface DungeonContentCoverage {
  situations: SituationCoverageEntry[];
  abilities: AbilityCoverageEntry[];
  route: {
    pullCount: number;
    pullsWithSituation: number;
    pullsWithoutSituation: PullStep[];
    fullSituationReferenceCount: number;
    partialSituationReferenceCount: number;
  };
  bosses: {
    total: number;
    withoutFocusAbilityIds: string[];
  };
  uncoveredSituationIds: string[];
  incompleteSituationIds: string[];
  uncoveredDecisionCriticalAbilityIds: string[];
}

const emptyReferences = (): KnowledgeCoverageReferences => ({
  routeIds: [],
  situationIds: [],
  bossIds: [],
  enemyIds: [],
});

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function addReference(
  references: Map<string, KnowledgeCoverageReferences>,
  id: string,
  collection: keyof KnowledgeCoverageReferences,
  sourceId: string,
): void {
  const target = references.get(id) ?? emptyReferences();
  pushUnique(target[collection], sourceId);
  references.set(id, target);
}

function getRoutes(
  document: DungeonDocument,
  options: DungeonContentCoverageOptions,
): RouteKnowledge[] {
  return options.routeIntent
    ? document.routes.filter((route) => route.intent === options.routeIntent)
    : [...document.routes];
}

function getPullSteps(routes: readonly RouteKnowledge[]): PullStep[] {
  return routes.flatMap((route) =>
    route.steps.filter((step): step is PullStep => step.type === 'pull'),
  );
}

/**
 * Builds a deterministic report of where authored knowledge is surfaced.
 * Enemy ownership is recorded separately from learning surfaces so a spell
 * that is merely attached to an NPC cannot accidentally count as taught.
 */
export function getDungeonContentCoverage(
  document: DungeonDocument,
  options: DungeonContentCoverageOptions = {},
): DungeonContentCoverage {
  const situationReferences = new Map<string, KnowledgeCoverageReferences>();
  const abilityReferences = new Map<string, KnowledgeCoverageReferences>();
  const routes = getRoutes(document, options);
  const routeSteps = getPullSteps(routes);
  let fullSituationReferenceCount = 0;
  let partialSituationReferenceCount = 0;

  document.enemies.forEach((enemy) => {
    enemy.abilityIds.forEach((abilityId) =>
      addReference(abilityReferences, abilityId, 'enemyIds', enemy.id),
    );
  });

  const routeSituationIds = options.routeIntent ? new Set<string>() : undefined;
  routes.forEach((route) => {
    route.steps.forEach((step) => {
      if (step.type !== 'pull' && step.type !== 'event') return;
      step.situationRefs.forEach(({ situationId, coverage }) => {
        routeSituationIds?.add(situationId);
        addReference(situationReferences, situationId, 'routeIds', route.id);
        if (coverage === 'full') fullSituationReferenceCount += 1;
        else partialSituationReferenceCount += 1;
      });
      if (step.type === 'pull') {
        step.focusAbilityIds.forEach((abilityId) =>
          addReference(abilityReferences, abilityId, 'routeIds', route.id),
        );
      }
    });
  });

  document.situations.forEach((situation) => {
    if (options.routeIntent && !routeSituationIds?.has(situation.id)) return;
    situation.focusAbilityIds.forEach((abilityId) =>
      addReference(abilityReferences, abilityId, 'situationIds', situation.id),
    );
  });

  document.bosses.forEach((boss) => {
    boss.focusAbilityIds.forEach((abilityId) =>
      addReference(abilityReferences, abilityId, 'bossIds', boss.id),
    );
  });

  const situations = document.situations.map((situation) => {
    const references = situationReferences.get(situation.id) ?? emptyReferences();
    const hasRouteCoverage = references.routeIds.length > 0;
    return {
      situation,
      references,
      hasRouteCoverage,
      hasFullRouteCoverage:
        hasRouteCoverage &&
        routes.some((route) =>
          route.steps.some(
            (step) =>
              (step.type === 'pull' || step.type === 'event') &&
              step.situationRefs.some(
                (reference) =>
                  reference.situationId === situation.id && reference.coverage === 'full',
              ),
          ),
        ),
    };
  });

  const abilities = document.abilities.map((ability) => {
    const references = abilityReferences.get(ability.id) ?? emptyReferences();
    return {
      ability,
      references,
      hasLearningSurface:
        references.routeIds.length > 0 ||
        references.situationIds.length > 0 ||
        references.bossIds.length > 0,
    };
  });

  const pullsWithoutSituation = routeSteps.filter((step) => step.situationRefs.length === 0);

  return {
    situations,
    abilities,
    route: {
      pullCount: routeSteps.length,
      pullsWithSituation: routeSteps.length - pullsWithoutSituation.length,
      pullsWithoutSituation,
      fullSituationReferenceCount,
      partialSituationReferenceCount,
    },
    bosses: {
      total: document.bosses.length,
      withoutFocusAbilityIds: document.bosses
        .filter((boss) => boss.focusAbilityIds.length === 0)
        .map((boss) => boss.id),
    },
    uncoveredSituationIds: situations
      .filter((entry) => !entry.hasRouteCoverage && entry.situation.kind !== 'boss')
      .map((entry) => entry.situation.id),
    incompleteSituationIds: situations
      .filter(
        (entry) =>
          entry.hasRouteCoverage && !entry.hasFullRouteCoverage && entry.situation.kind !== 'boss',
      )
      .map((entry) => entry.situation.id),
    uncoveredDecisionCriticalAbilityIds: abilities
      .filter((entry) => entry.ability.decisionCritical && !entry.hasLearningSurface)
      .map((entry) => entry.ability.id),
  };
}
