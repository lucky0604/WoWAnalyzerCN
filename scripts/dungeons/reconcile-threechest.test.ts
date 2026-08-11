import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { reconcileThreechest } from './reconcile-threechest';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const previousSnapshot = {
  dungeonKey: 'demo',
  spawns: [
    { sourceId: 'old-a', sourceEnemyId: 1, floorId: 'default', position: [10, 10] },
    { sourceId: 'old-b', sourceEnemyId: 1, floorId: 'default', position: [20, 20] },
  ],
};

const registry = {
  version: 1,
  entries: [
    {
      stableId: 'spawn-a',
      sourceId: 'old-a',
      enemyId: 'demo:source-enemy:1',
      floorId: 'demo:default',
    },
    {
      stableId: 'spawn-b',
      sourceId: 'old-b',
      enemyId: 'demo:source-enemy:1',
      floorId: 'demo:default',
    },
  ],
};

describe('Threechest spawn reconciliation CLI', () => {
  it('previews new identities and writes only when explicitly requested', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-reconcile-'));
    temporaryRoots.push(root);
    const snapshotPath = join(root, 'next.json');
    const registryPath = join(root, 'identity.json');
    await writeJson(snapshotPath, {
      dungeonKey: 'demo',
      spawns: [{ sourceId: 'new-a', sourceEnemyId: 1, floorId: 'default', position: [1, 2] }],
    });

    const preview = await reconcileThreechest([
      '--snapshot',
      snapshotPath,
      '--registry',
      registryPath,
    ]);
    expect(preview).toMatchObject({ blocked: false, counts: { new: 1 } });
    await expect(readFile(registryPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await reconcileThreechest([
      '--snapshot',
      snapshotPath,
      '--registry',
      registryPath,
      '--write-registry',
    ]);
    expect(JSON.parse(await readFile(registryPath, 'utf8')).entries[0]).toMatchObject({
      stableId: 'spawn-1',
      sourceId: 'new-a',
    });
  });

  it('preserves stable IDs when source order and IDs change', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-reconcile-match-'));
    temporaryRoots.push(root);
    const previousPath = join(root, 'previous.json');
    const snapshotPath = join(root, 'next.json');
    const registryPath = join(root, 'identity.json');
    await writeJson(previousPath, previousSnapshot);
    await writeJson(snapshotPath, {
      dungeonKey: 'demo',
      spawns: [
        { sourceId: 'new-b', sourceEnemyId: 1, floorId: 'default', position: [20, 20] },
        { sourceId: 'new-a', sourceEnemyId: 1, floorId: 'default', position: [10, 10] },
      ],
    });
    await writeJson(registryPath, registry);

    const report = await reconcileThreechest([
      '--snapshot',
      snapshotPath,
      '--previous-snapshot',
      previousPath,
      '--registry',
      registryPath,
    ]);
    expect(report).toMatchObject({
      blocked: false,
      counts: { 'auto-match': 2 },
      previousSnapshotPath: previousPath,
    });
    expect(report.result.items.map((item) => item.stableId)).toEqual(['spawn-b', 'spawn-a']);
  });

  it('blocks ambiguous matches and never writes a registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-reconcile-ambiguous-'));
    temporaryRoots.push(root);
    const previousPath = join(root, 'previous.json');
    const snapshotPath = join(root, 'next.json');
    const registryPath = join(root, 'identity.json');
    await writeJson(previousPath, {
      dungeonKey: 'demo',
      spawns: [
        { sourceId: 'old-a', sourceEnemyId: 1, floorId: 'default', position: [9, 10] },
        { sourceId: 'old-b', sourceEnemyId: 1, floorId: 'default', position: [11, 10] },
      ],
    });
    await writeJson(snapshotPath, {
      dungeonKey: 'demo',
      spawns: [{ sourceId: 'new', sourceEnemyId: 1, floorId: 'default', position: [10, 10] }],
    });
    await writeJson(registryPath, registry);

    await expect(
      reconcileThreechest([
        '--snapshot',
        snapshotPath,
        '--previous-snapshot',
        previousPath,
        '--registry',
        registryPath,
        '--write-registry',
      ]),
    ).rejects.toThrow('DUNGEON_RECONCILE_AMBIGUOUS');
    expect(JSON.parse(await readFile(registryPath, 'utf8'))).toEqual(registry);
  });

  it('blocks an exact source drift and preserves the previous registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-reconcile-drift-'));
    temporaryRoots.push(root);
    const snapshotPath = join(root, 'next.json');
    const registryPath = join(root, 'identity.json');
    await writeJson(snapshotPath, {
      dungeonKey: 'demo',
      spawns: [{ sourceId: 'old-a', sourceEnemyId: 2, floorId: 'default', position: [10, 10] }],
    });
    await writeJson(registryPath, registry);

    await expect(
      reconcileThreechest([
        '--snapshot',
        snapshotPath,
        '--registry',
        registryPath,
        '--write-registry',
      ]),
    ).rejects.toThrow('DUNGEON_RECONCILE_DRIFT');
    expect(JSON.parse(await readFile(registryPath, 'utf8'))).toEqual(registry);
  });

  it('rejects a previous snapshot from a different dungeon', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-threechest-reconcile-mismatch-'));
    temporaryRoots.push(root);
    const previousPath = join(root, 'previous.json');
    const snapshotPath = join(root, 'next.json');
    await writeJson(previousPath, { ...previousSnapshot, dungeonKey: 'other' });
    await writeJson(snapshotPath, { dungeonKey: 'demo', spawns: [] });

    await expect(
      reconcileThreechest(['--snapshot', snapshotPath, '--previous-snapshot', previousPath]),
    ).rejects.toThrow('DUNGEON_RECONCILE_SOURCE_MISMATCH');
  });
});
