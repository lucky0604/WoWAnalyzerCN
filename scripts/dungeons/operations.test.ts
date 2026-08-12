import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../../src/dungeon/registry';
import { season2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';
import type { DungeonDocument } from '../../src/dungeon/schema/types';
import { computeFactBindingManifestDigest } from '../../src/dungeon/runtime/factBinding';
import { getCoordinateBindingIdentity } from '../../src/dungeon/runtime/coordinates';
import { dungeonFactBindingRegistry } from '../../src/dungeon/runtime/sourceRegistry';
import { rubyLifePoolsPhase1Draft } from '../../src/dungeon/data/phase1Prototypes';
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
  dungeonFactBindingRegistry.splice(0);
});

async function releaseReadyFixture(): Promise<DungeonDocument> {
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
    selfTest: {
      completedAt: '2026-08-10T00:00:00.000Z',
      modes: ['quick', 'overview', 'full'],
      situationIds: document.situations.map((situation) => situation.id),
      routeIds: document.routes.map((route) => route.id),
      evidence: 'test fixture only',
    },
    authoringEffort: {
      totalMinutes: 30,
      situationMinutes: Object.fromEntries(
        document.situations.map((situation) => [situation.id, 1]),
      ),
      evidence: 'test fixture only',
    },
  };
  const factBinding = {
    version: 1 as const,
    registryKey: 'fact-binding:fixture-fact-snapshot',
    snapshotId: 'fixture-fact-snapshot',
    snapshotDigest: `sha256:${'a'.repeat(64)}` as `sha256:${string}`,
    dungeonId: document.id,
    season: document.season,
    gameBuild: document.version.build,
    enemies: document.enemies.map((enemy) => ({
      sourceKey: `fixture:${enemy.id}`,
      documentEnemyId: enemy.id,
      npcId: enemy.npcId ?? 1001,
      isBoss: enemy.isBoss,
      forcesPoints: enemy.forcesPoints,
    })),
    abilities: document.abilities.map((ability) => ({
      sourceKey: `fixture:${ability.id}`,
      documentAbilityId: ability.id,
      spellId: ability.spellId ?? 2001,
      casterEnemyKeys: ability.casterEnemyIds.map((enemyId) => `fixture:${enemyId}`),
    })),
  };
  document.factBinding = {
    ...factBinding,
    manifestDigest: await computeFactBindingManifestDigest(factBinding),
  };
  document.coordinateBinding = getCoordinateBindingIdentity('rlp');
  return document;
}

function registerFixtureBinding(document: DungeonDocument): void {
  const binding = document.factBinding!;
  dungeonFactBindingRegistry.push({
    registryKey: binding.registryKey,
    dungeonId: binding.dungeonId,
    season: binding.season,
    gameBuild: binding.gameBuild,
    snapshotId: binding.snapshotId,
    snapshotDigest: binding.snapshotDigest,
    manifestDigest: binding.manifestDigest,
    enemyDocumentIds: binding.enemies.map((row) => row.documentEnemyId),
    abilityDocumentIds: binding.abilities.map((row) => row.documentAbilityId),
    enemySourceKeys: binding.enemies.map((row) => row.sourceKey),
    abilitySourceKeys: binding.abilities.map((row) => row.sourceKey),
    enemyFacts: binding.enemies.map((row) => ({
      ...row,
      npcId:
        binding.enemies.find((candidate) => candidate.documentEnemyId === row.documentEnemyId) &&
        document.enemies.find((enemy) => enemy.id === row.documentEnemyId)?.npcId,
      isBoss: document.enemies.find((enemy) => enemy.id === row.documentEnemyId)?.isBoss,
      forcesPoints: document.enemies.find((enemy) => enemy.id === row.documentEnemyId)
        ?.forcesPoints,
    })),
    abilityFacts: binding.abilities.map((row) => ({
      ...row,
      spellId: document.abilities.find((ability) => ability.id === row.documentAbilityId)?.spellId,
      casterEnemyKeys:
        document.abilities
          .find((ability) => ability.id === row.documentAbilityId)
          ?.casterEnemyIds.map(
            (enemyId) =>
              binding.enemies.find((enemy) => enemy.documentEnemyId === enemyId)?.sourceKey,
          )
          .filter((key): key is string => Boolean(key)) ?? [],
    })),
    evidenceRef: 'test fixture only',
    status: 'approved',
  });
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

  it('reports S2 coordinate references without mixing them with legacy keys', () => {
    const report = coordinateImpact('threechest-coordinate-snapshot-2026-08-11-s2-fang-ptr');
    expect(report).toEqual([
      expect.objectContaining({
        dungeonId: 'altar-of-fangs',
        sourceKey: 's2-fang',
        spawnCount: 160,
        affectedKnowledgeIds: [],
      }),
    ]);
  });

  it('reports exactly one isolated impact entry for every S2 snapshot', () => {
    const expectedCounts: Record<string, number> = {
      'altar-of-fangs': 160,
      'murder-row': 221,
      'den-of-nalorakk': 116,
      'the-blinding-vale': 276,
      'voidscar-arena': 218,
      'ruby-life-pools': 166,
      'kings-rest': 101,
      'temple-of-sethraliss': 128,
    };
    season2DungeonCatalog.forEach((entry) => {
      const report = coordinateImpact(entry.coordinateSnapshotId!);
      expect(report).toHaveLength(1);
      expect(report[0]).toMatchObject({
        dungeonId: entry.id,
        sourceKey: entry.coordinateSnapshotKey,
        snapshotId: entry.coordinateSnapshotId,
        spawnCount: expectedCounts[entry.id],
        affectedKnowledgeIds: entry.id === 'ruby-life-pools' ? expect.any(Array) : [],
      });
    });
    expect(coordinateImpact('unknown-snapshot')).toEqual([]);
  });

  it('writes an idempotent stale ledger without deleting facts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-ops-'));
    temporaryRoots.push(root);
    const ledgerPath = join(root, 'stale.json');
    await writeFile(
      ledgerPath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            knowledgeId: rubyLifePoolsPhase1Draft.abilities[0]!.id,
            reason: 'old',
            markedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    await markStale(
      [rubyLifePoolsPhase1Draft.abilities[0]!.id, rubyLifePoolsPhase1Draft.situations[0]!.id],
      'snapshot changed',
      ledgerPath,
      'snapshot-2',
    );
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          knowledgeId: rubyLifePoolsPhase1Draft.abilities[0]!.id,
          reason: 'snapshot changed',
        }),
        expect.objectContaining({
          knowledgeId: rubyLifePoolsPhase1Draft.situations[0]!.id,
          snapshotId: 'snapshot-2',
        }),
      ]),
    );
  });

  it('rejects malformed or unknown stale writes before touching the ledger', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-stale-invalid-'));
    temporaryRoots.push(root);
    const ledgerPath = join(root, 'stale.json');
    await writeFile(ledgerPath, JSON.stringify({ version: 1, entries: null }));
    await expect(markStale(['typo-id'], 'changed', ledgerPath)).rejects.toThrow(
      'DUNGEON_STALE_LEDGER_INVALID',
    );
    expect(JSON.parse(await readFile(ledgerPath, 'utf8')).entries).toBeNull();
  });

  it('previews, publishes and rolls back only a validated release candidate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-release-'));
    temporaryRoots.push(root);
    const document = await releaseReadyFixture();
    registerFixtureBinding(document);
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
    const document = await releaseReadyFixture();
    registerFixtureBinding(document);
    await publishDocument(document, 2, root);
    await expect(publishDocument(document, 2, root)).rejects.toThrow('DUNGEON_RELEASE_EXISTS');
  });

  it('refuses publishing a stale source without a fresh authoring pass', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-stale-guard-'));
    temporaryRoots.push(root);
    const document = await releaseReadyFixture();
    registerFixtureBinding(document);
    document.version.status = 'stale';
    await expect(publishDocument(document, 3, root)).rejects.toThrow(
      'DUNGEON_PUBLISH_STALE_FORBIDDEN',
    );
  });

  it('refuses publishing when only a non-learning route has Pull coverage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-learning-release-'));
    temporaryRoots.push(root);
    const document = await releaseReadyFixture();
    registerFixtureBinding(document);
    const learningRoute = document.routes[0]!;
    const referenceRoute = structuredClone(learningRoute);
    referenceRoute.id = 'rlp-pug-reference-route';
    referenceRoute.intent = 'pug-safe';
    document.routes = [referenceRoute];
    document.review!.selfTest!.routeIds = document.routes.map((route) => route.id);

    await expect(publishDocument(document, 4, root)).rejects.toThrow(
      'DUNGEON_LEARNING_ROUTE_EMPTY',
    );
  });
});
