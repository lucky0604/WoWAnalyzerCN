import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getDungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import {
  validateFactSnapshotIntegrity,
  type FactSnapshotDiagnostic,
} from '../../src/dungeon/runtime/factSnapshot';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function printResult(
  inputPath: string,
  dungeonId: string | undefined,
  validation: Awaited<ReturnType<typeof validateFactSnapshotIntegrity>>,
  diagnostics: FactSnapshotDiagnostic[],
): void {
  const ok = validation.ok && diagnostics.every((item) => item.severity !== 'error');
  const result = {
    ok,
    releaseReady: ok && validation.releaseReady,
    inputPath,
    dungeonId: dungeonId ?? null,
    snapshotId: validation.snapshot?.snapshotId ?? null,
    gameBuild: validation.snapshot?.gameBuild ?? null,
    errors: [...validation.errors, ...diagnostics].filter((item) => item.severity === 'error'),
    warnings: [...validation.warnings, ...diagnostics].filter(
      (item) => item.severity === 'warning',
    ),
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(
    `${inputPath}: ${ok ? 'OK' : 'FAILED'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
  );
  [...result.errors, ...result.warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const requestedInput = option('--input');
  if (!requestedInput) {
    throw new Error('FACT_SNAPSHOT_INPUT_REQUIRED: pass --input=<snapshot.json>.');
  }
  const inputPath = resolve(requestedInput);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  } catch {
    throw new Error(`FACT_SNAPSHOT_INPUT_INVALID: ${inputPath}`);
  }
  const requestedDungeon = option('--dungeon');
  const requestedBuild = option('--build');
  const inferredDungeon =
    requestedDungeon ??
    (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'dungeonId' in parsed
      ? String(parsed.dungeonId)
      : undefined);
  const entry = inferredDungeon ? getDungeonCatalogEntry(inferredDungeon) : undefined;
  const diagnostics: FactSnapshotDiagnostic[] = [];
  if (inferredDungeon && !entry) {
    diagnostics.push({
      severity: 'error',
      code: 'FACT_SNAPSHOT_DUNGEON_NOT_FOUND',
      path: 'dungeonId',
      message: `S2 目录中不存在副本：${inferredDungeon}`,
    });
  }
  const validation = await validateFactSnapshotIntegrity(parsed, {
    entry,
    requireApproved: process.argv.includes('--release'),
    expectedGameBuild: requestedBuild,
  });
  printResult(inputPath, inferredDungeon, validation, diagnostics);
  if (
    validation.errors.some((item) => item.severity === 'error') ||
    diagnostics.some((item) => item.severity === 'error')
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          releaseReady: false,
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
