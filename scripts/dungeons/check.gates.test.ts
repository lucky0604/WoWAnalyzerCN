import { describe, expect, it, vi } from 'vitest';

import ossManifestJson from '../../src/dungeon/data/assets/oss.manifest.json';
import zhTooltipsJson from '../../src/dungeon/data/spellFacts/s2.zhTooltips.json';
import rubyLifePoolsMdtFacts from '../../src/dungeon/data/mdtFacts/ruby-life-pools.json';
import {
  validateSpellDictionaryCoverage,
  type SpellDictionaryAudit,
} from '../../src/dungeon/data/spellReference';
import type { AssetManifest, AssetManifestEntry } from '../../src/dungeon/runtime/assets';

// 门禁对静态 import 的已提交 JSON 逐字段断言。负路径用 vi.doMock 把注入的坏
// JSON / 坏审计结果替换进 './check' 的模块图（resetModules 保证动态 re-import
// 时重新求值），静态 import 拿到的始终是真实已提交数据，只作克隆基底，
// 不污染其它测试文件共享的模块对象。
const committedManifest = structuredClone(ossManifestJson) as AssetManifest;

interface ZhTooltipSnapshot {
  version: number;
  source: string;
  capturedAt: string;
  dungeonCount: number;
  spellCount: number;
  tooltips: Record<string, { name: string; desc: string }>;
  unknownGate: Record<string, string>;
}
const committedZhTooltips = structuredClone(zhTooltipsJson) as ZhTooltipSnapshot;

const RLP_TILES_KEY = 'midnight-s2:ruby-life-pools';
const RLP_ARTWORK_KEY = `${RLP_TILES_KEY}:artwork`;

async function importCheck(): Promise<typeof import('./check')> {
  vi.resetModules();
  return import('./check');
}

async function importCheckWithOssManifest(manifest: unknown): Promise<typeof import('./check')> {
  vi.resetModules();
  vi.doMock('../../src/dungeon/data/assets/oss.manifest.json', () => ({ default: manifest }));
  try {
    return await import('./check');
  } finally {
    vi.doUnmock('../../src/dungeon/data/assets/oss.manifest.json');
  }
}

async function importCheckWithDictionaryAudit(
  audit: SpellDictionaryAudit,
): Promise<typeof import('./check')> {
  vi.resetModules();
  vi.doMock('../../src/dungeon/data/spellReference', async (importActual) => {
    const actual = await importActual<typeof import('../../src/dungeon/data/spellReference')>();
    return {
      ...actual,
      validateSpellDictionaryCoverage: () => audit,
    };
  });
  try {
    return await import('./check');
  } finally {
    vi.doUnmock('../../src/dungeon/data/spellReference');
  }
}

async function importCheckWithZhTooltips(snapshot: unknown): Promise<typeof import('./check')> {
  vi.resetModules();
  vi.doMock('../../src/dungeon/data/spellFacts/s2.zhTooltips.json', () => ({ default: snapshot }));
  try {
    return await import('./check');
  } finally {
    vi.doUnmock('../../src/dungeon/data/spellFacts/s2.zhTooltips.json');
  }
}

async function importCheckWithMdtFacts(snapshot: unknown): Promise<typeof import('./check')> {
  vi.resetModules();
  vi.doMock('../../src/dungeon/data/mdtFacts/ruby-life-pools.json', () => ({ default: snapshot }));
  try {
    return await import('./check');
  } finally {
    vi.doUnmock('../../src/dungeon/data/mdtFacts/ruby-life-pools.json');
  }
}

describe('validateOssAssetManifestGate', () => {
  it('accepts the committed OSS manifest as-is', async () => {
    const { validateOssAssetManifestGate } = await importCheck();
    expect(validateOssAssetManifestGate()).toEqual([]);
  });

  it('fails closed when the committed manifest loses its manifest shape', async () => {
    const { validateOssAssetManifestGate } = await importCheckWithOssManifest({ provider: 'oss' });
    expect(validateOssAssetManifestGate()).toEqual(['asset manifest: OSS_MANIFEST_INVALID_SHAPE']);
  });

  it('rejects legacy threechest keys inside the OSS manifest', async () => {
    const manifest = structuredClone(committedManifest);
    manifest.assets['legacy-threechest:aa'] =
      'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com/maps/aa/0_0.jpg';
    const { validateOssAssetManifestGate } = await importCheckWithOssManifest(manifest);
    expect(validateOssAssetManifestGate()).toEqual([
      'asset manifest: LEGACY_KEY_IN_OSS_MANIFEST legacy-threechest:aa',
    ]);
  });

  it('rejects asset URLs pointing back at the retired threechest/keystone sources', async () => {
    const manifest = structuredClone(committedManifest);
    manifest.assets['quarantined-cover'] = 'https://www.keystone.guru/img/wallpaper.jpg';
    const { validateOssAssetManifestGate } = await importCheckWithOssManifest(manifest);
    expect(validateOssAssetManifestGate()).toEqual([
      'asset manifest: LEGACY_SOURCE_URL_IN_OSS_MANIFEST quarantined-cover',
    ]);
  });

  it('rejects a dungeon whose tiles entry is missing', async () => {
    const manifest = structuredClone(committedManifest);
    delete manifest.assets[RLP_TILES_KEY];
    const { validateOssAssetManifestGate } = await importCheckWithOssManifest(manifest);
    expect(validateOssAssetManifestGate()).toEqual([
      `asset manifest: OSS_TILES_ENTRY_INVALID ${RLP_TILES_KEY}`,
    ]);
  });

  it('rejects a dungeon whose artwork entry is missing', async () => {
    const manifest = structuredClone(committedManifest);
    delete manifest.assets[RLP_ARTWORK_KEY];
    const { validateOssAssetManifestGate } = await importCheckWithOssManifest(manifest);
    expect(validateOssAssetManifestGate()).toEqual([
      `asset manifest: OSS_ARTWORK_ENTRY_INVALID ${RLP_ARTWORK_KEY}`,
    ]);
  });

  it('rejects a tile grid that no longer matches the normalized-tile contract', async () => {
    // tileSize !== 64 / origin !== [0,0] / flipY !== true 各破坏瓦片换算的一个前提，
    // 都必须落进同一条 OSS_TILES_ENTRY_INVALID 门禁错误。
    const cases: Array<[string, (entry: AssetManifestEntry) => void]> = [
      [
        'tileSize !== 64',
        (entry) => {
          entry.tileSize = 128;
        },
      ],
      [
        'origin !== [0,0]',
        (entry) => {
          entry.origin = [1, 0];
        },
      ],
      [
        'flipY !== true',
        (entry) => {
          entry.flipY = false;
        },
      ],
    ];
    for (const [label, mutate] of cases) {
      const manifest = structuredClone(committedManifest);
      mutate(manifest.assets[RLP_TILES_KEY] as AssetManifestEntry);
      const { validateOssAssetManifestGate } = await importCheckWithOssManifest(manifest);
      expect(validateOssAssetManifestGate(), `expected ${label} to fail the tiles gate`).toEqual([
        `asset manifest: OSS_TILES_ENTRY_INVALID ${RLP_TILES_KEY}`,
      ]);
    }
  });
});

describe('validateSpellDictionaryGate', () => {
  const audit = (overrides: Partial<SpellDictionaryAudit>): SpellDictionaryAudit => ({
    referencedSpellIds: [1],
    missingFromDictionary: [],
    unknownRegistered: [],
    attributeMismatches: [],
    dictionaryFacts: 1,
    dictionaryUnknowns: 0,
    ...overrides,
  });

  it('accepts the committed dictionary against the reference layers', async () => {
    const { validateSpellDictionaryGate } = await importCheck();
    expect(validateSpellDictionaryGate()).toEqual([]);
  });

  it('reports reference spell ids that are missing from the dictionary', async () => {
    const { validateSpellDictionaryGate } = await importCheckWithDictionaryAudit(
      audit({
        referencedSpellIds: [1, 99999],
        missingFromDictionary: [99999],
        dictionaryFacts: 2,
      }),
    );
    expect(validateSpellDictionaryGate()).toEqual([
      'spell dictionary: SPELL_DICTIONARY_MISSING 99999',
    ]);
  });

  it('reports dictionary attributes that drift from the cross-caster reference union', async () => {
    const { validateSpellDictionaryGate } = await importCheckWithDictionaryAudit(
      audit({
        attributeMismatches: [
          { spellId: 1, dictionary: ['magic'], references: ['interruptible', 'magic'] },
        ],
      }),
    );
    expect(validateSpellDictionaryGate()).toEqual([
      'spell dictionary: SPELL_DICTIONARY_ATTRIBUTE_MISMATCH 1 dictionary=[magic] references=[interruptible,magic]',
    ]);
  });

  it('reports a dictionary head count that no longer matches the reference layer', async () => {
    const { validateSpellDictionaryGate } = await importCheckWithDictionaryAudit(
      audit({ referencedSpellIds: [1, 2, 3], dictionaryFacts: 1 }),
    );
    expect(validateSpellDictionaryGate()).toEqual([
      'spell dictionary: SPELL_DICTIONARY_COUNT_MISMATCH facts=1 unknowns=0 referenced=3',
    ]);
  });
});

describe('validateSpellTooltipSnapshotGate', () => {
  it('accepts the committed zh tooltip snapshot as-is', async () => {
    const { validateSpellTooltipSnapshotGate } = await importCheck();
    expect(validateSpellTooltipSnapshotGate()).toEqual([]);
  });

  it('fails closed when the snapshot loses its shape', async () => {
    const { validateSpellTooltipSnapshotGate } = await importCheckWithZhTooltips({ version: 1 });
    expect(validateSpellTooltipSnapshotGate()).toEqual([
      'spell tooltips snapshot: ZH_TOOLTIPS_INVALID_SHAPE',
    ]);
  });

  it('rejects a referenced spell id with neither a tooltip nor an unknownGate entry', async () => {
    const target = validateSpellDictionaryCoverage().referencedSpellIds.find(
      (spellId) => committedZhTooltips.unknownGate[String(spellId)] === undefined,
    );
    if (target === undefined) {
      throw new Error('fixture broken: no referenced spell id outside unknownGate');
    }
    const snapshot = structuredClone(committedZhTooltips) as ZhTooltipSnapshot;
    delete snapshot.tooltips[String(target)];
    const { validateSpellTooltipSnapshotGate } = await importCheckWithZhTooltips(snapshot);
    expect(validateSpellTooltipSnapshotGate()).toEqual([
      `spell tooltips snapshot: ZH_TOOLTIPS_MISSING ${target}`,
    ]);
  });

  it('rejects snapshot keys that the reference layers no longer reference', async () => {
    const snapshot = structuredClone(committedZhTooltips) as ZhTooltipSnapshot;
    snapshot.tooltips['999999999'] = { name: '幽灵技能', desc: '参考层未引用' };
    const { validateSpellTooltipSnapshotGate } = await importCheckWithZhTooltips(snapshot);
    expect(validateSpellTooltipSnapshotGate()).toEqual([
      'spell tooltips snapshot: ZH_TOOLTIPS_UNREFERENCED 999999999',
    ]);
  });

  it('rejects non-canonical spell id keys instead of letting Number() alias them', async () => {
    const snapshot = structuredClone(committedZhTooltips) as ZhTooltipSnapshot;
    snapshot.tooltips['1e3'] = { name: '别名键', desc: 'Number("1e3") = 1000' };
    const { validateSpellTooltipSnapshotGate } = await importCheckWithZhTooltips(snapshot);
    expect(validateSpellTooltipSnapshotGate()).toEqual([
      'spell tooltips snapshot: ZH_TOOLTIPS_ENTRY_INVALID 1e3',
    ]);
  });
});

describe('validateMdtFactsHashGate', () => {
  it('accepts the committed mdtFacts reference layer as-is', async () => {
    const { validateMdtFactsHashGate } = await importCheck();
    expect(validateMdtFactsHashGate()).toEqual([]);
  });

  it('rejects a reference whose embedded source hash drifts from the registered batch', async () => {
    // 只篡改内嵌 source.sha256：模拟"参考层被换成未登记原始快照后重新导入"。
    const tampered = {
      ...rubyLifePoolsMdtFacts,
      source: { ...rubyLifePoolsMdtFacts.source, sha256: '0'.repeat(64) },
    };
    const { validateMdtFactsHashGate } = await importCheckWithMdtFacts(tampered);
    expect(validateMdtFactsHashGate()).toEqual([
      'source registry: MDT_FACTS_HASH_MISMATCH ruby-life-pools',
    ]);
  });

  it('rejects a reference file whose identity no longer matches its filename', async () => {
    // 哈希仍与登记一致、但 slug 已不是文件身份：两本文件互换必须落进身份门禁。
    const swapped = { ...rubyLifePoolsMdtFacts, slug: 'kings-rest' };
    const { validateMdtFactsHashGate } = await importCheckWithMdtFacts(swapped);
    expect(validateMdtFactsHashGate()).toEqual([
      'source registry: MDT_FACTS_IDENTITY_MISMATCH ruby-life-pools',
    ]);
  });
});
