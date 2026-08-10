import type {
  AbilityKnowledge,
  DungeonDocument,
  Enemy,
  RouteKnowledge,
  RouteStep,
  SituationKnowledge,
  Spawn,
} from '../schema/types';

export type DungeonSearchKind = 'enemy' | 'ability' | 'situation' | 'route';

export interface DungeonSearchResult {
  kind: DungeonSearchKind;
  id: string;
  title: string;
  subtitle: string;
  score: number;
}

export interface EnemyReference {
  enemy: Enemy;
  abilities: AbilityKnowledge[];
  spawns: Spawn[];
  situations: SituationKnowledge[];
  routeSteps: Array<{ route: RouteKnowledge; step: RouteStep }>;
}

export interface AbilityReference {
  ability: AbilityKnowledge;
  casters: Enemy[];
  situations: SituationKnowledge[];
  spawns: Spawn[];
  routeSteps: Array<{ route: RouteKnowledge; step: RouteStep }>;
}

const searchableText = (values: Array<string | undefined>): string[] =>
  values
    .filter((value): value is string => Boolean(value))
    .map((value) => value.normalize('NFKD').toLocaleLowerCase());

const matchScore = (query: string, values: Array<string | undefined>): number => {
  if (!query) return 0;
  const normalizedQuery = query.normalize('NFKD').toLocaleLowerCase();
  return searchableText(values).reduce((best, value) => {
    if (value === normalizedQuery) return Math.max(best, 100);
    if (value.startsWith(normalizedQuery)) return Math.max(best, 70);
    if (value.includes(normalizedQuery)) return Math.max(best, 40);
    return best;
  }, 0);
};

const textValues = (value: { zhCN: string; enUS?: string }, id: string) => [
  value.zhCN,
  value.enUS,
  id,
];

export function searchDungeon(
  document: DungeonDocument,
  query: string,
  limit = 12,
): DungeonSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: DungeonSearchResult[] = [];
  document.enemies.forEach((enemy) => {
    const score = matchScore(trimmed, textValues(enemy.name, enemy.id));
    if (score > 0) {
      results.push({
        kind: 'enemy',
        id: enemy.id,
        title: enemy.name.zhCN,
        subtitle: `${enemy.isBoss ? 'Boss' : '小怪'} · ${enemy.abilityIds.length} 个技能`,
        score: score + 4,
      });
    }
  });
  document.abilities.forEach((ability) => {
    const score = matchScore(trimmed, textValues(ability.name, ability.id));
    if (score > 0) {
      results.push({
        kind: 'ability',
        id: ability.id,
        title: ability.name.zhCN,
        subtitle: `${ability.decisionCritical ? '关键技能' : '技能'} · ${ability.severity}`,
        score: score + 3,
      });
    }
  });
  document.situations.forEach((situation) => {
    const score = matchScore(trimmed, textValues(situation.title, situation.id));
    if (score > 0) {
      results.push({
        kind: 'situation',
        id: situation.id,
        title: situation.title.zhCN,
        subtitle: `Situation · ${situation.kind}`,
        score: score + 2,
      });
    }
  });
  document.routes.forEach((route) => {
    const score = matchScore(trimmed, textValues(route.name, route.id));
    if (score > 0) {
      results.push({
        kind: 'route',
        id: route.id,
        title: route.name.zhCN,
        subtitle: `路线 · ${route.intent}`,
        score,
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function getEnemyReference(
  document: DungeonDocument,
  enemyId: string,
): EnemyReference | undefined {
  const enemy = document.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) return undefined;
  const abilities = enemy.abilityIds.flatMap((abilityId) => {
    const ability = document.abilities.find((candidate) => candidate.id === abilityId);
    return ability ? [ability] : [];
  });
  const spawns = document.spawns.filter((spawn) => spawn.enemyId === enemyId);
  const abilityIds = new Set(enemy.abilityIds);
  const situations = document.situations.filter(
    (situation) =>
      situation.anchorSpawnIds.some((spawnId) => enemy.spawnIds.includes(spawnId)) ||
      situation.focusAbilityIds.some((abilityId) => abilityIds.has(abilityId)),
  );
  const routeSteps = document.routes.flatMap((route) =>
    route.steps.flatMap((step) => {
      const isRelated =
        (step.type === 'pull' &&
          (step.spawnIds.some((spawnId) => enemy.spawnIds.includes(spawnId)) ||
            step.focusAbilityIds.some((abilityId) => abilityIds.has(abilityId)))) ||
        (step.type === 'event' &&
          step.situationRefs.some(({ situationId }) =>
            situations.some((situation) => situation.id === situationId),
          ));
      return isRelated ? [{ route, step }] : [];
    }),
  );
  return { enemy, abilities, spawns, situations, routeSteps };
}

export function getAbilityReference(
  document: DungeonDocument,
  abilityId: string,
): AbilityReference | undefined {
  const ability = document.abilities.find((candidate) => candidate.id === abilityId);
  if (!ability) return undefined;
  const casterIds = new Set(ability.casterEnemyIds);
  const casters = document.enemies.filter((enemy) => casterIds.has(enemy.id));
  const situations = document.situations.filter((situation) =>
    situation.focusAbilityIds.includes(abilityId),
  );
  const casterSpawnIds = new Set(casters.flatMap((enemy) => enemy.spawnIds));
  const spawns = document.spawns.filter((spawn) => casterSpawnIds.has(spawn.id));
  const routeSteps = document.routes.flatMap((route) =>
    route.steps.flatMap((step) => {
      const isRelated =
        (step.type === 'pull' && step.focusAbilityIds.includes(abilityId)) ||
        (step.type === 'event' &&
          step.situationRefs.some(({ situationId }) =>
            situations.some((situation) => situation.id === situationId),
          ));
      return isRelated ? [{ route, step }] : [];
    }),
  );
  return { ability, casters, situations, spawns, routeSteps };
}
