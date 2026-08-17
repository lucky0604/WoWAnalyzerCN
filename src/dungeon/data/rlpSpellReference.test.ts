import { describe, expect, it } from 'vitest';

import type { Enemy } from '../schema/types';
import {
  DUNGEON_REFERENCE_ASSET_ORIGIN,
  RLP_ENEMY_SPELL_IDS,
  RLP_SPELL_FACTS,
  getEnemySpellIds,
  npcPortraitUrl,
} from './rlpSpellReference';

describe('rlp spell reference snapshot', () => {
  it('binds every enemy spell id to a resolvable fact', () => {
    const resolvable = getEnemySpellIds(188252).every((spellId) => RLP_SPELL_FACTS[spellId]);
    expect(resolvable).toBe(true);
  });

  it('lists a complete boss spellbook without rewriting authored content', () => {
    // 三个 Boss 的完整技能清单直接来自 threechest rlp_mdt 快照;
    // 数字本身来自外部数据,这里用覆盖断言锁定"不为空且每个可解析"。
    for (const npcId of [188252, 189232, 190485, 190484] as const) {
      const ids = getEnemySpellIds(npcId);
      expect(ids.length).toBeGreaterThanOrEqual(8);
      const unresolvable = ids.filter((spellId) => !RLP_SPELL_FACTS[spellId]);
      expect(unresolvable).toEqual([]);
    }
  });

  it('returns an empty spell list for unknown or missing npc ids', () => {
    expect(getEnemySpellIds(undefined)).toEqual([]);
    expect(getEnemySpellIds(99999999)).toEqual([]);
  });

  it('keeps npcId -> portrait URLs behind the swappable asset origin', () => {
    expect(npcPortraitUrl(188252)).toBe(
      `${DUNGEON_REFERENCE_ASSET_ORIGIN}/npc_portraits/188252.png`,
    );
  });

  it('covers every RLP authored enemy that has an npc id snapshot', () => {
    // 快照有没有把 phase1 已经登记的 RLP 敌人都纳入技能参考。
    const snapshot = new Set(Object.keys(RLP_ENEMY_SPELL_IDS).map(Number));
    const phase1Enemies = (
      [
        { id: 'rlp-primal-juggernaut', npcId: 188244 },
        { id: 'rlp-melidrussa', npcId: 188252 },
        { id: 'rlp-kokia', npcId: 189232 },
      ] as Pick<Enemy, 'id' | 'npcId'>[]
    ).filter((enemy) => enemy.npcId !== undefined);
    const missing = phase1Enemies.filter((enemy) => !snapshot.has(enemy.npcId!));
    expect(missing).toEqual([]);
  });
});