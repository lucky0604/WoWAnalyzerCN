import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  AbilityKnowledge,
  BossKnowledge,
  ContentVersion,
  Diagnostic,
  DungeonDocument,
  Enemy,
  EventStep,
  LocalizedText,
  PullStep,
  Provenance,
  RouteKnowledge,
  SituationKnowledge,
} from '../../src/dungeon/schema/types';
import { getPullStepForces } from '../../src/dungeon/schema/validate';

/**
 * Drafts intentionally live outside the runtime registry. A maintainer must
 * review the generated document and explicitly register it before it can be
 * exposed as learning content.
 */
export const DEFAULT_AUTHORING_ROOT = resolve('src/dungeon/data/authoring');

type AuthoringEntity = 'enemy' | 'ability' | 'situation' | 'boss' | 'route-step';

interface AuthoringCommandOptions {
  root?: string;
  season?: string;
  slug?: string;
  id?: string;
  name?: string;
  npcId?: number;
  spellId?: number;
  forces?: number;
  casterEnemyIds?: string[];
  enemyId?: string;
  floorId?: string;
  spawnIds?: string[];
  situationIds?: string[];
  focusAbilityIds?: string[];
  type?: 'event' | 'pull';
}

const localized = (value: string): LocalizedText => ({ zhCN: value, enUS: value });

const authoringProvenance = (slug: string): Provenance => ({
  type: 'manual-test',
  title: `Authoring scaffold for ${slug}`,
  snapshot: 'authoring-scaffold-v1',
  retrievedAt: new Date().toISOString().slice(0, 10),
  licenseStatus: 'needs-review',
  notes: '仅用于内容编辑起步；进入 reviewed/published 前必须替换为已批准事实来源。',
});

const versionFor = (season: string): ContentVersion => ({
  season,
  build: 'authoring-scaffold',
  revision: 1,
  status: 'draft',
});

function assertSlug(value: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`DUNGEON_AUTHORING_SLUG_INVALID: ${value}`);
  }
  return value;
}

function parseOption(args: string[], name: string): string | undefined {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  const next = index >= 0 ? args[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
}

function parseNumberOption(args: string[], name: string, fallback: number): number {
  const value = parseOption(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`DUNGEON_AUTHORING_OPTION_INVALID: ${name}=${value}`);
  }
  return parsed;
}

function parseOptionalNumberOption(args: string[], name: string): number | undefined {
  return parseOption(args, name) === undefined ? undefined : parseNumberOption(args, name, 0);
}

function parseListOption(args: string[], name: string): string[] {
  const value = parseOption(args, name);
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parseStepType(args: string[]): 'event' | 'pull' {
  const value = parseOption(args, '--type');
  if (!value || value === 'event' || value === 'pull') return value ?? 'event';
  throw new Error(`DUNGEON_AUTHORING_OPTION_INVALID: --type=${value}`);
}

function documentPath(root: string, slug: string): string {
  return resolve(root, slug, 'document.json');
}

function readmePath(root: string, slug: string): string {
  return resolve(root, slug, 'AUTHORING.md');
}

export function makeAuthoringScaffold(slugInput: string, season = 'midnight-s2'): DungeonDocument {
  const slug = assertSlug(slugInput);
  const floorId = `${slug}-floor-1`;
  const provenance = authoringProvenance(slug);
  return {
    id: slug,
    slug,
    name: localized(`TODO：${slug}`),
    season,
    dataStatus: 'draft',
    spatialStatus: 'pending',
    version: versionFor(season),
    totalEnemyForcesPoints: 0,
    floors: [
      {
        id: floorId,
        name: localized('TODO：默认区域'),
        coordinateSpace: 'normalized-v1',
        bounds: { xMin: 0, xMax: 100, yMin: -100, yMax: 0 },
      },
    ],
    spawns: [],
    enemies: [],
    abilities: [],
    situations: [],
    routes: [],
    bosses: [],
    provenance: [provenance],
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function loadAuthoringDocument(
  slugInput: string,
  root = DEFAULT_AUTHORING_ROOT,
): Promise<DungeonDocument> {
  const slug = assertSlug(slugInput);
  const path = documentPath(root, slug);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(`DUNGEON_AUTHORING_NOT_FOUND: ${path}`);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    const candidate = parsed as Partial<DungeonDocument>;
    const requiredArrays: Array<keyof DungeonDocument> = [
      'floors',
      'spawns',
      'enemies',
      'abilities',
      'situations',
      'routes',
      'bosses',
      'provenance',
    ];
    if (requiredArrays.some((key) => !Array.isArray(candidate[key]))) {
      throw new Error('missing required arrays');
    }
    return parsed as DungeonDocument;
  } catch {
    throw new Error(`DUNGEON_AUTHORING_DOCUMENT_INVALID: ${path}`);
  }
}

function nextEntityId(document: DungeonDocument, prefix: string): string {
  const ids = [
    ...document.enemies.map((item) => item.id),
    ...document.abilities.map((item) => item.id),
    ...document.situations.map((item) => item.id),
    ...document.bosses.map((item) => item.id),
    ...document.routes.flatMap((route) => [route.id, ...route.steps.map((step) => step.id)]),
  ];
  let index = 1;
  while (ids.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function ensureFirstFloor(document: DungeonDocument): string {
  const floorId = document.floors[0]?.id;
  if (!floorId) throw new Error(`DUNGEON_AUTHORING_NO_FLOOR: ${document.id}`);
  return floorId;
}

function provenanceFor(document: DungeonDocument): Provenance[] {
  return document.provenance.length > 0
    ? document.provenance
    : [authoringProvenance(document.slug)];
}

function addEnemy(document: DungeonDocument, options: AuthoringCommandOptions): DungeonDocument {
  const id = options.id ?? nextEntityId(document, `${document.slug}-enemy`);
  const name = options.name ?? `TODO：${id}`;
  const enemy: Enemy = {
    id,
    ...(options.npcId === undefined ? {} : { npcId: options.npcId }),
    name: localized(name),
    forcesPoints: options.forces ?? 0,
    forcesStatus: 'pending',
    isBoss: false,
    spawnIds: [],
    abilityIds: [],
    provenance: provenanceFor(document),
  };
  return { ...document, enemies: [...document.enemies, enemy] };
}

function addAbility(document: DungeonDocument, options: AuthoringCommandOptions): DungeonDocument {
  const id = options.id ?? nextEntityId(document, `${document.slug}-ability`);
  const name = options.name ?? `TODO：${id}`;
  const ability: AbilityKnowledge = {
    id,
    ...(options.spellId === undefined ? {} : { spellId: options.spellId }),
    name: localized(name),
    casterEnemyIds: options.casterEnemyIds ?? [],
    decisionCritical: false,
    severity: 'info',
    action: localized('TODO：填写玩家可执行动作。'),
    consequence: localized('TODO：填写漏处理后果。'),
    version: document.version,
    provenance: provenanceFor(document),
  };
  return { ...document, abilities: [...document.abilities, ability] };
}

function addSituation(
  document: DungeonDocument,
  options: AuthoringCommandOptions,
): DungeonDocument {
  const id = options.id ?? nextEntityId(document, `${document.slug}-situation`);
  const floorId = options.floorId ?? ensureFirstFloor(document);
  const name = options.name ?? `TODO：${id}`;
  const situation: SituationKnowledge = {
    id,
    dungeonId: document.id,
    kind: 'routine',
    title: localized(name),
    floorIds: [floorId],
    anchorSpawnIds: [],
    summary: localized('TODO：解释这个稳定场景的危险因果。'),
    focusAbilityIds: options.focusAbilityIds ?? [],
    memoryCue: localized('TODO：写一句可复述记忆句。'),
    version: document.version,
    provenance: provenanceFor(document),
  };
  return { ...document, situations: [...document.situations, situation] };
}

function addBoss(document: DungeonDocument, options: AuthoringCommandOptions): DungeonDocument {
  const id = options.id ?? nextEntityId(document, `${document.slug}-boss`);
  const enemyId =
    options.enemyId ??
    document.enemies.find((enemy) => enemy.isBoss)?.id ??
    document.enemies[0]?.id;
  const boss: BossKnowledge = {
    id,
    enemyId: enemyId ?? `${document.slug}-TODO-boss-enemy`,
    title: localized(options.name ?? `TODO：${id}`),
    summary: localized('TODO：填写 Boss 阶段和常见失败。'),
    focusAbilityIds: options.focusAbilityIds ?? [],
    version: document.version,
    provenance: provenanceFor(document),
  };
  return { ...document, bosses: [...document.bosses, boss] };
}

function addRouteStep(
  document: DungeonDocument,
  options: AuthoringCommandOptions,
): DungeonDocument {
  const floorId = options.floorId ?? ensureFirstFloor(document);
  const routeId = `${document.slug}-learning-route`;
  const existingRoute = document.routes.find((route) => route.id === routeId);
  const route: RouteKnowledge = existingRoute ?? {
    id: routeId,
    dungeonId: document.id,
    name: localized('TODO：学习路线'),
    intent: 'learning',
    steps: [],
    expectedEnemyForcesPoints: 0,
    version: document.version,
    provenance: provenanceFor(document),
  };
  const stepId = options.id ?? nextEntityId(document, `${document.slug}-route-step`);
  const situationRefs = (options.situationIds ?? []).map((situationId) => ({
    situationId,
    coverage: 'full' as const,
  }));
  const step: EventStep | PullStep =
    options.type === 'pull'
      ? {
          type: 'pull',
          id: stepId,
          order: route.steps.length + 1,
          title: localized(options.name ?? `TODO：学习波次 ${route.steps.length + 1}`),
          floorId,
          spawnIds: options.spawnIds ?? [],
          situationRefs,
          rationale: localized('TODO：解释这波为什么这样组织。'),
          focusAbilityIds: options.focusAbilityIds ?? [],
        }
      : {
          type: 'event',
          id: stepId,
          order: route.steps.length + 1,
          title: localized(options.name ?? `TODO：学习节点 ${route.steps.length + 1}`),
          floorId,
          situationRefs,
          instruction: localized('TODO：填写进入这个学习节点前后的动作。'),
        };
  const nextRoute = { ...route, steps: [...route.steps, step] };
  nextRoute.expectedEnemyForcesPoints = nextRoute.steps
    .filter((candidate): candidate is PullStep => candidate.type === 'pull')
    .reduce((total, candidate) => total + getPullStepForces(document, candidate), 0);
  return {
    ...document,
    routes: existingRoute
      ? document.routes.map((candidate) => (candidate.id === route.id ? nextRoute : candidate))
      : [...document.routes, nextRoute],
  };
}

export function addAuthoringEntity(
  document: DungeonDocument,
  entity: AuthoringEntity,
  options: AuthoringCommandOptions = {},
): DungeonDocument {
  switch (entity) {
    case 'enemy':
      return addEnemy(document, options);
    case 'ability':
      return addAbility(document, options);
    case 'situation':
      return addSituation(document, options);
    case 'boss':
      return addBoss(document, options);
    case 'route-step':
      return addRouteStep(document, options);
    default:
      throw new Error(`DUNGEON_AUTHORING_ENTITY_INVALID: ${entity}`);
  }
}

function includesTodo(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('TODO');
  if (Array.isArray(value)) return value.some(includesTodo);
  if (value && typeof value === 'object') {
    return Object.values(value).some(includesTodo);
  }
  return false;
}

export function authoringDiagnostics(document: DungeonDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const requiredCollections: Array<[keyof DungeonDocument, string, string]> = [
    ['enemies', 'DUNGEON_AUTHORING_EMPTY_ENEMIES', '至少添加一个 Enemy。'],
    ['abilities', 'DUNGEON_AUTHORING_EMPTY_ABILITIES', '至少添加一个 AbilityKnowledge。'],
    ['situations', 'DUNGEON_AUTHORING_EMPTY_SITUATIONS', '至少添加一个稳定 Situation。'],
    ['routes', 'DUNGEON_AUTHORING_EMPTY_ROUTES', '至少添加一条学习路线。'],
    ['bosses', 'DUNGEON_AUTHORING_EMPTY_BOSSES', '至少添加一个 BossKnowledge。'],
  ];
  requiredCollections.forEach(([field, code, message]) => {
    const value = document[field];
    if (Array.isArray(value) && value.length === 0) {
      diagnostics.push({
        severity: 'error',
        code,
        path: field,
        message,
        entityId: document.id,
      });
    }
  });
  if (document.dataStatus !== 'draft') {
    diagnostics.push({
      severity: 'error',
      code: 'DUNGEON_AUTHORING_STATUS_INVALID',
      path: 'dataStatus',
      message: 'authoring 目录中的文档必须保持 draft，不能绕过正式 registry 发布。',
      entityId: document.id,
    });
  }
  if (document.version.status !== 'draft') {
    diagnostics.push({
      severity: 'error',
      code: 'DUNGEON_AUTHORING_VERSION_STATUS_INVALID',
      path: 'version.status',
      message: 'authoring 文档的版本状态必须保持 draft。',
      entityId: document.id,
    });
  }
  if (
    document.provenance.length === 0 ||
    document.provenance.some((source) => source.licenseStatus !== 'approved')
  ) {
    diagnostics.push({
      severity: 'error',
      code: 'DUNGEON_AUTHORING_PROVENANCE_UNREVIEWED',
      path: 'provenance',
      message: '进入 reviewed 前必须补齐并批准事实来源 provenance。',
      entityId: document.id,
    });
  }
  if (includesTodo(document)) {
    diagnostics.push({
      severity: 'error',
      code: 'DUNGEON_AUTHORING_TODO_REMAINING',
      path: 'document',
      message: '文档仍包含 TODO 占位；进入 reviewed 前必须全部替换并完成来源审校。',
      entityId: document.id,
    });
  }
  return diagnostics;
}

async function createScaffold(options: AuthoringCommandOptions): Promise<void> {
  const slug = assertSlug(options.slug ?? '');
  const root = options.root ?? DEFAULT_AUTHORING_ROOT;
  const path = documentPath(root, slug);
  try {
    await readFile(path, 'utf8');
    throw new Error(`DUNGEON_AUTHORING_EXISTS: ${path}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DUNGEON_AUTHORING_EXISTS')) throw error;
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  const document = makeAuthoringScaffold(slug, options.season ?? 'midnight-s2');
  await writeJson(path, document);
  await writeFile(
    readmePath(root, slug),
    `# ${slug} authoring draft\n\n` +
      '> This draft is not registered in the runtime catalog. Replace every TODO and provenance placeholder before review.\n\n' +
      '## Checklist\n\n' +
      '- [ ] Replace metadata and floor bounds\n' +
      '- [ ] Import/verify enemy and spawn facts\n' +
      '- [ ] Add decision-critical abilities with actions and consequences\n' +
      '- [ ] Add stable Situations and a learning route\n' +
      '- [ ] Add BossKnowledge and approved provenance\n' +
      '- [ ] Record review.selfTest for the learning modes and every Situation/Route\n' +
      '- [ ] Record review.authoringEffort for every Routine/Critical Situation and the full dungeon\n' +
      '- [ ] Run `pnpm dungeon:check --dungeon ' +
      slug +
      '`\n' +
      '- [ ] Obtain second-person review before registering the document\n',
    'utf8',
  );
  console.log(`Created authoring draft: ${path}`);
}

async function appendEntity(
  entity: AuthoringEntity,
  options: AuthoringCommandOptions,
): Promise<void> {
  const slug = assertSlug(options.slug ?? '');
  const root = options.root ?? DEFAULT_AUTHORING_ROOT;
  const document = await loadAuthoringDocument(slug, root);
  const next = addAuthoringEntity(document, entity, options);
  await writeJson(documentPath(root, slug), next);
  console.log(`Added ${entity} to ${documentPath(root, slug)}`);
}

export async function runAuthoringCommand(argv: string[]): Promise<void> {
  const mode = argv[0];
  const target = argv[1];
  const root = parseOption(argv, '--root');
  if (mode === 'new' && target === 'dungeon') {
    await createScaffold({
      root,
      slug: parseOption(argv, '--slug'),
      season: parseOption(argv, '--season'),
    });
    return;
  }
  if (
    mode === 'add' &&
    target &&
    ['enemy', 'ability', 'situation', 'boss', 'route-step'].includes(target)
  ) {
    await appendEntity(target as AuthoringEntity, {
      root,
      slug: parseOption(argv, '--dungeon'),
      id: parseOption(argv, '--id'),
      name: parseOption(argv, '--name'),
      npcId: parseOptionalNumberOption(argv, '--npc-id'),
      spellId: parseOptionalNumberOption(argv, '--spell-id'),
      forces: parseNumberOption(argv, '--forces', 0),
      casterEnemyIds: parseListOption(argv, '--caster'),
      enemyId: parseOption(argv, '--enemy'),
      floorId: parseOption(argv, '--floor'),
      spawnIds: parseListOption(argv, '--spawn'),
      situationIds: parseListOption(argv, '--situation'),
      focusAbilityIds: parseListOption(argv, '--ability'),
      type: parseStepType(argv),
    });
    return;
  }
  throw new Error(
    'DUNGEON_AUTHORING_USAGE: dungeon:new dungeon --season <season> --slug <slug>; ' +
      'dungeon:add <enemy|ability|situation|boss|route-step> --dungeon <slug>',
  );
}

if (process.argv[1]?.endsWith('scripts/dungeons/authoring.ts')) {
  runAuthoringCommand(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
