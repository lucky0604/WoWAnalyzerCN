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

  it('partially recovers valid records and drops malformed or dangerous entries', () => {
    const storage = memoryStorage();
    storage.setItem(
      'wowanalyzer:dungeon-learning:v1',
      JSON.stringify({
        version: 1,
        lastRole: 'tank',
        byDungeon: {
          'ruby-life-pools': {
            bySituation: {
              valid: {
                confidence: 'ready',
                revealed: true,
                updatedAt: '2026-08-11T00:00:00.000Z',
                contentFingerprint: 'v1:valid',
              },
              badConfidence: {
                confidence: 'certain',
                revealed: true,
                updatedAt: '2026-08-11T00:00:00.000Z',
                contentFingerprint: 'v1:bad',
              },
              badTimestamp: {
                confidence: 'fuzzy',
                revealed: false,
                updatedAt: 'yesterday',
                contentFingerprint: 'v1:bad',
              },
              impossibleDate: {
                confidence: 'fuzzy',
                revealed: false,
                updatedAt: '2026-02-31T00:00:00.000Z',
                contentFingerprint: 'v1:bad',
              },
            },
          },
          __proto__: { bySituation: { polluted: {} } },
          constructor: { bySituation: { polluted: {} } },
          '   ': { bySituation: { polluted: {} } },
        },
      }),
    );

    expect(readLearningProgress(storage)).toEqual({
      version: 1,
      lastRole: 'tank',
      byDungeon: {
        'ruby-life-pools': {
          bySituation: {
            valid: {
              confidence: 'ready',
              revealed: true,
              updatedAt: '2026-08-11T00:00:00.000Z',
              contentFingerprint: 'v1:valid',
            },
          },
        },
      },
    });

    storage.setItem(
      'wowanalyzer:dungeon-learning:v1',
      '{"version":1,"byDungeon":{"__proto__":{"bySituation":{"polluted":{}}}}}',
    );
    expect(readLearningProgress(storage)).toEqual(emptyLearningProgress());
  });

  it('rejects old schemas and malformed objects on write', () => {
    const storage = memoryStorage();
    storage.setItem(
      'wowanalyzer:dungeon-learning:v1',
      JSON.stringify({ version: 0, byDungeon: {} }),
    );
    expect(readLearningProgress(storage)).toEqual(emptyLearningProgress());

    const malformed = {
      version: 1,
      byDungeon: {
        dungeon: {
          bySituation: {
            situation: {
              confidence: 'ready',
              revealed: true,
              updatedAt: 'not-a-date',
              contentFingerprint: 'v1:bad',
            },
          },
        },
      },
    } as unknown as ReturnType<typeof emptyLearningProgress>;
    expect(writeLearningProgress(malformed, storage)).toBe(false);
    expect(JSON.parse(storage.getItem('wowanalyzer:dungeon-learning:v1')!)).toEqual({
      version: 0,
      byDungeon: {},
    });

    storage.setItem(
      'wowanalyzer:dungeon-learning:v1',
      JSON.stringify({ version: 1, lastRole: 'mage', byDungeon: {} }),
    );
    expect(readLearningProgress(storage)).toEqual(emptyLearningProgress());

    const tooMany = { version: 1, byDungeon: { dungeon: { bySituation: {} } } } as {
      version: 1;
      byDungeon: Record<string, { bySituation: Record<string, unknown> }>;
    };
    for (let index = 0; index <= 10_000; index += 1) {
      tooMany.byDungeon.dungeon.bySituation[`situation-${index}`] = {
        confidence: 'ready',
        revealed: true,
        updatedAt: '2026-08-11T00:00:00.000Z',
        contentFingerprint: 'v1:valid',
      };
    }
    storage.setItem('wowanalyzer:dungeon-learning:v1', JSON.stringify(tooMany));
    expect(readLearningProgress(storage)).toEqual(emptyLearningProgress());
  });

  it('fails closed for invalid recall inputs without mutating progress', () => {
    const progress = emptyLearningProgress();
    expect(recordRecall(progress, '__proto__', 'situation', 'ready', true)).toBe(progress);
    expect(recordRecall(progress, null as never, 'situation', 'ready', true)).toBe(progress);
    expect(recordRecall(progress, 'dungeon', null as never, 'ready', true)).toBe(progress);
    expect(recordRecall(progress, 'toString', 'situation', 'ready', true)).not.toBe(progress);
    expect(recordRecall(progress, 'toString', 'situation', 'ready', true).byDungeon).toEqual({
      toString: {
        bySituation: {
          situation: expect.objectContaining({ confidence: 'ready' }),
        },
      },
    });
    expect(recordRecall(progress, 'dungeon', 'situation', 'certain' as never, true)).toBe(progress);
    expect(recordRecall(progress, 'dungeon', 'situation', 'ready', true, '')).toBe(progress);
    expect(
      recordRecall({ version: 1, byDungeon: null } as never, 'dungeon', 'situation', 'ready', true),
    ).toEqual(emptyLearningProgress());
  });
});
