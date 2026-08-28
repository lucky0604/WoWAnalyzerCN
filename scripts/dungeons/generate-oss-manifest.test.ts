import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, tmpdir as _tmpdir } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { season2DungeonCatalog } from '../../src/dungeon/data/season2Catalog';
import committedManifestJson from '../../src/dungeon/data/assets/oss.manifest.json';
import { getCoordinateReference } from '../../src/dungeon/runtime/coordinates';
import type { AssetManifest } from '../../src/dungeon/runtime/assets';
import { getMapTiles } from '../../src/dungeon/runtime/map';

import { runGenerate } from './generate-oss-manifest';

const committedManifest = committedManifestJson as AssetManifest;

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** 与生成器同一语义：flipY 渲染端先把 bounds 翻到屏幕空间（y' = -y）再取瓦片行列。 */
function toScreenSpace(bounds: { xMin: number; xMax: number; yMin: number; yMax: number }): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  return { xMin: bounds.xMin, xMax: bounds.xMax, yMin: -bounds.yMax, yMax: -bounds.yMin };
}

/**
 * 程序化本地镜像 fixture：物理目录名与封面路径从已提交 manifest 反解，
 * 期望瓦片集合用与渲染端同一套 getMapTiles 数学计算，全部写成空文件。
 * 这样测试不依赖 ../../rpglogs/wcl-mp-client/downloaded 真实镜像。
 */
async function writeMirrorFixture(root: string): Promise<void> {
  for (const entry of season2DungeonCatalog.filter((item) => item.season === 'midnight-s2')) {
    const tilesEntry = committedManifest.assets[entry.mapAssetKey];
    if (!tilesEntry || typeof tilesEntry === 'string' || tilesEntry.type !== 'tiles') {
      throw new Error(`fixture: committed manifest lacks tiles for ${entry.mapAssetKey}`);
    }
    const tileDirectory = /maps\/(.+)\/\{x\}_\{y\}\.jpg$/.exec(tilesEntry.urlTemplate ?? '')?.[1];
    if (!tileDirectory) {
      throw new Error(`fixture: cannot derive tile directory for ${entry.id}`);
    }
    const artworkEntry = committedManifest.assets[`${entry.mapAssetKey}:artwork`];
    if (!artworkEntry || typeof artworkEntry === 'string' || artworkEntry.type !== 'image') {
      throw new Error(`fixture: committed manifest lacks artwork for ${entry.mapAssetKey}`);
    }
    const coverPath = /images\/dungeons\/(.+)$/.exec(artworkEntry.url ?? '')?.[1];
    if (!coverPath) {
      throw new Error(`fixture: cannot derive cover path for ${entry.id}`);
    }

    const coordinateReference = getCoordinateReference(entry);
    const tiles = getMapTiles(toScreenSpace(coordinateReference.floor.bounds), {
      kind: 'remote-tiles' as const,
      assetKey: entry.mapAssetKey,
      urlTemplate: tilesEntry.urlTemplate ?? '',
      tileSize: tilesEntry.tileSize ?? 64,
      origin: tilesEntry.origin ?? [0, 0],
      flipY: true,
    });
    const tileDirectoryPath = join(root, 'maps', tileDirectory);
    await mkdir(tileDirectoryPath, { recursive: true });
    for (const tile of tiles) {
      await writeFile(join(tileDirectoryPath, `${tile.key.replace(':', '_')}.jpg`), '');
    }
    const coverTarget = join(root, 'images', 'dungeons', coverPath);
    await mkdir(dirname(coverTarget), { recursive: true });
    await writeFile(coverTarget, '');
  }
}

describe('OSS manifest generator', () => {
  it('prints paired remote-dev env lines that match the committed manifest', async () => {
    const mirror = await mkdtemp(join(tmpdir(), 'wowa-oss-mirror-'));
    temporaryRoots.push(mirror);
    await writeMirrorFixture(mirror);

    const result = await runGenerate(['--print-remote-dev-env', `--mirror-dir=${mirror}`]);

    // 两行必须成对出现：只贴 manifest 行时 development 默认 provider 是 placeholder，
    // 会在渲染时抛 DUNGEON_ASSET_PROVIDER_MISMATCH。
    const lines = (result.devManifestEnvLine ?? '').split('\n');
    expect(lines[0]).toBe('VITE_DUNGEON_ASSET_PROVIDER=remote-dev');
    expect(lines[1]?.startsWith('VITE_DUNGEON_DEV_ASSET_MANIFEST=')).toBe(true);
    const payload = JSON.parse(
      (lines[1] ?? '').slice('VITE_DUNGEON_DEV_ASSET_MANIFEST='.length),
    ) as { provider: string; assets: Record<string, unknown> };
    expect(payload.provider).toBe('remote-dev');
    expect(Object.keys(payload.assets)).toEqual(Object.keys(committedManifest.assets));
    expect(result.manifest.provider).toBe('oss');
  });

  it('fails fast on a missing mirror instead of generating unchecked URLs', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'wowa-oss-empty-'));
    temporaryRoots.push(empty);
    await expect(runGenerate(['--print-remote-dev-env', `--mirror-dir=${empty}`])).rejects.toThrow(
      /OSS_MANIFEST_MIRROR_MISSING/,
    );
  });

  it('fails fast when a single expected tile is missing from the mirror', async () => {
    const mirror = await mkdtemp(join(tmpdir(), 'wowa-oss-partial-'));
    temporaryRoots.push(mirror);
    await writeMirrorFixture(mirror);
    // 从 RLP（maps/rlp）删掉 0_0.jpg：生成器必须对账出缺瓦片，而不是静默生成 manifest。
    await rm(join(mirror, 'maps', 'rlp', '0_0.jpg'));
    await expect(runGenerate(['--print-remote-dev-env', `--mirror-dir=${mirror}`])).rejects.toThrow(
      /OSS_MANIFEST_TILES_MISSING/,
    );
  });
});
