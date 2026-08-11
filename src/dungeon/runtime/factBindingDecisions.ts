import {
  factBindingSchemaVersion,
  type FactBindingAbility,
  type FactBindingDiagnostic,
  type FactBindingEnemy,
  type FactBindingManifest,
} from './factBinding';
import type {
  FactBindingAbilityPlanRow,
  FactBindingCandidateStatus,
  FactBindingEnemyPlanRow,
  FactBindingPlan,
  FactBindingPlanDigest,
} from './factBindingPlan';
import { computeFactBindingPlanDigest } from './factBindingPlan';

export const factBindingDecisionSchemaVersion = 1 as const;

export type FactBindingDecision = 'accept' | 'reject' | 'override';

export interface FactBindingDecisionRow {
  sourceKey: string;
  decision: FactBindingDecision;
  documentId?: string;
  reason?: string;
}

export interface FactBindingDecisionFile {
  version: typeof factBindingDecisionSchemaVersion;
  plan: {
    planDigest: FactBindingPlanDigest;
    snapshotId: string;
    snapshotDigest: string;
    dungeonId: string;
    season: string;
    gameBuild: string;
    documentId: string;
    documentSeason: string;
    documentGameBuild: string;
    documentRevision: number;
  };
  reviewer: string;
  reviewedAt: string;
  enemies: FactBindingDecisionRow[];
  abilities: FactBindingDecisionRow[];
}

/**
 * A deliberately non-consumable decision template.  `TODO` is not part of
 * FactBindingDecision, so a template cannot accidentally be passed to the
 * manifest generator before every row has been reviewed.
 */
export interface FactBindingDecisionTemplate {
  version: typeof factBindingDecisionSchemaVersion;
  plan: FactBindingDecisionFile['plan'];
  reviewer: string;
  reviewedAt: string;
  enemies: Array<{
    sourceKey: string;
    decision: 'TODO';
    reason: string;
  }>;
  abilities: Array<{
    sourceKey: string;
    decision: 'TODO';
    reason: string;
  }>;
}

export interface FactBindingDecisionResult {
  ok: boolean;
  manifest?: FactBindingManifest;
  errors: FactBindingDiagnostic[];
  warnings: FactBindingDiagnostic[];
  summary: {
    enemyAccepted: number;
    enemyRejected: number;
    abilityAccepted: number;
    abilityRejected: number;
  };
}

export interface FactBindingDecisionOptions {
  /** Require every source row to be explicitly accepted or overridden. */
  requireComplete?: boolean;
}

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const decisionValues = new Set<FactBindingDecision>(['accept', 'reject', 'override']);
const candidateStatuses = new Set<FactBindingCandidateStatus>([
  'suggested',
  'ambiguous',
  'unmapped',
  'blocked',
]);

const diagnostic = (
  severity: FactBindingDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactBindingDiagnostic => ({ severity, code, path, message });

function unknownKeys(
  value: RecordValue,
  allowed: ReadonlySet<string>,
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
          'FACT_BINDING_DECISION_UNKNOWN_FIELD',
          `${path}.${key}`,
          `人工映射决策文件不支持字段：${key}。`,
        ),
      ),
    );
}

function validIsoTimestamp(value: unknown): value is string {
  return (
    nonEmptyString(value) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function readPlanIdentity(plan: FactBindingPlan): FactBindingDecisionFile['plan'] {
  return {
    planDigest: plan.planDigest,
    snapshotId: plan.snapshot.snapshotId,
    snapshotDigest: plan.snapshot.digest,
    dungeonId: plan.snapshot.dungeonId,
    season: plan.snapshot.season,
    gameBuild: plan.snapshot.gameBuild,
    documentId: plan.document.id,
    documentSeason: plan.document.season,
    documentGameBuild: plan.document.gameBuild,
    documentRevision: plan.document.revision,
  };
}

export function isFactBindingDecisionTimestamp(value: unknown): value is string {
  return validIsoTimestamp(value);
}

/**
 * Build a review-only template from a validated candidate plan.  The rows use
 * an intentionally invalid decision value so the template is safe to save and
 * edit, but cannot be consumed as a manifest until every TODO is replaced.
 */
export function createFactBindingDecisionTemplate(
  plan: FactBindingPlan,
  options: { reviewer: string; reviewedAt: string },
): FactBindingDecisionTemplate {
  if (
    !plan ||
    !Array.isArray(plan.enemies) ||
    !Array.isArray(plan.abilities) ||
    [...plan.enemies, ...plan.abilities].some(
      (row) => !isRecord(row) || !nonEmptyString(row.sourceKey),
    )
  ) {
    throw new Error('FACT_BINDING_DECISION_TEMPLATE_PLAN_INVALID');
  }
  if (plan.enemies.length + plan.abilities.length === 0) {
    throw new Error('FACT_BINDING_DECISION_TEMPLATE_NO_SOURCE_ROWS');
  }
  if (!nonEmptyString(options.reviewer)) {
    throw new Error('FACT_BINDING_DECISION_TEMPLATE_REVIEWER_REQUIRED');
  }
  if (!validIsoTimestamp(options.reviewedAt)) {
    throw new Error('FACT_BINDING_DECISION_TEMPLATE_TIMESTAMP_INVALID');
  }
  return {
    version: factBindingDecisionSchemaVersion,
    plan: readPlanIdentity(plan),
    reviewer: options.reviewer,
    reviewedAt: options.reviewedAt,
    enemies: plan.enemies.map((row) => ({
      sourceKey: row.sourceKey,
      decision: 'TODO',
      reason: '',
    })),
    abilities: plan.abilities.map((row) => ({
      sourceKey: row.sourceKey,
      decision: 'TODO',
      reason: '',
    })),
  };
}

function validatePlanShape(
  value: unknown,
  errors: FactBindingDiagnostic[],
): value is FactBindingPlan {
  if (!isRecord(value)) {
    errors.push(
      diagnostic('error', 'FACT_BINDING_DECISION_PLAN_INVALID', 'plan', '候选计划必须是对象。'),
    );
    return false;
  }
  unknownKeys(
    value,
    new Set([
      'version',
      'planDigest',
      'snapshot',
      'document',
      'manifestTemplate',
      'enemies',
      'abilities',
      'coverage',
      'status',
    ]),
    'plan',
    errors,
  );
  if (value.version !== 1) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_VERSION_INVALID',
        'plan.version',
        '候选计划 version 必须为 1。',
      ),
    );
  }
  if (!nonEmptyString(value.planDigest) || !/^sha256:[a-f0-9]{64}$/.test(value.planDigest)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_DIGEST_INVALID',
        'plan.planDigest',
        '候选计划 planDigest 必须是 sha256: 加 64 位小写十六进制字符串。',
      ),
    );
  }
  const snapshot = value.snapshot;
  if (!isRecord(snapshot)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_INVALID',
        'plan.snapshot',
        'snapshot 必须是对象。',
      ),
    );
  } else {
    unknownKeys(
      snapshot,
      new Set(['snapshotId', 'digest', 'dungeonId', 'season', 'gameBuild']),
      'plan.snapshot',
      errors,
    );
    ['snapshotId', 'digest', 'dungeonId', 'season', 'gameBuild'].forEach((key) => {
      if (!nonEmptyString(snapshot[key])) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_INVALID',
            `plan.snapshot.${key}`,
            `${key} 必须是非空字符串。`,
          ),
        );
      }
    });
    if (!/^sha256:[a-f0-9]{64}$/.test(String(snapshot.digest))) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_INVALID',
          'plan.snapshot.digest',
          'snapshot.digest 必须是 sha256: 加 64 位小写十六进制字符串。',
        ),
      );
    }
  }
  const document = value.document;
  if (!isRecord(document)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_INVALID',
        'plan.document',
        'document 必须是对象。',
      ),
    );
  } else {
    unknownKeys(
      document,
      new Set(['id', 'season', 'gameBuild', 'revision']),
      'plan.document',
      errors,
    );
    ['id', 'season', 'gameBuild'].forEach((key) => {
      if (!nonEmptyString(document[key])) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_INVALID',
            `plan.document.${key}`,
            `${key} 必须是非空字符串。`,
          ),
        );
      }
    });
    if (!Number.isInteger(document.revision) || (document.revision as number) <= 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_INVALID',
          'plan.document.revision',
          'document.revision 必须是正整数。',
        ),
      );
    }
  }
  if (!Array.isArray(value.enemies) || !Array.isArray(value.abilities)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_ROWS_INVALID',
        'plan',
        '候选计划必须包含 enemies 与 abilities 数组。',
      ),
    );
  }
  const manifestTemplate = value.manifestTemplate;
  if (!isRecord(manifestTemplate)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_INVALID',
        'plan.manifestTemplate',
        '候选计划必须包含 manifestTemplate 对象。',
      ),
    );
  } else {
    unknownKeys(
      manifestTemplate,
      new Set([
        'version',
        'snapshotId',
        'snapshotDigest',
        'dungeonId',
        'season',
        'gameBuild',
        'enemies',
        'abilities',
      ]),
      'plan.manifestTemplate',
      errors,
    );
    if (manifestTemplate.version !== factBindingSchemaVersion) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_INVALID',
          'plan.manifestTemplate.version',
          'manifestTemplate.version 必须为 1。',
        ),
      );
    }
    const snapshotValue = value.snapshot;
    if (
      isRecord(snapshotValue) &&
      ['snapshotId', 'digest', 'dungeonId', 'season', 'gameBuild'].some(
        (key) => manifestTemplate[key === 'digest' ? 'snapshotDigest' : key] !== snapshotValue[key],
      )
    ) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_IDENTITY_INVALID',
          'plan.manifestTemplate',
          'manifestTemplate identity 必须与 snapshot identity 一致。',
        ),
      );
    }
    if (
      !Array.isArray(manifestTemplate.enemies) ||
      !Array.isArray(manifestTemplate.abilities) ||
      manifestTemplate.enemies.length > 0 ||
      manifestTemplate.abilities.length > 0
    ) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_INVALID',
          'plan.manifestTemplate',
          '候选计划的 manifestTemplate 必须是空映射模板；实际决定只能来自 decisions 文件。',
        ),
      );
    }
  }
  const coverage = value.coverage;
  if (!isRecord(coverage)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_INVALID',
        'plan.coverage',
        '候选计划必须包含 coverage 对象。',
      ),
    );
  } else {
    const coverageKeys = [
      'snapshotEnemies',
      'snapshotAbilities',
      'documentEnemies',
      'documentAbilities',
      'unambiguousEnemyCandidates',
      'unambiguousAbilityCandidates',
    ];
    unknownKeys(coverage, new Set(coverageKeys), 'plan.coverage', errors);
    coverageKeys.forEach((key) => {
      if (!Number.isInteger(coverage[key]) || (coverage[key] as number) < 0) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_INVALID',
            `plan.coverage.${key}`,
            `${key} 必须是非负整数。`,
          ),
        );
      }
    });
  }
  if (!['ready-for-review', 'needs-review', 'blocked'].includes(String(value.status))) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_INVALID',
        'plan.status',
        '候选计划 status 不是受支持的状态。',
      ),
    );
  }
  if (
    isRecord(value.snapshot) &&
    isRecord(value.document) &&
    value.snapshot.dungeonId !== value.document.id
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_IDENTITY_INVALID',
        'plan.snapshot.dungeonId',
        '候选计划的 snapshot dungeonId 必须与 document.id 一致。',
      ),
    );
  }
  if (
    isRecord(value.snapshot) &&
    isRecord(value.document) &&
    value.snapshot.season !== value.document.season
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_IDENTITY_INVALID',
        'plan.snapshot.season',
        '候选计划的 snapshot season 必须与 document.season 一致。',
      ),
    );
  }
  if (
    isRecord(value.snapshot) &&
    isRecord(value.document) &&
    value.snapshot.gameBuild !== value.document.gameBuild
  ) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_IDENTITY_INVALID',
        'plan.snapshot.gameBuild',
        '候选计划的 snapshot gameBuild 必须与 document.gameBuild 一致。',
      ),
    );
  }
  return errors.length === 0;
}

function validatePlanRows(
  rows: readonly unknown[],
  path: string,
  kind: 'enemy' | 'ability',
  errors: FactBindingDiagnostic[],
): boolean {
  const sourceKeys = new Set<string>();
  rows.forEach((value, index) => {
    const rowPath = `${path}[${index}]`;
    if (!isRecord(value)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
          rowPath,
          '计划行必须是对象。',
        ),
      );
      return;
    }
    unknownKeys(
      value,
      kind === 'enemy'
        ? new Set(['sourceKey', 'npcId', 'isBoss', 'candidates', 'status'])
        : new Set(['sourceKey', 'spellId', 'casterEnemyKeys', 'candidates', 'status']),
      rowPath,
      errors,
    );
    if (!nonEmptyString(value.sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
          `${rowPath}.sourceKey`,
          'sourceKey 必须是非空字符串。',
        ),
      );
    } else if (sourceKeys.has(value.sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_DUPLICATE_SOURCE_KEY',
          `${rowPath}.sourceKey`,
          `sourceKey 重复：${value.sourceKey}`,
        ),
      );
    } else {
      sourceKeys.add(value.sourceKey);
    }
    if (kind === 'enemy') {
      if (!Number.isInteger(value.npcId) || (value.npcId as number) <= 0) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
            `${rowPath}.npcId`,
            'npcId 必须是正整数。',
          ),
        );
      }
      if (typeof value.isBoss !== 'boolean') {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
            `${rowPath}.isBoss`,
            'isBoss 必须是 boolean。',
          ),
        );
      }
    } else {
      if (!Number.isInteger(value.spellId) || (value.spellId as number) <= 0) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
            `${rowPath}.spellId`,
            'spellId 必须是正整数。',
          ),
        );
      }
      if (
        !Array.isArray(value.casterEnemyKeys) ||
        value.casterEnemyKeys.length === 0 ||
        value.casterEnemyKeys.some((key) => !nonEmptyString(key))
      ) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
            `${rowPath}.casterEnemyKeys`,
            'casterEnemyKeys 必须是非空字符串数组。',
          ),
        );
      }
    }
    if (!candidateStatuses.has(value.status as FactBindingCandidateStatus)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
          `${rowPath}.status`,
          'status 不是受支持的候选状态。',
        ),
      );
    }
    if (!Array.isArray(value.candidates)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_ROW_INVALID',
          `${rowPath}.candidates`,
          'candidates 必须是数组。',
        ),
      );
      return;
    }
    const candidateCountRequirements: Record<
      FactBindingCandidateStatus,
      (count: number) => boolean
    > = {
      suggested: (count) => count === 1,
      ambiguous: (count) => count > 1,
      unmapped: (count) => count === 0,
      blocked: (count) => count > 0,
    };
    const status = value.status as FactBindingCandidateStatus;
    if (
      candidateStatuses.has(status) &&
      !candidateCountRequirements[status](value.candidates.length)
    ) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_STATUS_INVALID',
          `${rowPath}.status`,
          `status ${value.status} 与 candidates 数量 ${value.candidates.length} 不一致。`,
        ),
      );
    }
    const candidateIds = new Set<string>();
    value.candidates.forEach((candidate, candidateIndex) => {
      const candidatePath = `${rowPath}.candidates[${candidateIndex}]`;
      if (
        !isRecord(candidate) ||
        !nonEmptyString(candidate.documentId) ||
        !Array.isArray(candidate.reasons)
      ) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_CANDIDATE_INVALID',
            candidatePath,
            'candidate 必须包含 documentId 和 reasons 数组。',
          ),
        );
        return;
      }
      unknownKeys(candidate, new Set(['documentId', 'reasons']), candidatePath, errors);
      if (candidateIds.has(candidate.documentId as string)) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_DUPLICATE_CANDIDATE',
            `${candidatePath}.documentId`,
            `candidate documentId 重复：${candidate.documentId}`,
          ),
        );
      } else {
        candidateIds.add(candidate.documentId as string);
      }
      if (
        candidate.reasons.length === 0 ||
        candidate.reasons.some((reason) => !nonEmptyString(reason))
      ) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_CANDIDATE_INVALID',
            `${candidatePath}.reasons`,
            'candidate reasons 必须是非空字符串数组。',
          ),
        );
      }
    });
  });
  return errors.length === 0;
}

function validateDecisionRows(
  value: unknown,
  planRows: readonly (FactBindingEnemyPlanRow | FactBindingAbilityPlanRow)[],
  path: string,
  errors: FactBindingDiagnostic[],
): FactBindingDecisionRow[] {
  if (!Array.isArray(value)) {
    errors.push(
      diagnostic('error', 'FACT_BINDING_DECISION_ROWS_INVALID', path, `${path} 必须是数组。`),
    );
    return [];
  }
  const planBySourceKey = new Map(planRows.map((row) => [row.sourceKey, row]));
  const seen = new Set<string>();
  const rows: FactBindingDecisionRow[] = [];
  value.forEach((candidate, index) => {
    const rowPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(
        diagnostic('error', 'FACT_BINDING_DECISION_ROW_INVALID', rowPath, '决策行必须是对象。'),
      );
      return;
    }
    unknownKeys(
      candidate,
      new Set(['sourceKey', 'decision', 'documentId', 'reason']),
      rowPath,
      errors,
    );
    const sourceKey = candidate.sourceKey;
    const decision = candidate.decision;
    if (!nonEmptyString(sourceKey) || !decisionValues.has(decision as FactBindingDecision)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_ROW_INVALID',
          rowPath,
          'sourceKey 必须非空，decision 必须为 accept、reject 或 override。',
        ),
      );
      return;
    }
    if (seen.has(sourceKey)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_DUPLICATE_SOURCE_KEY',
          `${rowPath}.sourceKey`,
          `sourceKey 重复：${sourceKey}`,
        ),
      );
      return;
    }
    seen.add(sourceKey);
    const planRow = planBySourceKey.get(sourceKey);
    if (!planRow) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_UNKNOWN_SOURCE_KEY',
          `${rowPath}.sourceKey`,
          `候选计划中不存在 sourceKey：${sourceKey}`,
        ),
      );
      return;
    }
    const normalizedDecision = decision as FactBindingDecision;
    const documentId = candidate.documentId;
    const reason = candidate.reason;
    if (normalizedDecision === 'reject') {
      if (documentId !== undefined) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_TARGET_NOT_ALLOWED',
            `${rowPath}.documentId`,
            'reject 决策不能包含 documentId。',
          ),
        );
      }
      if (!nonEmptyString(reason)) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_REASON_REQUIRED',
            `${rowPath}.reason`,
            'reject 决策必须记录 reason。',
          ),
        );
      }
    } else if (!nonEmptyString(documentId)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_TARGET_REQUIRED',
          `${rowPath}.documentId`,
          `${normalizedDecision} 决策必须包含 documentId。`,
        ),
      );
    } else if (normalizedDecision === 'accept') {
      const isCandidate = planRow.candidates.some((item) => item.documentId === documentId);
      if (planRow.status !== 'suggested' || !isCandidate) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_ACCEPT_NOT_SUGGESTED',
            `${rowPath}.documentId`,
            'accept 只能采纳唯一的 suggested 候选；歧义或非候选必须使用 override 并记录原因。',
          ),
        );
      }
    } else if (!nonEmptyString(reason)) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_REASON_REQUIRED',
          `${rowPath}.reason`,
          'override 决策必须记录 reason。',
        ),
      );
    }
    rows.push({
      sourceKey,
      decision: normalizedDecision,
      ...(nonEmptyString(documentId) ? { documentId } : {}),
      ...(nonEmptyString(reason) ? { reason } : {}),
    });
  });
  const missing = planRows.filter((row) => !seen.has(row.sourceKey));
  missing.forEach((row) =>
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_MISSING_SOURCE_KEY',
        `${path}`,
        `sourceKey 尚未作出明确决策：${row.sourceKey}`,
      ),
    ),
  );
  return rows;
}

function checkTargetCollisions(
  rows: readonly FactBindingDecisionRow[],
  path: string,
  errors: FactBindingDiagnostic[],
): void {
  const targets = new Map<string, string>();
  rows
    .filter((row) => row.decision !== 'reject' && row.documentId)
    .forEach((row) => {
      const previous = targets.get(row.documentId!);
      if (previous) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_DUPLICATE_TARGET_ID',
            path,
            `${row.documentId} 被 ${previous} 与 ${row.sourceKey} 同时采纳。`,
          ),
        );
      } else {
        targets.set(row.documentId!, row.sourceKey);
      }
    });
}

function acceptedRows(
  rows: readonly FactBindingDecisionRow[],
): Array<FactBindingDecisionRow & { documentId: string }> {
  return rows
    .filter((row) => row.decision !== 'reject' && nonEmptyString(row.documentId))
    .map((row) => ({ ...row, documentId: row.documentId! }));
}

export async function buildFactBindingManifestFromDecisions(
  rawPlan: unknown,
  rawDecisions: unknown,
  options: FactBindingDecisionOptions = {},
): Promise<FactBindingDecisionResult> {
  const errors: FactBindingDiagnostic[] = [];
  const warnings: FactBindingDiagnostic[] = [];
  const summary = { enemyAccepted: 0, enemyRejected: 0, abilityAccepted: 0, abilityRejected: 0 };
  if (!validatePlanShape(rawPlan, errors)) {
    return { ok: false, errors, warnings, summary };
  }
  const plan = rawPlan as FactBindingPlan;
  let computedPlanDigest: FactBindingPlanDigest;
  try {
    computedPlanDigest = await computeFactBindingPlanDigest(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_DIGEST_UNAVAILABLE',
        'plan.planDigest',
        `无法计算候选计划 digest：${message}`,
      ),
    );
    return { ok: false, errors, warnings, summary };
  }
  if (computedPlanDigest !== plan.planDigest) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_DIGEST_MISMATCH',
        'plan.planDigest',
        `候选计划内容与 planDigest 不一致：${plan.planDigest} !== ${computedPlanDigest}。`,
      ),
    );
    return { ok: false, errors, warnings, summary };
  }
  if (!validatePlanRows(plan.enemies, 'plan.enemies', 'enemy', errors)) {
    return { ok: false, errors, warnings, summary };
  }
  if (!validatePlanRows(plan.abilities, 'plan.abilities', 'ability', errors)) {
    return { ok: false, errors, warnings, summary };
  }
  if (plan.enemies.length + plan.abilities.length === 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_EMPTY_PLAN',
        'plan',
        '候选计划没有任何 Enemy 或 Ability sourceKey，不能生成空 binding manifest。',
      ),
    );
    return { ok: false, errors, warnings, summary };
  }
  const expectedCoverage = {
    snapshotEnemies: plan.enemies.length,
    snapshotAbilities: plan.abilities.length,
    unambiguousEnemyCandidates: plan.enemies.filter((row) => row.status === 'suggested').length,
    unambiguousAbilityCandidates: plan.abilities.filter((row) => row.status === 'suggested').length,
  };
  for (const [key, expected] of Object.entries(expectedCoverage)) {
    if (plan.coverage[key as keyof typeof expectedCoverage] !== expected) {
      errors.push(
        diagnostic(
          'error',
          'FACT_BINDING_DECISION_PLAN_COVERAGE_MISMATCH',
          `plan.coverage.${key}`,
          `coverage.${key} 与候选计划实际行数不一致。`,
        ),
      );
    }
  }
  const hasBlockedRow = [...plan.enemies, ...plan.abilities].some(
    (row) => row.status === 'blocked',
  );
  const hasReviewRow = [...plan.enemies, ...plan.abilities].some(
    (row) => row.status === 'ambiguous' || row.status === 'unmapped',
  );
  const expectedStatus = hasBlockedRow
    ? 'blocked'
    : hasReviewRow
      ? 'needs-review'
      : 'ready-for-review';
  if (plan.status !== expectedStatus) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_STATUS_MISMATCH',
        'plan.status',
        `plan.status ${plan.status} 与候选行推导状态 ${expectedStatus} 不一致。`,
      ),
    );
  }
  if (errors.length > 0) return { ok: false, errors, warnings, summary };
  if (!isRecord(rawDecisions)) {
    errors.push(
      diagnostic('error', 'FACT_BINDING_DECISION_INVALID', '$', '人工映射决策文件必须是对象。'),
    );
    return { ok: false, errors, warnings, summary };
  }
  unknownKeys(
    rawDecisions,
    new Set(['version', 'plan', 'reviewer', 'reviewedAt', 'enemies', 'abilities']),
    '$',
    errors,
  );
  if (rawDecisions.version !== factBindingDecisionSchemaVersion) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_VERSION_INVALID',
        'version',
        '人工映射决策 version 必须为 1。',
      ),
    );
  }
  if (!nonEmptyString(rawDecisions.reviewer)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_REVIEWER_REQUIRED',
        'reviewer',
        '必须记录实际做出映射决定的维护者。',
      ),
    );
  }
  if (!validIsoTimestamp(rawDecisions.reviewedAt)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_TIMESTAMP_INVALID',
        'reviewedAt',
        'reviewedAt 必须是可解析的 ISO 时间戳。',
      ),
    );
  }
  const decisionPlan = rawDecisions.plan;
  const expectedIdentity = readPlanIdentity(plan);
  if (!isRecord(decisionPlan)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_PLAN_IDENTITY_INVALID',
        'plan',
        '决策文件必须包含 plan identity。',
      ),
    );
  } else {
    unknownKeys(decisionPlan, new Set(Object.keys(expectedIdentity)), 'plan', errors);
    Object.entries(expectedIdentity).forEach(([key, expected]) => {
      if (decisionPlan[key] !== expected) {
        errors.push(
          diagnostic(
            'error',
            'FACT_BINDING_DECISION_PLAN_IDENTITY_MISMATCH',
            `plan.${key}`,
            `决策文件的 ${key} 与候选计划不一致。`,
          ),
        );
      }
    });
  }
  const enemyDecisions = validateDecisionRows(
    rawDecisions.enemies,
    plan.enemies,
    'enemies',
    errors,
  );
  const abilityDecisions = validateDecisionRows(
    rawDecisions.abilities,
    plan.abilities,
    'abilities',
    errors,
  );
  checkTargetCollisions(enemyDecisions, 'enemies', errors);
  checkTargetCollisions(abilityDecisions, 'abilities', errors);
  enemyDecisions.forEach((row) =>
    row.decision === 'reject' ? (summary.enemyRejected += 1) : (summary.enemyAccepted += 1),
  );
  abilityDecisions.forEach((row) =>
    row.decision === 'reject' ? (summary.abilityRejected += 1) : (summary.abilityAccepted += 1),
  );
  if (errors.length > 0) return { ok: false, errors, warnings, summary };
  const rejectedRows = [...enemyDecisions, ...abilityDecisions].filter(
    (row) => row.decision === 'reject',
  );
  rejectedRows.forEach((row) =>
    warnings.push(
      diagnostic(
        'warning',
        'FACT_BINDING_DECISION_REJECTED',
        row.sourceKey,
        `sourceKey ${row.sourceKey} 被明确拒绝：${row.reason}`,
      ),
    ),
  );
  if (options.requireComplete && rejectedRows.length > 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_BINDING_DECISION_INCOMPLETE',
        '$',
        '完整 manifest 不能包含 reject 决策；请补充事实或保留为 draft 审计结果。',
      ),
    );
    return { ok: false, errors, warnings, summary };
  }
  const enemies: FactBindingEnemy[] = acceptedRows(enemyDecisions).map((row) => ({
    sourceKey: row.sourceKey,
    documentEnemyId: row.documentId,
  }));
  const abilities: FactBindingAbility[] = acceptedRows(abilityDecisions).map((row) => ({
    sourceKey: row.sourceKey,
    documentAbilityId: row.documentId,
  }));
  const manifest: FactBindingManifest = {
    version: factBindingSchemaVersion,
    snapshotId: plan.snapshot.snapshotId,
    snapshotDigest: plan.snapshot.digest,
    dungeonId: plan.snapshot.dungeonId,
    season: plan.snapshot.season,
    gameBuild: plan.snapshot.gameBuild,
    enemies,
    abilities,
  };
  return { ok: true, manifest, errors, warnings, summary };
}
