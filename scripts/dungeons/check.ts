import { createHash } from 'node:crypto';

import {
  legacyThreechestCoordinateInventory,
  isLearningPublished,
  season2DungeonCatalog,
  season2WclCatalogSource,
  serializeSeason2WclSourceIdentity,
  validateSeason2DungeonCatalog,
} from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
import { dungeonPreviewDocuments } from '../../src/dungeon/registry';
import {
  getCoordinateReference,
  getCoordinateIdentityRegistry,
  getCoordinateSnapshot,
  serializeCoordinateData,
  serializeCoordinateSnapshot,
  coordinateSnapshotUsesAllowedFields,
} from '../../src/dungeon/runtime/coordinates';
import {
  checkSourceUse,
  dungeonFactBindingRegistry,
  dungeonForcesSnapshotRegistry,
  dungeonSourceRegistry,
  validateFactBindingRegistry,
  validateForcesSnapshotRegistry,
} from '../../src/dungeon/runtime/sourceRegistry';
import { getDungeonScopedLearningAccess } from '../../src/dungeon/runtime/formalAccess';
import {
  documentKnowledgeIds,
  staleKnowledgeLedger,
  validateStaleLedger,
} from '../../src/dungeon/runtime/staleLedger';

function staleLedgerErrors(
  documentIds = new Set(
    dungeonPreviewDocuments.flatMap((document) => [...documentKnowledgeIds(document)]),
  ),
): string[] {
  const result = validateStaleLedger(staleKnowledgeLedger, documentIds);
  return result.errors.map((error) => `stale ledger: ${error}`);
}
import type {
  ApprovedSourceSnapshot,
  SourceUseCheck,
} from '../../src/dungeon/runtime/sourceRegistry';
import type { DungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';
import { authoringDiagnostics, loadAuthoringDocument } from './authoring';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

const requestedDungeon = option('--dungeon');
const jsonOutput = process.argv.includes('--json');
const requestedRoot = option('--root');

export function validateS2CoordinateGate(
  entry: DungeonCatalogEntry,
  snapshot: ReturnType<typeof getCoordinateSnapshot>,
  registeredSnapshot: ApprovedSourceSnapshot | undefined,
  sourceUse: SourceUseCheck,
): string[] {
  const errors: string[] = [];
  if (!snapshot || !registeredSnapshot) {
    errors.push(`source registry: S2_COORDINATE_SNAPSHOT_MISSING ${entry.id}`);
    return errors;
  }
  const coordinateHash = createHash('sha256')
    .update(serializeCoordinateSnapshot(snapshot))
    .digest('hex');
  if (registeredSnapshot.hash !== `sha256:${coordinateHash}`) {
    errors.push(
      `source registry: S2_COORDINATE_HASH_MISMATCH ${entry.id} ${registeredSnapshot.hash} !== sha256:${coordinateHash}`,
    );
  }
  if (!registeredSnapshot.rawSha256) {
    errors.push(`source registry: S2_COORDINATE_RAW_HASH_MISSING ${entry.id}`);
  } else if (snapshot.rawSha256 !== registeredSnapshot.rawSha256) {
    errors.push(`source registry: S2_COORDINATE_RAW_HASH_MISMATCH ${entry.id}`);
  }
  if (
    !registeredSnapshot.fieldAllowlist ||
    !coordinateSnapshotUsesAllowedFields(snapshot, registeredSnapshot.fieldAllowlist)
  ) {
    errors.push(`source registry: S2_COORDINATE_FIELD_NOT_ALLOWED ${entry.id}`);
  }
  if (!entry.coordinateIdentityRegistryKey || !registeredSnapshot.identityHash) {
    errors.push(`source registry: S2_COORDINATE_IDENTITY_REGISTRY_MISSING ${entry.id}`);
  } else {
    const identityRegistry = getCoordinateIdentityRegistry(entry.coordinateIdentityRegistryKey);
    const identityHash = identityRegistry
      ? createHash('sha256').update(serializeCoordinateData(identityRegistry)).digest('hex')
      : undefined;
    if (identityHash !== registeredSnapshot.identityHash.slice('sha256:'.length)) {
      errors.push(`source registry: S2_COORDINATE_IDENTITY_HASH_MISMATCH ${entry.id}`);
    }
  }
  if (!sourceUse.ok) {
    errors.push(`source registry: ${sourceUse.reason}`);
  }
  return errors;
}

export function validatePublishedLearningGate(
  entry: DungeonCatalogEntry,
  document: (typeof dungeonDocuments)[number] | undefined,
): string[] {
  if (!isLearningPublished(entry.status)) return [];
  const access = getDungeonScopedLearningAccess(entry, document);
  return access.isFormal
    ? []
    : [`catalog: FORMAL_LEARNING_GATE_FAILED ${entry.id} — ${access.reason}`];
}

function printSingleResult(
  dungeonId: string,
  result: ReturnType<typeof validateDungeonDocument>,
  authoring: ReturnType<typeof authoringDiagnostics> = [],
): boolean {
  const diagnostics = [...result.errors, ...result.warnings, ...authoring];
  const ok = result.ok && authoring.every((item) => item.severity !== 'error');
  if (jsonOutput) {
    console.log(JSON.stringify({ dungeonId, ok, diagnostics }, null, 2));
  } else {
    console.log(
      `${dungeonId}: ${ok ? 'OK' : 'FAILED'} (${diagnostics.filter((item) => item.severity === 'error').length} errors, ${diagnostics.filter((item) => item.severity === 'warning').length} warnings)`,
    );
    diagnostics.forEach((item) =>
      console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
    );
  }
  return ok;
}

async function runSingleDungeonCheck(dungeonId: string): Promise<void> {
  const registeredDocument =
    dungeonDocuments.find((document) => document.id === dungeonId) ??
    dungeonPreviewDocuments.find((document) => document.id === dungeonId);
  try {
    const document = registeredDocument ?? (await loadAuthoringDocument(dungeonId, requestedRoot));
    const staleErrors = staleLedgerErrors();
    const ok = printSingleResult(dungeonId, validateDungeonDocument(document), [
      ...(registeredDocument ? [] : authoringDiagnostics(document)),
      ...staleErrors.map((message) => ({
        severity: 'error' as const,
        code: message.split(':')[0] ?? 'DUNGEON_STALE_LEDGER_INVALID',
        path: 'src/dungeon/data/authoring/stale.json',
        message,
      })),
    ]);
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = {
      severity: 'error' as const,
      code: message.split(':')[0] ?? 'DUNGEON_CHECK_FAILED',
      path: '$',
      message,
    };
    if (jsonOutput) {
      console.log(JSON.stringify({ dungeonId, ok: false, diagnostics: [diagnostic] }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  }
}

function runGlobalDungeonCheck(): void {
  const errors: string[] = [];
  const knownKnowledgeIds = new Set(
    dungeonPreviewDocuments.flatMap((document) => [...documentKnowledgeIds(document)]),
  );
  errors.push(...staleLedgerErrors(knownKnowledgeIds));

  errors.push(
    ...validateForcesSnapshotRegistry(dungeonForcesSnapshotRegistry).map(
      (diagnostic) => `source registry: ${diagnostic}`,
    ),
  );
  errors.push(
    ...validateFactBindingRegistry(dungeonFactBindingRegistry).map(
      (diagnostic) => `source registry: ${diagnostic}`,
    ),
  );

  validateSeason2DungeonCatalog(
    undefined,
    new Set(dungeonDocuments.map((document) => document.id)),
  ).forEach((diagnostic) => {
    errors.push(`catalog: ${diagnostic.code} ${diagnostic.path} — ${diagnostic.message}`);
  });

  const wclIdentityDigest = createHash('sha256')
    .update(serializeSeason2WclSourceIdentity())
    .digest('hex');
  if (season2WclCatalogSource.identityDigest !== `sha256:${wclIdentityDigest}`) {
    errors.push(
      `catalog: CATALOG_WCL_SOURCE_DIGEST_MISMATCH ${season2WclCatalogSource.identityDigest} !== sha256:${wclIdentityDigest}`,
    );
  }

  let season2CoordinateReferenceCount = 0;
  for (const entry of season2DungeonCatalog) {
    errors.push(
      ...validatePublishedLearningGate(
        entry,
        dungeonDocuments.find((candidate) => candidate.id === entry.id),
      ),
    );
    if (!entry.coordinateSnapshotId) continue;
    season2CoordinateReferenceCount += 1;
    const reference = getCoordinateReference(entry);
    if (!reference) {
      errors.push(`catalog: COORDINATE_SNAPSHOT_MISSING ${entry.id} — ${entry.sourceKey}`);
    } else if (reference.snapshot.snapshotId !== entry.coordinateSnapshotId) {
      errors.push(
        `catalog: COORDINATE_SNAPSHOT_MISMATCH ${entry.id} — ${reference.snapshot.snapshotId} !== ${entry.coordinateSnapshotId}`,
      );
    }
  }

  const coordinateSnapshotHash = createHash('sha256')
    .update(
      legacyThreechestCoordinateInventory
        .map((entry) => {
          const snapshot = getCoordinateSnapshot(entry.sourceKey);
          return `${entry.sourceKey}:${snapshot ? createHash('sha256').update(serializeCoordinateSnapshot(snapshot)).digest('hex') : 'missing'}`;
        })
        .sort()
        .join('\n'),
    )
    .digest('hex');
  const registeredCoordinateHash = dungeonSourceRegistry.snapshots.find(
    (snapshot) =>
      snapshot.sourceId === 'threechest' &&
      snapshot.snapshotId === 'threechest-coordinate-snapshot-2026-08-10',
  )?.hash;
  if (registeredCoordinateHash !== `sha256:${coordinateSnapshotHash}`) {
    errors.push(
      `source registry: COORDINATE_HASH_MISMATCH ${registeredCoordinateHash ?? 'missing'} !== sha256:${coordinateSnapshotHash}`,
    );
  }

  for (const entry of legacyThreechestCoordinateInventory) {
    const snapshot = getCoordinateSnapshot(entry.sourceKey);
    if (!snapshot) {
      errors.push(
        `coordinate inventory: COORDINATE_SNAPSHOT_MISSING ${entry.id} — ${entry.sourceKey}`,
      );
    } else if (snapshot.snapshotId !== entry.coordinateSnapshotId) {
      errors.push(
        `coordinate inventory: COORDINATE_SNAPSHOT_MISMATCH ${entry.id} — ${snapshot.snapshotId} !== ${entry.coordinateSnapshotId}`,
      );
    } else {
      const registeredSnapshot = dungeonSourceRegistry.snapshots.find(
        (candidate) =>
          candidate.sourceId === entry.coordinateSourceId &&
          candidate.snapshotId === entry.coordinateSnapshotId,
      );
      if (
        !registeredSnapshot?.fieldAllowlist ||
        !coordinateSnapshotUsesAllowedFields(snapshot, registeredSnapshot.fieldAllowlist)
      ) {
        errors.push(`coordinate inventory: COORDINATE_FIELD_NOT_ALLOWED ${entry.id}`);
      }
    }
  }

  for (const entry of season2DungeonCatalog) {
    if (!entry.coordinateSnapshotId) continue;
    const snapshot = getCoordinateSnapshot(entry.coordinateSnapshotKey ?? entry.sourceKey);
    const registeredSnapshot = dungeonSourceRegistry.snapshots.find(
      (candidate) =>
        candidate.sourceId === entry.coordinateSourceId &&
        candidate.snapshotId === entry.coordinateSnapshotId,
    );
    if (!snapshot || !registeredSnapshot) {
      errors.push(`source registry: S2_COORDINATE_SNAPSHOT_MISSING ${entry.id}`);
      continue;
    }
    const coordinateSource = checkSourceUse(
      dungeonSourceRegistry,
      entry.coordinateSourceId ?? 'threechest',
      entry.coordinateSnapshotId,
      'commit-derived-data',
    );
    errors.push(...validateS2CoordinateGate(entry, snapshot, registeredSnapshot, coordinateSource));
  }

  for (const document of dungeonPreviewDocuments) {
    const result = validateDungeonDocument(document);
    result.errors.forEach((item) =>
      errors.push(`${document.id}: ${item.code} ${item.path} — ${item.message}`),
    );
  }

  const coordinateSource = checkSourceUse(
    dungeonSourceRegistry,
    'threechest',
    'threechest-coordinate-snapshot-2026-08-10',
    'commit-derived-data',
  );
  if (!coordinateSource.ok) {
    errors.push(`source registry: ${coordinateSource.reason}`);
  }

  if (errors.length > 0) {
    console.error(`Dungeon check failed with ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(
      `Dungeon check passed: ${dungeonDocuments.length} registered document(s), ${dungeonPreviewDocuments.length} preview document(s), ${season2DungeonCatalog.length} S2 catalog entries (${season2CoordinateReferenceCount} coordinate reference(s)), ${legacyThreechestCoordinateInventory.length} legacy coordinate snapshot(s), source registry approved.`,
    );
  }
}

if (process.argv[1]?.endsWith('scripts/dungeons/check.ts')) {
  if (requestedDungeon) {
    await runSingleDungeonCheck(requestedDungeon);
  } else {
    runGlobalDungeonCheck();
  }
}
