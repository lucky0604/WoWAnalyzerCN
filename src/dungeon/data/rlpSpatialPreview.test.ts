import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const snapshotId = 'threechest-coordinate-snapshot-2026-08-12-rlp-s2';

describe('RLP spatial preview binding guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./coordinates/rlp.json');
    vi.doUnmock('./coordinates/rlp.bindings.json');
    vi.resetModules();
  });

  it('fails closed when a hand-maintained binding array has the wrong shape', async () => {
    vi.doMock('./coordinates/rlp.bindings.json', () => ({
      default: {
        version: 1,
        dungeonId: 'ruby-life-pools',
        snapshotId,
        sourceFloorId: 'default',
        previewFloorId: 'rlp-source-plane',
        enemyBindings: [{}],
        situationAnchors: [{}],
      },
    }));

    const { rubyLifePoolsSpatialPreview } = await import('./rlpSpatialPreview');
    expect(rubyLifePoolsSpatialPreview.spawns).toHaveLength(0);
    expect(rubyLifePoolsSpatialPreview.spatialStatus).toBe('pending');
  });

  it('fails closed when a coordinate spawn loses its required position shape', async () => {
    vi.doMock('./coordinates/rlp.json', () => ({
      default: { snapshotId, spawns: [{}] },
    }));

    const { rubyLifePoolsSpatialPreview } = await import('./rlpSpatialPreview');
    expect(rubyLifePoolsSpatialPreview.spawns).toHaveLength(0);
  });
});
