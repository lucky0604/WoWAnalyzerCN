import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import {
  buildFactIntakeBundle,
  type FactIntakeBundleResult,
  type FactIntakeDiagnostic,
} from '../../src/dungeon/runtime/factIntake';
import type { DungeonDocument } from '../../src/dungeon/schema/types';
import { captureWclFactInputs } from '../../src/dungeon/runtime/wclFactSource';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function diagnostic(
  severity: FactIntakeDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactIntakeDiagnostic {
  return { severity, code, path, message };
}

function parsePositiveInteger(
  value: string | undefined,
  code: string,
  label: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${code}: ${label} 必须是正整数。`);
  }
  return parsed;
}

async function readDocument(path: string): Promise<DungeonDocument> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  } catch {
    throw new Error(`FACT_INTAKE_DOCUMENT_INVALID: ${resolve(path)}`);
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof (value as { id?: unknown }).id !== 'string' ||
    typeof (value as { season?: unknown }).season !== 'string' ||
    !('version' in value) ||
    !value.version ||
    typeof value.version !== 'object' ||
    Array.isArray(value.version) ||
    !Array.isArray(value.floors) ||
    !Array.isArray(value.spawns) ||
    !Array.isArray(value.enemies) ||
    !Array.isArray(value.abilities) ||
    !Array.isArray(value.situations) ||
    !Array.isArray(value.routes) ||
    !Array.isArray(value.bosses)
  ) {
    throw new Error(`FACT_INTAKE_DOCUMENT_INVALID: ${resolve(path)}`);
  }
  return value as DungeonDocument;
}

function pathContains(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..');
}

async function assertInputOutputIsolation(
  outputDir: string,
  inputPaths: readonly string[],
  force: boolean,
): Promise<void> {
  const resolvedOutput = resolve(outputDir);
  let outputStat: Awaited<ReturnType<typeof stat>> | undefined;
  try {
    outputStat = await stat(resolvedOutput);
  } catch {
    outputStat = undefined;
  }
  if (outputStat && !outputStat.isDirectory()) {
    throw new Error(`FACT_INTAKE_OUTPUT_INVALID: --out-dir 必须是目录：${resolvedOutput}`);
  }
  if (outputStat && !force) {
    throw new Error(
      `FACT_INTAKE_OUTPUT_EXISTS: 输出目录已存在；如需替换请显式传 --force：${resolvedOutput}`,
    );
  }

  const outputRealPath = outputStat ? await realpath(resolvedOutput) : resolvedOutput;
  for (const inputPath of inputPaths) {
    const resolvedInput = resolve(inputPath);
    let inputRealPath: string;
    try {
      inputRealPath = await realpath(resolvedInput);
    } catch {
      throw new Error(`FACT_INTAKE_INPUT_INVALID: 输入文件不存在：${resolvedInput}`);
    }
    if (
      pathContains(outputRealPath, inputRealPath) ||
      pathContains(inputRealPath, outputRealPath)
    ) {
      throw new Error(
        `FACT_INTAKE_OUTPUT_MUST_DIFFER: --out-dir 不能与输入路径重叠：${resolvedInput}`,
      );
    }
    if (outputStat) {
      const inputStat = await stat(resolvedInput);
      if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
        throw new Error(
          `FACT_INTAKE_OUTPUT_MUST_DIFFER: --out-dir 不能通过文件别名覆盖输入：${resolvedInput}`,
        );
      }
    }
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function writeBundleAtomically(
  outputDir: string,
  result: NonNullable<FactIntakeBundleResult['artifacts']>,
  document: DungeonDocument | undefined,
  force: boolean,
): Promise<void> {
  const resolvedOutput = resolve(outputDir);
  const temporaryDir = `${resolvedOutput}.tmp-${process.pid}-${randomUUID()}`;
  const backupDir = `${resolvedOutput}.backup-${process.pid}-${randomUUID()}`;
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await mkdir(temporaryDir, { recursive: false });
  let backupCreated = false;
  try {
    await writeJson(resolve(temporaryDir, 'snapshot.json'), result.snapshot);
    if (result.plan) await writeJson(resolve(temporaryDir, 'binding-plan.json'), result.plan);
    if (result.decisionsTemplate) {
      await writeJson(resolve(temporaryDir, 'decisions.template.json'), result.decisionsTemplate);
    }
    if (document) await writeJson(resolve(temporaryDir, 'authoring-document.json'), document);
    await writeJson(resolve(temporaryDir, 'intake.json'), result.manifest);

    let outputExists = false;
    try {
      await stat(resolvedOutput);
      outputExists = true;
    } catch {
      outputExists = false;
    }
    if (outputExists) {
      if (!force) {
        throw new Error(`FACT_INTAKE_OUTPUT_EXISTS: 输出目录已存在：${resolvedOutput}`);
      }
      await rename(resolvedOutput, backupDir);
      backupCreated = true;
      try {
        await rename(temporaryDir, resolvedOutput);
      } catch (error) {
        try {
          await rename(backupDir, resolvedOutput);
          backupCreated = false;
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'FACT_INTAKE_OUTPUT_REPLACE_FAILED: 原输出目录无法恢复，请保留 backup 目录以便人工恢复。',
          );
        }
        throw error;
      }
      await rm(backupDir, { recursive: true, force: true });
      backupCreated = false;
    } else {
      await rename(temporaryDir, resolvedOutput);
    }
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  } finally {
    if (!backupCreated) await rm(backupDir, { recursive: true, force: true });
  }
}

function printResult(
  result: FactIntakeBundleResult | undefined,
  outputDir: string | null,
  errors: readonly FactIntakeDiagnostic[],
  warnings: readonly FactIntakeDiagnostic[],
): void {
  const payload = {
    ok: Boolean(result?.ok && errors.length === 0 && result.artifacts),
    status: result?.artifacts?.manifest.status ?? null,
    outputDir,
    files: result?.artifacts
      ? {
          snapshot: 'snapshot.json',
          plan: result.artifacts.plan ? 'binding-plan.json' : null,
          decisionsTemplate: result.artifacts.decisionsTemplate ? 'decisions.template.json' : null,
          authoringDocument: result.artifacts.manifest.document ? 'authoring-document.json' : null,
          intake: 'intake.json',
        }
      : null,
    snapshot: result?.artifacts
      ? {
          snapshotId: result.artifacts.snapshot.snapshotId,
          digest: result.artifacts.snapshot.digest,
          fightId: result.artifacts.snapshot.fightId ?? null,
          enemies: result.artifacts.snapshot.enemies.length,
          abilities: result.artifacts.snapshot.abilities.length,
        }
      : null,
    errors,
    warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${payload.ok ? 'OK' : 'FAILED'}: ${payload.ok ? outputDir : 'bundle 未生成'} (${errors.length} errors, ${warnings.length} warnings)`,
  );
  [...errors, ...warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const reportCode = option('--report-code');
  const apiBase =
    option('--api-base') ?? process.env.DUNGEON_WCL_API_BASE ?? process.env.VITE_WCL_API_BASE;
  const dungeonId = option('--dungeon');
  const gameBuild = option('--build');
  const outputOption = option('--out-dir');
  const documentPath = option('--document');
  if (!reportCode || !apiBase || !dungeonId || !gameBuild || !outputOption) {
    throw new Error(
      'FACT_INTAKE_INPUT_REQUIRED: pass --api-base=<url> --report-code=<code> --dungeon=<id> --build=<build> --out-dir=<dir>.',
    );
  }
  const outputDir = resolve(outputOption);
  const inputPaths = documentPath ? [resolve(documentPath)] : [];
  const force = process.argv.includes('--force');
  await assertInputOutputIsolation(outputDir, inputPaths, force);
  const document = documentPath ? await readDocument(documentPath) : undefined;
  const fightId = parsePositiveInteger(
    option('--fight-id'),
    'WCL_FACT_FIGHT_ID_INVALID',
    '--fight-id',
  );
  const maxEventPages = parsePositiveInteger(
    option('--max-event-pages'),
    'WCL_FACT_API_PAGE_LIMIT_INVALID',
    '--max-event-pages',
  );
  const timeoutMs = parsePositiveInteger(
    option('--timeout-ms'),
    'WCL_FACT_API_TIMEOUT_INVALID',
    '--timeout-ms',
  );
  const maxEvents = parsePositiveInteger(
    option('--max-events'),
    'WCL_FACT_API_EVENT_LIMIT_INVALID',
    '--max-events',
  );
  const maxResponseBytes = parsePositiveInteger(
    option('--max-response-bytes'),
    'WCL_FACT_API_RESPONSE_LIMIT_INVALID',
    '--max-response-bytes',
  );
  const evidenceRef = option('--evidence-ref') ?? `wcl-report:${reportCode}`;
  const requestedSnapshotId = option('--snapshot-id');
  const season = option('--season') ?? 'midnight-s2';
  const reviewer = option('--reviewer');
  const reviewedAt = option('--reviewed-at');
  const requestedLicenseStatus = option('--license-status');
  if (
    requestedLicenseStatus !== undefined &&
    !['approved', 'reference-only', 'needs-review'].includes(requestedLicenseStatus)
  ) {
    throw new Error(
      'WCL_FACT_LICENSE_STATUS_INVALID: --license-status 必须是 approved、reference-only 或 needs-review。',
    );
  }

  const source = await captureWclFactInputs({
    apiBase,
    reportCode,
    ...(fightId === undefined ? {} : { fightId }),
    includeEvents: !process.argv.includes('--skip-events'),
    ...(maxEventPages === undefined ? {} : { maxEventPages }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(maxEvents === undefined ? {} : { maxEvents }),
    ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
  });
  const snapshotId =
    requestedSnapshotId ??
    `wcl:${evidenceRef}:${dungeonId}:${gameBuild}${source.fightId === undefined ? '' : `:fight-${source.fightId}`}`;
  const result = await buildFactIntakeBundle(source, {
    reportCode,
    dungeonId,
    season,
    gameBuild,
    snapshotId,
    evidenceRef,
    capturedAt: option('--captured-at') ?? new Date().toISOString(),
    ...(source.fightId === undefined ? {} : { fightId: source.fightId }),
    licenseStatus:
      requestedLicenseStatus === 'approved'
        ? 'approved'
        : requestedLicenseStatus === 'needs-review'
          ? 'needs-review'
          : 'reference-only',
    requireApproved: process.argv.includes('--release'),
    ...(document ? { document } : {}),
    ...(reviewer === undefined ? {} : { reviewer }),
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
  });
  if (!result.ok || !result.artifacts) {
    printResult(result, null, result.errors, result.warnings);
    process.exitCode = 1;
    return;
  }
  await writeBundleAtomically(outputDir, result.artifacts, document, force);
  printResult(result, outputDir, result.errors, result.warnings);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.split(':')[0] || 'FACT_INTAKE_ERROR';
  const errors = [diagnostic('error', code, '$', message)];
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { ok: false, status: null, outputDir: null, files: null, errors, warnings: [] },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
