import { describe, expect, it } from 'vitest';

import { createAssetProviderFromEnv, createDungeonAssetProvider } from './assets';

describe('Dungeon asset providers', () => {
  it('resolves remote development assets from a manifest', () => {
    const provider = createDungeonAssetProvider({
      provider: 'remote-dev',
      mode: 'development',
      hostname: 'localhost',
      manifest: { provider: 'remote-dev', assets: { 'floor-1': 'https://example.test/floor.png' } },
    });
    expect(provider.getFloorMap('floor-1')).toEqual({
      kind: 'remote',
      assetKey: 'floor-1',
      url: 'https://example.test/floor.png',
    });
  });

  it('rejects remote development assets outside localhost development', () => {
    expect(() =>
      createDungeonAssetProvider({
        provider: 'remote-dev',
        mode: 'production',
        hostname: 'example.com',
        manifest: { provider: 'remote-dev', assets: {} },
      }),
    ).toThrow('DUNGEON_REMOTE_DEV_ASSETS_FORBIDDEN');
  });

  it('returns a placeholder for missing production assets', () => {
    const provider = createDungeonAssetProvider({
      provider: 'placeholder',
      mode: 'production',
      hostname: 'example.com',
    });
    expect(provider.getFloorMap('missing')).toMatchObject({
      kind: 'placeholder',
      assetKey: 'missing',
    });
  });

  it('rejects a remote-dev manifest passed to an OSS provider', () => {
    expect(() =>
      createDungeonAssetProvider({
        provider: 'oss',
        mode: 'production',
        hostname: 'example.com',
        manifest: { provider: 'remote-dev', assets: { map: 'https://example.test/map.png' } },
      }),
    ).toThrow('DUNGEON_ASSET_PROVIDER_MISMATCH');
  });

  it('reads the local-only manifest from Vite env without exposing it by default', () => {
    const provider = createAssetProviderFromEnv(
      {
        MODE: 'development',
        VITE_DUNGEON_ASSET_PROVIDER: 'remote-dev',
        VITE_DUNGEON_DEV_ASSET_MANIFEST: JSON.stringify({
          provider: 'remote-dev',
          assets: { 'floor-1': 'https://example.test/floor.png' },
        }),
      },
      'localhost',
    );
    expect(provider.getFloorMap('floor-1')).toMatchObject({
      kind: 'remote',
      url: 'https://example.test/floor.png',
    });
  });

  it('resolves a configured tile template without embedding a host in code', () => {
    const provider = createDungeonAssetProvider({
      provider: 'remote-dev',
      mode: 'development',
      hostname: 'localhost',
      manifest: {
        provider: 'remote-dev',
        assets: {
          'magi-floor': {
            type: 'tiles',
            urlTemplate: 'https://example.test/maps/magi/{x}_{y}.jpg',
            tileSize: 64,
            origin: [0, 0],
          },
        },
      },
    });
    expect(provider.getFloorMap('magi-floor')).toEqual({
      kind: 'remote-tiles',
      assetKey: 'magi-floor',
      urlTemplate: 'https://example.test/maps/magi/{x}_{y}.jpg',
      tileSize: 64,
      origin: [0, 0],
    });
  });
});
