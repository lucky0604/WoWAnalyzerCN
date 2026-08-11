import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  buildFactBindingManifestFromDecisions,
  createFactBindingDecisionTemplate,
  isFactBindingDecisionTimestamp,
  type FactBindingDecisionTemplate,
} from '../../src/dungeon/runtime/factBindingDecisions';
import type { FactBindingPlan } from '../../src/dungeon/runtime/factBindingPlan';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  } catch {
    throw new Error(`FACT_BINDING_DECISION_TEMPLATE_PLAN_INVALID: ${resolve(path)}`);
  }
}

function basicPlanShape(value: unknown): value is FactBindingPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  const snapshot = plan.snapshot;
  const document = plan.document;
  return (
    plan.version === 1 &&
    typeof plan.planDigest === 'string' &&
    !!snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    !!document &&
    typeof document === 'object' &&
    !Array.isArray(document) &&
    Array.isArray(plan.enemies) &&
    Array.isArray(plan.abilities) &&
    [...plan.enemies, ...plan.abilities].every(
      (row) =>
        !!row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        typeof (row as { sourceKey?: unknown }).sourceKey === 'string' &&
        (row as { sourceKey: string }).sourceKey.trim().length > 0,
    )
  );
}

async function assertOutputIsNew(outputPath: string, sourcePath: string): Promise<void> {
  let sourceRealPath: string;
  try {
    sourceRealPath = await realpath(sourcePath);
  } catch {
    throw new Error(`FACT_BINDING_DECISION_TEMPLATE_PLAN_INVALID: ${sourcePath}`);
  }

  let outputRealPath: string | undefined;
  try {
    outputRealPath = await realpath(outputPath);
  } catch {
    // A new output path is allowed.
  }
  if (outputRealPath === sourceRealPath) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_OUTPUT_MUST_DIFFER: --out 不能覆盖 plan 输入文件。',
    );
  }

  let outputStat;
  try {
    outputStat = await stat(outputPath);
  } catch {
    return;
  }
  const sourceStat = await stat(sourcePath);
  if (outputStat.dev === sourceStat.dev && outputStat.ino === sourceStat.ino) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_OUTPUT_MUST_DIFFER: --out 不能通过 hardlink 覆盖 plan 输入文件。',
    );
  }
  if (!process.argv.includes('--force')) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_OUTPUT_EXISTS: 输出文件已存在；如需替换请显式传 --force。',
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

function templateInput(template: FactBindingDecisionTemplate): Record<string, unknown> {
  return template as unknown as Record<string, unknown>;
}

function printResult(
  result: { ok: boolean; errors: readonly unknown[]; warnings: readonly unknown[] },
  outputPath: string,
): void {
  const payload = {
    ok: result.ok,
    outputPath: result.ok ? outputPath : null,
    template: result.ok,
    errors: result.errors,
    warnings: result.warnings,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `${result.ok ? 'OK' : 'FAILED'}: ${result.ok ? outputPath : 'template 未生成'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
  );
  [...result.errors, ...result.warnings].forEach((item) => {
    const value = item as { severity?: string; code?: string; path?: string; message?: string };
    console.log(
      `  ${(value.severity ?? 'error').toUpperCase()} ${value.code ?? 'UNKNOWN'} ${value.path ?? '$'}: ${value.message ?? ''}`,
    );
  });
}

async function main(): Promise<void> {
  const planPath = option('--plan');
  const outputOption = option('--out');
  const reviewer = option('--reviewer');
  const reviewedAt = option('--reviewed-at');
  if (!planPath || !outputOption || !reviewer || !reviewedAt) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_INPUT_REQUIRED: pass --plan=<file> --out=<file> --reviewer=<name> --reviewed-at=<ISO timestamp>.',
    );
  }
  if (!isFactBindingDecisionTimestamp(reviewedAt)) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_TIMESTAMP_INVALID: --reviewed-at 必须是 UTC ISO 时间戳。',
    );
  }
  const planPathResolved = resolve(planPath);
  const outputPath = resolve(outputOption);
  await assertOutputIsNew(outputPath, planPathResolved);
  const rawPlan = await readJson(planPathResolved);
  if (!basicPlanShape(rawPlan)) {
    throw new Error(`FACT_BINDING_DECISION_TEMPLATE_PLAN_INVALID: ${planPathResolved}`);
  }
  if (rawPlan.enemies.length + rawPlan.abilities.length === 0) {
    throw new Error(
      'FACT_BINDING_DECISION_TEMPLATE_NO_SOURCE_ROWS: 候选计划没有任何 Enemy 或 Ability sourceKey，不能生成空 intake 模板。',
    );
  }

  // Validate the complete plan before emitting a template.  The provisional
  // rejects are never written; they only exercise the same strict contract as
  // the manifest generator, including digest, identity, rows and coverage.
  const provisional = createFactBindingDecisionTemplate(rawPlan, { reviewer, reviewedAt });
  const provisionalResult = await buildFactBindingManifestFromDecisions(rawPlan, {
    ...templateInput(provisional),
    enemies: provisional.enemies.map((row) => ({
      ...row,
      decision: 'reject',
      reason: 'provisional plan validation only',
    })),
    abilities: provisional.abilities.map((row) => ({
      ...row,
      decision: 'reject',
      reason: 'provisional plan validation only',
    })),
  });
  if (!provisionalResult.ok) {
    printResult(provisionalResult, outputPath);
    process.exitCode = 1;
    return;
  }

  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeOutputAtomically(outputPath, provisional);
  printResult({ ok: true, errors: [], warnings: [] }, outputPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    ok: false,
    outputPath: null,
    template: false,
    errors: [{ severity: 'error', code: message.split(':')[0], path: '$', message }],
    warnings: [],
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(payload, null, 2));
  else console.error(message);
  process.exitCode = 1;
});
