import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

const dungeonKey = argument('--dungeon', 'magi');
const snapshotId = argument('--snapshot', 'local-threechest');
const root = resolve(argument('--threechest-root', 'agent_flow/threechest'));
const inputPath = resolve(root, 'src/data/mdtDungeons', `${dungeonKey}_mdt.json`);
const outputPath = resolve(argument('--output', `.tmp/dungeons/${dungeonKey}.coordinates.json`));

const source = JSON.parse(await readFile(inputPath, 'utf8')) as SourceDungeon;
if (!Number.isInteger(source.dungeonIndex) || !Array.isArray(source.enemies)) {
  throw new Error(`DUNGEON_THREECHEST_SNAPSHOT_INVALID: ${inputPath}`);
}
const output: CoordinateSnapshot = {
  source: 'threechest',
  snapshotId,
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
