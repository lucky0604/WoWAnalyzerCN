import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import {
  validateRuntimeReleaseArtifact,
  type RuntimeReleaseArtifact,
  type RuntimeReleaseDocument,
} from '../../src/dungeon/runtime/releaseRegistry';

const DEFAULT_RELEASE_DIR = resolve('.tmp/dungeons/releases');
const DEFAULT_OUTPUT = resolve('src/dungeon/data/releases/current.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const option = (args: string[], name: string): string | undefined => {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const jsonOutput = (args: string[]) => args.includes('--json');

function parseJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `DUNGEON_RELEASE_SYNC_JSON_INVALID: ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function releaseEntryFromManifest(
  value: unknown,
  path: string,
  expectedRevision?: number,
): RuntimeReleaseDocument {
  if (!isRecord(value)) {
    throw new Error(`DUNGEON_RELEASE_SYNC_MANIFEST_INVALID: ${path}: top-level object required.`);
  }
  const entry = {
    dungeonId: value.dungeonId,
    revision: value.revision,
    document: value.document,
  } as RuntimeReleaseDocument;
  // Shape validation first: a manifest that is structurally broken (missing
  // revision/document or wrong types) must be reported as invalid input, not
  // as a coincidental filename mismatch.
  const errors = validateRuntimeReleaseArtifact({ version: 1, documents: [entry] });
  if (errors.length > 0) {
    throw new Error(`DUNGEON_RELEASE_SYNC_MANIFEST_INVALID: ${path}: ${errors.join(', ')}`);
  }
  if (expectedRevision !== undefined && entry.revision !== expectedRevision) {
    throw new Error(
      `DUNGEON_RELEASE_SYNC_REVISION_FILENAME_MISMATCH: ${path}: filename=${expectedRevision}, manifest=${entry.revision}.`,
    );
  }
  return entry;
}

export function selectLatestReleaseDocuments(
  entries: readonly RuntimeReleaseDocument[],
): RuntimeReleaseArtifact {
  const latest = new Map<string, RuntimeReleaseDocument>();
  for (const entry of entries) {
    const previous = latest.get(entry.dungeonId);
    if (!previous || entry.revision > previous.revision) {
      latest.set(entry.dungeonId, entry);
      continue;
    }
    if (entry.revision === previous.revision) {
      throw new Error(
        `DUNGEON_RELEASE_SYNC_REVISION_CONFLICT: ${entry.dungeonId} revision ${entry.revision} is duplicated.`,
      );
    }
  }
  const artifact: RuntimeReleaseArtifact = {
    version: 1,
    documents: [...latest.values()].sort((left, right) =>
      left.dungeonId.localeCompare(right.dungeonId),
    ),
  };
  const errors = validateRuntimeReleaseArtifact(artifact);
  if (errors.length > 0) {
    throw new Error(`DUNGEON_RELEASE_SYNC_ARTIFACT_INVALID: ${errors.join(', ')}`);
  }
  return artifact;
}

async function assertOutputIsNotInput(outputPath: string, inputPaths: readonly string[]) {
  const resolvedOutput = resolve(outputPath);
  for (const inputPath of inputPaths) {
    if (resolve(inputPath) === resolvedOutput) {
      throw new Error('DUNGEON_RELEASE_SYNC_OUTPUT_INPUT_ALIAS: output must be new.');
    }
  }
  let outputStat;
  try {
    outputStat = await stat(resolvedOutput);
  } catch {
    outputStat = undefined;
  }
  if (!outputStat) return;
  for (const inputPath of inputPaths) {
    try {
      const inputStat = await stat(inputPath);
      if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
        throw new Error('DUNGEON_RELEASE_SYNC_OUTPUT_INPUT_ALIAS: output shares an input inode.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('DUNGEON_RELEASE_SYNC_')) throw error;
    }
  }
}

async function writeArtifactAtomically(outputPath: string, artifact: RuntimeReleaseArtifact) {
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  const temporaryPath = join(
    dirname(resolvedOutput),
    `.${basename(resolvedOutput)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, resolvedOutput);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function syncReleaseArtifact(
  releaseDir = DEFAULT_RELEASE_DIR,
  outputPath = DEFAULT_OUTPUT,
): Promise<RuntimeReleaseArtifact> {
  const resolvedReleaseDir = resolve(releaseDir);
  const resolvedOutput = resolve(outputPath);
  let directoryEntries;
  try {
    directoryEntries = await readdir(resolvedReleaseDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `DUNGEON_RELEASE_SYNC_DIR_INVALID: ${resolvedReleaseDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const revisionFiles = directoryEntries
    .filter((entry) => entry.isFile() && /^\d+\.json$/.test(entry.name))
    .map((entry) => join(resolvedReleaseDir, entry.name))
    .sort();
  const currentPath = join(resolvedReleaseDir, 'current.json');
  const inputPaths = [...revisionFiles, currentPath];
  await assertOutputIsNotInput(resolvedOutput, inputPaths);

  const entries: RuntimeReleaseDocument[] = [];
  for (const revisionPath of revisionFiles) {
    const value = parseJson(await readFile(revisionPath, 'utf8'), revisionPath);
    const revision = Number(basename(revisionPath, '.json'));
    entries.push(releaseEntryFromManifest(value, revisionPath, revision));
  }

  let currentEntry: RuntimeReleaseDocument | undefined;
  try {
    const currentValue = parseJson(await readFile(currentPath, 'utf8'), currentPath);
    currentEntry = releaseEntryFromManifest(currentValue, currentPath);
    const matchingRevision = entries.find(
      (entry) =>
        entry.dungeonId === currentEntry.dungeonId && entry.revision === currentEntry.revision,
    );
    if (!matchingRevision) {
      throw new Error(
        `DUNGEON_RELEASE_SYNC_CURRENT_MISSING: ${currentEntry.dungeonId} revision ${currentEntry.revision} is not present in numbered history.`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('DUNGEON_RELEASE_SYNC_CURRENT_MISSING')
    ) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const selectedEntries = currentEntry
    ? entries.filter((entry) => entry.dungeonId !== currentEntry?.dungeonId)
    : entries;
  if (currentEntry) {
    const currentIndex = entries.findIndex(
      (entry) =>
        entry.dungeonId === currentEntry?.dungeonId && entry.revision === currentEntry.revision,
    );
    if (currentIndex < 0) {
      throw new Error(
        `DUNGEON_RELEASE_SYNC_CURRENT_MISSING: ${currentEntry.dungeonId} revision ${currentEntry.revision} is not present in numbered history.`,
      );
    }
    selectedEntries.push(currentEntry);
  }

  const artifact = selectLatestReleaseDocuments(selectedEntries);
  await writeArtifactAtomically(resolvedOutput, artifact);
  return artifact;
}

async function run(args: string[]) {
  const artifact = await syncReleaseArtifact(
    option(args, '--release-dir') ?? DEFAULT_RELEASE_DIR,
    option(args, '--out') ?? DEFAULT_OUTPUT,
  );
  const result = {
    ok: true,
    documents: artifact.documents.map(({ dungeonId, revision }) => ({ dungeonId, revision })),
    output: resolve(option(args, '--out') ?? DEFAULT_OUTPUT),
  };
  if (jsonOutput(args)) {
    console.log(JSON.stringify(result));
  } else {
    console.log(
      `Dungeon release artifact synced: ${artifact.documents.length} document(s) → ${result.output}`,
    );
  }
}

if (process.argv[1]?.endsWith('scripts/dungeons/release-sync.ts')) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonOutput(process.argv.slice(2))) {
      console.log(JSON.stringify({ ok: false, error: message }));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  });
}
