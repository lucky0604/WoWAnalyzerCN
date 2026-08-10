import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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

interface CoordinateSnapshot {
  source: 'threechest';
  snapshotId: string;
  sourceUrl: string;
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

const argument = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;

const dungeonArgument = argument('--dungeon', 'magi');
const snapshotId = argument('--snapshot', 'local-coordinate-fixture-2026-08-10');
const sourceUrl = argument('--source-url', process.env.DUNGEON_THREECHEST_SOURCE_URL ?? '');
const retrievedAt = argument('--retrieved-at', '2026-08-10');
const root = resolve(argument('--threechest-root', 'agent_flow/threechest'));
const inputDir = resolve(root, 'src/data/mdtDungeons');
const requestedOutput = process.argv.find((value) => value.startsWith('--output='));
const requestedOutputDir = process.argv.find((value) => value.startsWith('--output-dir='));
const outputDir = requestedOutputDir
  ? requestedOutputDir.slice('--output-dir='.length)
  : '.tmp/dungeons';

if (!sourceUrl) {
  throw new Error(
    'DUNGEON_THREECHEST_SOURCE_URL_REQUIRED: pass --source-url or DUNGEON_THREECHEST_SOURCE_URL.',
  );
}

const dungeonKeys =
  dungeonArgument === 'all'
    ? (await readdir(inputDir))
        .filter((file) => file.endsWith('_mdt.json'))
        .map((file) => file.replace(/_mdt\.json$/, ''))
        .sort()
    : [dungeonArgument];

if (dungeonKeys.length === 0) {
  throw new Error(`DUNGEON_THREECHEST_NO_SNAPSHOTS: ${inputDir}`);
}

for (const dungeonKey of dungeonKeys) {
  if (!/^[a-z0-9-]+$/.test(dungeonKey)) {
    throw new Error(`DUNGEON_THREECHEST_KEY_INVALID: ${dungeonKey}`);
  }

  const inputPath = resolve(inputDir, `${dungeonKey}_mdt.json`);
  const defaultOutput = `${outputDir}/${dungeonKey}.coordinates.json`;
  const outputPath = resolve(
    requestedOutput && dungeonKeys.length === 1
      ? requestedOutput.slice('--output='.length)
      : defaultOutput,
  );
  const raw = await readFile(inputPath, 'utf8');
  const source = JSON.parse(raw) as SourceDungeon;

  if (!Number.isInteger(source.dungeonIndex) || !Array.isArray(source.enemies)) {
    throw new Error(`DUNGEON_THREECHEST_SNAPSHOT_INVALID: ${inputPath}`);
  }
  const output: CoordinateSnapshot = {
    source: 'threechest',
    snapshotId,
    sourceUrl,
    retrievedAt,
    rawSha256: createHash('sha256').update(raw).digest('hex'),
    transformVersion: 'threechest-yx-to-normalized-v1',
    dungeonKey,
    dungeonIndex: source.dungeonIndex,
    sourceCoordinateSpace: 'threechest-yx',
    normalizedCoordinateSpace: 'normalized-v1',
    spawns: source.enemies.flatMap((enemy) =>
      enemy.spawns.map((spawn) => ({
        ...(Array.isArray(spawn.pos) && spawn.pos.length >= 2
          ? {}
          : (() => {
              throw new Error(
                `DUNGEON_THREECHEST_COORDINATE_INVALID: ${enemy.enemyIndex}/${spawn.id}`,
              );
            })()),
        sourceId: `${dungeonKey}:${spawn.id}`,
        sourceEnemyId: enemy.id,
        sourceEnemyIndex: enemy.enemyIndex,
        floorId: 'default' as const,
        position: [spawn.pos[1]!, spawn.pos[0]!] as [number, number],
        ...(spawn.group == null ? {} : { groupId: `${dungeonKey}:group:${spawn.group}` }),
        ...(spawn.patrol
          ? { patrol: spawn.patrol.map((point) => [point[1]!, point[0]!] as [number, number]) }
          : {}),
      })),
    ),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Imported ${output.spawns.length} coordinate spawns from ${inputPath}`);
  console.log(`Wrote ${outputPath}`);
}
