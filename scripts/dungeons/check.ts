import { createHash } from 'node:crypto';
import { checkSourceUse, dungeonSourceRegistry } from '../../src/dungeon/runtime/sourceRegistry';
import {
  season2DungeonCatalog,
  validateSeason2DungeonCatalog,
} from '../../src/dungeon/data/season2Catalog';
import {
  getCoordinateReference,
  getCoordinateSnapshot,
} from '../../src/dungeon/runtime/coordinates';
import { dungeonDocuments } from '../../src/dungeon/registry';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

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
