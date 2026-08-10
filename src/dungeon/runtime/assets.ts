import type { DungeonAssetProvider, DungeonAssetResult } from './assetsTypes';

export interface AssetManifestEntry {
  type: 'image' | 'tiles';
  url?: string;
  urlTemplate?: string;
  tileSize?: number;
  origin?: readonly [x: number, y: number];
}

export interface AssetManifest {
  provider: 'remote-dev' | 'oss';
  assets: Record<string, string | AssetManifestEntry>;
}

export interface AssetProviderOptions {
  provider: AssetManifest['provider'] | 'placeholder';
  manifest?: AssetManifest;
  mode: 'development' | 'production' | 'preview' | 'test';
  hostname: string;
}

const placeholder = (assetKey: string, reason: string): DungeonAssetResult => ({
  kind: 'placeholder',
  assetKey,
  reason,
});

export function createDungeonAssetProvider(options: AssetProviderOptions): DungeonAssetProvider {
  if (options.manifest && options.manifest.provider !== options.provider) {
    throw new Error(
      'DUNGEON_ASSET_PROVIDER_MISMATCH: manifest provider does not match runtime provider.',
    );
  }
  if (
    options.provider === 'remote-dev' &&
    (options.mode !== 'development' ||
      !['localhost', '127.0.0.1', '::1'].includes(options.hostname))
  ) {
    throw new Error(
      'DUNGEON_REMOTE_DEV_ASSETS_FORBIDDEN: remote-dev assets require localhost development mode.',
    );
  }

  if (options.provider === 'remote-dev' && !options.manifest) {
    throw new Error(
      'DUNGEON_REMOTE_DEV_MANIFEST_MISSING: remote-dev requires a local asset manifest.',
    );
  }

  return {
    getFloorMap: (assetKey) => resolveAsset(assetKey, options),
    getDungeonArtwork: (assetKey) => resolveAsset(assetKey, options),
  };
}

function resolveAsset(assetKey: string, options: AssetProviderOptions): DungeonAssetResult {
  if (options.provider === 'placeholder') {
    return placeholder(assetKey, '生产资源尚未配置。');
  }
  const url = options.manifest?.assets[assetKey];
  if (typeof url === 'string') return { kind: 'remote', assetKey, url };
  if (!url) return placeholder(assetKey, 'assetKey 不在当前 manifest 中。');
  if (url.type === 'image' && url.url) return { kind: 'remote', assetKey, url: url.url };
  const tileSize = url.tileSize;
  if (
    url.type === 'tiles' &&
    url.urlTemplate?.includes('{x}') &&
    url.urlTemplate.includes('{y}') &&
    tileSize !== undefined &&
    Number.isInteger(tileSize) &&
    tileSize > 0 &&
    url.origin
  ) {
    return {
      kind: 'remote-tiles',
      assetKey,
      urlTemplate: url.urlTemplate,
      tileSize,
      origin: url.origin,
    };
  }
  return placeholder(assetKey, 'asset manifest 条目缺少可用的图片或瓦片配置。');
}

export function createAssetProviderFromEnv(
  env: Record<string, string | undefined>,
  hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname,
): DungeonAssetProvider {
  const provider = env.VITE_DUNGEON_ASSET_PROVIDER ?? 'placeholder';
  const mode =
    env.MODE === 'production' ? 'production' : env.MODE === 'preview' ? 'preview' : 'development';
  const manifestJson = env.VITE_DUNGEON_DEV_ASSET_MANIFEST;
  let manifest: AssetManifest | undefined;
  if (manifestJson) {
    try {
      manifest = JSON.parse(manifestJson) as AssetManifest;
    } catch {
      throw new Error(
        'DUNGEON_REMOTE_DEV_MANIFEST_INVALID: local asset manifest is not valid JSON.',
      );
    }
  }
  return createDungeonAssetProvider({
    provider: provider === 'remote-dev' || provider === 'oss' ? provider : 'placeholder',
    manifest,
    mode,
    hostname,
  });
}
