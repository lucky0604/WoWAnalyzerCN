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

  it('rejects a manifest with an invalid top-level shape', () => {
    expect(() =>
      createAssetProviderFromEnv(
        {
          MODE: 'development',
          VITE_DUNGEON_ASSET_PROVIDER: 'remote-dev',
          VITE_DUNGEON_DEV_ASSET_MANIFEST: JSON.stringify({ provider: 'remote-dev' }),
        },
        'localhost',
      ),
    ).toThrow('DUNGEON_REMOTE_DEV_MANIFEST_INVALID');
  });

  it('fails closed to a placeholder when an OSS manifest entry is malformed', () => {
    const provider = createDungeonAssetProvider({
      provider: 'oss',
      mode: 'production',
      hostname: 'example.com',
      // 条目既不是字符串 URL，也没有可用的 image/tiles 字段。
      manifest: {
        provider: 'oss',
        assets: {
          'bad-floor': { type: 'bogus' as never },
        },
      },
    });
    expect(provider.getFloorMap('bad-floor')).toMatchObject({
      kind: 'placeholder',
      assetKey: 'bad-floor',
    });
  });
});

describe('production OSS injection channel', () => {
  const OSS_ORIGIN = 'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com';

  it('defaults production and preview to the committed OSS manifest', () => {
    (['production', 'preview'] as const).forEach((mode) => {
      const provider = createAssetProviderFromEnv({ MODE: mode }, 'example.com');
      expect(provider.getFloorMap('midnight-s2:ruby-life-pools')).toEqual({
        kind: 'remote-tiles',
        assetKey: 'midnight-s2:ruby-life-pools',
        urlTemplate: `${OSS_ORIGIN}/maps/rlp/{x}_{y}.jpg`,
        tileSize: 64,
        origin: [0, 0],
        flipY: true,
      });
      expect(provider.getDungeonArtwork('midnight-s2:ruby-life-pools:artwork')).toEqual({
        kind: 'remote',
        assetKey: 'midnight-s2:ruby-life-pools:artwork',
        url: `${OSS_ORIGIN}/images/dungeons/df/rubylifepools.jpg`,
      });
    });
  });

  it('keeps development and test on placeholders unless configured', () => {
    (
      [
        [{ MODE: 'development' }, 'localhost'],
        [{}, 'example.com'],
      ] as Array<[Record<string, string>, string]>
    ).forEach(([env, hostname]) => {
      const provider = createAssetProviderFromEnv(env, hostname);
      expect(provider.getFloorMap('midnight-s2:ruby-life-pools')).toMatchObject({
        kind: 'placeholder',
      });
    });
  });

  it('honors an explicit placeholder override in production', () => {
    const provider = createAssetProviderFromEnv(
      { MODE: 'production', VITE_DUNGEON_ASSET_PROVIDER: 'placeholder' },
      'example.com',
    );
    expect(provider.getFloorMap('midnight-s2:ruby-life-pools')).toMatchObject({
      kind: 'placeholder',
    });
  });

  it('still rejects remote-dev providers outside localhost development', () => {
    expect(() =>
      createAssetProviderFromEnv(
        { MODE: 'production', VITE_DUNGEON_ASSET_PROVIDER: 'remote-dev' },
        'example.com',
      ),
    ).toThrow('DUNGEON_REMOTE_DEV_ASSETS_FORBIDDEN');
  });
});

describe('explicit oss provider from env', () => {
  const OSS_ORIGIN = 'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com';

  it('resolves the committed OSS manifest when the provider is explicitly oss', () => {
    // 显式 provider='oss' 不限于生产模式：开发机也可能直接走已提交 manifest。
    const provider = createAssetProviderFromEnv(
      { MODE: 'development', VITE_DUNGEON_ASSET_PROVIDER: 'oss' },
      'localhost',
    );
    expect(provider.getFloorMap('midnight-s2:ruby-life-pools')).toEqual({
      kind: 'remote-tiles',
      assetKey: 'midnight-s2:ruby-life-pools',
      urlTemplate: `${OSS_ORIGIN}/maps/rlp/{x}_{y}.jpg`,
      tileSize: 64,
      origin: [0, 0],
      flipY: true,
    });
  });

  it('prefers a local dev manifest over the committed OSS manifest', () => {
    const provider = createAssetProviderFromEnv(
      {
        MODE: 'production',
        VITE_DUNGEON_ASSET_PROVIDER: 'oss',
        VITE_DUNGEON_DEV_ASSET_MANIFEST: JSON.stringify({
          provider: 'oss',
          assets: { 'local-floor': 'https://local.test/floor.png' },
        }),
      },
      'example.com',
    );
    expect(provider.getFloorMap('local-floor')).toEqual({
      kind: 'remote',
      assetKey: 'local-floor',
      url: 'https://local.test/floor.png',
    });
    // 本地 manifest 生效时已提交 manifest 不再参与解析：生产 key 落占位。
    expect(provider.getFloorMap('midnight-s2:ruby-life-pools')).toMatchObject({
      kind: 'placeholder',
      assetKey: 'midnight-s2:ruby-life-pools',
    });
  });

  it('rejects a remote-dev local manifest injected into an explicit oss provider', () => {
    expect(() =>
      createAssetProviderFromEnv(
        {
          MODE: 'production',
          VITE_DUNGEON_ASSET_PROVIDER: 'oss',
          VITE_DUNGEON_DEV_ASSET_MANIFEST: JSON.stringify({
            provider: 'remote-dev',
            assets: {},
          }),
        },
        'example.com',
      ),
    ).toThrow('DUNGEON_ASSET_PROVIDER_MISMATCH');
  });

  it('reuses the same resolved object across repeated lookups', () => {
    // byKey 缓存保证同一 provider 的重复解析返回同一引用，
    // 父组件重渲染时 DungeonMap 的 tiles/memo 不会因对象身份变化而重建。
    const provider = createAssetProviderFromEnv(
      { MODE: 'development', VITE_DUNGEON_ASSET_PROVIDER: 'oss' },
      'localhost',
    );
    const floorA = provider.getFloorMap('midnight-s2:ruby-life-pools');
    const floorB = provider.getFloorMap('midnight-s2:ruby-life-pools');
    expect(floorB).toBe(floorA);
    const artworkA = provider.getDungeonArtwork('midnight-s2:ruby-life-pools:artwork');
    const artworkB = provider.getDungeonArtwork('midnight-s2:ruby-life-pools:artwork');
    expect(artworkB).toBe(artworkA);
  });
});
