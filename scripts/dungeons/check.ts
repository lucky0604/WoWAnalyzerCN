import { createHash } from 'node:crypto';

import {
  legacyThreechestCoordinateInventory,
  season2DungeonCatalog,
  validateSeason2DungeonCatalog,
} from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
import { dungeonPreviewDocuments } from '../../src/dungeon/registry';
import {
  getCoordinateReference,
  getCoordinateSnapshot,
} from '../../src/dungeon/runtime/coordinates';
import { checkSourceUse, dungeonSourceRegistry } from '../../src/dungeon/runtime/sourceRegistry';
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
    const ok = printSingleResult(
      dungeonId,
      validateDungeonDocument(document),
      registeredDocument ? [] : authoringDiagnostics(document),
    );
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

  validateSeason2DungeonCatalog(
    undefined,
    new Set(dungeonDocuments.map((document) => document.id)),
  ).forEach((diagnostic) => {
    errors.push(`catalog: ${diagnostic.code} ${diagnostic.path} — ${diagnostic.message}`);
  });

  let season2CoordinateReferenceCount = 0;
  for (const entry of season2DungeonCatalog) {
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
          return `${entry.sourceKey}:${snapshot?.rawSha256 ?? 'missing'}`;
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

  const rlpSnapshot = getCoordinateSnapshot('rlp');
  const rlpCoordinateHash = createHash('sha256')
    .update(`rlp:${rlpSnapshot?.rawSha256 ?? 'missing'}`)
    .digest('hex');
  const registeredRlpHash = dungeonSourceRegistry.snapshots.find(
    (snapshot) =>
      snapshot.sourceId === 'threechest' &&
      snapshot.snapshotId === 'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
  )?.hash;
  if (registeredRlpHash !== `sha256:${rlpCoordinateHash}`) {
    errors.push(
      `source registry: RLP_COORDINATE_HASH_MISMATCH ${registeredRlpHash ?? 'missing'} !== sha256:${rlpCoordinateHash}`,
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
    }
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

  const rlpCoordinateSource = checkSourceUse(
    dungeonSourceRegistry,
    'threechest',
    'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
    'commit-derived-data',
  );
  if (!rlpCoordinateSource.ok) {
    errors.push(`source registry: ${rlpCoordinateSource.reason}`);
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

if (requestedDungeon) {
  await runSingleDungeonCheck(requestedDungeon);
} else {
  runGlobalDungeonCheck();
}
