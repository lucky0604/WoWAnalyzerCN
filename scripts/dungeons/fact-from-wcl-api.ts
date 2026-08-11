import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  buildWclFactSnapshot,
  type WclFactSnapshotDiagnostic,
  type WclFactSnapshotResult,
} from '../../src/dungeon/runtime/wclFactSnapshot';
import {
  captureWclFactInputs,
  type WclFactSourceDiagnostic,
} from '../../src/dungeon/runtime/wclFactSource';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function diagnostic(
  severity: 'error' | 'warning',
  code: string,
  path: string,
  message: string,
): WclFactSnapshotDiagnostic {
  return { severity, code, path, message };
}

async function writeOutputAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function printResult(
  result: WclFactSnapshotResult | undefined,
  inputPath: string,
  outputPath: string,
  errors: readonly (WclFactSnapshotDiagnostic | WclFactSourceDiagnostic)[],
  warnings: readonly (WclFactSnapshotDiagnostic | WclFactSourceDiagnostic)[],
): void {
  const snapshot = result?.snapshot;
  const payload = {
    ok: Boolean(result?.ok && errors.length === 0 && snapshot),
    outputPath: result?.ok && errors.length === 0 ? outputPath : null,
    inputPath,
    snapshotId: snapshot?.snapshotId ?? null,
    gameBuild: snapshot?.gameBuild ?? null,
    fightId: snapshot?.fightId ?? null,
    stats: result?.stats ?? null,
    errors,
    warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${payload.ok ? 'OK' : 'FAILED'}: ${payload.ok ? outputPath : 'snapshot 未生成'} (${errors.length} errors, ${warnings.length} warnings)`,
  );
  [...errors, ...warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
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

async function main(): Promise<void> {
  const reportCode = option('--report-code');
  const apiBase =
    option('--api-base') ?? process.env.DUNGEON_WCL_API_BASE ?? process.env.VITE_WCL_API_BASE;
  const requestedOutput = option('--out');
  const dungeonId = option('--dungeon');
  const gameBuild = option('--build');
  if (!reportCode || !apiBase || !requestedOutput || !dungeonId || !gameBuild) {
    throw new Error(
      'WCL_FACT_API_INPUT_REQUIRED: pass --api-base=<url> --report-code=<code> --dungeon=<id> --build=<build> --out=<snapshot.json>.',
    );
  }
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
  const outputPath = resolve(requestedOutput);
  const evidenceRef = option('--evidence-ref') ?? `wcl-report:${reportCode}`;
  const snapshotId =
    option('--snapshot-id') ??
    `wcl:${evidenceRef}:${dungeonId}:${gameBuild}${fightId === undefined ? '' : `:fight-${fightId}`}`;
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
    fightId,
    includeEvents: !process.argv.includes('--skip-events'),
    maxEventPages,
    maxEvents,
    maxResponseBytes,
    timeoutMs,
  });
  if (!source.ok || !source.report) {
    printResult(undefined, reportCode, outputPath, source.errors, source.warnings);
    process.exitCode = 1;
    return;
  }

  const result = await buildWclFactSnapshot(source.report, source.events, {
    dungeonId,
    season: option('--season') ?? 'midnight-s2',
    gameBuild,
    snapshotId,
    evidenceRef,
    capturedAt: option('--captured-at') ?? new Date().toISOString(),
    fightId: source.fightId ?? fightId,
    licenseStatus:
      requestedLicenseStatus === 'approved'
        ? 'approved'
        : requestedLicenseStatus === 'needs-review'
          ? 'needs-review'
          : 'reference-only',
    requireApproved: process.argv.includes('--release'),
  });
  const errors = [...source.errors, ...result.errors];
  const warnings = [...source.warnings, ...result.warnings];
  if (!result.ok || !result.snapshot || errors.length > 0) {
    printResult({ ...result, ok: false }, reportCode, outputPath, errors, warnings);
    process.exitCode = 1;
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeOutputAtomically(outputPath, result.snapshot);
  printResult(result, reportCode, outputPath, errors, warnings);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputPath: null,
          inputPath: option('--report-code') ?? null,
          snapshotId: null,
          gameBuild: option('--build') ?? null,
          fightId: option('--fight-id') ? Number(option('--fight-id')) || null : null,
          stats: null,
          errors: [
            diagnostic('error', message.split(':')[0] ?? 'WCL_FACT_API_ERROR', '$', message),
          ],
          warnings: [],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
