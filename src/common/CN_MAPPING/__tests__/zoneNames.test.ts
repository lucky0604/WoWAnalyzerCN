import { describe, expect, it } from 'vitest';
import { getZoneCnName } from '../index';

describe('getZoneCnName', () => {
  it('returns CN name for Zone 46', () => {
    const result = getZoneCnName(46);
    expect(result).toBeTruthy();
  });

  it('returns CN name for Zone 47', () => {
    const result = getZoneCnName(47);
    expect(result).toBeTruthy();
  });

  it('returns null for unknown zone ID', () => {
    expect(getZoneCnName(999)).toBeNull();
  });
});
