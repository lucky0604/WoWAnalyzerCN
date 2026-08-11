import { describe, expect, it } from 'vitest';

import { rubyLifePoolsSpatialPreview } from '../data/rlpSpatialPreview';
import { getRouteStepAnchorSpawnIds } from './resolve';

describe('route spatial learning anchors', () => {
  it('keeps RLP route floors on the source plane while full pull composition is pending', () => {
    const route = rubyLifePoolsSpatialPreview.routes[0]!;
    expect(
      route.steps.every((step) =>
        step.type === 'transition'
          ? step.fromFloorId === 'rlp-source-plane' && step.toFloorId === 'rlp-source-plane'
          : step.floorId === 'rlp-source-plane',
      ),
    ).toBe(true);
    expect(getRouteStepAnchorSpawnIds(rubyLifePoolsSpatialPreview, route.steps[0]!)).toEqual([
      'spawn-1',
      'spawn-2',
      'spawn-20',
      'spawn-21',
      'spawn-22',
      'spawn-23',
    ]);
  });

  it('does not invent anchors for a transition step', () => {
    const route = rubyLifePoolsSpatialPreview.routes[0]!;
    expect(getRouteStepAnchorSpawnIds(rubyLifePoolsSpatialPreview, route.steps[1]!)).toEqual([]);
  });
});
