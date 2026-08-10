import { describe, expect, it } from 'vitest';

import {
  emptyLearningProgress,
  readLearningProgress,
  recordRecall,
  writeLearningProgress,
} from './progress';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

describe('learning progress storage', () => {
  it('round-trips recall records and survives corrupt storage', () => {
    const storage = memoryStorage();
    let progress = emptyLearningProgress();
    progress = recordRecall(
      progress,
      'ruby-life-pools',
      'rlp-situation-infusion-first-pack',
      'fuzzy',
      true,
    );
    expect(writeLearningProgress(progress, storage)).toBe(true);
    expect(readLearningProgress(storage).byDungeon['ruby-life-pools']?.bySituation).toMatchObject({
      'rlp-situation-infusion-first-pack': { confidence: 'fuzzy', revealed: true },
    });
    storage.setItem('wowanalyzer:dungeon-learning:v1', '{broken');
    expect(readLearningProgress(storage)).toEqual(emptyLearningProgress());
  });

  it('falls back when storage is unavailable', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(writeLearningProgress(emptyLearningProgress(), storage)).toBe(false);
  });
});
