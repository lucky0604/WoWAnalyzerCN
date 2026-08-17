import { fireEvent, render, screen } from '@testing-library/react';

import type { AbilityKnowledge, Enemy, Floor, Spawn } from '../schema/types';
import { DungeonMap } from './DungeonMap';

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
      `https://threechest.io/npc_portraits/${enemies[0]!.npcId}.png`,
    );
    // 未收录 npcId 的敌人回退为圆点，不渲染头像。
    expect(container.querySelector('[aria-label="spawn-2 位置"] circle')).not.toBeNull();
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
});
