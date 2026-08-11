import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  reconcileSpawns,
  type ReconciliationResult,
  type SpawnIdentityRegistry,
} from '../../src/dungeon/runtime/reconcile';
import type { Coordinate } from '../../src/dungeon/schema/types';

interface SnapshotSpawn {
  sourceId: string;
  sourceEnemyId: number;
  floorId: 'default';
  position: [number, number];
}

interface CoordinateSnapshotInput {
  dungeonKey: string;
  spawns: SnapshotSpawn[];
}

export interface ReconciliationReport {
  sourceKey: string;
  snapshotPath: string;
  registryPath: string;
  previousSnapshotPath?: string;
  blocked: boolean;
  counts: Record<string, number>;
  result: ReconciliationResult;
}

const DEFAULT_REGISTRY = resolve('.tmp/dungeons/spawn-identity.json');

function option(args: string[], name: string): string | undefined {
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name);
  if (!value) throw new Error(`DUNGEON_RECONCILE_OPTION_REQUIRED: ${name}`);
  return value;
}

function parseSnapshot(value: unknown, path: string): CoordinateSnapshotInput {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { dungeonKey?: unknown }).dungeonKey !== 'string' ||
    !/^[a-z0-9-]+$/.test((value as { dungeonKey: string }).dungeonKey) ||
    !Array.isArray((value as { spawns?: unknown }).spawns)
  ) {
    throw new Error(`DUNGEON_RECONCILE_SNAPSHOT_INVALID: ${path}`);
  }
  const snapshot = value as CoordinateSnapshotInput;
  const sourceIds = new Set<string>();
  snapshot.spawns.forEach((spawn, index) => {
    if (
      !spawn ||
      typeof spawn.sourceId !== 'string' ||
      !spawn.sourceId ||
      !Number.isInteger(spawn.sourceEnemyId) ||
      spawn.floorId !== 'default' ||
      !Array.isArray(spawn.position) ||
      spawn.position.length !== 2 ||
      !spawn.position.every(
        (coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate),
      )
    ) {
      throw new Error(`DUNGEON_RECONCILE_SPAWN_INVALID: ${path}#${index}`);
    }
    if (sourceIds.has(spawn.sourceId)) {
      throw new Error(`DUNGEON_RECONCILE_DUPLICATE_SPAWN_ID: ${spawn.sourceId}`);
    }
    sourceIds.add(spawn.sourceId);
  });
  return snapshot;
}

function parseRegistry(value: unknown, path: string): SpawnIdentityRegistry {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as { entries?: unknown }).entries)
  ) {
    throw new Error(`DUNGEON_RECONCILE_REGISTRY_INVALID: ${path}`);
  }
  const registry = value as SpawnIdentityRegistry;
  if (registry.version !== 1) {
    throw new Error(`DUNGEON_RECONCILE_REGISTRY_VERSION_INVALID: ${path}`);
  }
  const stableIds = new Set<string>();
  const sourceIds = new Set<string>();
  registry.entries.forEach((entry, index) => {
    if (
      !entry ||
      typeof entry.stableId !== 'string' ||
      !entry.stableId ||
      typeof entry.sourceId !== 'string' ||
      !entry.sourceId ||
      typeof entry.enemyId !== 'string' ||
      typeof entry.floorId !== 'string'
    ) {
      throw new Error(`DUNGEON_RECONCILE_REGISTRY_ENTRY_INVALID: ${path}#${index}`);
    }
    if (stableIds.has(entry.stableId) || sourceIds.has(entry.sourceId)) {
      throw new Error(`DUNGEON_RECONCILE_REGISTRY_DUPLICATE_ID: ${path}#${index}`);
    }
    stableIds.add(entry.stableId);
    sourceIds.add(entry.sourceId);
  });
  return registry;
}

async function readSnapshot(path: string): Promise<CoordinateSnapshotInput> {
  try {
    return parseSnapshot(JSON.parse(await readFile(path, 'utf8')), path);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DUNGEON_RECONCILE_')) throw error;
    throw new Error(`DUNGEON_RECONCILE_SNAPSHOT_INVALID: ${path}`);
  }
}

async function readRegistry(path: string): Promise<SpawnIdentityRegistry> {
  try {
    return parseRegistry(JSON.parse(await readFile(path, 'utf8')), path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { version: 1, entries: [] };
    }
    if (error instanceof Error && error.message.startsWith('DUNGEON_RECONCILE_')) throw error;
    throw new Error(`DUNGEON_RECONCILE_REGISTRY_INVALID: ${path}`);
  }
}

function incomingSpawns(snapshot: CoordinateSnapshotInput) {
  return snapshot.spawns.map((spawn) => ({
    sourceId: spawn.sourceId,
    enemyId: `${snapshot.dungeonKey}:source-enemy:${spawn.sourceEnemyId}`,
    floorId: `${snapshot.dungeonKey}:${spawn.floorId}`,
    position: spawn.position as Coordinate,
  }));
}

function previousCoordinates(
  registry: SpawnIdentityRegistry,
  snapshot: CoordinateSnapshotInput | undefined,
): Record<string, Coordinate> {
  if (!snapshot) return {};
  const positions = new Map(snapshot.spawns.map((spawn) => [spawn.sourceId, spawn.position]));
  return Object.fromEntries(
    registry.entries.flatMap((entry) => {
      const position = positions.get(entry.sourceId);
      return position ? [[entry.stableId, position]] : [];
    }),
  );
}

async function writeRegistryAtomic(path: string, registry: SpawnIdentityRegistry): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function reportFor(
  snapshotPath: string,
  registryPath: string,
  snapshot: CoordinateSnapshotInput,
  previousPath: string | undefined,
  result: ReconciliationResult,
): ReconciliationReport {
  const counts = result.items.reduce<Record<string, number>>((summary, item) => {
    summary[item.kind] = (summary[item.kind] ?? 0) + 1;
    return summary;
  }, {});
  return {
    sourceKey: snapshot.dungeonKey,
    snapshotPath,
    registryPath,
    ...(previousPath ? { previousSnapshotPath: previousPath } : {}),
    blocked: result.blocked,
    counts,
    result,
  };
}

export async function reconcileThreechest(args: string[]): Promise<ReconciliationReport> {
  const snapshotPath = resolve(requiredOption(args, '--snapshot'));
  const registryPath = resolve(option(args, '--registry') ?? DEFAULT_REGISTRY);
  const previousPath = option(args, '--previous-snapshot');
  const snapshot = await readSnapshot(snapshotPath);
  const registry = await readRegistry(registryPath);
  const previous = previousPath ? await readSnapshot(resolve(previousPath)) : undefined;
  if (previous && previous.dungeonKey !== snapshot.dungeonKey) {
    throw new Error(
      `DUNGEON_RECONCILE_SOURCE_MISMATCH: ${previous.dungeonKey} !== ${snapshot.dungeonKey}`,
    );
  }
  const result = reconcileSpawns(
    registry.entries,
    incomingSpawns(snapshot),
    previousCoordinates(registry, previous),
  );
  const report = reportFor(
    snapshotPath,
    registryPath,
    snapshot,
    previousPath ? resolve(previousPath) : undefined,
    result,
  );
  if (args.includes('--write-registry')) {
    if (result.blocked) {
      throw new Error(
        `DUNGEON_RECONCILE_AMBIGUOUS: ${result.items
          .filter((item) => item.kind === 'ambiguous')
          .map((item) => item.sourceId)
          .join(', ')}`,
      );
    }
    await writeRegistryAtomic(registryPath, result.nextRegistry);
  }
  return report;
}

function printReport(report: ReconciliationReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const summary = Object.entries(report.counts)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(', ');
  console.log(
    `Reconciled ${report.sourceKey}: ${summary || 'no changes'}${report.blocked ? ' · BLOCKED' : ''}`,
  );
  report.result.items
    .filter((item) => item.kind === 'ambiguous')
    .forEach((item) =>
      console.log(`  AMBIGUOUS ${item.sourceId}: ${(item.candidates ?? []).join(', ')}`),
    );
}

if (process.argv[1]?.endsWith('scripts/dungeons/reconcile-threechest.ts')) {
  reconcileThreechest(process.argv.slice(2))
    .then((report) => {
      printReport(report, process.argv.includes('--json'));
      if (report.blocked) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
