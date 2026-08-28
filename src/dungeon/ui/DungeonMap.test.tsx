import { fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';

import type { AbilityKnowledge, Enemy, Floor, Spawn } from '../schema/types';
import { DungeonMap } from './DungeonMap';

// DungeonMap 的浮层徽标用 t() 取可见文案；测试态加载最小目录并激活，避免“未设 locale”。
i18n.load('en', { 'dungeon.map.interruptible': 'Interruptible' });
i18n.activate('en');

const floor: Floor = {
  id: 'floor-1',
  name: { zhCN: '测试楼层' },
  coordinateSpace: 'normalized-v1',
  bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
};

const spawns: Spawn[] = [
  {
    id: 'spawn-1',
    enemyId: 'enemy-1',
    floorId: floor.id,
    position: [20, 30],
    sourceId: 'source-1',
  },
  {
    id: 'spawn-2',
    enemyId: 'enemy-2',
    floorId: floor.id,
    position: [70, 60],
    sourceId: 'source-2',
  },
];

const enemy = (overrides: Partial<Enemy>): Enemy => ({
  id: overrides.id ?? 'enemy-1',
  name: overrides.name ?? { zhCN: '测试敌人' },
  forcesPoints: 100,
  isBoss: false,
  spawnIds: overrides.spawnIds ?? [],
  abilityIds: overrides.abilityIds ?? [],
  provenance: overrides.provenance ?? [],
  ...overrides,
});

const enemies: Enemy[] = [enemy({ id: 'enemy-1', npcId: 188252, name: { zhCN: '美莉杜莎' } })];
const abilities: AbilityKnowledge[] = [
  {
    id: 'ability-1',
    spellId: 372808,
    name: { zhCN: '寒冰碎片' },
    casterEnemyIds: ['enemy-1'],
    decisionCritical: true,
    severity: 'critical',
    action: { zhCN: '正面扇形，提前走位。' },
    consequence: { zhCN: '高额伤害。' },
    version: { season: 'midnight-s2', build: 'test', revision: 1, status: 'draft' },
    provenance: [],
  },
];

describe('DungeonMap', () => {
  it('keeps coordinates keyboard-accessible when the background is unavailable', () => {
    const onSpawnSelect = vi.fn();
    render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        onSpawnSelect={onSpawnSelect}
        selectedSpawnIds={[]}
        spawns={spawns}
      />,
    );

    expect(screen.getByText('地图背景未配置')).toBeInTheDocument();
    const spawn = screen.getByRole('button', { name: 'spawn-1 位置' });
    fireEvent.keyDown(spawn, { key: 'Enter' });
    expect(onSpawnSelect).toHaveBeenCalledWith('spawn-1');
  });

  it('falls back to the coordinate layer when the remote background image fails to load', () => {
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'remote', assetKey: 'map', url: 'https://example.test/aof.png' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={spawns}
      />,
    );
    // 远程图加载失败必须切换到坐标占位层，且不残留损坏的背景图。
    fireEvent.error(container.querySelector('.dungeon-map__background')!);
    expect(screen.getByText('地图背景加载失败')).toBeInTheDocument();
    expect(screen.getByText('远程资源不可用，仍可使用坐标层。')).toBeInTheDocument();
    expect(container.querySelector('.dungeon-map__background')).not.toBeInTheDocument();
  });

  it('uses an explicit focus window without changing spawn coordinates', () => {
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        hullSpawns={[spawns[0]!]}
        onSpawnSelect={vi.fn()}
        selectedSpawnIds={['spawn-1']}
        spawns={spawns}
        viewBounds={{ xMin: 10, xMax: 30, yMin: 20, yMax: 40 }}
      />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '6 16 28 28');
    expect(screen.getByRole('button', { name: 'spawn-1 位置' })).toBeInTheDocument();
  });

  it('renders patrol paths as a separate spatial layer', () => {
    const patrolSpawn = {
      ...spawns[0]!,
      patrol: { points: [[20, 30] as [number, number], [25, 35] as [number, number]] },
    };
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[patrolSpawn]}
      />,
    );
    expect(container.querySelector('.dungeon-map__patrol')).toHaveAttribute('d', 'M 20 30 L 25 35');
    expect(screen.getByText('— 巡逻路径')).toBeInTheDocument();
  });

  it('flips the visual Y axis for screen-space tile sources', () => {
    const { container } = render(
      <DungeonMap
        asset={{
          kind: 'remote-tiles',
          assetKey: 'map',
          urlTemplate: 'https://example.test/maps/{x}_{y}.jpg',
          tileSize: 64,
          origin: [0, 0],
          flipY: true,
        }}
        floor={{ ...floor, bounds: { xMin: 0, xMax: 128, yMin: -128, yMax: 0 } }}
        selectedSpawnIds={[]}
        spawns={[{ ...spawns[0]!, position: [20, -30] }]}
      />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '-4 -4 136 136');
    const images = Array.from(container.querySelectorAll('image'));
    expect(images).toHaveLength(4);
    expect(images.map((img) => img.getAttribute('href'))).toContain(
      'https://example.test/maps/0_0.jpg',
    );
    expect(container.querySelector('[aria-label="spawn-1 位置"] circle')).toHaveAttribute(
      'cy',
      '30',
    );
  });

  it('renders enemy portraits on the map when npc ids are resolved', () => {
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        enemies={enemies}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={spawns}
      />,
    );
    const spawnGroup = container.querySelector('[aria-label="spawn-1 位置"]');
    const portrait = spawnGroup?.querySelector('image.dungeon-map__portrait');
    expect(portrait).toHaveAttribute(
      'href',
      `https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com/npc_portraits/${enemies[0]!.npcId}.png`,
    );
    // 未收录 npcId 的敌人回退为圆点，不渲染头像。
    expect(container.querySelector('[aria-label="spawn-2 位置"] circle')).not.toBeNull();
  });

  it('resolves portraits from the reference spawn id when no enemies prop is given', () => {
    // 位置参考页只传坐标层：spawn.enemyId 的 `:source-enemy:<npcId>` 后缀
    // 就是坐标快照的 sourceEnemyId，标记应直接解析出头像。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'ref-spawn',
            enemyId: 'ruby-life-pools:source-enemy:188244',
            floorId: floor.id,
            position: [20, 30],
            sourceId: 'rlp:1-1',
          },
        ]}
      />,
    );
    const spawnGroup = container.querySelector('[aria-label="ref-spawn 位置"]');
    const portrait = spawnGroup?.querySelector('image.dungeon-map__portrait');
    expect(portrait).toHaveAttribute(
      'href',
      'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com/npc_portraits/188244.png',
    );
  });

  it('sizes coordinate-only markers from the mdtFacts visual shape when spawn.scale is absent', () => {
    // 位置参考页只传坐标层:spawn 无 scale、无 enemies 目录,体型应回退到 mdtFacts
    // 参考层的 NPC mob.scale 与 isBoss,而不是一律 5.5。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'ref-boss',
            enemyId: 'ruby-life-pools:source-enemy:188252',
            floorId: floor.id,
            position: [20, 30],
            sourceId: 'rlp:7-1',
          },
          {
            id: 'ref-channeler',
            enemyId: 'ruby-life-pools:source-enemy:198047',
            floorId: floor.id,
            position: [50, 40],
            sourceId: 'rlp:17-1',
          },
        ]}
      />,
    );
    const portraitWidth = (spawnId: string): number =>
      Number(
        container
          .querySelector(`[aria-label="${spawnId} 位置"] image.dungeon-map__portrait`)
          ?.getAttribute('width'),
      );
    // 188252(Melidrussa,isBoss) → 5.5 × mdtFacts scale 1 × Boss 放大 1.7。
    expect(portraitWidth('ref-boss')).toBeCloseTo(5.5 * 1.7, 2);
    // 198047(Tempest Channeler,scale 0.8) → 5.5 × 0.8,小体型图标。
    expect(portraitWidth('ref-channeler')).toBeCloseTo(5.5 * 0.8, 2);
  });

  it('shows a spell popover on hover and hides it on leave', () => {
    const { container } = render(
      <DungeonMap
        abilities={abilities}
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        enemies={enemies}
        floor={floor}
        onSpawnSelect={vi.fn()}
        selectedSpawnIds={[]}
        spawns={spawns}
      />,
    );
    const spawnGroup = container.querySelector('[aria-label="spawn-1 位置"]')!;
    expect(container.querySelector('.dungeon-map__popover')).toBeNull();

    fireEvent.mouseEnter(spawnGroup);
    expect(screen.getByText('美莉杜莎')).toBeInTheDocument();
    // spellId 372808 已审校,浮层优先显示中文名。
    expect(screen.getByText('寒冰碎片')).toBeInTheDocument();

    fireEvent.mouseLeave(spawnGroup);
    expect(container.querySelector('.dungeon-map__popover')).toBeNull();
  });

  it('keeps the popover open for a selected single spawn', () => {
    const { container } = render(
      <DungeonMap
        abilities={abilities}
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        enemies={enemies}
        floor={floor}
        onSpawnSelect={vi.fn()}
        selectedSpawnIds={['spawn-1']}
        spawns={spawns}
      />,
    );
    expect(container.querySelector('.dungeon-map__popover')).not.toBeNull();
    expect(screen.getByText('美莉杜莎')).toBeInTheDocument();
  });

  it('marks interruptible spells with a badge from the reference attributes', () => {
    // npcId 188252（ruby-life-pools）在 mdtFacts 参考层中首条技能带 interruptible。
    const { container } = render(
      <DungeonMap
        abilities={abilities}
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        enemies={[enemy({ id: 'enemy-1', npcId: 188252 })]}
        floor={floor}
        onSpawnSelect={vi.fn()}
        selectedSpawnIds={[]}
        spawns={[spawns[0]!]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector('[aria-label="spawn-1 位置"]')!);
    const badges = container.querySelectorAll(
      '.dungeon-map__popover .dungeon-map__spell-interrupt',
    );
    expect(badges.length).toBeGreaterThan(0);
  });

  it('titles reference spawns with the mdtFacts zhCN name when no enemies are given', () => {
    // 位置参考页无敌人目录：浮层标题应回退到 mdtFacts 的 zhCN 怪物名
    // （259445 = Rav'i，尖牙祭坛），而不是 "NPC 259445"。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'aof-priest',
            enemyId: 'altar-of-fangs:source-enemy:259445',
            floorId: floor.id,
            position: [20, 30],
            sourceId: 'aof:1-1',
          },
        ]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector('[aria-label="aof-priest 位置"]')!);
    expect(screen.getByText('拉维')).toBeInTheDocument();
  });

  it('shows zhCN spell descriptions for non-RLP dungeons from the offline snapshot', () => {
    // 非红玉副本此前只有英文名、无说明；现在 s2.zhTooltips 离线层兜底：
    // 270306 = Ritual Chieftain（仪式首领），技能 1306517“鲜血献祭”
    // （不在 RLP 金标准覆盖层里，说明含已填充数值）。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'aof-ritual',
            enemyId: 'altar-of-fangs:source-enemy:270306',
            floorId: floor.id,
            position: [20, 30],
            sourceId: 'aof:3-2',
          },
        ]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector('[aria-label="aof-ritual 位置"]')!);
    // 中文名来自快照的 SpellName 层（仪式首领有两个同名“鲜血献祭”技能）。
    expect(screen.getAllByText('鲜血献祭').length).toBeGreaterThan(0);
    const descs = container.querySelectorAll('.dungeon-map__popover-spell-desc');
    const texts = Array.from(descs).map((node) => node.textContent ?? '');
    expect(texts.some((text) => text.includes('物理伤害') && /\d+点/.test(text))).toBe(true);
  });

  it('prefers the spawn-level scale over the mdtFacts npc scale', () => {
    // 体型优先级（DungeonMap resolvedSpawns）：文档级 spawn.scale 优先于
    // mdtFacts 的 NPC mob.scale。198047 在 mdtFacts 里是 0.8，这里两侧同时给值，
    // spawn.scale=1.5 必须赢（5.5 × 1.5 = 8.25），而不是 5.5 × 0.8 = 4.4。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'scaled-spawn',
            enemyId: 'ruby-life-pools:source-enemy:198047',
            floorId: floor.id,
            position: [20, 30],
            scale: 1.5,
            sourceId: 'rlp:17-1',
          },
        ]}
      />,
    );
    const portrait = container.querySelector(
      '[aria-label="scaled-spawn 位置"] image.dungeon-map__portrait',
    );
    expect(portrait).toHaveAttribute('width', '8.25');
  });

  it('does not apply the boss multiplier when the enemy catalog says isBoss=false', () => {
    // Boss 判定优先级：enemies 目录的文档字段优先；mdtFacts 标记 188252 为
    // boss，但目录显式 isBoss=false 时不得放大 1.7（5.5 × mdtFacts scale 1 = 5.5）。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        enemies={[enemy({ id: 'enemy-1', npcId: 188252, isBoss: false })]}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[spawns[0]!]}
      />,
    );
    const portrait = container.querySelector(
      '[aria-label="spawn-1 位置"] image.dungeon-map__portrait',
    );
    expect(portrait).toHaveAttribute('width', '5.5');
  });

  it('does not mark non-interruptible spells in the popover', () => {
    // 198047（Tempest Channeler）技能书：392576 带 interruptible，
    // 1306366 等不带；同一浮层里非可打断技能不得渲染打断徽标。
    const { container } = render(
      <DungeonMap
        asset={{ kind: 'placeholder', assetKey: 'map', reason: 'test' }}
        floor={floor}
        selectedSpawnIds={[]}
        spawns={[
          {
            id: 'channeler-spawn',
            enemyId: 'ruby-life-pools:source-enemy:198047',
            floorId: floor.id,
            position: [20, 30],
            sourceId: 'rlp:17-1',
          },
        ]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector('[aria-label="channeler-spawn 位置"]')!);
    const interruptibleRow = container.querySelector(
      '.dungeon-map__popover li[title*="Spell 392576"]',
    );
    expect(interruptibleRow?.querySelector('.dungeon-map__spell-interrupt')).not.toBeNull();
    const plainRow = container.querySelector('.dungeon-map__popover li[title*="Spell 1306366"]');
    expect(plainRow).not.toBeNull();
    expect(plainRow?.querySelector('.dungeon-map__spell-interrupt')).toBeNull();
  });
});
