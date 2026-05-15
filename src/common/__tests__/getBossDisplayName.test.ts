import { describe, expect, it } from 'vitest';
import getBossDisplayName from '../getBossDisplayName';

describe('getBossDisplayName', () => {
  it('returns hardcoded CN name when boss exists in game/raids (priority 1)', () => {
    const result = getBossDisplayName(3176, 'Imperator Averzian');
    expect(result).toBe('元首阿福扎恩');
  });

  it('returns CN_MAPPING name when boss not in game/raids but in mapping (priority 2)', () => {
    const result = getBossDisplayName(112526, "Algeth'ar Academy");
    expect(result).toBe('艾杰斯亚学院');
  });

  it('returns fallback when boss not in game/raids nor mapping (priority 3)', () => {
    const result = getBossDisplayName(99999, 'Unknown Boss');
    expect(result).toBe('Unknown Boss');
  });

  it('returns fallback for trash fight (boss=0)', () => {
    const result = getBossDisplayName(0, 'Trash');
    expect(result).toBe('Trash');
  });
});
