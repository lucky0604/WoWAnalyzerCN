import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AssetManifest, AssetManifestEntry } from '../../src/dungeon/runtime/assets';
import {
  season2DungeonCatalog,
  type DungeonCatalogEntry,
} from '../../src/dungeon/data/season2Catalog';
import { getCoordinateReference } from '../../src/dungeon/runtime/coordinates';
import { getMapTiles } from '../../src/dungeon/runtime/map';

/**
 * 生产 OSS 资源 manifest 生成器。
 *
 * 输出 src/dungeon/data/assets/oss.manifest.json（provider: 'oss'），运行时在
 * production/preview 下自动加载（见 src/dungeon/runtime/assets.ts）。对外 key
 * 一律是稳定 mapAssetKey；threechest 物理目录名（fang/tos/vale/void/murd/nalo/
 * kr/rlp）只存在于本文件的别名表里，不允许泄漏进 runtime 或业务数据。
 *
 * 校验全部针对本地镜像（wcl-mp-client/downloaded，raw source of record）：
 * 坐标快照 bounds 外包络所需的每一张瓦片、每张封面都必须在镜像中存在；
 * 镜像里多出的文件仅提示不报错。镜像缺失时直接失败并给出获取方式，
 * 绝不跳过校验静默生成 manifest。
 *
 * --print-remote-dev-env：跳过写文件，把同一套 tiles+artwork（provider 改为
 * remote-dev）打印成 .env.local 直接可粘贴的两行——VITE_DUNGEON_ASSET_PROVIDER
 * 与 VITE_DUNGEON_DEV_ASSET_MANIFEST 必须成对设置：只贴 manifest 行时
 * development 默认 provider 是 placeholder，与 manifest 的 remote-dev 不匹配，
 * createAssetProviderFromEnv 会在渲染时抛 DUNGEON_ASSET_PROVIDER_MISMATCH。
 * 以此保证本地开发示例与已提交 manifest 不漂移。
 */

const OSS_ORIGIN = 'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com';

/** catalog slug → OSS/threechest 物理瓦片目录名。 */
const TILE_DIRECTORY_BY_SLUG: Record<string, string> = {
  'altar-of-fangs': 'fang',
  'den-of-nalorakk': 'nalo',
  'kings-rest': 'kr',
  'murder-row': 'murd',
  'ruby-life-pools': 'rlp',
  'temple-of-sethraliss': 'tos',
  'the-blinding-vale': 'vale',
  'voidscar-arena': 'void',
};

/** catalog slug → OSS 封面路径（images/dungeons/ 下，沿用 keystone.guru 原布局）。 */
const COVER_PATH_BY_SLUG: Record<string, string> = {
  'altar-of-fangs': 'midnight/altar_of_fangs.jpg',
  'den-of-nalorakk': 'midnight/den_of_nalorakk.jpg',
  'kings-rest': 'bfa/kingsrest.jpg',
  'murder-row': 'midnight/murder_row.jpg',
  'ruby-life-pools': 'df/rubylifepools.jpg',
  'temple-of-sethraliss': 'bfa/templeofsethraliss.jpg',
  'the-blinding-vale': 'midnight/the_blinding_vale.jpg',
  'voidscar-arena': 'midnight/voidscar_arena.jpg',
};

const OUTPUT_PATH = 'src/dungeon/data/assets/oss.manifest.json';
const TILE_SIZE = 64;

interface GeneratorOptions {
  mirrorDir: string;
  outputPath: string;
  check: boolean;
  printRemoteDevEnv: boolean;
}

interface DungeonReport {
  slug: string;
  assetKey: string;
  tileDirectory: string;
  expectedTiles: number;
  mirroredTiles: number;
  extraMirrorTiles: number;
}

export interface GenerateResult {
  manifest: AssetManifest;
  reports: DungeonReport[];
  /** --print-remote-dev-env 模式：可直接粘贴进 .env.local 的单行 env 值。 */
  devManifestEnvLine?: string;
}

function parseOptions(args: string[]): GeneratorOptions {
  const argument = (name: string, fallback: string) =>
    args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
  return {
    // 本地镜像仓库与本项目同级：Code/rpglogs/wcl-mp-client。
    mirrorDir: resolve(
      argument('--mirror-dir', '../../rpglogs/wcl-mp-client/downloaded'),
    ),
    outputPath: resolve(argument('--output', OUTPUT_PATH)),
    check: args.includes('--check'),
    printRemoteDevEnv: args.includes('--print-remote-dev-env'),
  };
}

/**
 * 渲染端（DungeonMap）在 flipY 时先把整个平面翻转到屏幕空间（y' = -y）再计算
 * 瓦片行号，源瓦片网格因此是非负索引（0_0 起）。这里复刻同一变换，保证校验
 * 的行列号与运行时真实请求一一对应。
 */
function toScreenSpace(bounds: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}): { xMin: number; xMax: number; yMin: number; yMax: number } {
  return { xMin: bounds.xMin, xMax: bounds.xMax, yMin: -bounds.yMax, yMax: -bounds.yMin };
}

async function listTileKeys(directory: string): Promise<Set<string>> {
  const names = await readdir(directory);
  const keys = new Set<string>();
  names.forEach((name) => {
    const match = name.match(/^(\d+)_(\d+)\.jpg$/);
    if (match) keys.add(`${match[1]}:${match[2]}`);
  });
  return keys;
}

async function generate(options: GeneratorOptions): Promise<GenerateResult> {
  const s2Entries = season2DungeonCatalog.filter((entry) => entry.season === 'midnight-s2');

  const assets: Record<string, AssetManifestEntry> = {};
  const reports: DungeonReport[] = [];

  for (const entry of s2Entries) {
    const tileDirectory = TILE_DIRECTORY_BY_SLUG[entry.id];
    const coverPath = COVER_PATH_BY_SLUG[entry.id];
    if (!tileDirectory || !coverPath) {
      throw new Error(`OSS_MANIFEST_ALIAS_MISSING: ${entry.id}`);
    }
    const coordinateReference = getCoordinateReference(entry as DungeonCatalogEntry);
    if (!coordinateReference) {
      throw new Error(`OSS_MANIFEST_COORDINATES_UNRESOLVED: ${entry.id}`);
    }

    // 与渲染端同一套网格数学：getMapTiles 是 normalized-v1 瓦片换算的唯一实现。
    const probeAsset = {
      kind: 'remote-tiles' as const,
      assetKey: entry.mapAssetKey,
      urlTemplate: `${OSS_ORIGIN}/maps/${tileDirectory}/{x}_{y}.jpg`,
      tileSize: TILE_SIZE,
      origin: [0, 0] as const,
      flipY: true,
    };
    const tiles = getMapTiles(toScreenSpace(coordinateReference.floor.bounds), probeAsset);
    const expectedKeys = new Set(tiles.map((tile) => tile.key));

    let mirroredKeys: Set<string>;
    try {
      mirroredKeys = await listTileKeys(resolve(options.mirrorDir, 'maps', tileDirectory));
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error(
          `OSS_MANIFEST_MIRROR_MISSING: ${options.mirrorDir}（本地镜像缺失。` +
            '运行 wcl-mp-client/downloaded/download-threechest-images.js 重建后重试）',
        );
      }
      throw error;
    }
    const missing = [...expectedKeys].filter((key) => !mirroredKeys.has(key)).sort();
    if (missing.length > 0) {
      throw new Error(
        `OSS_MANIFEST_TILES_MISSING: ${entry.id} 缺少 ${missing.length} 张：${missing.join(', ')}`,
      );
    }

    try {
      await readFile(resolve(options.mirrorDir, 'images', 'dungeons', coverPath));
    } catch {
      throw new Error(`OSS_MANIFEST_COVER_MISSING: ${entry.id} → ${coverPath}`);
    }

    assets[entry.mapAssetKey] = {
      type: 'tiles',
      urlTemplate: probeAsset.urlTemplate,
      tileSize: TILE_SIZE,
      origin: [0, 0],
      flipY: true,
    };
    assets[`${entry.mapAssetKey}:artwork`] = {
      type: 'image',
      url: `${OSS_ORIGIN}/images/dungeons/${coverPath}`,
    };
    reports.push({
      slug: entry.id,
      assetKey: entry.mapAssetKey,
      tileDirectory,
      expectedTiles: expectedKeys.size,
      mirroredTiles: mirroredKeys.size,
      extraMirrorTiles: [...mirroredKeys].filter((key) => !expectedKeys.has(key)).length,
    });
  }

  const manifest: AssetManifest = {
    provider: 'oss',
    assets: Object.fromEntries(Object.entries(assets).sort(([left], [right]) => left.localeCompare(right))),
  };
  return { manifest, reports };
}

async function semanticJsonEqual(path: string, next: unknown): Promise<boolean> {
  let existing: string;
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`OSS_MANIFEST_CHECK_MISSING: ${path}`);
    }
    throw error;
  }
  return JSON.stringify(JSON.parse(existing)) === JSON.stringify(next);
}

export async function runGenerate(
  args: string[],
): Promise<GenerateResult & { changed?: boolean }> {
  const options = parseOptions(args);
  const { manifest, reports } = await generate(options);
  if (options.printRemoteDevEnv) {
    // 本地开发直接复用与生产相同的 OSS 瓦片/封面（OSS 从 localhost 可达）：
    // provider 改为 remote-dev 后输出单行 env 值，保证 .env.local 示例与
    // 已提交 oss.manifest.json 不漂移。镜像校验照常执行。
    return {
      manifest,
      reports,
      devManifestEnvLine:
        'VITE_DUNGEON_ASSET_PROVIDER=remote-dev\n' +
        'VITE_DUNGEON_DEV_ASSET_MANIFEST=' +
        JSON.stringify({ provider: 'remote-dev', assets: manifest.assets }),
    };
  }
  if (options.check) {
    const changed = !(await semanticJsonEqual(options.outputPath, manifest));
    return { manifest, reports, changed };
  }
  await mkdir(resolve(options.outputPath, '..'), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, reports };
}

if (process.argv[1]?.endsWith('scripts/dungeons/generate-oss-manifest.ts')) {
  runGenerate(process.argv.slice(2))
    .then(({ reports, changed, devManifestEnvLine }) => {
      console.log(
        `OSS manifest ${changed === undefined ? 'written' : changed ? 'CHANGED' : 'verified'}: ` +
          reports
            .map(
              (report) =>
                `${report.slug}(${report.expectedTiles} tiles required / ` +
                `${report.mirroredTiles} mirrored${report.extraMirrorTiles > 0 ? `, ${report.extraMirrorTiles} extra` : ''})`,
            )
            .join(', '),
      );
      if (changed === true) {
        console.error('OSS_MANIFEST_DRIFT: 已提交 manifest 与镜像校验结果不一致（重跑生成器更新）');
        process.exitCode = 1;
      }
      if (devManifestEnvLine) console.log(devManifestEnvLine);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
