import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../../src/dungeon/registry';
import type { DungeonDocument } from '../../src/dungeon/schema/types';
import {
  coordinateImpact,
  markStale,
  previewDocument,
  publishDocument,
  rollbackRelease,
} from './operations';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function releaseReadyFixture(): DungeonDocument {
  const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
  document.dataStatus = 'draft';
  document.version.status = 'draft';
  document.provenance = document.provenance.map((source) => ({
    ...source,
    licenseStatus: 'approved',
  }));
  document.review = {
    author: 'fixture-author',
    reviewer: 'fixture-reviewer',
    reviewedAt: '2026-08-10T00:00:00.000Z',
    gameBuild: document.version.build,
    evidence: 'test fixture only',
  };
  return document;
}

describe('dungeon content operations', () => {
  it('reports all coordinate references affected by a known snapshot', () => {
    const report = coordinateImpact('threechest-coordinate-snapshot-2026-08-10');
    expect(report).toHaveLength(8);
    expect(report.find((item) => item.sourceKey === 'magi')).toMatchObject({
      dungeonId: 'magisters-terrace',
      spawnCount: expect.any(Number),
      affectedKnowledgeIds: [],
    });
  });

  it('writes an idempotent stale ledger without deleting facts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-ops-'));
    temporaryRoots.push(root);
    const ledgerPath = join(root, 'stale.json');
    await writeFile(
      ledgerPath,
      JSON.stringify({
        version: 1,
        entries: [{ knowledgeId: 'ability-old', reason: 'old', markedAt: '2026-01-01' }],
      }),
    );
    await markStale(['ability-old', 'situation-new'], 'snapshot changed', ledgerPath, 'snapshot-2');
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ knowledgeId: 'ability-old', reason: 'snapshot changed' }),
        expect.objectContaining({ knowledgeId: 'situation-new', snapshotId: 'snapshot-2' }),
      ]),
    );
  });

  it('previews, publishes and rolls back only a validated release candidate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-release-'));
    temporaryRoots.push(root);
    const document = releaseReadyFixture();
    expect((await previewDocument(document)).ok).toBe(true);
    const first = await publishDocument(document, 7, root);
    expect(first.revision).toBe(7);

    const second = await publishDocument(document, 8, root);
    expect(second.previousRevision).toBe(7);
    const rolledBack = await rollbackRelease(root);
    expect(rolledBack.revision).toBe(7);
    expect(JSON.parse(await readFile(join(root, 'current.json'), 'utf8')).revision).toBe(7);
  });

  it('refuses fixture publication and release revision overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-release-guard-'));
    temporaryRoots.push(root);
    await expect(publishDocument(phase0FixtureDocuments.rubyLifePools, 1, root)).rejects.toThrow(
      'DUNGEON_PUBLISH_FIXTURE_FORBIDDEN',
    );
    const document = releaseReadyFixture();
    await publishDocument(document, 2, root);
    await expect(publishDocument(document, 2, root)).rejects.toThrow('DUNGEON_RELEASE_EXISTS');
  });

  it('refuses publishing a stale source without a fresh authoring pass', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-stale-guard-'));
    temporaryRoots.push(root);
    const document = releaseReadyFixture();
    document.version.status = 'stale';
    await expect(publishDocument(document, 3, root)).rejects.toThrow(
      'DUNGEON_PUBLISH_STALE_FORBIDDEN',
    );
  });
});
