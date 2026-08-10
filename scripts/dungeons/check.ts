import { checkSourceUse, dungeonSourceRegistry } from '../../src/dungeon/runtime/sourceRegistry';
import { validateSeason2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

const errors: string[] = [];

validateSeason2DungeonCatalog(
  undefined,
  new Set(dungeonDocuments.map((document) => document.id)),
).forEach((diagnostic) => {
  errors.push(`catalog: ${diagnostic.code} ${diagnostic.path} — ${diagnostic.message}`);
});

for (const document of dungeonDocuments) {
  const result = validateDungeonDocument(document);
  result.errors.forEach((item) =>
    errors.push(`${document.id}: ${item.code} ${item.path} — ${item.message}`),
  );
}

const coordinateSource = checkSourceUse(
  dungeonSourceRegistry,
  'threechest',
  'local-coordinate-fixture-2026-08-10',
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
    `Dungeon check passed: ${dungeonDocuments.length} document(s), source registry approved.`,
  );
}
