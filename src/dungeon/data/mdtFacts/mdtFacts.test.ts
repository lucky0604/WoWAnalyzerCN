import { describe, expect, it } from 'vitest';

import { getDungeonCatalogEntry, season2DungeonCatalog } from '../season2Catalog';
import {
  checkSourceUse,
  dungeonSourceRegistry,
} from '../../runtime/sourceRegistry';
import { validateFactSnapshot, type FactSnapshot } from '../../runtime/factSnapshot';

import altarOfFangsRef from './altar-of-fangs.json';
import denOfNalorakkRef from './den-of-nalorakk.json';
import kingsRestRef from './kings-rest.json';
import murderRowRef from './murder-row.json';
import rubyLifePoolsRef from './ruby-life-pools.json';
import templeOfSethralissRef from './temple-of-sethraliss.json';
import theBlindingValeRef from './the-blinding-vale.json';
import voidscarArenaRef from './voidscar-arena.json';
import altarOfFangsSnap from '../facts/altar-of-fangs.s2.json';
import denOfNalorakkSnap from '../facts/den-of-nalorakk.s2.json';
import kingsRestSnap from '../facts/kings-rest.s2.json';
import murderRowSnap from '../facts/murder-row.s2.json';
import rubyLifePoolsSnap from '../facts/ruby-life-pools.s2.json';
import templeOfSethralissSnap from '../facts/temple-of-sethraliss.s2.json';
import theBlindingValeSnap from '../facts/the-blinding-vale.s2.json';
import voidscarArenaSnap from '../facts/voidscar-arena.s2.json';

// 坐标快照与 MDT 快照来自不同上游修订，文件键不总是一致（rlp 无 .s2 后缀，
// 其余按 threechest 物理 key 命名）。别名只允许出现在这张表里。
import fangCoords from '../coordinates/fang.s2.json';
import krCoords from '../coordinates/kr.s2.json';
import murdCoords from '../coordinates/murd.s2.json';
import naloCoords from '../coordinates/nalo.s2.json';
import rlpCoords from '../coordinates/rlp.json';
import tosCoords from '../coordinates/tos.s2.json';
import valeCoords from '../coordinates/vale.s2.json';
import voidCoords from '../coordinates/void.s2.json';

/**
 * 坐标快照（PTR 期上游修订）里存在、但当前 MDT 事实快照中已没有的 NPC。
 * 这些 spawn 在地图上没有事实可绑定；出现新的差集必须先更新本表并说明原因。
 */
const COORDINATE_ONLY_NPC_IDS: Record<string, ReadonlySet<number>> = {
  'den-of-nalorakk': new Set([252041, 241805, 246591]),
  'kings-rest': new Set([138250, 273050]),
};

interface MdtReferenceFixture {
  version: number;
  slug: string;
  sourceKey: string;
  nameZhCoverage: string;
  totalEnemyForcesPoints: number;
  enemies: Array<{
    npcId: number;
    enemyIndex: number;
    name: { enUS: string; zhCN?: string };
    count: number;
    isBoss: boolean;
    characteristics: string[];
    spells: Array<{ id: number; attributes: string[] }>;
  }>;
}

interface DungeonCase {
  slug: string;
  sourceKey: string;
  reference: MdtReferenceFixture;
  snapshot: FactSnapshot;
  coordinates: { spawns: Array<{ sourceEnemyId: number }> };
}

const cases: DungeonCase[] = [
  {
    slug: 'altar-of-fangs',
    sourceKey: 'aof',
    reference: altarOfFangsRef as MdtReferenceFixture,
    snapshot: altarOfFangsSnap as unknown as FactSnapshot,
    coordinates: fangCoords,
  },
  {
    slug: 'den-of-nalorakk',
    sourceKey: 'dnl',
    reference: denOfNalorakkRef as MdtReferenceFixture,
    snapshot: denOfNalorakkSnap as unknown as FactSnapshot,
    coordinates: naloCoords,
  },
  {
    slug: 'kings-rest',
    sourceKey: 'kr',
    reference: kingsRestRef as MdtReferenceFixture,
    snapshot: kingsRestSnap as unknown as FactSnapshot,
    coordinates: krCoords,
  },
  {
    slug: 'murder-row',
    sourceKey: 'mdr',
    reference: murderRowRef as MdtReferenceFixture,
    snapshot: murderRowSnap as unknown as FactSnapshot,
    coordinates: murdCoords,
  },
  {
    slug: 'ruby-life-pools',
    sourceKey: 'rlp',
    reference: rubyLifePoolsRef as MdtReferenceFixture,
    snapshot: rubyLifePoolsSnap as unknown as FactSnapshot,
    coordinates: rlpCoords,
  },
  {
    slug: 'temple-of-sethraliss',
    sourceKey: 'tst',
    reference: templeOfSethralissRef as MdtReferenceFixture,
    snapshot: templeOfSethralissSnap as unknown as FactSnapshot,
    coordinates: tosCoords,
  },
  {
    slug: 'the-blinding-vale',
    sourceKey: 'bvl',
    reference: theBlindingValeRef as MdtReferenceFixture,
    snapshot: theBlindingValeSnap as unknown as FactSnapshot,
    coordinates: valeCoords,
  },
  {
    slug: 'voidscar-arena',
    sourceKey: 'vsa',
    reference: voidscarArenaRef as MdtReferenceFixture,
    snapshot: voidscarArenaSnap as unknown as FactSnapshot,
    coordinates: voidCoords,
  },
];

describe('mdt facts reference layer', () => {
  it('covers every Midnight S2 catalog entry exactly once', () => {
    const s2Entries = season2DungeonCatalog.filter((entry) => entry.season === 'midnight-s2');
    expect(s2Entries.map((entry) => entry.id).sort()).toEqual(
      cases.map((item) => item.slug).sort(),
    );
    expect(s2Entries.length).toBe(8);
  });

  it.each(cases)('$slug: reference identity and bilingual names', ({ slug, sourceKey, reference }) => {
    const entry = getDungeonCatalogEntry(slug);
    expect(entry, `catalog entry ${slug}`).toBeDefined();
    expect(reference.version).toBe(1);
    expect(reference.slug).toBe(slug);
    expect(reference.sourceKey).toBe(sourceKey);
    // bvl 的 MDT 上游无中文译文（README 记录在案），整本回退英文。
    expect(reference.nameZhCoverage).toBe(slug === 'the-blinding-vale' ? 'none' : 'full');
    const keys = new Set<number>();
    reference.enemies.forEach((enemy) => {
      expect(enemy.npcId).toBeGreaterThan(0);
      expect(keys.has(enemy.npcId)).toBe(false);
      keys.add(enemy.npcId);
      expect(enemy.name.enUS.trim()).toBeTruthy();
    });
  });

  it.each(cases)(
    '$slug: every fact enemy exists in the committed coordinate snapshot',
    ({ slug, reference, coordinates }) => {
      const coordEnemyIds = new Set(coordinates.spawns.map((spawn) => spawn.sourceEnemyId));
      const allowlist = COORDINATE_ONLY_NPC_IDS[slug] ?? new Set<number>();
      const missing = reference.enemies.filter((enemy) => !coordEnemyIds.has(enemy.npcId));
      expect(
        missing.map((enemy) => enemy.npcId),
        `MDT 敌人未出现在坐标快照中：${slug}`,
      ).toEqual([]);
      const extra = [...coordEnemyIds].filter((npcId) =>
        reference.enemies.every((enemy) => enemy.npcId !== npcId),
      );
      const unexpectedExtra = extra.filter((npcId) => !allowlist.has(npcId));
      expect(
        unexpectedExtra,
        `坐标快照出现了未登记的坐标-only NPC：${slug}`,
      ).toEqual([]);
    },
  );

  it.each(cases)('$slug: forces sum consistency', ({ reference, snapshot }) => {
    const derived = reference.enemies.reduce((total, enemy) => total + enemy.count, 0);
    expect(reference.totalEnemyForcesPoints).toBe(derived);
    expect(snapshot.totalEnemyForcesPoints).toBe(derived);
    expect(snapshot.enemies.map((enemy) => enemy.forcesPoints)).not.toContain(undefined);
    expect(snapshot.enemies).toHaveLength(reference.enemies.length);
  });

  it.each(cases)(
    '$slug: ability grouping and interruptible flags derive from reference attributes',
    ({ reference, snapshot }) => {
      const keyByNpcId = new Map(
        snapshot.enemies.map((enemy) => [enemy.npcId, enemy.enemyKey]),
      );
      const expected = new Map<number, { casters: string[]; interruptible: boolean }>();
      reference.enemies.forEach((enemy) => {
        const enemyKey = keyByNpcId.get(enemy.npcId)!;
        enemy.spells.forEach((spell) => {
          const group = expected.get(spell.id) ?? { casters: [], interruptible: false };
          if (!group.casters.includes(enemyKey)) group.casters.push(enemyKey);
          if (spell.attributes.includes('interruptible')) group.interruptible = true;
          expected.set(spell.id, group);
        });
      });
      expect(snapshot.abilities.map((ability) => ability.spellId)).toEqual(
        [...expected.keys()].sort((left, right) => left - right),
      );
      snapshot.abilities.forEach((ability) => {
        const group = expected.get(ability.spellId)!;
        expect(ability.casterEnemyKeys).toEqual(group.casters);
        if (group.interruptible) {
          expect(ability.interruptible).toBe(true);
        }
      });
    },
  );

  it.each(cases)(
    '$slug: enemyKey disambiguation keeps unique names readable',
    ({ reference, snapshot }) => {
      const nameCounts = new Map<string, number>();
      reference.enemies.forEach((enemy) => {
        nameCounts.set(enemy.name.enUS, (nameCounts.get(enemy.name.enUS) ?? 0) + 1);
      });
      snapshot.enemies.forEach((enemy) => {
        const suffixed = enemy.enemyKey.match(/^(.*) \[(\d+)\]$/);
        if (suffixed) {
          // 重名敌人必须带 [npcId] 后缀，且后缀要能对回参考层的同名敌人。
          expect(
                reference.enemies.some(
                  (candidate) =>
                    candidate.name.enUS === suffixed[1] && candidate.npcId === Number(suffixed[2]),
                ),
            `${enemy.enemyKey} 无法对回参考层`,
          ).toBe(true);
        } else {
          expect(
            nameCounts.get(enemy.enemyKey) ?? 0,
            `${enemy.enemyKey} 不带后缀但名字不唯一`,
          ).toBe(1);
        }
      });
      const keys = snapshot.enemies.map((enemy) => enemy.enemyKey);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );
});

describe('mdt fact snapshots integrity', () => {
  it.each(cases)(
    '$slug: committed snapshot passes independent canonical digest validation',
    async ({ slug, snapshot }) => {
      const entry = getDungeonCatalogEntry(slug)!;
      const validation = await validateFactSnapshot(snapshot, { entry });
      expect(validation.errors).toEqual([]);
      expect(validation.ok).toBe(true);
    },
  );

  it.each(cases)('$slug: mdt source batch approves commit-derived-data', ({ slug }) => {
    const use = checkSourceUse(
      dungeonSourceRegistry,
      'mdt',
      `mdt-facts-s2-${slug}-2026-08-26`,
      'commit-derived-data',
    );
    expect(use.ok, use.reason).toBe(true);
  });
});
