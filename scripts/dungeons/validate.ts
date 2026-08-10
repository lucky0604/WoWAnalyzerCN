import { dungeonDocuments, getDungeonDocument } from '../../src/dungeon/registry';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

const dungeonId = option('--dungeon');
const jsonOutput = process.argv.includes('--json');
const documents = dungeonId ? [getDungeonDocument(dungeonId)].filter(Boolean) : dungeonDocuments;

if (documents.length === 0) {
  const message = `DUNGEON_NOT_FOUND: ${dungeonId}`;
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          diagnostics: [{ severity: 'error', code: 'DUNGEON_NOT_FOUND', path: '$', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exitCode = 1;
} else {
  const report = documents.map((document) => {
    const result = validateDungeonDocument(document);
    return { dungeonId: document.id, ...result };
  });
  const hasErrors = report.some((item) => !item.ok);
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: !hasErrors, documents: report }, null, 2));
  } else {
    report.forEach((item) => {
      console.log(
        `${item.dungeonId}: ${item.ok ? 'OK' : 'FAILED'} (${item.errors.length} errors, ${item.warnings.length} warnings)`,
      );
      for (const diagnostic of [...item.errors, ...item.warnings]) {
        console.log(
          `  ${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
        );
      }
    });
  }
  process.exitCode = hasErrors ? 1 : 0;
}
