import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { getDungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import {
  bindFactSnapshotToDocument,
  type FactBindingDiagnostic,
} from '../../src/dungeon/runtime/factBinding';
import type { DungeonDocument } from '../../src/dungeon/schema/types';

type Diagnostic = FactBindingDiagnostic;

function appendDiagnostics(target: Diagnostic[], incoming: readonly Diagnostic[]): void {
  const existing = new Set(
    target.map((item) => `${item.severity}:${item.code}:${item.path}:${item.message}`),
  );
  incoming.forEach((item) => {
    const key = `${item.severity}:${item.code}:${item.path}:${item.message}`;
    if (existing.has(key)) return;
    existing.add(key);
    target.push(item);
  });
}

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
    throw new Error(`FACT_BINDING_DOCUMENT_INVALID: ${path}`);
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
    // A new output path is allowed; the inode check below is only needed when it exists.
  }
  if (outputRealPath && sourceRealPaths.includes(outputRealPath)) {
    throw new Error(
      'FACT_BINDING_OUTPUT_MUST_DIFFER: --out 不能通过 symlink 覆盖 snapshot、bindings 或 authoring document。',
    );
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
    throw new Error(
      'FACT_BINDING_OUTPUT_MUST_DIFFER: --out 不能通过 hardlink 覆盖 snapshot、bindings 或 authoring document。',
    );
  }
}

async function writeOutputAtomically(outputPath: string, document: DungeonDocument): Promise<void> {
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function printResult(
  outputPath: string,
  snapshotId: string | null,
  diagnostics: Diagnostic[],
  resultDocument?: DungeonDocument,
): void {
  const errors = diagnostics.filter((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');
  const result = {
    ok: errors.length === 0 && Boolean(resultDocument),
    outputPath: errors.length === 0 ? outputPath : null,
    snapshotId,
    documentId: resultDocument?.id ?? null,
    dataStatus: resultDocument?.dataStatus ?? null,
    revision: resultDocument?.version.revision ?? null,
    errors,
    warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(
    `${result.ok ? 'OK' : 'FAILED'}: ${result.ok ? outputPath : 'draft 未生成'} (${errors.length} errors, ${warnings.length} warnings)`,
  );
  [...errors, ...warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const snapshotPath = option('--snapshot');
  const bindingsPath = option('--bindings');
  const documentPath = option('--document');
  const requestedOutput = option('--out');
  if (!snapshotPath || !bindingsPath || !documentPath || !requestedOutput) {
    throw new Error(
      'FACT_BINDING_INPUT_REQUIRED: pass --snapshot=<file> --bindings=<file> --document=<file> --out=<file>.',
    );
  }
  const outputPath = resolve(requestedOutput);
  const sourceDocumentPath = resolve(documentPath);
  const sourceInputPaths = [resolve(snapshotPath), resolve(bindingsPath), sourceDocumentPath];
  if (sourceInputPaths.includes(outputPath)) {
    throw new Error(
      'FACT_BINDING_OUTPUT_MUST_DIFFER: --out 不能覆盖 snapshot、bindings 或 authoring document。',
    );
  }
  await assertOutputIsNew(outputPath, sourceInputPaths);
  const document = asDocument(
    await readJson(sourceDocumentPath, 'FACT_BINDING_DOCUMENT_INVALID'),
    sourceDocumentPath,
  );
  const rawSnapshot = await readJson(snapshotPath, 'FACT_SNAPSHOT_INPUT_INVALID');
  const rawBindings = await readJson(bindingsPath, 'FACT_BINDING_MANIFEST_INVALID');
  const requestedDungeon = option('--dungeon') ?? document.id;
  const entry = getDungeonCatalogEntry(requestedDungeon);
  const diagnostics: Diagnostic[] = [];
  if (!entry) {
    appendDiagnostics(diagnostics, [
      {
        severity: 'error',
        code: 'FACT_SNAPSHOT_DUNGEON_NOT_FOUND',
        path: 'dungeonId',
        message: `S2 目录中不存在副本：${requestedDungeon}`,
      },
    ]);
  }
  const release = process.argv.includes('--release');
  const requestedBuild = option('--build');
  const binding = await bindFactSnapshotToDocument(document, rawSnapshot, rawBindings, {
    requireCompleteDocument: release,
    expectedGameBuild: release ? requestedBuild : (requestedBuild ?? document.version.build),
    catalogEntry: entry,
  });
  appendDiagnostics(diagnostics, [...binding.errors, ...binding.warnings]);
  const resultDocument = binding.document;
  if (diagnostics.some((item) => item.severity === 'error') || !resultDocument) {
    printResult(
      outputPath,
      typeof rawSnapshot === 'object' && rawSnapshot !== null && 'snapshotId' in rawSnapshot
        ? String(rawSnapshot.snapshotId)
        : null,
      diagnostics,
      resultDocument,
    );
    process.exitCode = 1;
    return;
  }
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeOutputAtomically(outputPath, resultDocument);
  printResult(
    outputPath,
    typeof rawSnapshot === 'object' && rawSnapshot !== null && 'snapshotId' in rawSnapshot
      ? String(rawSnapshot.snapshotId)
      : null,
    diagnostics,
    resultDocument,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputPath: null,
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
