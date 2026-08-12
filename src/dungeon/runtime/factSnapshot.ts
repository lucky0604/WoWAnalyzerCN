import type { DungeonCatalogEntry } from '../data/season2Catalog';
import type { ProvenanceLicenseStatus, ProvenanceType } from '../schema/types';

export const factSnapshotSchemaVersion = 1 as const;

export type FactSnapshotSource = Extract<
  ProvenanceType,
  'official' | 'game-data' | 'wcl' | 'manual-test'
>;

export interface FactSnapshotEnemy {
  enemyKey: string;
  npcId: number;
  isBoss: boolean;
  forcesPoints?: number;
}

export interface FactSnapshotAbility {
  abilityKey: string;
  spellId: number;
  casterEnemyKeys: string[];
  interruptible?: boolean;
}

/**
 * Raw, source-owned facts. It deliberately contains IDs and objective labels,
 * not authored player instructions or route decisions.
 */
export interface FactSnapshot {
  version: typeof factSnapshotSchemaVersion;
  snapshotId: string;
  /** Optional source scope, e.g. a WCL fight id within a report. */
  fightId?: number;
  dungeonId: string;
  season: string;
  gameBuild: string;
  source: FactSnapshotSource;
  licenseStatus: ProvenanceLicenseStatus;
  evidenceRef: string;
  capturedAt: string;
  digest: `sha256:${string}`;
  enemies: FactSnapshotEnemy[];
  abilities: FactSnapshotAbility[];
  totalEnemyForcesPoints?: number;
}

export interface FactSnapshotDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface FactSnapshotValidation {
  ok: boolean;
  releaseReady: boolean;
  snapshot?: FactSnapshot;
  errors: FactSnapshotDiagnostic[];
  warnings: FactSnapshotDiagnostic[];
}

export interface FactSnapshotValidationOptions {
  /** Require an approved non-test source for a release candidate. */
  requireApproved?: boolean;
  /** Optional catalog entry used to bind the snapshot to the S2 roster. */
  entry?: DungeonCatalogEntry;
  /** Build selected by the release/preflight caller, not copied from the input. */
  expectedGameBuild?: string;
}

export type FactSnapshotDraft = Omit<FactSnapshot, 'digest'>;

type ShapeValidationOptions = FactSnapshotValidationOptions & {
  /** Internal only: digest produced independently by Web Crypto. */
  expectedDigest?: FactSnapshot['digest'];
};

const sourceValues = new Set<FactSnapshotSource>(['official', 'game-data', 'wcl', 'manual-test']);
const licenseValues = new Set<ProvenanceLicenseStatus>([
  'approved',
  'reference-only',
  'needs-review',
]);

const topLevelKeys = new Set([
  'version',
  'snapshotId',
  'fightId',
  'dungeonId',
  'season',
  'gameBuild',
  'source',
  'licenseStatus',
  'evidenceRef',
  'capturedAt',
  'digest',
  'enemies',
  'abilities',
  'totalEnemyForcesPoints',
]);
const enemyFieldKeys = new Set(['enemyKey', 'npcId', 'isBoss', 'forcesPoints']);
const abilityFieldKeys = new Set(['abilityKey', 'spellId', 'casterEnemyKeys', 'interruptible']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isUtcIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));

const diagnostic = (
  severity: FactSnapshotDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactSnapshotDiagnostic => ({ severity, code, path, message });

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableSort(value[key])]),
  );
}

function reportUnknownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: FactSnapshotDiagnostic[],
): void {
  Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort()
    .forEach((key) => {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_UNKNOWN_FIELD',
          `${path}.${key}`,
          `schema v1 不支持字段：${key}。`,
        ),
      );
    });
}

/** Canonical payload used to compute the non-self-referential digest. */
export function serializeFactSnapshotPayload(snapshot: FactSnapshot): string {
  const payload = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'digest'));
  return JSON.stringify(stableSort(payload));
}

/**
 * Compute the digest with the platform Web Crypto API. Keeping this helper
 * browser-safe avoids importing node:crypto into the Dungeon runtime bundle.
 */
export async function computeFactSnapshotDigest(
  snapshot: FactSnapshot,
): Promise<FactSnapshot['digest']> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('FACT_SNAPSHOT_CRYPTO_UNAVAILABLE: Web Crypto is required.');
  }
  const hash = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serializeFactSnapshotPayload(snapshot)),
  );
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return `sha256:${hex}`;
}

function validateEnemyFacts(
  value: unknown,
  errors: FactSnapshotDiagnostic[],
  warnings: FactSnapshotDiagnostic[],
): FactSnapshotEnemy[] {
  if (!Array.isArray(value)) {
    errors.push(
      diagnostic('error', 'FACT_SNAPSHOT_ENEMIES_INVALID', 'enemies', 'enemies 必须是数组。'),
    );
    return [];
  }
  const keys = new Set<string>();
  const enemies: FactSnapshotEnemy[] = [];
  value.forEach((candidate, index) => {
    const path = `enemies[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(diagnostic('error', 'FACT_SNAPSHOT_ENEMY_INVALID', path, '敌人事实必须是对象。'));
      return;
    }
    reportUnknownKeys(candidate, enemyFieldKeys, path, errors);
    const enemyKey = candidate.enemyKey;
    const npcId = candidate.npcId;
    const isBoss = candidate.isBoss;
    if (!isNonEmptyString(enemyKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_ENEMY_KEY_INVALID',
          `${path}.enemyKey`,
          'enemyKey 必须是非空字符串。',
        ),
      );
    } else if (keys.has(enemyKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_DUPLICATE_ENEMY_KEY',
          `${path}.enemyKey`,
          `enemyKey 重复：${enemyKey}`,
        ),
      );
    } else {
      keys.add(enemyKey);
    }
    if (!Number.isInteger(npcId) || (npcId as number) <= 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_NPC_ID_INVALID',
          `${path}.npcId`,
          'NPC ID 必须是正整数。',
        ),
      );
    }
    if (typeof isBoss !== 'boolean') {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_BOSS_FLAG_INVALID',
          `${path}.isBoss`,
          'isBoss 必须是布尔值。',
        ),
      );
    }
    const forcesPoints = candidate.forcesPoints;
    if (
      forcesPoints !== undefined &&
      (!Number.isInteger(forcesPoints) || (forcesPoints as number) < 0)
    ) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_FORCES_INVALID',
          `${path}.forcesPoints`,
          'forcesPoints 必须是非负整数。',
        ),
      );
    }
    if (isNonEmptyString(enemyKey) && Number.isInteger(npcId) && typeof isBoss === 'boolean') {
      enemies.push({
        enemyKey,
        npcId: npcId as number,
        isBoss,
        ...(Number.isInteger(forcesPoints) ? { forcesPoints: forcesPoints as number } : {}),
      });
    }
  });
  if (enemies.length === 0) {
    warnings.push(
      diagnostic('warning', 'FACT_SNAPSHOT_ENEMIES_EMPTY', 'enemies', '当前快照没有可用敌人事实。'),
    );
  }
  return enemies;
}

function validateAbilityFacts(
  value: unknown,
  enemyKeys: Set<string>,
  errors: FactSnapshotDiagnostic[],
  warnings: FactSnapshotDiagnostic[],
): FactSnapshotAbility[] {
  if (!Array.isArray(value)) {
    errors.push(
      diagnostic('error', 'FACT_SNAPSHOT_ABILITIES_INVALID', 'abilities', 'abilities 必须是数组。'),
    );
    return [];
  }
  const keys = new Set<string>();
  const abilities: FactSnapshotAbility[] = [];
  value.forEach((candidate, index) => {
    const path = `abilities[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(
        diagnostic('error', 'FACT_SNAPSHOT_ABILITY_INVALID', path, '技能事实必须是对象。'),
      );
      return;
    }
    reportUnknownKeys(candidate, abilityFieldKeys, path, errors);
    const abilityKey = candidate.abilityKey;
    const spellId = candidate.spellId;
    const casterEnemyKeys = candidate.casterEnemyKeys;
    if (!isNonEmptyString(abilityKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_ABILITY_KEY_INVALID',
          `${path}.abilityKey`,
          'abilityKey 必须是非空字符串。',
        ),
      );
    } else if (keys.has(abilityKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_DUPLICATE_ABILITY_KEY',
          `${path}.abilityKey`,
          `abilityKey 重复：${abilityKey}`,
        ),
      );
    } else {
      keys.add(abilityKey);
    }
    if (!Number.isInteger(spellId) || (spellId as number) <= 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_SPELL_ID_INVALID',
          `${path}.spellId`,
          'Spell ID 必须是正整数。',
        ),
      );
    }
    if (!Array.isArray(casterEnemyKeys) || casterEnemyKeys.length === 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_CASTER_KEYS_INVALID',
          `${path}.casterEnemyKeys`,
          '技能至少需要一个施法者 enemyKey。',
        ),
      );
    } else {
      const validCasterKeys = casterEnemyKeys.filter(isNonEmptyString);
      if (
        validCasterKeys.length === casterEnemyKeys.length &&
        new Set(validCasterKeys).size !== validCasterKeys.length
      ) {
        errors.push(
          diagnostic(
            'error',
            'FACT_SNAPSHOT_DUPLICATE_CASTER',
            `${path}.casterEnemyKeys`,
            'casterEnemyKeys 不能包含重复 enemyKey。',
          ),
        );
      }
      casterEnemyKeys.forEach((enemyKey, casterIndex) => {
        if (!isNonEmptyString(enemyKey) || !enemyKeys.has(enemyKey)) {
          errors.push(
            diagnostic(
              'error',
              'FACT_SNAPSHOT_UNKNOWN_CASTER',
              `${path}.casterEnemyKeys[${casterIndex}]`,
              `未知施法者 enemyKey：${String(enemyKey)}`,
            ),
          );
        }
      });
    }
    if (candidate.interruptible !== undefined && typeof candidate.interruptible !== 'boolean') {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_INTERRUPTIBLE_INVALID',
          `${path}.interruptible`,
          'interruptible 必须是布尔值。',
        ),
      );
    }
    if (
      isNonEmptyString(abilityKey) &&
      Number.isInteger(spellId) &&
      Array.isArray(casterEnemyKeys)
    ) {
      abilities.push({
        abilityKey,
        spellId: spellId as number,
        casterEnemyKeys: casterEnemyKeys.filter(isNonEmptyString),
        ...(typeof candidate.interruptible === 'boolean'
          ? { interruptible: candidate.interruptible }
          : {}),
      });
    }
  });
  if (abilities.length === 0) {
    warnings.push(
      diagnostic(
        'warning',
        'FACT_SNAPSHOT_ABILITIES_EMPTY',
        'abilities',
        '当前快照没有可用技能事实。',
      ),
    );
  }
  return abilities;
}

function validateFactSnapshotShape(
  value: unknown,
  options: ShapeValidationOptions = {},
): FactSnapshotValidation {
  const errors: FactSnapshotDiagnostic[] = [];
  const warnings: FactSnapshotDiagnostic[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      releaseReady: false,
      errors: [diagnostic('error', 'FACT_SNAPSHOT_INVALID', '$', '事实快照必须是对象。')],
      warnings,
    };
  }
  reportUnknownKeys(value, topLevelKeys, '$', errors);
  const version = value.version;
  const snapshotId = value.snapshotId;
  const fightId = value.fightId;
  const dungeonId = value.dungeonId;
  const season = value.season;
  const gameBuild = value.gameBuild;
  const source = value.source;
  const licenseStatus = value.licenseStatus;
  const evidenceRef = value.evidenceRef;
  const capturedAt = value.capturedAt;
  const digest = value.digest;

  if (version !== factSnapshotSchemaVersion) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_VERSION_INVALID',
        'version',
        '事实快照 schema version 必须为 1。',
      ),
    );
  }
  for (const [key, field] of [
    ['snapshotId', snapshotId],
    ['dungeonId', dungeonId],
    ['season', season],
    ['gameBuild', gameBuild],
    ['evidenceRef', evidenceRef],
    ['capturedAt', capturedAt],
  ] as const) {
    if (!isNonEmptyString(field)) {
      errors.push(
        diagnostic('error', 'FACT_SNAPSHOT_METADATA_MISSING', key, `${key} 必须是非空字符串。`),
      );
    }
  }
  if (isNonEmptyString(capturedAt) && !isUtcIsoTimestamp(capturedAt)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_CAPTURED_AT_INVALID',
        'capturedAt',
        'capturedAt 必须是可解析的 UTC ISO timestamp。',
      ),
    );
  }
  if (fightId !== undefined && (!Number.isInteger(fightId) || (fightId as number) <= 0)) {
    errors.push(
      diagnostic('error', 'FACT_SNAPSHOT_FIGHT_ID_INVALID', 'fightId', 'fightId 必须是正整数。'),
    );
  }
  if (!isNonEmptyString(source) || !sourceValues.has(source as FactSnapshotSource)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_SOURCE_INVALID',
        'source',
        'source 必须是 approved 的官方、game-data、wcl 或 manual-test 来源类型。',
      ),
    );
  }
  if (
    !isNonEmptyString(licenseStatus) ||
    !licenseValues.has(licenseStatus as ProvenanceLicenseStatus)
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_LICENSE_INVALID',
        'licenseStatus',
        'licenseStatus 不是受支持的来源状态。',
      ),
    );
  }
  if (!isNonEmptyString(digest) || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_DIGEST_INVALID',
        'digest',
        'digest 必须是 sha256:<64 位十六进制>。',
      ),
    );
  }
  if (options.entry && (dungeonId !== options.entry.id || season !== options.entry.season)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_CATALOG_MISMATCH',
        'dungeonId',
        `事实快照 ${String(dungeonId)}/${String(season)} 与目录 ${options.entry.id}/${options.entry.season} 不匹配。`,
      ),
    );
  }

  const enemies = validateEnemyFacts(value.enemies, errors, warnings);
  const enemyKeys = new Set(enemies.map((enemy) => enemy.enemyKey));
  const abilities = validateAbilityFacts(value.abilities, enemyKeys, errors, warnings);
  const totalForces = value.totalEnemyForcesPoints;
  const forceValues = enemies.map((enemy) => enemy.forcesPoints);
  const hasAnyForces = forceValues.some((points) => points !== undefined);
  if (!hasAnyForces && totalForces !== undefined) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_TOTAL_FORCES_WITHOUT_VALUES',
        'totalEnemyForcesPoints',
        '没有逐敌人 forcesPoints 时不能单独提供总量。',
      ),
    );
  }
  if (hasAnyForces && totalForces === undefined) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_TOTAL_FORCES_REQUIRED',
        'totalEnemyForcesPoints',
        '提供 forcesPoints 后必须提供可校验的总量。',
      ),
    );
  }
  if (
    totalForces !== undefined &&
    (!Number.isInteger(totalForces) || (totalForces as number) < 0)
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_TOTAL_FORCES_INVALID',
        'totalEnemyForcesPoints',
        'totalEnemyForcesPoints 必须是非负整数。',
      ),
    );
  }
  if (hasAnyForces && forceValues.some((points) => points === undefined)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_FORCES_PARTIAL',
        'enemies',
        '提供 forces 时必须覆盖快照中的每个敌人。',
      ),
    );
  }
  if (hasAnyForces && Number.isInteger(totalForces)) {
    const derivedTotal = forceValues.reduce<number>((sum, points) => sum + (points ?? 0), 0);
    if (derivedTotal !== totalForces) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_FORCES_TOTAL_MISMATCH',
          'totalEnemyForcesPoints',
          `forces 总量 ${String(totalForces)} 与敌人推导总量 ${derivedTotal} 不一致。`,
        ),
      );
    }
  }
  if (licenseStatus !== 'approved' || source === 'manual-test') {
    warnings.push(
      diagnostic(
        'warning',
        'FACT_SNAPSHOT_RELEASE_SOURCE_PENDING',
        'licenseStatus',
        '来源尚未达到正式发布门禁，只能作为预检或 draft 证据。',
      ),
    );
  }
  if (options.requireApproved) {
    if (source === 'manual-test' || !sourceValues.has(source as FactSnapshotSource)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_TEST_SOURCE_FORBIDDEN',
          'source',
          '正式事实快照不能使用 manual-test 来源。',
        ),
      );
    }
    if (licenseStatus !== 'approved') {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_LICENSE_NOT_APPROVED',
          'licenseStatus',
          '正式事实快照必须使用 approved licenseStatus。',
        ),
      );
    }
    if (enemies.length === 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_ENEMIES_REQUIRED',
          'enemies',
          '正式事实快照至少需要一个敌人事实。',
        ),
      );
    }
    if (abilities.length === 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_ABILITIES_REQUIRED',
          'abilities',
          '正式事实快照至少需要一个技能事实。',
        ),
      );
    }
    if (!hasAnyForces) {
      errors.push(
        diagnostic(
          'error',
          'FACT_SNAPSHOT_FORCES_REQUIRED',
          'enemies',
          '正式事实快照必须包含完整的逐敌人 forcesPoints。',
        ),
      );
    }
  }
  if (options.requireApproved && !options.expectedGameBuild) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_EXPECTED_BUILD_REQUIRED',
        'gameBuild',
        'release 预检必须显式提供待校验的 expectedGameBuild。',
      ),
    );
  }
  if (options.requireApproved && !options.entry) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_CATALOG_ENTRY_REQUIRED',
        'dungeonId',
        'release 预检必须绑定一个已登记的 S2 catalog entry。',
      ),
    );
  }
  if (options.expectedGameBuild && gameBuild !== options.expectedGameBuild) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_GAME_BUILD_MISMATCH',
        'gameBuild',
        `事实快照 build ${String(gameBuild)} 与预期 build ${options.expectedGameBuild} 不匹配。`,
      ),
    );
  }
  const snapshot = {
    version: factSnapshotSchemaVersion,
    snapshotId: String(snapshotId),
    ...(Number.isInteger(fightId) ? { fightId: fightId as number } : {}),
    dungeonId: String(dungeonId),
    season: String(season),
    gameBuild: String(gameBuild),
    source: source as FactSnapshotSource,
    licenseStatus: licenseStatus as ProvenanceLicenseStatus,
    evidenceRef: String(evidenceRef),
    capturedAt: String(capturedAt),
    digest: String(digest) as `sha256:${string}`,
    enemies,
    abilities,
    ...(Number.isInteger(totalForces) ? { totalEnemyForcesPoints: totalForces as number } : {}),
  } satisfies FactSnapshot;
  if (options.expectedDigest === undefined) {
    const severity = options.requireApproved ? 'error' : 'warning';
    const message = options.requireApproved
      ? 'release 预检必须先用 canonical payload 独立计算 expectedDigest。'
      : '尚未执行 canonical digest 独立校验。';
    (severity === 'error' ? errors : warnings).push(
      diagnostic(severity, 'FACT_SNAPSHOT_DIGEST_UNVERIFIED', 'digest', message),
    );
  } else if (options.expectedDigest !== snapshot.digest) {
    errors.push(
      diagnostic(
        'error',
        'FACT_SNAPSHOT_DIGEST_MISMATCH',
        'digest',
        `digest 与独立计算结果不匹配：${snapshot.digest} !== ${options.expectedDigest}`,
      ),
    );
  }
  return {
    ok: errors.length === 0,
    releaseReady: errors.length === 0 && options.requireApproved === true,
    snapshot,
    errors,
    warnings,
  };
}

/**
 * Full async preflight: structural checks plus an independently computed
 * canonical digest. Release callers should use this function rather than the
 * synchronous structural validator.
 */
export async function validateFactSnapshot(
  value: unknown,
  options: FactSnapshotValidationOptions = {},
): Promise<FactSnapshotValidation> {
  const structural = validateFactSnapshotShape(value, { ...options, requireApproved: false });
  if (!structural.snapshot || structural.errors.length > 0) return structural;
  let expectedDigest: FactSnapshot['digest'];
  try {
    expectedDigest = await computeFactSnapshotDigest(structural.snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...structural,
      ok: false,
      releaseReady: false,
      errors: [
        ...structural.errors,
        diagnostic(
          'error',
          'FACT_SNAPSHOT_DIGEST_UNAVAILABLE',
          'digest',
          `无法执行 canonical digest 校验：${message}`,
        ),
      ],
    };
  }
  return validateFactSnapshotShape(value, { ...options, expectedDigest });
}

/**
 * Create a snapshot from source facts while computing its canonical digest
 * exactly once. Callers still receive the same full structural, catalog,
 * build, source and release validation as validateFactSnapshot.
 */
export async function createFactSnapshot(
  value: FactSnapshotDraft,
  options: FactSnapshotValidationOptions = {},
): Promise<FactSnapshotValidation> {
  const candidate = {
    ...value,
    digest: `sha256:${'0'.repeat(64)}`,
  } satisfies FactSnapshot;
  const structural = validateFactSnapshotShape(candidate, { ...options, requireApproved: false });
  if (!structural.snapshot || structural.errors.length > 0) return structural;
  let expectedDigest: FactSnapshot['digest'];
  try {
    expectedDigest = await computeFactSnapshotDigest(structural.snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...structural,
      ok: false,
      releaseReady: false,
      errors: [
        ...structural.errors,
        diagnostic(
          'error',
          'FACT_SNAPSHOT_DIGEST_UNAVAILABLE',
          'digest',
          `无法执行 canonical digest 校验：${message}`,
        ),
      ],
    };
  }
  return validateFactSnapshotShape(
    { ...candidate, digest: expectedDigest },
    { ...options, expectedDigest },
  );
}

/** Explicit name for callers that want to signal the full integrity pass. */
export const validateFactSnapshotIntegrity = validateFactSnapshot;
