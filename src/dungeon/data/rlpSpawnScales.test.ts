import { describe, expect, it } from 'vitest';

import rlpCoordinateSnapshot from './coordinates/rlp.json';
import { RLP_SPAWN_SCALES, getSpawnScale } from './rlpSpawnScales';

describe('rlp spawn scales snapshot', () => {
  it('covers every coordinate snapshot spawn with a finite positive scale', () => {
    // 快照里 150 个 spawn 的 sourceId('rlp:1-1…')与本表主键一一对应,不能有缺口。
    const spawns = (rlpCoordinateSnapshot as unknown as {
      spawns: Array<{ sourceId: string }>;
    }).spawns;
    expect(spawns.length).toBe(150);
    const uncovered = spawns
      .map((spawn) => spawn.sourceId.replace('rlp:', ''))
      .filter((key) => !(key in RLP_SPAWN_SCALES));
    expect(uncovered).toEqual([]);
    const values = Object.values(RLP_SPAWN_SCALES);
    expect(values.length).toBe(150);
    expect(values.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
  });

  it('keeps larger elites and bosses above trash scale', () => {
    expect(getSpawnScale('1-1')).toBeGreaterThan(1.8); // Primal Juggernaut 精英
    expect(getSpawnScale('7-1')).toBeGreaterThan(1.5); // 美莉杜莎 Boss
    expect(getSpawnScale('5-1')).toBe(1); // 龙崽小怪
    expect(getSpawnScale('17-7')).toBeLessThan(1); // 雷云小体型
  });

  it('falls back to 1 for unknown source ids', () => {
    expect(getSpawnScale('999-99')).toBe(1);
    expect(getSpawnScale('')).toBe(1);
  });
});