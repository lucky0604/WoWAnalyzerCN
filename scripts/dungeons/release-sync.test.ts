import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { selectLatestReleaseDocuments, syncReleaseArtifact } from './release-sync';

const tempDirectory = async () => mkdtemp(join(tmpdir(), 'wowanalyzer-release-sync-'));

describe('dungeon release sync', () => {
  it('writes a deterministic empty artifact for an empty release directory', async () => {
    const root = await tempDirectory();
    const releaseDir = join(root, 'releases');
    const output = join(root, 'runtime', 'current.json');
    await mkdir(releaseDir, { recursive: true });
    const artifact = await syncReleaseArtifact(releaseDir, output);

    expect(artifact).toEqual({ version: 1, documents: [] });
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(artifact);
  });

  it('fails before replacing output when a numbered manifest is malformed', async () => {
    const root = await tempDirectory();
    const releaseDir = join(root, 'releases');
    const output = join(root, 'current.json');
    await mkdir(releaseDir, { recursive: true });
    await writeFile(join(releaseDir, '3.json'), '{"version":1,"dungeonId":"broken"}', 'utf8');
    await writeFile(output, '{"version":1,"documents":[]}', 'utf8');

    await expect(syncReleaseArtifact(releaseDir, output)).rejects.toThrow(
      'DUNGEON_RELEASE_SYNC_MANIFEST_INVALID',
    );
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({ version: 1, documents: [] });
  });

  it('rejects a same-revision conflict before artifact validation', () => {
    expect(() =>
      selectLatestReleaseDocuments([
        { dungeonId: 'same', revision: 2, document: { marker: 'a' } as never },
        { dungeonId: 'same', revision: 2, document: { marker: 'b' } as never },
      ]),
    ).toThrow('DUNGEON_RELEASE_SYNC_REVISION_CONFLICT');
  });

  it('rejects output paths that alias a release input', async () => {
    const root = await tempDirectory();
    const releaseDir = join(root, 'releases');
    await mkdir(releaseDir, { recursive: true });
    await writeFile(join(releaseDir, 'current.json'), '{}', 'utf8');

    await expect(syncReleaseArtifact(releaseDir, join(releaseDir, 'current.json'))).rejects.toThrow(
      'DUNGEON_RELEASE_SYNC_OUTPUT_INPUT_ALIAS',
    );
  });
});
