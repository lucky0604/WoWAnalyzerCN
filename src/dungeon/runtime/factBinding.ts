import type {
  AbilityKnowledge,
  DungeonDocument,
  Enemy,
  FactBindingIdentity,
  Provenance,
  RouteKnowledge,
} from '../schema/types';
import type { DungeonCatalogEntry } from '../data/season2Catalog';
import { getDungeonCatalogEntry } from '../data/season2Catalog';
import { validateDungeonDocument } from '../schema/validate';
import { validateFactSnapshot, type FactSnapshot } from './factSnapshot';

export const factBindingSchemaVersion = 1 as const;

export interface FactBindingEnemy {
  sourceKey: string;
  documentEnemyId: string;
}

export interface FactBindingAbility {
  sourceKey: string;
  documentAbilityId: string;
}

/**
 * Explicit source-local → WoWAnalyzerCN-owned identity mapping.  The mapping
 * is intentionally separate from the source snapshot so a source reordering
 * cannot silently rewrite authored Enemy/Ability IDs.
 */
export interface FactBindingManifest {
  version: typeof factBindingSchemaVersion;
  snapshotId: string;
  snapshotDigest: FactSnapshot['digest'];
  dungeonId: string;
  season: string;
  gameBuild: string;
  enemies: FactBindingEnemy[];
  abilities: FactBindingAbility[];
}

const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableSort(value[key])]),
  );
}

/** Canonical manifest payload used for the document's auditable identity. */
export function serializeFactBindingManifestPayload(
  manifest: Pick<
    FactBindingManifest,
    | 'version'
    | 'snapshotId'
    | 'snapshotDigest'
    | 'dungeonId'
    | 'season'
    | 'gameBuild'
    | 'enemies'
    | 'abilities'
  >,
): string {
  return JSON.stringify(
    stableSort({
      version: manifest.version,
      snapshotId: manifest.snapshotId,
      snapshotDigest: manifest.snapshotDigest,
      dungeonId: manifest.dungeonId,
      season: manifest.season,
      gameBuild: manifest.gameBuild,
      enemies: manifest.enemies.map((row) => ({
        sourceKey: row.sourceKey,
        documentEnemyId: row.documentEnemyId,
      })),
      abilities: manifest.abilities.map((row) => ({
        sourceKey: row.sourceKey,
        documentAbilityId: row.documentAbilityId,
      })),
    }),
  );
}

export async function computeFactBindingManifestDigest(
  manifest: Pick<
    FactBindingManifest,
    | 'version'
    | 'snapshotId'
    | 'snapshotDigest'
    | 'dungeonId'
    | 'season'
    | 'gameBuild'
    | 'enemies'
    | 'abilities'
  >,
): Promise<FactBindingIdentity['manifestDigest']> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('FACT_BINDING_CRYPTO_UNAVAILABLE: Web Crypto is required.');
  const hash = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serializeFactBindingManifestPayload(manifest)),
  );
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return `sha256:${hex}`;
}

export async function factBindingIdentityDigestMatches(
  identity: FactBindingIdentity | undefined,
): Promise<boolean> {
  if (!identity) return false;
  try {
    const digest = await computeFactBindingManifestDigest(identity);
    return digest === identity.manifestDigest;
  } catch {
    return false;
  }
}

export function factBindingIdentityMatchesDocument(
  document: DungeonDocument,
  identity: FactBindingIdentity | undefined,
): boolean {
  if (
    !identity ||
    identity.version !== factBindingSchemaVersion ||
    !isNonEmptyString(identity.registryKey) ||
    !isNonEmptyString(identity.snapshotId) ||
    !sha256DigestPattern.test(identity.snapshotDigest) ||
    !sha256DigestPattern.test(identity.manifestDigest) ||
    identity.dungeonId !== document.id ||
    identity.season !== document.season ||
    identity.gameBuild !== document.version.build ||
    !Array.isArray(identity.enemies) ||
    !Array.isArray(identity.abilities)
  ) {
    return false;
  }
  const enemyIds = new Set(document.enemies.map((enemy) => enemy.id));
  const abilityIds = new Set(document.abilities.map((ability) => ability.id));
  const enemyTargets = new Set<string>();
  const abilityTargets = new Set<string>();
  const enemySources = new Set<string>();
  const abilitySources = new Set<string>();
  const sameIds = (left: readonly string[], right: readonly string[]) => {
    const rightSet = new Set(right);
    return left.length === rightSet.size && left.every((id) => rightSet.has(id));
  };
  const validRows = (
    rows: readonly { sourceKey: string; documentEnemyId?: string; documentAbilityId?: string }[],
    targets: Set<string>,
    sources: Set<string>,
    validTargetIds: Set<string>,
    targetKey: 'documentEnemyId' | 'documentAbilityId',
  ) =>
    rows.length > 0 &&
    rows.every((row) => {
      if (!row || typeof row !== 'object') return false;
      const target = row[targetKey];
      if (
        !isNonEmptyString(row.sourceKey) ||
        !isNonEmptyString(target) ||
        !validTargetIds.has(target)
      ) {
        return false;
      }
      if (sources.has(row.sourceKey)) return false;
      sources.add(row.sourceKey);
      if (targets.has(target)) return false;
      targets.add(target);
      return true;
    });
  return (
    identity.enemies.length === document.enemies.length &&
    identity.abilities.length === document.abilities.length &&
    validRows(identity.enemies, enemyTargets, enemySources, enemyIds, 'documentEnemyId') &&
    validRows(
      identity.abilities,
      abilityTargets,
      abilitySources,
      abilityIds,
      'documentAbilityId',
    ) &&
    enemyTargets.size === enemyIds.size &&
    abilityTargets.size === abilityIds.size &&
    identity.enemies.every((row) => {
      const enemy = document.enemies.find((candidate) => candidate.id === row.documentEnemyId);
      return (
        enemy &&
        row.npcId === enemy.npcId &&
        row.isBoss === enemy.isBoss &&
        row.forcesPoints === enemy.forcesPoints
      );
    }) &&
    identity.abilities.every((row) => {
      const ability = document.abilities.find(
        (candidate) => candidate.id === row.documentAbilityId,
      );
      return (
        ability &&
        row.spellId === ability.spellId &&
        Array.isArray(row.casterEnemyKeys) &&
        row.casterEnemyKeys.length > 0 &&
        new Set(row.casterEnemyKeys).size === row.casterEnemyKeys.length &&
        row.casterEnemyKeys.every(
          (sourceKey) =>
            typeof sourceKey === 'string' &&
            identity.enemies.some((enemy) => enemy.sourceKey === sourceKey),
        ) &&
        sameIds(
          row.casterEnemyKeys.map(
            (sourceKey) =>
              identity.enemies.find((enemy) => enemy.sourceKey === sourceKey)?.documentEnemyId ??
              '',
          ),
          ability.casterEnemyIds,
        )
      );
    })
  );
}

export interface FactBindingDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface FactBindingValidation {
  ok: boolean;
  errors: FactBindingDiagnostic[];
  warnings: FactBindingDiagnostic[];
  unmappedDocumentEnemyIds: string[];
  unmappedDocumentAbilityIds: string[];
}

export interface FactBindingOptions {
  /** Release mode requires every document fact to be mapped. */
  requireCompleteDocument?: boolean;
  /** Explicit build expected by the caller; release mode requires it. */
  expectedGameBuild?: string;
  /** CLI override used to report a missing/selected catalog entry once. */
  catalogEntry?: DungeonCatalogEntry;
}

export interface FactBindingResult extends FactBindingValidation {
  document?: DungeonDocument;
}

const topLevelKeys = new Set([
  'version',
  'snapshotId',
  'snapshotDigest',
  'dungeonId',
  'season',
  'gameBuild',
  'enemies',
  'abilities',
]);
const enemyBindingKeys = new Set(['sourceKey', 'documentEnemyId']);
const abilityBindingKeys = new Set(['sourceKey', 'documentAbilityId']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const diagnostic = (
  severity: FactBindingDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactBindingDiagnostic => ({ severity, code, path, message });

function unknownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: FactBindingDiagnostic[],
): void {
  Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort()
    .forEach((key) =>
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNKNOWN_FIELD',
          `${path}.${key}`,
          `binding manifest 不支持字段：${key}。`,
        ),
      ),
    );
}

function validateBindingRows<T extends { sourceKey: string }>(
  value: unknown,
  rowKeys: Set<string>,
  path: string,
  errors: FactBindingDiagnostic[],
  readTarget: (row: Record<string, unknown>) => unknown,
  targetLabel: string,
): Array<T & Record<string, string>> {
  if (!Array.isArray(value)) {
    errors.push(diagnostic('error', 'FACT_BINDING_ROWS_INVALID', path, `${path} 必须是数组。`));
    return [];
  }
  const sourceKeys = new Set<string>();
  const targetKeys = new Set<string>();
  const rows: Array<T & Record<string, string>> = [];
  value.forEach((candidate, index) => {
    const rowPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(
        diagnostic('error', 'FACT_BINDING_ROW_INVALID', rowPath, 'binding row 必须是对象。'),
      );
      return;
    }
    unknownKeys(candidate, rowKeys, rowPath, errors);
    const sourceKey = candidate.sourceKey;
    const target = readTarget(candidate);
    if (!isNonEmptyString(sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_SOURCE_KEY_INVALID',
          `${rowPath}.sourceKey`,
          'sourceKey 必须是非空字符串。',
        ),
      );
    } else if (sourceKeys.has(sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DUPLICATE_SOURCE_KEY',
          `${rowPath}.sourceKey`,
          `sourceKey 重复：${sourceKey}`,
        ),
      );
    } else {
      sourceKeys.add(sourceKey);
    }
    if (!isNonEmptyString(target)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_TARGET_ID_INVALID',
          rowPath,
          `${targetLabel} 必须是非空字符串。`,
        ),
      );
    } else if (targetKeys.has(target)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DUPLICATE_TARGET_ID',
          rowPath,
          `${targetLabel} 不能被多个来源事实复用：${target}`,
        ),
      );
    } else {
      targetKeys.add(target);
    }
    if (isNonEmptyString(sourceKey) && isNonEmptyString(target)) {
      rows.push(candidate as T & Record<string, string>);
    }
  });
  return rows;
}

export function validateFactBindingManifest(
  value: unknown,
  snapshot: FactSnapshot,
  document: DungeonDocument,
  options: FactBindingOptions = {},
): FactBindingValidation {
  const errors: FactBindingDiagnostic[] = [];
  const warnings: FactBindingDiagnostic[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [diagnostic('error', 'FACT_BINDING_INVALID', '$', 'binding manifest 必须是对象。')],
      warnings,
      unmappedDocumentEnemyIds: document.enemies.map((enemy) => enemy.id),
      unmappedDocumentAbilityIds: document.abilities.map((ability) => ability.id),
    };
  }
  unknownKeys(value, topLevelKeys, '$', errors);
  if (value.version !== factBindingSchemaVersion) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_VERSION_INVALID',
        'version',
        'binding manifest version 必须为 1。',
      ),
    );
  }
  const metadata: Array<[string, unknown]> = [
    ['snapshotId', value.snapshotId],
    ['snapshotDigest', value.snapshotDigest],
    ['dungeonId', value.dungeonId],
    ['season', value.season],
    ['gameBuild', value.gameBuild],
  ];
  metadata.forEach(([key, candidate]) => {
    if (!isNonEmptyString(candidate)) {
      errors.push(
        diagnostic('error', 'FACT_BINDING_METADATA_INVALID', key, `${key} 必须是非空字符串。`),
      );
    }
  });
  if (isNonEmptyString(value.snapshotDigest) && value.snapshotDigest !== snapshot.digest) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_SNAPSHOT_DIGEST_MISMATCH',
        'snapshotDigest',
        `binding digest ${value.snapshotDigest} 与输入快照 ${snapshot.digest} 不匹配。`,
      ),
    );
  }
  if (
    value.snapshotId !== snapshot.snapshotId ||
    value.dungeonId !== snapshot.dungeonId ||
    value.season !== snapshot.season ||
    value.gameBuild !== snapshot.gameBuild
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_SNAPSHOT_IDENTITY_MISMATCH',
        'snapshotId',
        'binding manifest 与事实快照的 snapshotId/dungeonId/season/build 不匹配。',
      ),
    );
  }
  if (
    value.dungeonId !== document.id ||
    value.season !== document.season ||
    value.gameBuild !== document.version.build
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DOCUMENT_IDENTITY_MISMATCH',
        'document',
        'binding manifest 的副本、赛季或 build 与 authoring document 不匹配。',
      ),
    );
  }

  const enemyRows = validateBindingRows<FactBindingEnemy>(
    value.enemies,
    enemyBindingKeys,
    'enemies',
    errors,
    (row) => row.documentEnemyId,
    'documentEnemyId',
  );
  const abilityRows = validateBindingRows<FactBindingAbility>(
    value.abilities,
    abilityBindingKeys,
    'abilities',
    errors,
    (row) => row.documentAbilityId,
    'documentAbilityId',
  );
  const snapshotEnemiesByKey = new Map(snapshot.enemies.map((enemy) => [enemy.enemyKey, enemy]));
  const snapshotAbilitiesByKey = new Map(
    snapshot.abilities.map((ability) => [ability.abilityKey, ability]),
  );
  const documentEnemiesById = new Map(document.enemies.map((enemy) => [enemy.id, enemy]));
  const documentAbilitiesById = new Map(document.abilities.map((ability) => [ability.id, ability]));
  const boundEnemySourceKeys = new Set(enemyRows.map((row) => row.sourceKey));
  const boundAbilitySourceKeys = new Set(abilityRows.map((row) => row.sourceKey));
  const boundEnemyDocumentIds = new Set(enemyRows.map((row) => row.documentEnemyId));
  const boundAbilityDocumentIds = new Set(abilityRows.map((row) => row.documentAbilityId));
  enemyRows.forEach((row, index) => {
    if (!snapshotEnemiesByKey.has(row.sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNKNOWN_ENEMY_SOURCE',
          `enemies[${index}].sourceKey`,
          `事实快照中不存在 enemyKey：${row.sourceKey}`,
        ),
      );
    }
    if (!documentEnemiesById.has(row.documentEnemyId)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNKNOWN_DOCUMENT_ENEMY',
          `enemies[${index}].documentEnemyId`,
          `authoring document 中不存在 Enemy：${row.documentEnemyId}`,
        ),
      );
    }
    const sourceEnemy = snapshotEnemiesByKey.get(row.sourceKey);
    const documentEnemy = documentEnemiesById.get(row.documentEnemyId);
    if (sourceEnemy && documentEnemy && sourceEnemy.isBoss !== documentEnemy.isBoss) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_ENEMY_KIND_MISMATCH',
          `enemies[${index}]`,
          `来源 Enemy ${row.sourceKey} 的 isBoss 与文档 Enemy ${row.documentEnemyId} 不一致。`,
        ),
      );
    }
  });
  abilityRows.forEach((row, index) => {
    if (!snapshotAbilitiesByKey.has(row.sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNKNOWN_ABILITY_SOURCE',
          `abilities[${index}].sourceKey`,
          `事实快照中不存在 abilityKey：${row.sourceKey}`,
        ),
      );
    }
    if (!documentAbilitiesById.has(row.documentAbilityId)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNKNOWN_DOCUMENT_ABILITY',
          `abilities[${index}].documentAbilityId`,
          `authoring document 中不存在 Ability：${row.documentAbilityId}`,
        ),
      );
    }
  });
  snapshot.enemies.forEach((enemy, index) => {
    if (!boundEnemySourceKeys.has(enemy.enemyKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNMAPPED_SNAPSHOT_ENEMY',
          `snapshot.enemies[${index}].enemyKey`,
          `事实快照中的 enemyKey 尚未绑定：${enemy.enemyKey}`,
        ),
      );
    }
  });
  snapshot.abilities.forEach((ability, index) => {
    if (!boundAbilitySourceKeys.has(ability.abilityKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_UNMAPPED_SNAPSHOT_ABILITY',
          `snapshot.abilities[${index}].abilityKey`,
          `事实快照中的 abilityKey 尚未绑定：${ability.abilityKey}`,
        ),
      );
    }
  });
  const unmappedDocumentEnemyIds = document.enemies
    .map((enemy) => enemy.id)
    .filter((id) => !boundEnemyDocumentIds.has(id));
  const unmappedDocumentAbilityIds = document.abilities
    .map((ability) => ability.id)
    .filter((id) => !boundAbilityDocumentIds.has(id));
  if (unmappedDocumentEnemyIds.length > 0) {
    const severity = options.requireCompleteDocument ? 'error' : 'warning';
    (severity === 'error' ? errors : warnings).push(
      diagnostic(
        severity,
        'FACT_BINDING_DOCUMENT_ENEMIES_UNMAPPED',
        'enemies',
        `authoring document 中仍有 ${unmappedDocumentEnemyIds.length} 个 Enemy 未接入此快照。`,
      ),
    );
  }
  if (unmappedDocumentAbilityIds.length > 0) {
    const severity = options.requireCompleteDocument ? 'error' : 'warning';
    (severity === 'error' ? errors : warnings).push(
      diagnostic(
        severity,
        'FACT_BINDING_DOCUMENT_ABILITIES_UNMAPPED',
        'abilities',
        `authoring document 中仍有 ${unmappedDocumentAbilityIds.length} 个 Ability 未接入此快照。`,
      ),
    );
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    unmappedDocumentEnemyIds,
    unmappedDocumentAbilityIds,
  };
}

function sourceProvenance(snapshot: FactSnapshot): Provenance {
  return {
    type: snapshot.source,
    title: `Fact snapshot ${snapshot.snapshotId}`,
    snapshot: `${snapshot.snapshotId}:${snapshot.digest}`,
    gameBuild: snapshot.gameBuild,
    retrievedAt: snapshot.capturedAt,
    licenseStatus: snapshot.licenseStatus,
    notes: '由 fact-bind 绑定；事实来源不自动生成攻略结论或路线选择。',
  };
}

function appendProvenance(existing: readonly Provenance[], source: Provenance): Provenance[] {
  const key = `${source.type}:${source.snapshot}:${source.gameBuild}`;
  const alreadyPresent = existing.some(
    (item) => `${item.type}:${item.snapshot}:${item.gameBuild}` === key,
  );
  return alreadyPresent ? [...existing] : [...existing, source];
}

function mapBySourceKey<T extends { sourceKey: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.sourceKey, row]));
}

function mapEnemyFacts(
  document: DungeonDocument,
  snapshot: FactSnapshot,
  rows: readonly FactBindingEnemy[],
  provenance: Provenance,
): Enemy[] {
  const facts = new Map(snapshot.enemies.map((enemy) => [enemy.enemyKey, enemy]));
  const rowByDocumentId = new Map(rows.map((row) => [row.documentEnemyId, row]));
  return document.enemies.map((enemy) => {
    const row = rowByDocumentId.get(enemy.id);
    const fact = row ? facts.get(row.sourceKey) : undefined;
    if (!fact) {
      return {
        ...enemy,
        npcId: undefined,
        factBuild: undefined,
        forcesPoints: 0,
        forcesStatus: 'pending' as const,
      };
    }
    return {
      ...enemy,
      npcId: fact.npcId,
      factBuild: snapshot.gameBuild,
      forcesPoints: fact.forcesPoints ?? 0,
      forcesStatus: 'pending' as const,
      provenance: appendProvenance(enemy.provenance, provenance),
    };
  });
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
}

function mapAbilityFacts(
  document: DungeonDocument,
  snapshot: FactSnapshot,
  rows: readonly FactBindingAbility[],
  enemyRows: readonly FactBindingEnemy[],
  provenance: Provenance,
  errors: FactBindingDiagnostic[],
): AbilityKnowledge[] {
  const facts = new Map(snapshot.abilities.map((ability) => [ability.abilityKey, ability]));
  const enemyBindings = mapBySourceKey(enemyRows);
  const rowByDocumentId = new Map(rows.map((row) => [row.documentAbilityId, row]));
  return document.abilities.map((ability) => {
    const row = rowByDocumentId.get(ability.id);
    const fact = row ? facts.get(row.sourceKey) : undefined;
    if (!fact) {
      return {
        ...ability,
        spellId: undefined,
        version: { ...ability.version, status: 'draft' as const },
      };
    }
    const mappedCasters = fact.casterEnemyKeys
      .map((sourceKey) => enemyBindings.get(sourceKey)?.documentEnemyId)
      .filter((enemyId): enemyId is string => Boolean(enemyId));
    if (!sameIds(mappedCasters, ability.casterEnemyIds)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_CASTER_MISMATCH',
          `abilities.${ability.id}.casterEnemyIds`,
          `技能 ${ability.id} 的来源施法者映射与文档 casterEnemyIds 不一致。`,
        ),
      );
    }
    return {
      ...ability,
      spellId: fact.spellId,
      version: {
        ...ability.version,
        season: snapshot.season,
        build: snapshot.gameBuild,
        status: 'draft' as const,
      },
      provenance: appendProvenance(ability.provenance, provenance),
    };
  });
}

function recalculateRouteForces(document: DungeonDocument): RouteKnowledge[] {
  const enemiesById = new Map(document.enemies.map((enemy) => [enemy.id, enemy]));
  const spawnsById = new Map(document.spawns.map((spawn) => [spawn.id, spawn]));
  return document.routes.map((route) => ({
    ...route,
    expectedEnemyForcesPoints: route.steps
      .filter((step) => step.type === 'pull')
      .reduce(
        (total, step) =>
          total +
          step.spawnIds.reduce(
            (pullTotal, spawnId) =>
              pullTotal +
              (enemiesById.get(spawnsById.get(spawnId)?.enemyId ?? '')?.forcesPoints ?? 0),
            0,
          ),
        0,
      ),
  }));
}

export async function bindFactSnapshotToDocument(
  document: DungeonDocument,
  snapshot: unknown,
  manifest: unknown,
  options: FactBindingOptions = {},
): Promise<FactBindingResult> {
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
          'FACT_BINDING_DOCUMENT_VALIDATION_FAILED',
          'document',
          `authoring document 校验异常：${message}`,
        ),
      ],
      warnings: [],
      unmappedDocumentEnemyIds: [],
      unmappedDocumentAbilityIds: [],
    };
  }
  if (!documentValidation.ok) {
    return {
      ok: false,
      errors: documentValidation.errors,
      warnings: documentValidation.warnings,
      unmappedDocumentEnemyIds: document.enemies.map((enemy) => enemy.id),
      unmappedDocumentAbilityIds: document.abilities.map((ability) => ability.id),
    };
  }
  const snapshotValidation = await validateFactSnapshot(snapshot, {
    entry: options.catalogEntry ?? getDungeonCatalogEntry(document.id),
    requireApproved: options.requireCompleteDocument,
    expectedGameBuild:
      options.expectedGameBuild ??
      (options.requireCompleteDocument ? undefined : document.version.build),
  });
  if (!snapshotValidation.snapshot) {
    return {
      ok: false,
      errors: snapshotValidation.errors,
      warnings: [...documentValidation.warnings, ...snapshotValidation.warnings],
      unmappedDocumentEnemyIds: document.enemies.map((enemy) => enemy.id),
      unmappedDocumentAbilityIds: document.abilities.map((ability) => ability.id),
    };
  }
  const validation = validateFactBindingManifest(
    manifest,
    snapshotValidation.snapshot,
    document,
    options,
  );
  validation.errors.unshift(...snapshotValidation.errors);
  validation.warnings.unshift(...documentValidation.warnings, ...snapshotValidation.warnings);
  if (!validation.ok) return validation;
  const validatedSnapshot = snapshotValidation.snapshot!;
  const provenance = sourceProvenance(validatedSnapshot);
  const validatedManifest = manifest as FactBindingManifest;
  const enemies = mapEnemyFacts(document, validatedSnapshot, validatedManifest.enemies, provenance);
  const errors = [...validation.errors];
  const abilities = mapAbilityFacts(
    document,
    validatedSnapshot,
    validatedManifest.abilities,
    validatedManifest.enemies,
    provenance,
    errors,
  );
  if (errors.length > 0) {
    return { ...validation, ok: false, errors, document: undefined };
  }
  const allDocumentEnemiesMapped = validation.unmappedDocumentEnemyIds.length === 0;
  let manifestDigest: FactBindingIdentity['manifestDigest'];
  try {
    manifestDigest = await computeFactBindingManifestDigest(validatedManifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...validation,
      ok: false,
      errors: [
        ...errors,
        diagnostic(
          'error',
          'FACT_BINDING_MANIFEST_DIGEST_UNAVAILABLE',
          'manifestDigest',
          `无法计算 binding manifest digest：${message}`,
        ),
      ],
      document: undefined,
    };
  }
  const nextDocument: DungeonDocument = {
    ...document,
    dataStatus: 'draft',
    review: undefined,
    version: {
      ...document.version,
      season: validatedSnapshot.season,
      build: validatedSnapshot.gameBuild,
      revision: document.version.revision + 1,
      status: 'draft',
    },
    totalEnemyForcesPoints:
      allDocumentEnemiesMapped && validatedSnapshot.totalEnemyForcesPoints !== undefined
        ? validatedSnapshot.totalEnemyForcesPoints
        : 0,
    forcesSnapshot: undefined,
    factBinding: {
      version: factBindingSchemaVersion,
      registryKey: `fact-binding:${validatedSnapshot.snapshotId}`,
      snapshotId: validatedSnapshot.snapshotId,
      snapshotDigest: validatedSnapshot.digest,
      manifestDigest,
      dungeonId: validatedManifest.dungeonId,
      season: validatedManifest.season,
      gameBuild: validatedManifest.gameBuild,
      enemies: validatedManifest.enemies.map((row) => {
        const fact = validatedSnapshot.enemies.find(
          (candidate) => candidate.enemyKey === row.sourceKey,
        )!;
        const enemy = enemies.find((candidate) => candidate.id === row.documentEnemyId)!;
        return {
          ...row,
          npcId: fact.npcId,
          isBoss: fact.isBoss,
          forcesPoints: enemy.forcesPoints,
        };
      }),
      abilities: validatedManifest.abilities.map((row) => {
        const fact = validatedSnapshot.abilities.find(
          (candidate) => candidate.abilityKey === row.sourceKey,
        )!;
        return {
          ...row,
          spellId: fact.spellId,
          casterEnemyKeys: [...fact.casterEnemyKeys],
        };
      }),
    },
    provenance: appendProvenance(document.provenance, provenance),
    enemies,
    abilities,
  };
  const recalculatedDocument = {
    ...nextDocument,
    routes: recalculateRouteForces(nextDocument),
  };
  if (!allDocumentEnemiesMapped && validatedSnapshot.totalEnemyForcesPoints !== undefined) {
    validation.warnings.push(
      diagnostic(
        'warning',
        'FACT_BINDING_TOTAL_NOT_APPLIED',
        'totalEnemyForcesPoints',
        '快照总 forces 未覆盖 authoring document 的全部 Enemy，因此已清零并继续等待完整快照。',
      ),
    );
  }
  return { ...validation, document: recalculatedDocument };
}

/** Source-only type guards used by the CLI before binding. */
export function isFactBindingManifest(value: unknown): value is FactBindingManifest {
  return (
    isRecord(value) &&
    value.version === factBindingSchemaVersion &&
    isNonEmptyString(value.snapshotId) &&
    isNonEmptyString(value.snapshotDigest) &&
    isNonEmptyString(value.dungeonId) &&
    isNonEmptyString(value.season) &&
    isNonEmptyString(value.gameBuild) &&
    Array.isArray(value.enemies) &&
    Array.isArray(value.abilities)
  );
}
