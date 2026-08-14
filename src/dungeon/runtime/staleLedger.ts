import staleLedgerJson from '../data/authoring/stale.json';
import { dungeonPreviewDocuments } from '../registry';
import type { DungeonDocument } from '../schema/types';
import { isUtcIsoTimestamp } from './factSnapshot';

export interface StaleKnowledgeEntry {
  knowledgeId: string;
  reason: string;
  markedAt: string;
  snapshotId?: string;
}

export interface StaleKnowledgeLedger {
  version: 1;
  entries: StaleKnowledgeEntry[];
}

export interface StaleLedgerStatus {
  ok: boolean;
  errors: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidUtcTimestamp(value: unknown): value is string {
  return isUtcIsoTimestamp(value);
}

export function validateStaleLedger(
  value: unknown,
  knownKnowledgeIds?: ReadonlySet<string>,
): StaleLedgerStatus {
  const errors: string[] = [];
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    return { ok: false, errors: ['DUNGEON_STALE_LEDGER_INVALID_SHAPE'] };
  }
  const ids = new Set<string>();
  value.entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`DUNGEON_STALE_LEDGER_INVALID_ENTRY #${index}`);
      return;
    }
    const knowledgeId = entry.knowledgeId;
    if (!isNonEmptyString(knowledgeId) || ids.has(knowledgeId)) {
      errors.push(`DUNGEON_STALE_LEDGER_INVALID_KNOWLEDGE_ID #${index}`);
    } else {
      ids.add(knowledgeId);
    }
    if (!isNonEmptyString(entry.reason)) {
      errors.push(`DUNGEON_STALE_LEDGER_INVALID_REASON ${knowledgeId || `#${index}`}`);
    }
    if (!isValidUtcTimestamp(entry.markedAt)) {
      errors.push(`DUNGEON_STALE_LEDGER_INVALID_MARKED_AT ${knowledgeId || `#${index}`}`);
    }
    if (entry.snapshotId !== undefined && !isNonEmptyString(entry.snapshotId)) {
      errors.push(`DUNGEON_STALE_LEDGER_INVALID_SNAPSHOT ${knowledgeId || `#${index}`}`);
    }
    if (knownKnowledgeIds && isNonEmptyString(knowledgeId) && !knownKnowledgeIds.has(knowledgeId)) {
      errors.push(`DUNGEON_STALE_LEDGER_UNKNOWN_KNOWLEDGE ${knowledgeId}`);
    }
  });
  return { ok: errors.length === 0, errors };
}

export const staleKnowledgeLedger = staleLedgerJson as unknown;

export const registeredKnowledgeIds = new Set(
  dungeonPreviewDocuments.flatMap((document) => [...documentKnowledgeIds(document)]),
);

// The ledger and registered id set are module constants, so validation is
// memoizable as long as the default id set is used. This keeps the hot path
// (every learning/route render calls the access gate) from re-validating a
// static payload on each pass.
let cachedValidatedLedger: StaleKnowledgeLedger | undefined;
let cacheValidated = false;

export function getStaleKnowledgeLedger(): StaleKnowledgeLedger | undefined {
  return getValidatedStaleKnowledgeLedger();
}

export function getValidatedStaleKnowledgeLedger(
  knownKnowledgeIds: ReadonlySet<string> = registeredKnowledgeIds,
): StaleKnowledgeLedger | undefined {
  if (knownKnowledgeIds === registeredKnowledgeIds) {
    if (!cacheValidated) {
      cachedValidatedLedger = validateStaleLedger(staleKnowledgeLedger, knownKnowledgeIds).ok
        ? (staleKnowledgeLedger as StaleKnowledgeLedger)
        : undefined;
      cacheValidated = true;
    }
    return cachedValidatedLedger;
  }
  const validation = validateStaleLedger(staleKnowledgeLedger, knownKnowledgeIds);
  return validation.ok ? (staleKnowledgeLedger as StaleKnowledgeLedger) : undefined;
}

export function documentKnowledgeIds(document: DungeonDocument): Set<string> {
  return new Set([
    ...document.enemies.map((enemy) => enemy.id),
    ...document.abilities.map((ability) => ability.id),
    ...document.situations.map((situation) => situation.id),
    ...document.routes.flatMap((route) => [route.id, ...route.steps.map((step) => step.id)]),
    ...document.bosses.map((boss) => boss.id),
  ]);
}

export function getStaleEntriesForDocument(
  document: DungeonDocument,
  ledger: StaleKnowledgeLedger | undefined = getStaleKnowledgeLedger(),
): StaleKnowledgeEntry[] {
  if (!ledger || !validateStaleLedger(ledger, registeredKnowledgeIds).ok) return [];
  const ids = documentKnowledgeIds(document);
  return ledger.entries.filter((entry) => ids.has(entry.knowledgeId));
}
