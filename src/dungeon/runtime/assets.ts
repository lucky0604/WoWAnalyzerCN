import type { DungeonAssetProvider, DungeonAssetResult } from './assetsTypes';
// 生产/preview 的默认资源来源。由 scripts/dungeons/generate-oss-manifest.ts
// 从本地镜像校验后生成；物理 key 别名只存在于那个脚本里。
import committedOssManifestJson from '../data/assets/oss.manifest.json';

export interface AssetManifestEntry {
  type: 'image' | 'tiles';
  url?: string;
  urlTemplate?: string;
  tileSize?: number;
  origin?: readonly [x: number, y: number];
  flipY?: boolean;
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

export function isAssetManifest(value: unknown): value is AssetManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AssetManifest>;
  return (
    (candidate.provider === 'remote-dev' || candidate.provider === 'oss') &&
    !!candidate.assets &&
    typeof candidate.assets === 'object' &&
    !Array.isArray(candidate.assets)
  );
}

let committedOssManifest: AssetManifest | undefined;

/**
 * 已提交的生产 OSS manifest。加载时做一次形状校验，生成器或手改破坏形状时
 * 在 provider 创建处显式失败，而不是渲染出坏 URL。
 */
function getCommittedOssManifest(): AssetManifest {
  if (!committedOssManifest) {
    if (!isAssetManifest(committedOssManifestJson) || committedOssManifestJson.provider !== 'oss') {
      throw new Error(
        'DUNGEON_OSS_MANIFEST_INVALID: committed asset manifest has an invalid shape.',
      );
    }
    committedOssManifest = committedOssManifestJson;
  }
  return committedOssManifest;
}

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

  // 同一 assetKey 解析结果按引用缓存：在路由地图/封面上 props 相等性
  // 保持稳定，避免父组件每次渲染都让 DungeonMap 重建 tiles / memo。
  const byKey = new Map<string, DungeonAssetResult>();

  return {
    getFloorMap: (assetKey) => {
      let resolved = byKey.get(assetKey);
      if (!resolved) {
        resolved = resolveAsset(assetKey, options);
        byKey.set(assetKey, resolved);
      }
      return resolved;
    },
    getDungeonArtwork: (assetKey) => {
      let resolved = byKey.get(assetKey);
      if (!resolved) {
        resolved = resolveAsset(assetKey, options);
        byKey.set(assetKey, resolved);
      }
      return resolved;
    },
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
      ...(url.flipY === true ? { flipY: true } : {}),
    };
  }
  return placeholder(assetKey, 'asset manifest 条目缺少可用的图片或瓦片配置。');
}

export function createAssetProviderFromEnv(
  env: Record<string, string | undefined>,
  hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname,
): DungeonAssetProvider {
  const explicitProvider = env.VITE_DUNGEON_ASSET_PROVIDER;
  const mode =
    env.MODE === 'production' ? 'production' : env.MODE === 'preview' ? 'preview' : 'development';
  // 显式配置优先；未配置时生产/preview 默认走已提交的 OSS manifest，
  // 开发/测试保持 placeholder（本地开发用 remote-dev + 本地 manifest）。
  const provider: AssetManifest['provider'] | 'placeholder' =
    explicitProvider === 'remote-dev' ||
    explicitProvider === 'oss' ||
    explicitProvider === 'placeholder'
      ? explicitProvider
      : mode === 'production' || mode === 'preview'
        ? 'oss'
        : 'placeholder';
  const manifestJson = env.VITE_DUNGEON_DEV_ASSET_MANIFEST;
  let manifest: AssetManifest | undefined;
  if (manifestJson) {
    try {
      const parsed: unknown = JSON.parse(manifestJson);
      if (!isAssetManifest(parsed)) throw new Error('invalid manifest shape');
      manifest = parsed;
    } catch {
      throw new Error(
        'DUNGEON_REMOTE_DEV_MANIFEST_INVALID: local asset manifest is not valid JSON.',
      );
    }
  }
  return createDungeonAssetProvider({
    provider,
    ...(provider === 'oss' && !manifest
      ? { manifest: getCommittedOssManifest() }
      : manifest
        ? { manifest }
        : {}),
    mode,
    hostname,
  });
}
