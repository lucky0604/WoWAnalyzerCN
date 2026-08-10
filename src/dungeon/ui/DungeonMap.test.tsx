import { fireEvent, render, screen } from '@testing-library/react';

import type { Floor, Spawn } from '../schema/types';
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
});
