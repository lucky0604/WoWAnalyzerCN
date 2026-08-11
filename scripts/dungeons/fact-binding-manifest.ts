import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  buildFactBindingManifestFromDecisions,
  type FactBindingDecisionResult,
} from '../../src/dungeon/runtime/factBindingDecisions';

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
  let sourceRealPaths: string[];
  try {
    sourceRealPaths = await Promise.all(sourcePaths.map((path) => realpath(path)));
  } catch {
    throw new Error(
      `FACT_BINDING_DECISION_SOURCE_MISSING: ${sourcePaths.join(', ')}；输入文件必须在输出前保持可读。`,
    );
  }
  let outputRealPath: string | undefined;
  try {
    outputRealPath = await realpath(outputPath);
  } catch {
    // New output path.
  }
  if (outputRealPath && sourceRealPaths.includes(outputRealPath)) {
    throw new Error('FACT_BINDING_DECISION_OUTPUT_MUST_DIFFER: --out 不能覆盖输入文件。');
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
      'FACT_BINDING_DECISION_OUTPUT_MUST_DIFFER: --out 不能通过 hardlink 覆盖输入文件。',
    );
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

function printResult(
  result: FactBindingDecisionResult,
  outputPath: string,
  inputPath: string,
): void {
  const payload = {
    ok: result.ok,
    outputPath: result.ok ? outputPath : null,
    inputPath,
    summary: result.summary,
    errors: result.errors,
    warnings: result.warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${result.ok ? 'OK' : 'FAILED'}: ${result.ok ? outputPath : 'manifest 未生成'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
  );
  [...result.errors, ...result.warnings].forEach((item) =>
    console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
  );
}

async function main(): Promise<void> {
  const planPath = option('--plan');
  const decisionsPath = option('--decisions');
  const requestedOutput = option('--out');
  if (!planPath || !decisionsPath || !requestedOutput) {
    throw new Error(
      'FACT_BINDING_DECISION_INPUT_REQUIRED: pass --plan=<plan.json> --decisions=<decisions.json> --out=<manifest.json>.',
    );
  }
  const outputPath = resolve(requestedOutput);
  const sourcePaths = [resolve(planPath), resolve(decisionsPath)];
  if (sourcePaths.includes(outputPath)) {
    throw new Error('FACT_BINDING_DECISION_OUTPUT_MUST_DIFFER: --out 不能覆盖输入文件。');
  }
  const [plan, decisions] = await Promise.all([
    readJson(planPath, 'FACT_BINDING_DECISION_PLAN_INVALID'),
    readJson(decisionsPath, 'FACT_BINDING_DECISIONS_INVALID'),
  ]);
  await assertOutputIsNew(outputPath, sourcePaths);
  const result = await buildFactBindingManifestFromDecisions(plan, decisions, {
    requireComplete: process.argv.includes('--complete'),
  });
  if (!result.ok || !result.manifest) {
    printResult(result, outputPath, decisionsPath);
    process.exitCode = 1;
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeOutputAtomically(outputPath, result.manifest);
  printResult(result, outputPath, decisionsPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputPath: null,
          inputPath: option('--decisions') ?? null,
          summary: null,
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
