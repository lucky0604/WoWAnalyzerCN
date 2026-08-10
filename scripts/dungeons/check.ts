import { createHash } from 'node:crypto';

import {
  season2DungeonCatalog,
  validateSeason2DungeonCatalog,
} from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
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
  const registeredDocument = dungeonDocuments.find((document) => document.id === dungeonId);
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

  for (const entry of season2DungeonCatalog) {
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
      season2DungeonCatalog
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

  for (const document of dungeonDocuments) {
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
      `Dungeon check passed: ${dungeonDocuments.length} document(s), ${season2DungeonCatalog.length} coordinate reference(s), source registry approved.`,
    );
  }
}

if (requestedDungeon) {
  await runSingleDungeonCheck(requestedDungeon);
} else {
  runGlobalDungeonCheck();
}
