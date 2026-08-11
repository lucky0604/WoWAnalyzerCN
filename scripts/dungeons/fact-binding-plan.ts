import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getDungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import {
  buildFactBindingPlan,
  type FactBindingPlanResult,
} from '../../src/dungeon/runtime/factBindingPlan';
import type { DungeonDocument } from '../../src/dungeon/schema/types';

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

function asDocument(value: unknown, path: string): DungeonDocument {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof (value as { id?: unknown }).id !== 'string' ||
    typeof (value as { season?: unknown }).season !== 'string' ||
    !value.version ||
    typeof value.version !== 'object' ||
    !Array.isArray(value.floors) ||
    !Array.isArray(value.spawns) ||
    !Array.isArray(value.enemies) ||
    !Array.isArray(value.abilities) ||
    !Array.isArray(value.situations) ||
    !Array.isArray(value.routes) ||
    !Array.isArray(value.bosses)
  ) {
    throw new Error(`FACT_BINDING_PLAN_DOCUMENT_INVALID: ${path}`);
  }
  return value as DungeonDocument;
}

async function assertOutputIsNew(
  outputPath: string,
  sourcePaths: readonly string[],
): Promise<void> {
  const sourceRealPaths = await Promise.all(sourcePaths.map((path) => realpath(path)));
  let outputRealPath: string | undefined;
  try {
    outputRealPath = await realpath(outputPath);
  } catch {
    // New output path.
  }
  if (outputRealPath && sourceRealPaths.includes(outputRealPath)) {
    throw new Error('FACT_BINDING_PLAN_OUTPUT_MUST_DIFFER: --out 不能覆盖输入文件。');
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
    throw new Error('FACT_BINDING_PLAN_OUTPUT_MUST_DIFFER: --out 不能通过 hardlink 覆盖输入文件。');
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

function printResult(result: FactBindingPlanResult, outputPath: string): void {
  const payload = {
    ok: result.ok,
    outputPath: result.ok ? outputPath : null,
    status: result.plan?.status ?? null,
    coverage: result.plan?.coverage ?? null,
    errors: result.errors,
    warnings: result.warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${result.ok ? 'OK' : 'FAILED'}: ${result.ok ? outputPath : 'plan 未生成'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
  );
  [...result.errors, ...result.warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const snapshotPath = option('--snapshot');
  const documentPath = option('--document');
  const requestedOutput = option('--out');
  if (!snapshotPath || !documentPath || !requestedOutput) {
    throw new Error(
      'FACT_BINDING_PLAN_INPUT_REQUIRED: pass --snapshot=<file> --document=<file> --out=<file>.',
    );
  }
  const outputPath = resolve(requestedOutput);
  const sourcePaths = [resolve(snapshotPath), resolve(documentPath)];
  if (sourcePaths.includes(outputPath)) {
    throw new Error('FACT_BINDING_PLAN_OUTPUT_MUST_DIFFER: --out 不能覆盖输入文件。');
  }
  await assertOutputIsNew(outputPath, sourcePaths);
  const document = asDocument(
    await readJson(documentPath, 'FACT_BINDING_PLAN_DOCUMENT_INVALID'),
    documentPath,
  );
  const snapshot = await readJson(snapshotPath, 'FACT_BINDING_PLAN_SNAPSHOT_INVALID');
  const requestedDungeon = option('--dungeon') ?? document.id;
  const entry = getDungeonCatalogEntry(requestedDungeon);
  const result = await buildFactBindingPlan(document, snapshot, {
    catalogEntry: entry,
    requireApproved: process.argv.includes('--release'),
    expectedGameBuild: process.argv.includes('--release')
      ? option('--build')
      : (option('--build') ?? document.version.build),
  });
  if (!entry) {
    result.ok = false;
    result.errors.push({
      severity: 'error',
      code: 'FACT_BINDING_PLAN_DUNGEON_NOT_FOUND',
      path: 'dungeonId',
      message: `S2 目录中不存在副本：${requestedDungeon}`,
    });
  }
  if (!result.ok || !result.plan) {
    printResult(result, outputPath);
    process.exitCode = 1;
    return;
  }
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeOutputAtomically(outputPath, result.plan);
  printResult(result, outputPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputPath: null,
          status: null,
          coverage: null,
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
