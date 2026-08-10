import { getDungeonDocument } from '../../src/dungeon/registry';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

const dungeonId = process.argv.find((argument) => argument.startsWith('--dungeon='))?.split('=')[1];
const documents = dungeonId ? [getDungeonDocument(dungeonId)].filter(Boolean) : undefined;

if (documents && documents.length === 0) {
  console.error(`DUNGEON_NOT_FOUND: ${dungeonId}`);
  process.exitCode = 1;
} else {
  const targetDocuments =
    documents ?? (await import('../../src/dungeon/registry')).dungeonDocuments;
  let hasErrors = false;
  for (const document of targetDocuments) {
    const result = validateDungeonDocument(document);
    hasErrors ||= !result.ok;
    console.log(
      `${document.id}: ${result.ok ? 'OK' : 'FAILED'} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
    );
    for (const item of [...result.errors, ...result.warnings]) {
      console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`);
    }
  }
  process.exitCode = hasErrors ? 1 : 0;
}
