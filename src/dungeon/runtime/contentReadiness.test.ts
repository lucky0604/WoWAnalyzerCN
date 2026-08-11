import { describe, expect, it } from 'vitest';

import { season2DungeonCatalog, season2DungeonCatalogById } from '../data/season2Catalog';
import { rubyLifePoolsSpatialPreview } from '../data/rlpSpatialPreview';
import { phase0FixtureDocuments } from '../registry';
import type { DungeonDocument } from '../schema/types';
import { forcesSnapshotMatchesRegistry, getDungeonContentReadiness } from './contentReadiness';

describe('dungeon content readiness', () => {
  it('keeps an S2 coordinate entry visibly coordinate-only without a document', () => {
    const entry = season2DungeonCatalogById.get('altar-of-fangs')!;
    const readiness = getDungeonContentReadiness(entry);

    expect(readiness.state).toBe('coordinate-only');
    expect(readiness.readyGateCount).toBe(1);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'coordinates', state: 'ready' }),
        expect.objectContaining({ id: 'enemy-facts', state: 'pending' }),
        expect.objectContaining({ id: 'forces', state: 'pending' }),
        expect.objectContaining({ id: 'review', state: 'pending' }),
      ]),
    );
  });

  it('distinguishes a catalog-only entry from a coordinate reference', () => {
    const entry = {
      ...season2DungeonCatalogById.get('altar-of-fangs')!,
      coordinateSnapshotId: undefined,
      coordinateSnapshotKey: undefined,
      coordinateIdentityRegistryKey: undefined,
    };
    const readiness = getDungeonContentReadiness(entry);

    expect(readiness.state).toBe('catalog-only');
    expect(readiness.readyGateCount).toBe(0);
  });

  it('does not count reference-only RLP draft facts as publish-ready', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const readiness = getDungeonContentReadiness(entry, rubyLifePoolsSpatialPreview);

    expect(readiness.state).toBe('learning-preview');
    expect(readiness.documentPresent).toBe(true);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'coordinates', state: 'ready' }),
        expect.objectContaining({ id: 'enemy-facts', state: 'pending' }),
        expect.objectContaining({ id: 'ability-facts', state: 'pending' }),
        expect.objectContaining({ id: 'forces', state: 'pending' }),
        expect.objectContaining({ id: 'learning-surfaces', state: 'pending' }),
        expect.objectContaining({ id: 'review', state: 'pending' }),
      ]),
    );
  });

  it('does not count a contract fixture as S2 learning content', () => {
    const entry = season2DungeonCatalogById.get('altar-of-fangs')!;
    const readiness = getDungeonContentReadiness(entry, phase0FixtureDocuments.altarOfFangs);

    expect(readiness.documentPresent).toBe(false);
    expect(readiness.state).toBe('coordinate-only');
    expect(readiness.counts).toEqual({
      enemies: 0,
      abilities: 0,
      situations: 0,
      routes: 0,
      bosses: 0,
    });
  });

  it('fails closed when a document is paired with another catalog entry', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    document.id = 'other-dungeon';

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.documentPresent).toBe(false);
    expect(readiness.state).toBe('blocked');
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'enemy-facts', state: 'blocked' }),
        expect.objectContaining({ id: 'review', state: 'blocked' }),
      ]),
    );
  });

  it('does not treat a mutable verified flag as a forces snapshot', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    document.totalEnemyForcesPoints = 100;
    document.enemies.forEach((enemy) => {
      enemy.forcesPoints = 1;
      enemy.forcesStatus = 'verified';
    });

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'forces', state: 'pending' })]),
    );
  });

  it('binds a forces snapshot to the committed enemy payload', () => {
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    const digest = `sha256:${'b'.repeat(64)}`;
    document.forcesSnapshot = {
      registryKey: 'test-forces',
      source: 'game-data',
      title: 'Test forces snapshot',
      snapshot: 'test-snapshot',
      gameBuild: document.version.build,
      digest,
      licenseStatus: 'approved',
    };
    const registryEntry = {
      registryKey: 'test-forces',
      dungeonId: document.id,
      snapshotId: 'test-snapshot',
      source: 'game-data' as const,
      gameBuild: document.version.build,
      digest,
      enemyForces: Object.fromEntries(
        document.enemies.map((enemy) => [enemy.id, enemy.forcesPoints]),
      ),
      totalEnemyForcesPoints: document.totalEnemyForcesPoints,
      evidenceRef: 'test-evidence',
      status: 'approved' as const,
    };

    expect(forcesSnapshotMatchesRegistry(document, registryEntry)).toBe(true);
    document.enemies[0]!.forcesPoints = 1;
    expect(forcesSnapshotMatchesRegistry(document, registryEntry)).toBe(false);

    document.enemies[0]!.forcesPoints = 0;
    const missingEvidence = { ...registryEntry, evidenceRef: '' };
    expect(forcesSnapshotMatchesRegistry(document, missingEvidence)).toBe(false);

    const wrongKey = { ...registryEntry, registryKey: 'other-forces' };
    expect(forcesSnapshotMatchesRegistry(document, wrongKey)).toBe(false);

    const manualDocument = structuredClone(document);
    manualDocument.forcesSnapshot!.source = 'manual-test';
    const manualRegistry = { ...registryEntry, source: 'manual-test' as const };
    expect(forcesSnapshotMatchesRegistry(manualDocument, manualRegistry)).toBe(false);
  });

  it('keeps approved facts pending when their build is stale', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    const oldFact = {
      type: 'game-data' as const,
      title: 'Old game-data snapshot',
      snapshot: 'old-snapshot',
      gameBuild: 'old-build',
      licenseStatus: 'approved' as const,
    };
    document.enemies.forEach((enemy) => {
      enemy.factBuild = 'old-build';
      enemy.provenance = [oldFact];
    });
    document.abilities.forEach((ability) => {
      ability.version = { ...ability.version, build: 'old-build' };
      ability.provenance = [oldFact];
    });

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'enemy-facts', state: 'pending' }),
        expect.objectContaining({ id: 'ability-facts', state: 'pending' }),
      ]),
    );
  });

  it('reports every catalog entry and never invents a learning document', () => {
    const reports = season2DungeonCatalog.map((entry) =>
      getDungeonContentReadiness(
        entry,
        entry.id === 'ruby-life-pools' ? rubyLifePoolsSpatialPreview : undefined,
      ),
    );

    expect(reports).toHaveLength(8);
    expect(reports.filter((report) => report.documentPresent)).toHaveLength(1);
    expect(reports.every((report) => report.gates.length === 6)).toBe(true);
  });

  it('fails closed for malformed review and localized ability fields', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview) as unknown as DungeonDocument;
    Object.assign(document, { review: {} });
    Object.assign(document.abilities[0], { action: null });

    expect(() => getDungeonContentReadiness(entry, document)).not.toThrow();
    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ability-facts', state: 'pending' }),
        expect.objectContaining({ id: 'review', state: 'pending' }),
      ]),
    );
  });

  it('does not share empty count objects between no-document reports', () => {
    const entry = season2DungeonCatalogById.get('altar-of-fangs')!;
    const first = getDungeonContentReadiness(entry);
    first.counts.enemies = 99;
    const second = getDungeonContentReadiness(entry);

    expect(second.counts.enemies).toBe(0);
  });
});
