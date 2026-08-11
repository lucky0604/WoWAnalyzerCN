import { getDungeonCatalogEntry } from '../data/season2Catalog';
import type { DungeonDocument } from '../schema/types';
import {
  buildFactBindingPlan,
  type FactBindingPlan,
  type FactBindingPlanResult,
} from './factBindingPlan';
import {
  createFactBindingDecisionTemplate,
  type FactBindingDecisionTemplate,
} from './factBindingDecisions';
import {
  buildWclFactSnapshot,
  buildWclFactSnapshotFromCapturedSource,
  type WclFactSnapshotOptions,
  type WclFactSnapshotResult,
} from './wclFactSnapshot';
import { isValidatedWclFactSource, type WclFactSourceResult } from './wclFactSource';
import type { FactSnapshot } from './factSnapshot';

export const factIntakeBundleSchemaVersion = 1 as const;

export type FactIntakeBundleStatus = 'snapshot-only' | 'template-ready';

export interface FactIntakeDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface FactIntakeBundleManifest {
  version: typeof factIntakeBundleSchemaVersion;
  status: FactIntakeBundleStatus;
  source: {
    reportCode: string;
    eventPages: number;
  };
  files: {
    snapshot: 'snapshot.json';
    plan?: 'binding-plan.json';
    decisionsTemplate?: 'decisions.template.json';
    authoringDocument?: 'authoring-document.json';
  };
  skipped: {
    plan?: 'document-not-provided';
    decisionsTemplate?: 'document-not-provided';
    authoringDocument?: 'document-not-provided';
  };
  diagnostics: {
    errors: Array<Pick<FactIntakeDiagnostic, 'code' | 'path'>>;
    warnings: Array<Pick<FactIntakeDiagnostic, 'code' | 'path'>>;
  };
  snapshot: {
    artifact: 'snapshot.json';
    snapshotId: string;
    digest: FactSnapshot['digest'];
    dungeonId: string;
    season: string;
    gameBuild: string;
    fightId?: number;
  };
  document?: {
    artifact: 'authoring-document.json';
    id: string;
    season: string;
    gameBuild: string;
    revision: number;
  };
  plan?: {
    artifact: 'binding-plan.json';
    planDigest: FactBindingPlan['planDigest'];
    status: FactBindingPlan['status'];
    coverage: FactBindingPlan['coverage'];
  };
  decisionsTemplate?: {
    artifact: 'decisions.template.json';
    reviewer: string;
    reviewedAt: string;
    enemyRows: number;
    abilityRows: number;
  };
}

export interface FactIntakeBundleArtifacts {
  snapshot: FactSnapshot;
  plan?: FactBindingPlan;
  decisionsTemplate?: FactBindingDecisionTemplate;
  manifest: FactIntakeBundleManifest;
}

export interface FactIntakeBundleResult {
  ok: boolean;
  artifacts?: FactIntakeBundleArtifacts;
  errors: FactIntakeDiagnostic[];
  warnings: FactIntakeDiagnostic[];
}

export interface FactIntakeBundleOptions extends Pick<
  WclFactSnapshotOptions,
  | 'dungeonId'
  | 'season'
  | 'gameBuild'
  | 'snapshotId'
  | 'evidenceRef'
  | 'capturedAt'
  | 'fightId'
  | 'licenseStatus'
  | 'requireApproved'
> {
  reportCode: string;
  document?: DungeonDocument;
  reviewer?: string;
  reviewedAt?: string;
}

const append = (
  target: FactIntakeDiagnostic[],
  incoming: readonly FactIntakeDiagnostic[],
): void => {
  incoming.forEach((item) => target.push(item));
};

const diagnostic = (
  severity: FactIntakeDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactIntakeDiagnostic => ({ severity, code, path, message });

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDiagnostic = (value: unknown): value is FactIntakeDiagnostic =>
  isRecord(value) &&
  (value.severity === 'error' || value.severity === 'warning') &&
  typeof value.code === 'string' &&
  typeof value.path === 'string' &&
  typeof value.message === 'string';

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function readSourceCode(
  value: unknown,
  path: string,
): {
  code?: string;
  errors: FactIntakeDiagnostic[];
} {
  if (!isRecord(value)) return { errors: [] };
  const aliases = [value.code, value.reportCode].filter(nonEmptyString);
  const uniqueAliases = [...new Set(aliases)];
  if (uniqueAliases.length > 1) {
    return {
      errors: [
        diagnostic(
          'error',
          'FACT_INTAKE_SOURCE_CODE_ALIAS_MISMATCH',
          path,
          '同一输入中的 code 与 reportCode 不一致，不能选择其中一个继续处理。',
        ),
      ],
    };
  }
  return { code: uniqueAliases[0], errors: [] };
}

function validateSource(
  source: WclFactSourceResult,
  reportCode: string,
  fightId: number | undefined,
): FactIntakeDiagnostic[] {
  const errors: FactIntakeDiagnostic[] = [];
  if (!isRecord(source) || typeof source.ok !== 'boolean') {
    return [
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source',
        'WCL source capture 结果必须是包含 ok、report、diagnostics 的对象。',
      ),
    ];
  }
  if (!Array.isArray(source.errors) || !source.errors.every(isDiagnostic)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source.errors',
        'source.errors 必须是结构化诊断数组。',
      ),
    );
  }
  if (!Array.isArray(source.warnings) || !source.warnings.every(isDiagnostic)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source.warnings',
        'source.warnings 必须是结构化诊断数组。',
      ),
    );
  }
  if (!Number.isInteger(source.eventPages) || source.eventPages < 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source.eventPages',
        'source.eventPages 必须是非负整数。',
      ),
    );
  }
  if (source.fightId !== undefined && (!Number.isInteger(source.fightId) || source.fightId <= 0)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source.fightId',
        'source.fightId 必须是正整数。',
      ),
    );
  }
  if (fightId !== undefined && source.fightId !== undefined && fightId !== source.fightId) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_FIGHT_ID_MISMATCH',
        'source.fightId',
        `source fightId ${source.fightId} 与请求 fightId ${fightId} 不一致。`,
      ),
    );
  }
  if (!isRecord(source.report)) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_INVALID',
        'source.report',
        'source.report 必须是对象。',
      ),
    );
  }
  const reportCodeResult = readSourceCode(source.report, 'source.report');
  const eventsCodeResult = readSourceCode(source.events, 'source.events');
  errors.push(...reportCodeResult.errors, ...eventsCodeResult.errors);
  for (const [path, value] of [
    ['source.report', reportCodeResult.code],
    ['source.events', eventsCodeResult.code],
  ] as const) {
    if (value !== undefined && value !== reportCode) {
      errors.push(
        diagnostic(
          'error',
          'FACT_INTAKE_SOURCE_REPORT_CODE_MISMATCH',
          path,
          `source report code ${value} 与请求 reportCode ${reportCode} 不一致。`,
        ),
      );
    }
  }
  if (source.ok && Array.isArray(source.errors) && source.errors.length > 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_SOURCE_ERROR_STATE',
        'source.errors',
        'source.ok=true 时不能同时携带 error diagnostics。',
      ),
    );
  }
  return errors;
}

function summarizeDiagnostics(diagnostics: readonly FactIntakeDiagnostic[]) {
  return diagnostics.map(({ code, path }) => ({ code, path }));
}

function baseManifest(
  options: FactIntakeBundleOptions,
  source: WclFactSourceResult,
  snapshot: FactSnapshot,
): FactIntakeBundleManifest {
  return {
    version: factIntakeBundleSchemaVersion,
    status: options.document ? 'template-ready' : 'snapshot-only',
    source: { reportCode: options.reportCode, eventPages: source.eventPages },
    files: { snapshot: 'snapshot.json' },
    skipped: options.document
      ? {}
      : {
          plan: 'document-not-provided',
          decisionsTemplate: 'document-not-provided',
          authoringDocument: 'document-not-provided',
        },
    diagnostics: { errors: [], warnings: [] },
    snapshot: {
      artifact: 'snapshot.json',
      snapshotId: snapshot.snapshotId,
      digest: snapshot.digest,
      dungeonId: snapshot.dungeonId,
      season: snapshot.season,
      gameBuild: snapshot.gameBuild,
      ...(snapshot.fightId === undefined ? {} : { fightId: snapshot.fightId }),
    },
  };
}

/**
 * Build the four-file intake bundle in memory.  This function intentionally
 * performs no filesystem writes and never accepts a binding decision; the
 * caller must persist the returned artifacts atomically and a reviewer must
 * edit the TODO template before a manifest can be generated.
 */
export async function buildFactIntakeBundle(
  source: WclFactSourceResult,
  options: FactIntakeBundleOptions,
): Promise<FactIntakeBundleResult> {
  const errors: FactIntakeDiagnostic[] = [];
  const warnings: FactIntakeDiagnostic[] = [];
  const sourceValidationErrors = validateSource(source, options.reportCode, options.fightId);
  if (sourceValidationErrors.length > 0) {
    if (isRecord(source) && Array.isArray(source.errors))
      append(errors, source.errors.filter(isDiagnostic));
    if (isRecord(source) && Array.isArray(source.warnings)) {
      append(warnings, source.warnings.filter(isDiagnostic));
    }
    append(errors, sourceValidationErrors);
    return { ok: false, errors, warnings };
  }
  if (!source.ok || !source.report) {
    append(errors, source.errors);
    append(warnings, source.warnings);
    if (errors.length === 0) {
      errors.push(
        diagnostic(
          'error',
          'FACT_INTAKE_SOURCE_INVALID',
          'source',
          'WCL source capture 未返回可用 report，不能生成 intake bundle。',
        ),
      );
    }
    return { ok: false, errors, warnings };
  }
  if (typeof options.reportCode !== 'string' || !options.reportCode.trim()) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_REPORT_CODE_REQUIRED',
        'reportCode',
        'reportCode 不能为空。',
      ),
    );
    return { ok: false, errors, warnings };
  }
  const catalogEntry = getDungeonCatalogEntry(options.dungeonId);
  if (!catalogEntry) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_CATALOG_ENTRY_REQUIRED',
        'dungeonId',
        `S2 目录中不存在副本：${options.dungeonId}。`,
      ),
    );
    return { ok: false, errors, warnings };
  }

  append(warnings, source.warnings);
  const scopedFightId = source.fightId ?? options.fightId;
  const snapshotOptions: WclFactSnapshotOptions = {
    dungeonId: options.dungeonId,
    season: options.season,
    gameBuild: options.gameBuild,
    snapshotId: options.snapshotId,
    evidenceRef: options.evidenceRef,
    capturedAt: options.capturedAt,
    ...(scopedFightId === undefined ? {} : { fightId: scopedFightId }),
    ...(options.licenseStatus === undefined ? {} : { licenseStatus: options.licenseStatus }),
    ...(options.requireApproved === undefined ? {} : { requireApproved: options.requireApproved }),
    catalogEntry,
  };
  const snapshotResult: WclFactSnapshotResult = isValidatedWclFactSource(source)
    ? await buildWclFactSnapshotFromCapturedSource(source, snapshotOptions)
    : await buildWclFactSnapshot(source.report, source.events, snapshotOptions);
  append(errors, snapshotResult.errors);
  append(warnings, snapshotResult.warnings);
  if (!snapshotResult.ok || !snapshotResult.snapshot || errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  const snapshot = snapshotResult.snapshot;
  const manifest = baseManifest(options, source, snapshot);

  if (!options.document) {
    manifest.diagnostics = { errors: [], warnings: summarizeDiagnostics(warnings) };
    return { ok: true, artifacts: { snapshot, manifest }, errors, warnings };
  }

  if (!options.reviewer?.trim() || !options.reviewedAt?.trim()) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_REVIEW_METADATA_REQUIRED',
        'review',
        '带 authoring document 的 bundle 必须同时提供 reviewer 和 reviewedAt；不能伪造审阅身份。',
      ),
    );
    return { ok: false, errors, warnings };
  }
  const planResult: FactBindingPlanResult = await buildFactBindingPlan(options.document, snapshot, {
    catalogEntry,
    expectedGameBuild: options.document.version.build,
    requireApproved: options.requireApproved,
  });
  append(errors, planResult.errors);
  append(warnings, planResult.warnings);
  if (!planResult.ok || !planResult.plan || errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  if (planResult.plan.enemies.length + planResult.plan.abilities.length === 0) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_NO_SOURCE_ROWS',
        'plan',
        '当前事实快照没有 Enemy 或 Ability source row，不能生成空人工决策模板。',
      ),
    );
    return { ok: false, errors, warnings };
  }

  let decisionsTemplate: FactBindingDecisionTemplate;
  try {
    decisionsTemplate = createFactBindingDecisionTemplate(planResult.plan, {
      reviewer: options.reviewer,
      reviewedAt: options.reviewedAt,
    });
  } catch (error) {
    errors.push(
      diagnostic(
        'error',
        'FACT_INTAKE_TEMPLATE_INVALID',
        'decisionsTemplate',
        error instanceof Error ? error.message : String(error),
      ),
    );
    return { ok: false, errors, warnings };
  }

  manifest.document = {
    artifact: 'authoring-document.json',
    id: options.document.id,
    season: options.document.season,
    gameBuild: options.document.version.build,
    revision: options.document.version.revision,
  };
  manifest.files = {
    snapshot: 'snapshot.json',
    plan: 'binding-plan.json',
    decisionsTemplate: 'decisions.template.json',
    authoringDocument: 'authoring-document.json',
  };
  manifest.skipped = {};
  manifest.plan = {
    artifact: 'binding-plan.json',
    planDigest: planResult.plan.planDigest,
    status: planResult.plan.status,
    coverage: planResult.plan.coverage,
  };
  manifest.decisionsTemplate = {
    artifact: 'decisions.template.json',
    reviewer: decisionsTemplate.reviewer,
    reviewedAt: decisionsTemplate.reviewedAt,
    enemyRows: decisionsTemplate.enemies.length,
    abilityRows: decisionsTemplate.abilities.length,
  };
  manifest.diagnostics = { errors: [], warnings: summarizeDiagnostics(warnings) };

  return {
    ok: true,
    artifacts: { snapshot, plan: planResult.plan, decisionsTemplate, manifest },
    errors,
    warnings,
  };
}
