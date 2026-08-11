import type { DungeonCatalogEntry } from '../data/season2Catalog';
import { getDungeonCatalogEntry } from '../data/season2Catalog';
import type { DungeonDocument } from '../schema/types';
import { validateDungeonDocument } from '../schema/validate';
import {
  validateFactSnapshot,
  type FactSnapshot,
  type FactSnapshotDiagnostic,
} from './factSnapshot';
import {
  factBindingSchemaVersion,
  type FactBindingAbility,
  type FactBindingDiagnostic,
  type FactBindingEnemy,
  type FactBindingManifest,
} from './factBinding';

export const factBindingPlanSchemaVersion = 1 as const;

export type FactBindingPlanDigest = `sha256:${string}`;

export type FactBindingCandidateStatus = 'suggested' | 'ambiguous' | 'unmapped' | 'blocked';
export type FactBindingPlanStatus = 'ready-for-review' | 'needs-review' | 'blocked';

export interface FactBindingCandidate {
  documentId: string;
  reasons: string[];
}

export interface FactBindingEnemyPlanRow {
  sourceKey: string;
  npcId: number;
  isBoss: boolean;
  candidates: FactBindingCandidate[];
  status: FactBindingCandidateStatus;
}

export interface FactBindingAbilityPlanRow {
  sourceKey: string;
  spellId: number;
  casterEnemyKeys: string[];
  candidates: FactBindingCandidate[];
  status: FactBindingCandidateStatus;
}

export interface FactBindingPlan {
  version: typeof factBindingPlanSchemaVersion;
  planDigest: FactBindingPlanDigest;
  snapshot: {
    snapshotId: string;
    digest: FactSnapshot['digest'];
    dungeonId: string;
    season: string;
    gameBuild: string;
  };
  document: {
    id: string;
    season: string;
    gameBuild: string;
    revision: number;
  };
  manifestTemplate: FactBindingManifest;
  enemies: FactBindingEnemyPlanRow[];
  abilities: FactBindingAbilityPlanRow[];
  coverage: {
    snapshotEnemies: number;
    snapshotAbilities: number;
    documentEnemies: number;
    documentAbilities: number;
    unambiguousEnemyCandidates: number;
    unambiguousAbilityCandidates: number;
  };
  status: FactBindingPlanStatus;
}

type FactBindingPlanPayload = Omit<FactBindingPlan, 'planDigest'>;

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, stableSort(record[key])]),
  );
}

/** Canonical candidate plan payload; planDigest is intentionally excluded. */
export function serializeFactBindingPlanPayload(
  plan: FactBindingPlan | FactBindingPlanPayload,
): string {
  const payload = { ...plan } as Partial<FactBindingPlan>;
  delete payload.planDigest;
  return JSON.stringify(stableSort(payload));
}

export async function computeFactBindingPlanDigest(
  plan: FactBindingPlan | FactBindingPlanPayload,
): Promise<FactBindingPlanDigest> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('FACT_BINDING_PLAN_CRYPTO_UNAVAILABLE: Web Crypto is required.');
  const hash = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serializeFactBindingPlanPayload(plan)),
  );
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return `sha256:${hex}`;
}

export interface FactBindingPlanResult {
  ok: boolean;
  plan?: FactBindingPlan;
  errors: FactBindingDiagnostic[];
  warnings: FactBindingDiagnostic[];
}

export interface FactBindingPlanOptions {
  expectedGameBuild?: string;
  requireApproved?: boolean;
  catalogEntry?: DungeonCatalogEntry;
}

const sameValues = <T>(left: readonly T[], right: readonly T[]): boolean => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
};

const diagnostic = (
  severity: FactBindingDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactBindingDiagnostic => ({ severity, code, path, message });

const appendDiagnostics = (
  target: FactBindingDiagnostic[],
  incoming: readonly (FactBindingDiagnostic | FactSnapshotDiagnostic)[],
): void => {
  incoming.forEach((item) => target.push(item));
};

const contentStatuses = new Set(['draft', 'reviewed', 'published', 'stale']);

function validateDocumentVersionShape(document: unknown): FactBindingDiagnostic[] {
  const errors: FactBindingDiagnostic[] = [];
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return [
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_INVALID',
        'document',
        'authoring document 必须是对象。',
      ),
    ];
  }
  const value = document as Record<string, unknown>;
  const version = value.version;
  if (!version || typeof version !== 'object' || Array.isArray(version)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
        'document.version',
        'authoring document.version 必须是对象。',
      ),
    );
    return errors;
  }
  const contentVersion = version as Record<string, unknown>;
  if (typeof contentVersion.season !== 'string' || contentVersion.season.trim().length === 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
        'document.version.season',
        'document.version.season 必须是非空字符串。',
      ),
    );
  }
  if (typeof contentVersion.build !== 'string' || contentVersion.build.trim().length === 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
        'document.version.build',
        'document.version.build 必须是非空字符串。',
      ),
    );
  }
  if (!Number.isInteger(contentVersion.revision) || (contentVersion.revision as number) <= 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
        'document.version.revision',
        'document.version.revision 必须是正整数。',
      ),
    );
  }
  if (typeof contentVersion.status !== 'string' || !contentStatuses.has(contentVersion.status)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_INVALID',
        'document.version.status',
        'document.version.status 不是受支持的内容状态。',
      ),
    );
  }
  if (
    typeof value.season === 'string' &&
    typeof contentVersion.season === 'string' &&
    value.season !== contentVersion.season
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_VERSION_MISMATCH',
        'document.version.season',
        'document.version.season 必须与 document.season 一致。',
      ),
    );
  }
  return errors;
}

type DocumentEnemy = DungeonDocument['enemies'][number];
type DocumentAbility = DungeonDocument['abilities'][number];

interface DocumentFactIndexes {
  enemiesByNpcId: ReadonlyMap<number, readonly DocumentEnemy[]>;
  abilitiesBySpellId: ReadonlyMap<number, readonly DocumentAbility[]>;
  enemyNpcIdById: ReadonlyMap<string, number>;
  enemyIsBossById: ReadonlyMap<string, boolean>;
}

function buildDocumentFactIndexes(document: DungeonDocument): DocumentFactIndexes {
  const enemiesByNpcId = new Map<number, DocumentEnemy[]>();
  const enemyNpcIdById = new Map<string, number>();
  const enemyIsBossById = new Map<string, boolean>();
  document.enemies.forEach((enemy) => {
    if (enemy.npcId !== undefined) {
      const bucket = enemiesByNpcId.get(enemy.npcId) ?? [];
      bucket.push(enemy);
      enemiesByNpcId.set(enemy.npcId, bucket);
      enemyNpcIdById.set(enemy.id, enemy.npcId);
    }
    enemyIsBossById.set(enemy.id, enemy.isBoss);
  });

  const abilitiesBySpellId = new Map<number, DocumentAbility[]>();
  document.abilities.forEach((ability) => {
    if (ability.spellId !== undefined) {
      const bucket = abilitiesBySpellId.get(ability.spellId) ?? [];
      bucket.push(ability);
      abilitiesBySpellId.set(ability.spellId, bucket);
    }
  });

  return { enemiesByNpcId, abilitiesBySpellId, enemyNpcIdById, enemyIsBossById };
}

function enemyCandidates(
  sourceEnemy: FactSnapshot['enemies'][number],
  indexes: DocumentFactIndexes,
): { candidates: FactBindingCandidate[]; status: FactBindingCandidateStatus } {
  const candidates = (indexes.enemiesByNpcId.get(sourceEnemy.npcId) ?? []).map((enemy) => ({
    documentId: enemy.id,
    reasons: [
      'npc-id-exact',
      enemy.isBoss === sourceEnemy.isBoss ? 'isBoss-exact' : 'isBoss-mismatch',
    ],
  }));
  const kindMatches = candidates.filter(
    (candidate) => indexes.enemyIsBossById.get(candidate.documentId) === sourceEnemy.isBoss,
  );
  if (candidates.length === 0) return { candidates, status: 'unmapped' };
  if (kindMatches.length === 0) return { candidates, status: 'blocked' };
  return {
    candidates,
    status: candidates.length === 1 && kindMatches.length === 1 ? 'suggested' : 'ambiguous',
  };
}

function abilityCandidates(
  sourceAbility: FactSnapshot['abilities'][number],
  snapshotEnemiesByKey: ReadonlyMap<string, FactSnapshot['enemies'][number]>,
  indexes: DocumentFactIndexes,
): { candidates: FactBindingCandidate[]; status: FactBindingCandidateStatus } {
  const sourceCasterNpcIds = sourceAbility.casterEnemyKeys
    .map((key) => snapshotEnemiesByKey.get(key)?.npcId)
    .filter((npcId): npcId is number => npcId !== undefined);
  const candidates = (indexes.abilitiesBySpellId.get(sourceAbility.spellId) ?? []).map(
    (ability) => {
      const documentCasterNpcIds = ability.casterEnemyIds
        .map((enemyId) => indexes.enemyNpcIdById.get(enemyId))
        .filter((npcId): npcId is number => npcId !== undefined);
      const casterMatches = sameValues(sourceCasterNpcIds, documentCasterNpcIds);
      return {
        documentId: ability.id,
        reasons: [
          'spell-id-exact',
          casterMatches ? 'caster-npc-set-exact' : 'caster-npc-set-mismatch',
        ],
      };
    },
  );
  const casterMatches = candidates.filter((candidate) =>
    candidate.reasons.includes('caster-npc-set-exact'),
  );
  if (candidates.length === 0) return { candidates, status: 'unmapped' };
  if (casterMatches.length === 0) return { candidates, status: 'blocked' };
  return {
    candidates,
    status: candidates.length === 1 && casterMatches.length === 1 ? 'suggested' : 'ambiguous',
  };
}

function markCandidateTargetCollisions<
  T extends { candidates: FactBindingCandidate[]; status: FactBindingCandidateStatus },
>(rows: T[]): void {
  const rowsByTarget = new Map<string, Array<{ row: T; candidate: FactBindingCandidate }>>();
  rows.forEach((row) => {
    row.candidates.forEach((candidate) => {
      const targetRows = rowsByTarget.get(candidate.documentId) ?? [];
      targetRows.push({ row, candidate });
      rowsByTarget.set(candidate.documentId, targetRows);
    });
  });
  rowsByTarget.forEach((targetEntries) => {
    const uniqueRows = [...new Set(targetEntries.map(({ row }) => row))];
    if (uniqueRows.length < 2) return;
    targetEntries.forEach(({ row, candidate }) => {
      if (row.status !== 'blocked') row.status = 'ambiguous';
      if (!candidate.reasons.includes('target-id-collision')) {
        candidate.reasons.push('target-id-collision');
      }
    });
  });
}

export async function buildFactBindingPlan(
  document: DungeonDocument,
  rawSnapshot: unknown,
  options: FactBindingPlanOptions = {},
): Promise<FactBindingPlanResult> {
  const errors: FactBindingDiagnostic[] = [];
  const warnings: FactBindingDiagnostic[] = [];
  const documentShapeErrors = validateDocumentVersionShape(document);
  if (documentShapeErrors.length > 0) {
    return { ok: false, errors: documentShapeErrors, warnings };
  }
  let documentValidation;
  try {
    documentValidation = validateDungeonDocument(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        diagnostic(
          'error',
          'FACT_BINDING_PLAN_DOCUMENT_VALIDATION_FAILED',
          'document',
          `authoring document 校验异常：${message}`,
        ),
      ],
      warnings,
    };
  }
  appendDiagnostics(warnings, documentValidation.warnings);
  if (!documentValidation.ok) {
    appendDiagnostics(errors, documentValidation.errors);
    return { ok: false, errors, warnings };
  }

  const catalogEntry = options.catalogEntry ?? getDungeonCatalogEntry(document.id);
  if (!catalogEntry) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_CATALOG_ENTRY_REQUIRED',
        'document.id',
        `S2 目录中不存在副本：${document.id}。候选审计计划不能绑定未登记副本。`,
      ),
    );
    return { ok: false, errors, warnings };
  }
  if (catalogEntry.id !== document.id || catalogEntry.season !== document.season) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_CATALOG_DOCUMENT_MISMATCH',
        'document',
        `目录 ${catalogEntry.id}/${catalogEntry.season} 与文档 ${document.id}/${document.season} 不匹配。`,
      ),
    );
    return { ok: false, errors, warnings };
  }

  const snapshotValidation = await validateFactSnapshot(rawSnapshot, {
    entry: catalogEntry,
    requireApproved: options.requireApproved,
    expectedGameBuild:
      options.expectedGameBuild ?? (options.requireApproved ? undefined : document.version.build),
  });
  appendDiagnostics(errors, snapshotValidation.errors);
  appendDiagnostics(warnings, snapshotValidation.warnings);
  if (!snapshotValidation.ok || !snapshotValidation.snapshot) {
    return { ok: false, errors, warnings };
  }

  const snapshot = snapshotValidation.snapshot;
  if (snapshot.gameBuild !== document.version.build) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_PLAN_DOCUMENT_BUILD_MISMATCH',
        'gameBuild',
        `事实快照 build ${snapshot.gameBuild} 与 authoring document build ${document.version.build} 不匹配。`,
      ),
    );
    return { ok: false, errors, warnings };
  }
  const documentIndexes = buildDocumentFactIndexes(document);
  const snapshotEnemiesByKey = new Map(snapshot.enemies.map((enemy) => [enemy.enemyKey, enemy]));
  const enemyRows = snapshot.enemies.map((sourceEnemy) => {
    const match = enemyCandidates(sourceEnemy, documentIndexes);
    return {
      sourceKey: sourceEnemy.enemyKey,
      npcId: sourceEnemy.npcId,
      isBoss: sourceEnemy.isBoss,
      ...match,
    };
  });
  const abilityRows = snapshot.abilities.map((sourceAbility) => {
    const match = abilityCandidates(sourceAbility, snapshotEnemiesByKey, documentIndexes);
    return {
      sourceKey: sourceAbility.abilityKey,
      spellId: sourceAbility.spellId,
      casterEnemyKeys: [...sourceAbility.casterEnemyKeys],
      ...match,
    };
  });
  markCandidateTargetCollisions(enemyRows);
  markCandidateTargetCollisions(abilityRows);
  const hasBlockedRows = [...enemyRows, ...abilityRows].some(
    (row) => row.status === 'blocked' || row.status === 'ambiguous' || row.status === 'unmapped',
  );
  const hasHardBlockedRows = [...enemyRows, ...abilityRows].some((row) => row.status === 'blocked');
  const manifestTemplate: FactBindingManifest = {
    version: factBindingSchemaVersion,
    snapshotId: snapshot.snapshotId,
    snapshotDigest: snapshot.digest,
    dungeonId: snapshot.dungeonId,
    season: snapshot.season,
    gameBuild: snapshot.gameBuild,
    enemies: [] as FactBindingEnemy[],
    abilities: [] as FactBindingAbility[],
  };
  const planPayload: FactBindingPlanPayload = {
    version: factBindingPlanSchemaVersion,
    snapshot: {
      snapshotId: snapshot.snapshotId,
      digest: snapshot.digest,
      dungeonId: snapshot.dungeonId,
      season: snapshot.season,
      gameBuild: snapshot.gameBuild,
    },
    document: {
      id: document.id,
      season: document.season,
      gameBuild: document.version.build,
      revision: document.version.revision,
    },
    manifestTemplate,
    enemies: enemyRows,
    abilities: abilityRows,
    coverage: {
      snapshotEnemies: enemyRows.length,
      snapshotAbilities: abilityRows.length,
      documentEnemies: document.enemies.length,
      documentAbilities: document.abilities.length,
      unambiguousEnemyCandidates: enemyRows.filter((row) => row.status === 'suggested').length,
      unambiguousAbilityCandidates: abilityRows.filter((row) => row.status === 'suggested').length,
    },
    status: hasHardBlockedRows ? 'blocked' : hasBlockedRows ? 'needs-review' : 'ready-for-review',
  };
  let planDigest: FactBindingPlanDigest;
  try {
    planDigest = await computeFactBindingPlanDigest(planPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        diagnostic(
          'error',
          'FACT_BINDING_PLAN_DIGEST_UNAVAILABLE',
          'planDigest',
          `无法计算候选计划 digest：${message}`,
        ),
      ],
      warnings,
    };
  }
  return {
    ok: errors.length === 0,
    plan: {
      ...planPayload,
      planDigest,
    },
    errors,
    warnings,
  };
}
