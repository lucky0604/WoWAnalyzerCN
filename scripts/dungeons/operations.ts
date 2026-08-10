import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { legacyThreechestCoordinateInventory } from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
import {
  getCoordinateSnapshot,
  type CoordinateSnapshot,
} from '../../src/dungeon/runtime/coordinates';
import type { Diagnostic, DungeonDocument, ContentVersion } from '../../src/dungeon/schema/types';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';
import { authoringDiagnostics, loadAuthoringDocument } from './authoring';

const DEFAULT_STALE_LEDGER = resolve('src/dungeon/data/authoring/stale.json');
const DEFAULT_RELEASE_DIR = resolve('.tmp/dungeons/releases');

interface StaleEntry {
  knowledgeId: string;
  reason: string;
  markedAt: string;
  snapshotId?: string;
}

interface StaleLedger {
  version: 1;
  entries: StaleEntry[];
}

interface ReleaseManifest {
  version: 1;
  revision: number;
  publishedAt: string;
  previousRevision?: number;
  dungeonId: string;
  document: DungeonDocument;
}

interface CoordinateImpact {
  dungeonId: string;
  sourceKey: string;
  snapshotId: string;
  rawSha256: string;
  spawnCount: number;
  changedFrom?: string;
  affectedKnowledgeIds: string[];
}

function option(args: string[], name: string): string | undefined {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function numberOption(args: string[], name: string, fallback?: number): number | undefined {
  const value = option(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`DUNGEON_OPERATIONS_OPTION_INVALID: ${name}=${value}`);
  }
  return parsed;
}

function jsonEnabled(args: string[]): boolean {
  return args.includes('--json');
}

function print(value: unknown, args: string[], human: string): void {
  if (jsonEnabled(args)) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(human);
  }
}

async function readJson<T>(path: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if (
      fallback !== undefined &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return fallback;
    }
    throw new Error(`DUNGEON_OPERATIONS_JSON_INVALID: ${path}`);
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

function diagnosticsForDraft(document: DungeonDocument): Diagnostic[] {
  const draftView: DungeonDocument = {
    ...document,
    dataStatus: 'draft',
    version: { ...document.version, status: 'draft' },
  };
  return [
    ...validateDungeonDocument(draftView).errors,
    ...authoringDiagnostics(draftView).filter(
      (diagnostic) =>
        !['DUNGEON_AUTHORING_STATUS_INVALID', 'DUNGEON_AUTHORING_VERSION_STATUS_INVALID'].includes(
          diagnostic.code,
        ),
    ),
  ];
}

async function loadDocument(args: string[]): Promise<DungeonDocument> {
  const input = option(args, '--input');
  if (input) return readJson<DungeonDocument>(resolve(input));
  const dungeonId = option(args, '--dungeon');
  if (!dungeonId) {
    throw new Error('DUNGEON_OPERATIONS_DUNGEON_REQUIRED: pass --dungeon or --input.');
  }
  const root = option(args, '--root');
  const registered = dungeonDocuments.find((document) => document.id === dungeonId);
  return registered ?? loadAuthoringDocument(dungeonId, root);
}

function releaseCandidate(document: DungeonDocument, revision: number): DungeonDocument {
  const version: ContentVersion = {
    ...document.version,
    revision,
    status: 'published',
  };
  return { ...document, dataStatus: 'published', version };
}

export async function previewDocument(document: DungeonDocument): Promise<{
  ok: boolean;
  diagnostics: Diagnostic[];
}> {
  const diagnostics = diagnosticsForDraft(document);
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), diagnostics };
}

export async function publishDocument(
  document: DungeonDocument,
  revision: number,
  releaseDir = DEFAULT_RELEASE_DIR,
): Promise<ReleaseManifest> {
  if (document.dataStatus === 'fixture') {
    throw new Error('DUNGEON_PUBLISH_FIXTURE_FORBIDDEN: fixture documents cannot be published.');
  }
  if (document.version.status === 'stale') {
    throw new Error(
      'DUNGEON_PUBLISH_STALE_FORBIDDEN: stale content must be refreshed and re-authored before publication.',
    );
  }
  const preview = await previewDocument(document);
  if (!preview.ok) {
    throw new Error(
      `DUNGEON_PUBLISH_BLOCKED: ${preview.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.code)
        .join(', ')}`,
    );
  }
  const candidate = releaseCandidate(document, revision);
  const validation = validateDungeonDocument(candidate);
  if (!validation.ok) {
    throw new Error(
      `DUNGEON_PUBLISH_BLOCKED: ${validation.errors.map((diagnostic) => diagnostic.code).join(', ')}`,
    );
  }
  const currentPath = resolve(releaseDir, 'current.json');
  const current = await readJson<ReleaseManifest | null>(currentPath, null);
  const revisionPath = resolve(releaseDir, `${revision}.json`);
  const existingRevision = await readJson<ReleaseManifest | null>(revisionPath, null);
  if (existingRevision) {
    throw new Error(`DUNGEON_RELEASE_EXISTS: revision ${revision} already exists.`);
  }
  const manifest: ReleaseManifest = {
    version: 1,
    revision,
    publishedAt: new Date().toISOString(),
    ...(current ? { previousRevision: current.revision } : {}),
    dungeonId: candidate.id,
    document: candidate,
  };
  await writeJsonAtomic(revisionPath, manifest);
  await writeJsonAtomic(currentPath, manifest);
  return manifest;
}

export async function rollbackRelease(releaseDir = DEFAULT_RELEASE_DIR): Promise<ReleaseManifest> {
  const currentPath = resolve(releaseDir, 'current.json');
  const current = await readJson<ReleaseManifest>(currentPath);
  if (current.previousRevision === undefined) {
    throw new Error('DUNGEON_ROLLBACK_NO_PREVIOUS: current release has no previous revision.');
  }
  const previous = await readJson<ReleaseManifest>(
    resolve(releaseDir, `${current.previousRevision}.json`),
  );
  await writeJsonAtomic(currentPath, previous);
  return previous;
}

export async function markStale(
  knowledgeIds: string[],
  reason: string,
  ledgerPath = DEFAULT_STALE_LEDGER,
  snapshotId?: string,
): Promise<StaleLedger> {
  if (knowledgeIds.length === 0) {
    throw new Error('DUNGEON_STALE_IDS_REQUIRED: pass at least one knowledge ID.');
  }
  const ledger = await readJson<StaleLedger>(ledgerPath, { version: 1, entries: [] });
  const markedAt = new Date().toISOString();
  const nextEntries = ledger.entries.filter((entry) => !knowledgeIds.includes(entry.knowledgeId));
  knowledgeIds.forEach((knowledgeId) =>
    nextEntries.push({ knowledgeId, reason, markedAt, ...(snapshotId ? { snapshotId } : {}) }),
  );
  const next: StaleLedger = { version: 1, entries: nextEntries };
  await writeJsonAtomic(ledgerPath, next);
  return next;
}

function knowledgeIdsForSnapshot(snapshotId: string): string[] {
  return dungeonDocuments
    .filter((document) => document.provenance.some((source) => source.snapshot === snapshotId))
    .flatMap((document) => [
      ...document.abilities.map((ability) => ability.id),
      ...document.situations.map((situation) => situation.id),
      ...document.routes.flatMap((route) => [route.id, ...route.steps.map((step) => step.id)]),
      ...document.bosses.map((boss) => boss.id),
    ]);
}

export function coordinateImpact(
  snapshotId: string,
  previousBySourceKey: Record<string, string> = {},
): CoordinateImpact[] {
  return legacyThreechestCoordinateInventory.flatMap((entry) => {
    const snapshot: CoordinateSnapshot | undefined = getCoordinateSnapshot(entry.sourceKey);
    if (!snapshot || snapshot.snapshotId !== snapshotId) return [];
    const previousHash = previousBySourceKey[entry.sourceKey];
    return [
      {
        dungeonId: entry.id,
        sourceKey: entry.sourceKey,
        snapshotId: snapshot.snapshotId,
        rawSha256: snapshot.rawSha256,
        spawnCount: snapshot.spawns.length,
        ...(previousHash ? { changedFrom: previousHash } : {}),
        affectedKnowledgeIds: knowledgeIdsForSnapshot(snapshotId),
      },
    ];
  });
}

async function run(argv: string[]): Promise<void> {
  const mode = argv[0];
  if (mode === 'impact') {
    const snapshotId = option(argv, '--snapshot') ?? argv[1];
    if (!snapshotId) throw new Error('DUNGEON_IMPACT_SNAPSHOT_REQUIRED: pass a snapshot ID.');
    const report = coordinateImpact(snapshotId);
    print(
      { snapshotId, affected: report },
      argv,
      `Impact ${snapshotId}: ${report.length} dungeon reference(s), ${report.reduce((total, item) => total + item.affectedKnowledgeIds.length, 0)} knowledge item(s).`,
    );
    return;
  }
  if (mode === 'status' && argv[1] === 'stale') {
    const ids: string[] = [];
    for (const value of argv.slice(2)) {
      if (value.startsWith('--')) break;
      ids.push(value);
    }
    const reason = option(argv, '--reason') ?? 'source snapshot or gameplay facts changed';
    const ledger = await markStale(ids, reason, option(argv, '--file'), option(argv, '--snapshot'));
    print(ledger, argv, `Marked ${ids.length} knowledge item(s) stale.`);
    return;
  }
  if (mode === 'preview') {
    const document = await loadDocument(argv);
    const report = await previewDocument(document);
    print(report, argv, `${document.id}: ${report.ok ? 'ready for review' : 'blocked'}.`);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (mode === 'publish') {
    const document = await loadDocument(argv);
    const revision = numberOption(argv, '--revision');
    if (!revision)
      throw new Error('DUNGEON_PUBLISH_REVISION_REQUIRED: pass --revision <positive integer>.');
    const manifest = await publishDocument(document, revision, option(argv, '--release-dir'));
    print(manifest, argv, `Published ${manifest.dungeonId} revision ${manifest.revision}.`);
    return;
  }
  if (mode === 'rollback') {
    const manifest = await rollbackRelease(option(argv, '--release-dir'));
    print(manifest, argv, `Rolled back ${manifest.dungeonId} to revision ${manifest.revision}.`);
    return;
  }
  throw new Error(
    'DUNGEON_OPERATIONS_USAGE: impact <snapshot>; status stale <knowledge IDs>; preview --dungeon <id>|--input <file>; publish --input <file> --revision <n>; rollback',
  );
}

if (process.argv[1]?.endsWith('scripts/dungeons/operations.ts')) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
