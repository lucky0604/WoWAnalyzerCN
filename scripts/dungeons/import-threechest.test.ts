import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runImport } from './import-threechest';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writeSource(root: string, source: unknown): Promise<void> {
  const sourcePath = join(root, 'src/data/mdtDungeons/foo_mdt.json');
  await mkdir(join(root, 'src/data/mdtDungeons'), { recursive: true });
  await writeFile(sourcePath, `${JSON.stringify(source)}\n`, 'utf8');
}

const validSource = {
  dungeonIndex: 42,
  enemies: [
    {
      id: 1001,
      enemyIndex: 3,
      spawns: [{ id: 'spawn-a', pos: [20, 10], group: 2, patrol: [[21, 11]] }],
    },
  ],
};

function args(root: string, outputDir: string, ...flags: string[]): string[] {
  return [
    '--dungeon=foo',
    `--threechest-root=${root}`,
    `--output-dir=${outputDir}`,
    '--source-url=https://threechest.io/maps/foo',
    '--snapshot=snapshot-test',
    '--retrieved-at=2026-08-10',
    '--redact-source-url',
    ...flags,
  ];
}

describe('Threechest coordinate importer', () => {
  it('supports a no-write dry run and a deterministic check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-import-'));
    temporaryRoots.push(root);
    const outputDir = join(root, 'coordinates');
    await writeSource(root, validSource);

    const preview = await runImport(args(root, outputDir, '--dry-run'));
    expect(preview[0]).toMatchObject({ mode: 'dry-run', spawnCount: 1 });
    await expect(readFile(join(outputDir, 'foo.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const written = await runImport(args(root, outputDir));
    expect(written[0]?.mode).toBe('write');
    const snapshot = JSON.parse(await readFile(join(outputDir, 'foo.json'), 'utf8'));
    expect(snapshot).toMatchObject({
      snapshotId: 'snapshot-test',
      dungeonKey: 'foo',
    });
    expect(snapshot.spawns[0]).toMatchObject({
      sourceId: 'foo:spawn-a',
      position: [10, 20],
      patrol: [[11, 21]],
    });
    expect(snapshot.sourceUrl).toBeUndefined();

    const checked = await runImport([
      '--dungeon=foo',
      `--threechest-root=${root}`,
      `--output-dir=${outputDir}`,
      '--snapshot=snapshot-test',
      '--check',
    ]);
    expect(checked[0]).toMatchObject({ mode: 'check', changed: false });
  });

  it('fails check mode when the committed snapshot drifts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-import-drift-'));
    temporaryRoots.push(root);
    const outputDir = join(root, 'coordinates');
    await writeSource(root, validSource);
    await runImport(args(root, outputDir));
    await writeFile(join(outputDir, 'foo.json'), '{}\n', 'utf8');

    await expect(
      runImport([
        '--dungeon=foo',
        `--threechest-root=${root}`,
        `--output-dir=${outputDir}`,
        '--snapshot=snapshot-test',
        '--check',
      ]),
    ).rejects.toThrow('DUNGEON_THREECHEST_CHECK_MISMATCH');
  });

  it('rejects malformed coordinate payloads before writing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-import-invalid-'));
    temporaryRoots.push(root);
    const outputDir = join(root, 'coordinates');
    await writeSource(root, {
      ...validSource,
      enemies: [{ ...validSource.enemies[0], spawns: [{ id: 'bad', pos: ['x', 10] }] }],
    });

    await expect(runImport(args(root, outputDir, '--dry-run'))).rejects.toThrow(
      'DUNGEON_THREECHEST_COORDINATE_INVALID',
    );
  });

  it('rejects duplicate source spawn identities', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-import-duplicate-'));
    temporaryRoots.push(root);
    const outputDir = join(root, 'coordinates');
    await writeSource(root, {
      ...validSource,
      enemies: [
        validSource.enemies[0],
        { id: 1002, enemyIndex: 4, spawns: [{ id: 'spawn-a', pos: [30, 30] }] },
      ],
    });

    await expect(runImport(args(root, outputDir, '--dry-run'))).rejects.toThrow(
      'DUNGEON_THREECHEST_DUPLICATE_SPAWN_ID',
    );
  });
});
