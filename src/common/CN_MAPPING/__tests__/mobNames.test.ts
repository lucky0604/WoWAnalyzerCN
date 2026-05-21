import { describe, expect, it } from 'vitest';
import { getDungeonCnName, getMobCnName } from '../index';

describe('getDungeonCnName', () => {
  it('returns CN name for known dungeon slug', () => {
    expect(getDungeonCnName('magisters-terrace')).toBe('魔导师平台');
  });

  it('returns CN name for skyreach', () => {
    expect(getDungeonCnName('skyreach')).toBe('通天峰');
  });

  it('returns null for unknown dungeon slug', () => {
    expect(getDungeonCnName('nonexistent-dungeon')).toBeNull();
  });
});

describe('getMobCnName', () => {
  it('returns CN name for known mob', () => {
    expect(getMobCnName('Arcane Sentry')).toBe('奥术保卫者');
  });

  it('returns CN name for Melee → 普通攻击', () => {
    expect(getMobCnName('Melee')).toBe('普通攻击');
  });

  it('returns null for unknown mob', () => {
    expect(getMobCnName('Unknown Mob XYZ')).toBeNull();
  });
});
