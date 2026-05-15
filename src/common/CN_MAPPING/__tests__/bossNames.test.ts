import { describe, expect, it } from 'vitest';
import { getBossCnName } from '../index';

describe('getBossCnName', () => {
  it('returns CN name for known boss ID (Zone 46 - Imperator Averzian)', () => {
    expect(getBossCnName(3176)).toBe('元首阿福扎恩');
  });

  it('returns CN name for known boss ID (Zone 47 - Magisters Terrace)', () => {
    expect(getBossCnName(12811)).toBe('魔导师平台');
  });

  it('returns CN name for Throne of Thunder classic boss', () => {
    expect(getBossCnName(51579)).toBe('雷神');
  });

  it('returns CN name for Midnight boss', () => {
    expect(getBossCnName(3182)).toBe('贝洛朗，奥的子嗣');
  });

  it('returns CN name for dungeon encounter', () => {
    expect(getBossCnName(61209)).toBe('通天峰');
  });

  it('returns null for unknown boss ID', () => {
    expect(getBossCnName(99999)).toBeNull();
  });
});
