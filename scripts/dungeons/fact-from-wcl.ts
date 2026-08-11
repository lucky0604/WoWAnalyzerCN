import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  buildWclFactSnapshot,
  type WclFactSnapshotResult,
} from '../../src/dungeon/runtime/wclFactSnapshot';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

async function readJson(path: string, code: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  } catch {
    throw new Error(`${code}: ${resolve(path)}`);
  }
}

async function assertOutputIsNew(
  outputPath: string,
  sourcePaths: readonly string[],
): Promise<void> {
  const sourceRealPaths = (
    await Promise.all(
      sourcePaths.map(async (path) => {
        try {
          return await realpath(path);
        } catch {
          // Let readJson report a stable WCL_FACT_* input diagnostic below.
          return undefined;
        }
      }),
    )
  ).filter((path): path is string => path !== undefined);
  let outputRealPath: string | undefined;
  try {
    outputRealPath = await realpath(outputPath);
  } catch {
    // New output path.
  }
  if (outputRealPath && sourceRealPaths.includes(outputRealPath)) {
    throw new Error('WCL_FACT_OUTPUT_MUST_DIFFER: --out 不能覆盖 report/events 输入文件。');
  }
  let outputStat;
  try {
    outputStat = await stat(outputPath);
  } catch {
    return;
  }
  const sourceStats = await Promise.all(sourcePaths.map((path) => stat(path)));
  if (
    sourceStats.some((source) => source.dev === outputStat.dev && source.ino === outputStat.ino)
  ) {
    throw new Error('WCL_FACT_OUTPUT_MUST_DIFFER: --out 不能通过 hardlink 覆盖输入文件。');
  }
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

function printResult(result: WclFactSnapshotResult, outputPath: string, inputPath: string): void {
  const payload = {
    ok: result.ok,
    outputPath: result.ok ? outputPath : null,
    inputPath,
    snapshotId: result.snapshot?.snapshotId ?? null,
    gameBuild: result.snapshot?.gameBuild ?? null,
    stats: result.stats,
    errors: result.errors,
    warnings: result.warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${result.ok ? 'OK' : 'FAILED'}: ${result.ok ? outputPath : 'snapshot 未生成'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
  );
  [...result.errors, ...result.warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const reportPath = option('--report');
  const eventsPath = option('--events');
  const requestedOutput = option('--out');
  const dungeonId = option('--dungeon');
  const gameBuild = option('--build');
  const evidenceRef = option('--evidence-ref');
  if (!reportPath || !requestedOutput || !dungeonId || !gameBuild) {
    throw new Error(
      'WCL_FACT_INPUT_REQUIRED: pass --report=<report.json> --dungeon=<id> --build=<build> --out=<snapshot.json>.',
    );
  }
  const outputPath = resolve(requestedOutput);
  const sourcePaths = [resolve(reportPath), ...(eventsPath ? [resolve(eventsPath)] : [])];
  const report = await readJson(reportPath, 'WCL_FACT_REPORT_INVALID');
  const events = eventsPath ? await readJson(eventsPath, 'WCL_FACT_EVENTS_INVALID') : undefined;
  await assertOutputIsNew(outputPath, sourcePaths);
  const reportCode =
    report &&
    typeof report === 'object' &&
    !Array.isArray(report) &&
    typeof report.code === 'string' &&
    report.code.trim().length > 0
      ? report.code
      : report &&
          typeof report === 'object' &&
          !Array.isArray(report) &&
          typeof report.reportCode === 'string' &&
          report.reportCode.trim().length > 0
        ? report.reportCode
        : undefined;
  const resolvedEvidenceRef = evidenceRef ?? (reportCode ? `wcl-report:${reportCode}` : undefined);
  if (!resolvedEvidenceRef) {
    throw new Error(
      `WCL_FACT_EVIDENCE_REQUIRED: report 没有 code，请显式提供 --evidence-ref=<report/url/ticket>。`,
    );
  }
  const snapshotId =
    option('--snapshot-id') ?? `wcl:${resolvedEvidenceRef}:${dungeonId}:${gameBuild}`;
  const requestedLicenseStatus = option('--license-status');
  if (
    requestedLicenseStatus !== undefined &&
    !['approved', 'reference-only', 'needs-review'].includes(requestedLicenseStatus)
  ) {
    throw new Error(
      'WCL_FACT_LICENSE_STATUS_INVALID: --license-status 必须是 approved、reference-only 或 needs-review。',
    );
  }
  const result = await buildWclFactSnapshot(report, events, {
    dungeonId,
    season: option('--season') ?? 'midnight-s2',
    gameBuild,
    snapshotId,
    evidenceRef: resolvedEvidenceRef,
    capturedAt: option('--captured-at') ?? new Date().toISOString(),
    licenseStatus:
      requestedLicenseStatus === 'approved'
        ? 'approved'
        : requestedLicenseStatus === 'needs-review'
          ? 'needs-review'
          : 'reference-only',
    requireApproved: process.argv.includes('--release'),
  });
  if (!result.ok || !result.snapshot) {
    printResult(result, outputPath, reportPath);
    process.exitCode = 1;
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeOutputAtomically(outputPath, result.snapshot);
  printResult(result, outputPath, reportPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputPath: null,
          inputPath: option('--report') ?? null,
          snapshotId: null,
          gameBuild: option('--build') ?? null,
          stats: null,
          errors: [{ severity: 'error', code: message.split(':')[0], path: '$', message }],
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
