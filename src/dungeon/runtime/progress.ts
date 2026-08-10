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

export function readLearningProgress(storage?: ProgressStorage): LearningProgress {
  try {
    const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    const value = target?.getItem(LEARNING_PROGRESS_KEY);
    if (!value) return emptyLearningProgress();
    const parsed = JSON.parse(value) as Partial<LearningProgress>;
    if (parsed.version !== 1 || !parsed.byDungeon || typeof parsed.byDungeon !== 'object') {
      return emptyLearningProgress();
    }
    return { version: 1, byDungeon: parsed.byDungeon, lastRole: parsed.lastRole };
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
    target.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress));
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
  const dungeon = progress.byDungeon[dungeonId] ?? { bySituation: {} };
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
