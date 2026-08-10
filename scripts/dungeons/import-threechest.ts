import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface SourceSpawn {
  id: string;
  group?: number | null;
  pos: number[];
  patrol?: number[][];
}

interface SourceEnemy {
  id: number;
  enemyIndex: number;
  spawns: SourceSpawn[];
}

interface SourceDungeon {
  dungeonIndex: number;
  enemies: SourceEnemy[];
}

export interface CoordinateSnapshot {
  source: 'threechest';
  snapshotId: string;
  sourceUrl?: string;
  retrievedAt: string;
  rawSha256: string;
  transformVersion: 'threechest-yx-to-normalized-v1';
  dungeonKey: string;
  dungeonIndex: number;
  sourceCoordinateSpace: 'threechest-yx';
  normalizedCoordinateSpace: 'normalized-v1';
  spawns: Array<{
    sourceId: string;
    sourceEnemyId: number;
    sourceEnemyIndex: number;
    floorId: 'default';
    position: [number, number];
    groupId?: string;
    patrol?: Array<[number, number]>;
  }>;
}

export interface ImportSummary {
  dungeonKey: string;
  inputPath: string;
  outputPath: string;
  spawnCount: number;
  mode: 'write' | 'dry-run' | 'check';
  changed?: boolean;
}

interface ImportOptions {
  dungeonArgument: string;
  snapshotId: string;
  sourceUrl: string;
  retrievedAt: string;
  redactSourceUrl: boolean;
  root: string;
  output?: string;
  outputDir: string;
  dryRun: boolean;
  check: boolean;
}

const argument = (args: string[], name: string, fallback: string): string =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;

function parseOptions(args: string[]): ImportOptions {
  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run') || check;
  const requestedOutput = args.find((value) => value.startsWith('--output='));
  const requestedOutputDir = args.find((value) => value.startsWith('--output-dir='));
  const sourceUrl = argument(args, '--source-url', process.env.DUNGEON_THREECHEST_SOURCE_URL ?? '');
  if (!sourceUrl && !check) {
    throw new Error(
      'DUNGEON_THREECHEST_SOURCE_URL_REQUIRED: pass --source-url or DUNGEON_THREECHEST_SOURCE_URL.',
    );
  }
  if (requestedOutput && requestedOutputDir) {
    throw new Error('DUNGEON_THREECHEST_OUTPUT_CONFLICT: use --output or --output-dir, not both.');
  }
  return {
    dungeonArgument: argument(args, '--dungeon', 'magi'),
    snapshotId: argument(args, '--snapshot', 'threechest-coordinate-snapshot-2026-08-10'),
    sourceUrl,
    retrievedAt: argument(args, '--retrieved-at', '2026-08-10'),
    redactSourceUrl: args.includes('--redact-source-url') || check,
    root: resolve(argument(args, '--threechest-root', 'agent_flow/threechest')),
    ...(requestedOutput ? { output: requestedOutput.slice('--output='.length) } : {}),
    outputDir: requestedOutputDir
      ? requestedOutputDir.slice('--output-dir='.length)
      : check
        ? 'src/dungeon/data/coordinates'
        : '.tmp/dungeons',
    dryRun,
    check,
  };
}

function assertFiniteCoordinate(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`DUNGEON_THREECHEST_COORDINATE_INVALID: ${label}`);
  }
  return value;
}

function normalizePoint(point: unknown, label: string): [number, number] {
  if (
    !Array.isArray(point) ||
    point.length < 2 ||
    typeof point[0] !== 'number' ||
    typeof point[1] !== 'number'
  ) {
    throw new Error(`DUNGEON_THREECHEST_COORDINATE_INVALID: ${label}`);
  }
  return [assertFiniteCoordinate(point[1], label), assertFiniteCoordinate(point[0], label)];
}

function validateSource(source: SourceDungeon, inputPath: string): void {
  if (
    !source ||
    typeof source !== 'object' ||
    !Number.isInteger(source.dungeonIndex) ||
    !Array.isArray(source.enemies)
  ) {
    throw new Error(`DUNGEON_THREECHEST_SNAPSHOT_INVALID: ${inputPath}`);
  }
  const sourceSpawnIds = new Set<string>();
  source.enemies.forEach((enemy, enemyIndex) => {
    if (
      !enemy ||
      typeof enemy !== 'object' ||
      !Number.isInteger(enemy.id) ||
      !Number.isInteger(enemy.enemyIndex) ||
      !Array.isArray(enemy.spawns)
    ) {
      throw new Error(`DUNGEON_THREECHEST_ENEMY_INVALID: ${inputPath}#${enemyIndex}`);
    }
    enemy.spawns.forEach((spawn, spawnIndex) => {
      if (!spawn || typeof spawn !== 'object' || typeof spawn.id !== 'string' || !spawn.id) {
        throw new Error(
          `DUNGEON_THREECHEST_SPAWN_INVALID: ${inputPath}#${enemyIndex}/${spawnIndex}`,
        );
      }
      if (sourceSpawnIds.has(spawn.id)) {
        throw new Error(`DUNGEON_THREECHEST_DUPLICATE_SPAWN_ID: ${spawn.id}`);
      }
      sourceSpawnIds.add(spawn.id);
      if (
        spawn.group !== undefined &&
        spawn.group !== null &&
        (!Number.isInteger(spawn.group) || spawn.group < 0)
      ) {
        throw new Error(`DUNGEON_THREECHEST_GROUP_INVALID: ${enemy.enemyIndex}/${spawn.id}`);
      }
      normalizePoint(spawn.pos, `${enemy.enemyIndex}/${spawn.id}`);
      if (spawn.patrol !== undefined) {
        if (!Array.isArray(spawn.patrol)) {
          throw new Error(`DUNGEON_THREECHEST_PATROL_INVALID: ${enemy.enemyIndex}/${spawn.id}`);
        }
        spawn.patrol.forEach((point, pointIndex) =>
          normalizePoint(point, `${enemy.enemyIndex}/${spawn.id}/patrol/${pointIndex}`),
        );
      }
    });
  });
}

function buildSnapshot(
  source: SourceDungeon,
  raw: string,
  dungeonKey: string,
  options: ImportOptions,
): CoordinateSnapshot {
  return {
    source: 'threechest',
    snapshotId: options.snapshotId,
    ...(options.redactSourceUrl ? {} : { sourceUrl: options.sourceUrl }),
    retrievedAt: options.retrievedAt,
    rawSha256: createHash('sha256').update(raw).digest('hex'),
    transformVersion: 'threechest-yx-to-normalized-v1',
    dungeonKey,
    dungeonIndex: source.dungeonIndex,
    sourceCoordinateSpace: 'threechest-yx',
    normalizedCoordinateSpace: 'normalized-v1',
    spawns: source.enemies.flatMap((enemy) =>
      enemy.spawns.map((spawn) => ({
        sourceId: `${dungeonKey}:${spawn.id}`,
        sourceEnemyId: enemy.id,
        sourceEnemyIndex: enemy.enemyIndex,
        floorId: 'default' as const,
        position: normalizePoint(spawn.pos, `${enemy.enemyIndex}/${spawn.id}`),
        ...(spawn.group == null ? {} : { groupId: `${dungeonKey}:group:${spawn.group}` }),
        ...(spawn.patrol
          ? {
              patrol: spawn.patrol.map((point, pointIndex) =>
                normalizePoint(point, `${enemy.enemyIndex}/${spawn.id}/patrol/${pointIndex}`),
              ),
            }
          : {}),
      })),
    ),
  };
}

async function dungeonKeysFor(options: ImportOptions): Promise<string[]> {
  const keys =
    options.dungeonArgument === 'all'
      ? (await readdir(resolve(options.root, 'src/data/mdtDungeons')))
          .filter((file) => file.endsWith('_mdt.json'))
          .map((file) => file.replace(/_mdt\.json$/, ''))
          .sort()
      : [options.dungeonArgument];
  if (keys.length === 0) {
    throw new Error(
      `DUNGEON_THREECHEST_NO_SNAPSHOTS: ${resolve(options.root, 'src/data/mdtDungeons')}`,
    );
  }
  return keys;
}

function outputPathFor(dungeonKey: string, keys: string[], options: ImportOptions): string {
  const defaultOutput = `${options.outputDir}/${dungeonKey}.json`;
  return resolve(options.output && keys.length === 1 ? options.output : defaultOutput);
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function runImport(args: string[]): Promise<ImportSummary[]> {
  const options = parseOptions(args);
  const keys = await dungeonKeysFor(options);
  const summaries: ImportSummary[] = [];

  for (const dungeonKey of keys) {
    if (!/^[a-z0-9-]+$/.test(dungeonKey)) {
      throw new Error(`DUNGEON_THREECHEST_KEY_INVALID: ${dungeonKey}`);
    }
    const inputPath = resolve(options.root, 'src/data/mdtDungeons', `${dungeonKey}_mdt.json`);
    const outputPath = outputPathFor(dungeonKey, keys, options);
    const raw = await readFile(inputPath, 'utf8');
    let source: SourceDungeon;
    try {
      source = JSON.parse(raw) as SourceDungeon;
    } catch {
      throw new Error(`DUNGEON_THREECHEST_SNAPSHOT_INVALID: ${inputPath}`);
    }
    validateSource(source, inputPath);
    const snapshot = buildSnapshot(source, raw, dungeonKey, options);
    const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

    if (options.check) {
      let existing: string;
      try {
        existing = await readFile(outputPath, 'utf8');
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          throw new Error(`DUNGEON_THREECHEST_CHECK_MISSING: ${outputPath}`);
        }
        throw error;
      }
      let existingSnapshot: unknown;
      try {
        existingSnapshot = JSON.parse(existing);
      } catch {
        throw new Error(`DUNGEON_THREECHEST_CHECK_INVALID: ${outputPath}`);
      }
      const changed = JSON.stringify(existingSnapshot) !== JSON.stringify(snapshot);
      summaries.push({
        dungeonKey,
        inputPath,
        outputPath,
        spawnCount: snapshot.spawns.length,
        mode: 'check',
        changed,
      });
      if (changed) throw new Error(`DUNGEON_THREECHEST_CHECK_MISMATCH: ${outputPath}`);
    } else if (options.dryRun) {
      summaries.push({
        dungeonKey,
        inputPath,
        outputPath,
        spawnCount: snapshot.spawns.length,
        mode: 'dry-run',
      });
    } else {
      await writeFileAtomic(outputPath, serialized);
      summaries.push({
        dungeonKey,
        inputPath,
        outputPath,
        spawnCount: snapshot.spawns.length,
        mode: 'write',
      });
    }
  }
  return summaries;
}

if (process.argv[1]?.endsWith('scripts/dungeons/import-threechest.ts')) {
  runImport(process.argv.slice(2))
    .then((summaries) =>
      summaries.forEach((summary) => {
        const action =
          summary.mode === 'write' ? 'Wrote' : summary.mode === 'check' ? 'Checked' : 'Would write';
        console.log(
          `${action} ${summary.outputPath} (${summary.spawnCount} coordinate spawns from ${summary.inputPath})`,
        );
      }),
    )
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
