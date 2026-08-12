import { describe, expect, it } from 'vitest';

import { season2DungeonCatalog, season2DungeonCatalogById } from '../data/season2Catalog';
import { rubyLifePoolsSpatialPreview } from '../data/rlpSpatialPreview';
import { phase0FixtureDocuments } from '../registry';
import type { DungeonDocument } from '../schema/types';
import {
  factBindingMatchesRegistry,
  forcesSnapshotMatchesRegistry,
  getDungeonContentReadiness,
} from './contentReadiness';
import { validateFactBindingRegistry } from './sourceRegistry';

describe('dungeon content readiness', () => {
  it('returns structured diagnostics for malformed fact registry entries', () => {
    expect(validateFactBindingRegistry([null as never])).toEqual([
      'FACT_BINDING_REGISTRY_INVALID_ENTRY #0',
    ]);
    expect(validateFactBindingRegistry([{ status: 'revoked' } as never])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('FACT_BINDING_REGISTRY_INVALID_METADATA'),
        expect.stringContaining('FACT_BINDING_REGISTRY_INVALID_MAPPING'),
      ]),
    );
    expect(() =>
      validateFactBindingRegistry([
        {
          status: 'approved',
          enemyFacts: [null],
          abilityFacts: [null],
        } as never,
      ]),
    ).not.toThrow();
  });
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

  it('does not treat same-build approved IDs as facts without a binding identity', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    const provenance = {
      type: 'game-data' as const,
      title: 'Unbound test facts',
      snapshot: 'unbound-snapshot',
      gameBuild: document.version.build,
      licenseStatus: 'approved' as const,
    };
    document.enemies.forEach((enemy) => {
      enemy.npcId = 1001;
      enemy.factBuild = document.version.build;
      enemy.provenance = [provenance];
    });
    document.abilities.forEach((ability) => {
      ability.spellId = 2001;
      ability.version = { ...ability.version, build: document.version.build };
      ability.provenance = [provenance];
    });

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'enemy-facts',
          state: 'pending',
          detail: expect.stringContaining('事实快照'),
        }),
        expect.objectContaining({
          id: 'ability-facts',
          state: 'pending',
          detail: expect.stringContaining('事实快照'),
        }),
      ]),
    );
  });

  it('requires a reviewed registry row to authorize a fact binding identity', () => {
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    document.enemies.forEach((enemy) => {
      enemy.npcId ??= 1001;
    });
    document.abilities.forEach((ability) => {
      ability.spellId ??= 2001;
    });
    const identity = {
      version: 1 as const,
      registryKey: 'test-fact-binding',
      snapshotId: 'test-snapshot',
      snapshotDigest: `sha256:${'a'.repeat(64)}` as `sha256:${string}`,
      manifestDigest: `sha256:${'b'.repeat(64)}` as `sha256:${string}`,
      dungeonId: document.id,
      season: document.season,
      gameBuild: document.version.build,
      enemies: document.enemies.map((enemy) => ({
        sourceKey: `source:${enemy.id}`,
        documentEnemyId: enemy.id,
        npcId: enemy.npcId ?? 0,
        isBoss: enemy.isBoss,
        forcesPoints: enemy.forcesPoints,
      })),
      abilities: document.abilities.map((ability) => ({
        sourceKey: `source:${ability.id}`,
        documentAbilityId: ability.id,
        spellId: ability.spellId ?? 2001,
        casterEnemyKeys: ability.casterEnemyIds.map((enemyId) => `source:${enemyId}`),
      })),
    };
    const registryEntry = {
      registryKey: identity.registryKey,
      dungeonId: identity.dungeonId,
      season: identity.season,
      gameBuild: identity.gameBuild,
      snapshotId: identity.snapshotId,
      snapshotDigest: identity.snapshotDigest,
      manifestDigest: identity.manifestDigest,
      enemyDocumentIds: identity.enemies.map((row) => row.documentEnemyId),
      abilityDocumentIds: identity.abilities.map((row) => row.documentAbilityId),
      enemySourceKeys: identity.enemies.map((row) => row.sourceKey),
      abilitySourceKeys: identity.abilities.map((row) => row.sourceKey),
      enemyFacts: identity.enemies,
      abilityFacts: identity.abilities,
      evidenceRef: 'test-evidence',
      status: 'approved' as const,
    };

    expect(factBindingMatchesRegistry(document, identity, registryEntry)).toBe(true);
    expect(
      factBindingMatchesRegistry(document, identity, {
        ...registryEntry,
        manifestDigest: `sha256:${'c'.repeat(64)}`,
      }),
    ).toBe(false);

    const tamperedIdentity = structuredClone(identity);
    tamperedIdentity.enemies[0]!.npcId += 1;
    expect(factBindingMatchesRegistry(document, tamperedIdentity, registryEntry)).toBe(false);
    const tamperedCastersDocument = structuredClone(document);
    const alternateCaster = tamperedCastersDocument.enemies.find(
      (enemy) => !tamperedCastersDocument.abilities[0]!.casterEnemyIds.includes(enemy.id),
    );
    expect(alternateCaster).toBeDefined();
    tamperedCastersDocument.abilities[0]!.casterEnemyIds = [alternateCaster!.id];
    expect(factBindingMatchesRegistry(tamperedCastersDocument, identity, registryEntry)).toBe(
      false,
    );
    expect(
      factBindingMatchesRegistry(
        document,
        {
          ...identity,
          enemies: [null as never],
        },
        registryEntry,
      ),
    ).toBe(false);
  });

  it('does not accept a coordinate identity from another snapshot', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview);
    document.coordinateBinding!.snapshotId = 'threechest-coordinate-snapshot-other';

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'coordinates', state: 'pending' })]),
    );
  });

  it('fails closed for malformed fact binding rows', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(rubyLifePoolsSpatialPreview) as unknown as DungeonDocument;
    document.factBinding = {
      version: 1,
      registryKey: 'malformed',
      snapshotId: 'snapshot',
      snapshotDigest: `sha256:${'a'.repeat(64)}`,
      manifestDigest: `sha256:${'b'.repeat(64)}`,
      dungeonId: document.id,
      season: document.season,
      gameBuild: document.version.build,
      enemies: [null as never],
      abilities: [null as never],
    };
    expect(() => getDungeonContentReadiness(entry, document)).not.toThrow();
    expect(getDungeonContentReadiness(entry, document).gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'enemy-facts', state: 'pending' }),
        expect.objectContaining({ id: 'ability-facts', state: 'pending' }),
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

  it('does not let a non-learning route satisfy the learning-surface gate', () => {
    const entry = season2DungeonCatalogById.get('ruby-life-pools')!;
    const document = structuredClone(phase0FixtureDocuments.rubyLifePools);
    document.dataStatus = 'draft';
    const learningRoute = document.routes[0]!;
    const referenceRoute = structuredClone(learningRoute);
    referenceRoute.id = 'rlp-pug-reference-route';
    referenceRoute.intent = 'pug-safe';
    learningRoute.steps = learningRoute.steps.map((step) =>
      step.type === 'pull' ? { ...step, situationRefs: [] } : step,
    );
    document.routes = [learningRoute, referenceRoute];

    const readiness = getDungeonContentReadiness(entry, document);
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'learning-surfaces', state: 'pending' }),
      ]),
    );
  });
});
