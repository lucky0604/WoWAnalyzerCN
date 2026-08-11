import type { Role, SituationId } from '../schema/types';

export type RecallConfidence = 'ready' | 'fuzzy' | 'unknown';

export interface RecallRecord {
  confidence: RecallConfidence;
  revealed: boolean;
  updatedAt: string;
  contentFingerprint: string;
}

export interface DungeonProgress {
  bySituation: Record<SituationId, RecallRecord>;
}

export interface LearningProgress {
  version: 1;
  byDungeon: Record<string, DungeonProgress>;
  lastRole?: Role;
}

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LEARNING_PROGRESS_KEY = 'wowanalyzer:dungeon-learning:v1';

export const emptyLearningProgress = (): LearningProgress => ({ version: 1, byDungeon: {} });

type RecordValue = Record<string, unknown>;

const roles = new Set<Role>(['tank', 'healer', 'dps']);
const confidences = new Set<RecallConfidence>(['ready', 'fuzzy', 'unknown']);
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const maxProgressSerializedChars = 1_000_000;
const maxProgressRecords = 10_000;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  (() => {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return false;
    const date = new Date(timestamp);
    const canonical = date.toISOString();
    return canonical === value || canonical === value.replace('Z', '.000Z');
  })();

function normalizeLearningProgress(value: unknown, strict = false): LearningProgress | undefined {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.byDungeon)) return undefined;
  if (value.lastRole !== undefined && !roles.has(value.lastRole as Role)) return undefined;

  const byDungeon: Record<string, DungeonProgress> = {};
  let recordCount = 0;
  let invalidFound = false;
  let tooManyRecords = false;
  Object.entries(value.byDungeon).forEach(([dungeonId, rawDungeon]) => {
    if (
      forbiddenKeys.has(dungeonId) ||
      !dungeonId.trim() ||
      !isRecord(rawDungeon) ||
      !isRecord(rawDungeon.bySituation)
    ) {
      if (strict) invalidFound = true;
      return;
    }

    const bySituation: Record<SituationId, RecallRecord> = {};
    Object.entries(rawDungeon.bySituation).forEach(([situationId, rawRecord]) => {
      if (
        forbiddenKeys.has(situationId) ||
        !situationId.trim() ||
        !isRecord(rawRecord) ||
        !confidences.has(rawRecord.confidence as RecallConfidence) ||
        typeof rawRecord.revealed !== 'boolean' ||
        !isIsoTimestamp(rawRecord.updatedAt) ||
        !isNonEmptyString(rawRecord.contentFingerprint)
      ) {
        if (strict) invalidFound = true;
        return;
      }
      recordCount += 1;
      if (recordCount > maxProgressRecords) {
        tooManyRecords = true;
        if (strict) invalidFound = true;
        return;
      }
      bySituation[situationId] = {
        confidence: rawRecord.confidence as RecallConfidence,
        revealed: rawRecord.revealed,
        updatedAt: rawRecord.updatedAt,
        contentFingerprint: rawRecord.contentFingerprint,
      };
    });
    byDungeon[dungeonId] = { bySituation };
  });

  const lastRole = roles.has(value.lastRole as Role) ? (value.lastRole as Role) : undefined;
  if (tooManyRecords || (strict && invalidFound)) return undefined;
  return { version: 1, byDungeon, ...(lastRole === undefined ? {} : { lastRole }) };
}

export function readLearningProgress(storage?: ProgressStorage): LearningProgress {
  try {
    const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    const value = target?.getItem(LEARNING_PROGRESS_KEY);
    if (!value) return emptyLearningProgress();
    if (typeof value !== 'string' || value.length > maxProgressSerializedChars) {
      return emptyLearningProgress();
    }
    return normalizeLearningProgress(JSON.parse(value) as unknown) ?? emptyLearningProgress();
  } catch {
    return emptyLearningProgress();
  }
}

export function writeLearningProgress(
  progress: LearningProgress,
  storage?: ProgressStorage,
): boolean {
  try {
    const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    if (!target) return false;
    const normalized = normalizeLearningProgress(progress, true);
    if (!normalized) return false;
    const serialized = JSON.stringify(normalized);
    if (serialized.length > maxProgressSerializedChars) return false;
    target.setItem(LEARNING_PROGRESS_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function recordRecall(
  progress: LearningProgress,
  dungeonId: string,
  situationId: SituationId,
  confidence: RecallConfidence,
  revealed: boolean,
  contentFingerprint = 'legacy',
): LearningProgress {
  if (
    typeof dungeonId !== 'string' ||
    typeof situationId !== 'string' ||
    forbiddenKeys.has(dungeonId) ||
    !dungeonId.trim() ||
    forbiddenKeys.has(situationId) ||
    !situationId.trim() ||
    !confidences.has(confidence) ||
    typeof revealed !== 'boolean' ||
    !isNonEmptyString(contentFingerprint)
  ) {
    return progress;
  }
  if (!isRecord(progress) || progress.version !== 1 || !isRecord(progress.byDungeon)) {
    return emptyLearningProgress();
  }
  const existingDungeon = Object.hasOwn(progress.byDungeon, dungeonId)
    ? progress.byDungeon[dungeonId]
    : undefined;
  if (
    existingDungeon !== undefined &&
    (!isRecord(existingDungeon) || !isRecord(existingDungeon.bySituation))
  ) {
    return progress;
  }
  const dungeon = existingDungeon ?? { bySituation: {} };
  return {
    ...progress,
    byDungeon: {
      ...progress.byDungeon,
      [dungeonId]: {
        ...dungeon,
        bySituation: {
          ...dungeon.bySituation,
          [situationId]: {
            confidence,
            revealed,
            updatedAt: new Date().toISOString(),
            contentFingerprint,
          },
        },
      },
    },
  };
}
