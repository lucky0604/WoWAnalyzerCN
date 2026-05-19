import { describe, expect, it } from 'vitest';
import { getZoneCnName } from '../index';

describe('getZoneCnName', () => {
  it('returns CN name for Zone 46', () => {
    const result = getZoneCnName(46);
    expect(result).toBe('虚痕尖塔 / 梦境裂隙 / MQD');
  });

  it('returns CN name for Zone 47', () => {
    const result = getZoneCnName(47);
    expect(result).toBe('史诗钥石第 1 赛季');
  });

  it('returns null for unknown zone ID', () => {
    expect(getZoneCnName(999)).toBeNull();
  });
});
