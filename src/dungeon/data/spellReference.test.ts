import { describe, expect, it } from 'vitest';

import {
  DUNGEON_REFERENCE_ASSET_ORIGIN,
  dungeonSpellIconUrl,
  getEnemyNameZh,
  getEnemyScale,
  getEnemySpellAttributes,
  getEnemySpellIds,
  getSpellFact,
  getSpellTooltipZh,
  isEnemyBoss,
  npcPortraitUrl,
} from './spellReference';

describe('spell reference layer (mdtFacts + grimoire dictionary)', () => {
  it('lists every enemy spell against the dictionary with a resolvable fact', () => {
    const ids = getEnemySpellIds(188252);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    const unresolvable = ids.filter((spellId) => !getSpellFact(spellId));
    expect(unresolvable).toEqual([]);
  });

  it('keeps the ruby-life-pools boss spellbooks intact (>=8 spells each, all resolvable)', () => {
    for (const npcId of [188252, 189232, 190485, 190484] as const) {
      const ids = getEnemySpellIds(npcId);
      expect(ids.length).toBeGreaterThanOrEqual(8);
      const unresolvable = ids.filter((spellId) => !getSpellFact(spellId));
      expect(unresolvable).toEqual([]);
    }
  });

  it('keeps every registered RLP enemy spellbook non-empty and dictionary-resolvable', () => {
    // 迁移自已删除的 rlpSpellReference.test.ts：每位已登记的 RLP 敌人（含
    // 小怪 188244 原始主宰）技能书非空，且每个 spellId 都能在 grimoire 字典解析。
    for (const npcId of [188244, 188252, 189232, 190485, 190484] as const) {
      const ids = getEnemySpellIds(npcId);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      const unresolvable = ids.filter((spellId) => !getSpellFact(spellId));
      expect(unresolvable).toEqual([]);
    }
  });

  it('returns an empty spell list for unknown or missing npc ids', () => {
    expect(getEnemySpellIds(undefined)).toEqual([]);
    expect(getEnemySpellIds(99999999)).toEqual([]);
  });

  it('carries per-enemy mdt attributes (interruptible etc.) by spell id', () => {
    const attributes = getEnemySpellAttributes(188252);
    const interruptibleSpellIds = getEnemySpellIds(188252).filter((spellId) =>
      attributes.get(spellId)?.includes('interruptible'),
    );
    expect(interruptibleSpellIds.length).toBeGreaterThan(0);
    expect(getEnemySpellAttributes(99999999)).toEqual(new Map());
  });

  it('carries the per-npc visual shape for map marker sizing', () => {
    // 189886 = Blazebound Firestorm（龙崽头目,1.8）;198047 = Tempest Channeler(0.8)。
    expect(getEnemyScale(189886)).toBe(1.8);
    expect(getEnemyScale(198047)).toBe(0.8);
    expect(getEnemyScale(188252)).toBe(1);
    // Boss 标记:RLP 四位首领都有,普通怪没有。
    for (const bossNpcId of [188252, 189232, 190485, 190484] as const) {
      expect(isEnemyBoss(bossNpcId)).toBe(true);
    }
    expect(isEnemyBoss(188244)).toBe(false);
    // 未收录的 npcId 与缺失时:scale 回 undefined,boss 回 false。
    expect(getEnemyScale(99999999)).toBeUndefined();
    expect(getEnemyScale(undefined)).toBeUndefined();
    expect(isEnemyBoss(99999999)).toBe(false);
    expect(isEnemyBoss(undefined)).toBe(false);
  });

  it('resolves spell facts (name + icon) from the grimoire s2 dictionary', () => {
    // 384933 = ruby-life-pools“裹冰巨兽”可打断技能;名字/图标由 grimoire DBC 快照提供。
    const fact = getSpellFact(384933);
    expect(fact?.name).toBeTruthy();
    expect(fact?.icon).toBeTruthy();
    // 未知 spellId 与登记缺失的 1300666 都返回 undefined,不抛出。
    expect(getSpellFact(99999999)).toBeUndefined();
    expect(getSpellFact(1300666)).toBeUndefined();
    expect(getSpellFact(undefined)).toBeUndefined();
  });

  it('carries the mdtFacts zhCN enemy names for reference popover titles', () => {
    // 188244 = Primal Juggernaut（RLP）；259445 = Rav'i（altar-of-fangs）。
    expect(getEnemyNameZh(188244)).toBe('原始主宰');
    expect(getEnemyNameZh(259445)).toBe('拉维');
    expect(getEnemyNameZh(99999999)).toBeUndefined();
    expect(getEnemyNameZh(undefined)).toBeUndefined();
  });

  it('resolves zhCN spell names and descriptions from the s2 tooltip snapshot', () => {
    // 1306517 = 仪式首领“鲜血献祭”（s2.zhTooltips.json，数值已填充）。
    const tooltip = getSpellTooltipZh(1306517);
    expect(tooltip?.name).toBe('鲜血献祭');
    expect(tooltip?.desc).toContain('物理伤害');
    expect(tooltip?.desc).toMatch(/\d+点/);
    // 未收录与缺失入参返回 undefined。
    expect(getSpellTooltipZh(99999999)).toBeUndefined();
    expect(getSpellTooltipZh(undefined)).toBeUndefined();
  });

  it('keeps npcId -> portrait URLs behind the swappable asset origin', () => {
    expect(DUNGEON_REFERENCE_ASSET_ORIGIN).toBe(
      'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com',
    );
    expect(npcPortraitUrl(188252)).toBe(
      `${DUNGEON_REFERENCE_ASSET_ORIGIN}/npc_portraits/188252.png`,
    );
  });

  it('uses the rpglogs ability CDN for spell icons by Blizzard icon name', () => {
    expect(dungeonSpellIconUrl('spell_frost_icebolt')).toBe(
      'https://assets.rpglogs.com/img/warcraft/abilities/spell_frost_icebolt.jpg',
    );
  });
});
