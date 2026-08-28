import { createHash } from 'node:crypto';

import {
  legacyThreechestCoordinateInventory,
  isLearningPublished,
  season2DungeonCatalog,
  season2WclCatalogSource,
  serializeSeason2WclSourceIdentity,
  validateSeason2DungeonCatalog,
} from '../../src/dungeon/data/season2Catalog';
import { dungeonDocuments } from '../../src/dungeon/registry';
import { dungeonPreviewDocuments } from '../../src/dungeon/registry';
import ossManifestJson from '../../src/dungeon/data/assets/oss.manifest.json';
import zhTooltipSnapshotJson from '../../src/dungeon/data/spellFacts/s2.zhTooltips.json';
import altarOfFangsMdtFacts from '../../src/dungeon/data/mdtFacts/altar-of-fangs.json';
import denOfNalorakkMdtFacts from '../../src/dungeon/data/mdtFacts/den-of-nalorakk.json';
import kingsRestMdtFacts from '../../src/dungeon/data/mdtFacts/kings-rest.json';
import murderRowMdtFacts from '../../src/dungeon/data/mdtFacts/murder-row.json';
import rubyLifePoolsMdtFacts from '../../src/dungeon/data/mdtFacts/ruby-life-pools.json';
import templeOfSethralissMdtFacts from '../../src/dungeon/data/mdtFacts/temple-of-sethraliss.json';
import theBlindingValeMdtFacts from '../../src/dungeon/data/mdtFacts/the-blinding-vale.json';
import voidscarArenaMdtFacts from '../../src/dungeon/data/mdtFacts/voidscar-arena.json';
import { isAssetManifest, type AssetManifestEntry } from '../../src/dungeon/runtime/assets';
import { validateSpellDictionaryCoverage } from '../../src/dungeon/data/spellReference';
import {
  getCoordinateReference,
  getCoordinateIdentityRegistry,
  getCoordinateSnapshot,
  serializeCoordinateData,
  serializeCoordinateSnapshot,
  coordinateSnapshotUsesAllowedFields,
} from '../../src/dungeon/runtime/coordinates';
import {
  checkSourceUse,
  dungeonFactBindingRegistry,
  dungeonForcesSnapshotRegistry,
  dungeonSourceRegistry,
  getApprovedMdtFactsSnapshot,
  validateFactBindingRegistry,
  validateForcesSnapshotRegistry,
} from '../../src/dungeon/runtime/sourceRegistry';
import { getDungeonScopedLearningAccess } from '../../src/dungeon/runtime/formalAccess';
import { runtimeReleaseArtifactErrors } from '../../src/dungeon/runtime/releaseRegistry';
import {
  documentKnowledgeIds,
  staleKnowledgeLedger,
  validateStaleLedger,
} from '../../src/dungeon/runtime/staleLedger';

function staleLedgerErrors(
  documentIds = new Set(
    dungeonPreviewDocuments.flatMap((document) => [...documentKnowledgeIds(document)]),
  ),
): string[] {
  const result = validateStaleLedger(staleKnowledgeLedger, documentIds);
  return result.errors.map((error) => `stale ledger: ${error}`);
}
import type {
  ApprovedSourceSnapshot,
  SourceUseCheck,
} from '../../src/dungeon/runtime/sourceRegistry';
import type { DungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import { validateDungeonDocument } from '../../src/dungeon/schema/validate';
import { authoringDiagnostics, loadAuthoringDocument } from './authoring';

function option(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

const requestedDungeon = option('--dungeon');
const jsonOutput = process.argv.includes('--json');
const requestedRoot = option('--root');

export function validateS2CoordinateGate(
  entry: DungeonCatalogEntry,
  snapshot: ReturnType<typeof getCoordinateSnapshot>,
  registeredSnapshot: ApprovedSourceSnapshot | undefined,
  sourceUse: SourceUseCheck,
): string[] {
  const errors: string[] = [];
  if (!snapshot || !registeredSnapshot) {
    errors.push(`source registry: S2_COORDINATE_SNAPSHOT_MISSING ${entry.id}`);
    return errors;
  }
  const coordinateHash = createHash('sha256')
    .update(serializeCoordinateSnapshot(snapshot))
    .digest('hex');
  if (registeredSnapshot.hash !== `sha256:${coordinateHash}`) {
    errors.push(
      `source registry: S2_COORDINATE_HASH_MISMATCH ${entry.id} ${registeredSnapshot.hash} !== sha256:${coordinateHash}`,
    );
  }
  if (!registeredSnapshot.rawSha256) {
    errors.push(`source registry: S2_COORDINATE_RAW_HASH_MISSING ${entry.id}`);
  } else if (snapshot.rawSha256 !== registeredSnapshot.rawSha256) {
    errors.push(`source registry: S2_COORDINATE_RAW_HASH_MISMATCH ${entry.id}`);
  }
  if (
    !registeredSnapshot.fieldAllowlist ||
    !coordinateSnapshotUsesAllowedFields(snapshot, registeredSnapshot.fieldAllowlist)
  ) {
    errors.push(`source registry: S2_COORDINATE_FIELD_NOT_ALLOWED ${entry.id}`);
  }
  if (!entry.coordinateIdentityRegistryKey || !registeredSnapshot.identityHash) {
    errors.push(`source registry: S2_COORDINATE_IDENTITY_REGISTRY_MISSING ${entry.id}`);
  } else {
    const identityRegistry = getCoordinateIdentityRegistry(entry.coordinateIdentityRegistryKey);
    const identityHash = identityRegistry
      ? createHash('sha256').update(serializeCoordinateData(identityRegistry)).digest('hex')
      : undefined;
    if (identityHash !== registeredSnapshot.identityHash.slice('sha256:'.length)) {
      errors.push(`source registry: S2_COORDINATE_IDENTITY_HASH_MISMATCH ${entry.id}`);
    }
  }
  if (!sourceUse.ok) {
    errors.push(`source registry: ${sourceUse.reason}`);
  }
  return errors;
}

export function validatePublishedLearningGate(
  entry: DungeonCatalogEntry,
  document: (typeof dungeonDocuments)[number] | undefined,
): string[] {
  if (!isLearningPublished(entry.status)) return [];
  const access = getDungeonScopedLearningAccess(entry, document);
  return access.isFormal
    ? []
    : [`catalog: FORMAL_LEARNING_GATE_FAILED ${entry.id} — ${access.reason}`];
}

const OSS_ASSET_ORIGIN = 'https://wcl-mythic-dungeon.oss-cn-beijing.aliyuncs.com';

/**
 * 已提交 OSS manifest 的形状与覆盖门禁（不依赖本地镜像，可在 CI 运行；
 * 镜像层面的瓦片对账在 generate-oss-manifest.ts 里完成）。
 */
export function validateOssAssetManifestGate(): string[] {
  if (!isAssetManifest(ossManifestJson) || ossManifestJson.provider !== 'oss') {
    return ['asset manifest: OSS_MANIFEST_INVALID_SHAPE'];
  }
  const errors: string[] = [];
  for (const [key, value] of Object.entries(ossManifestJson.assets)) {
    if (key.startsWith('legacy-threechest:')) {
      errors.push(`asset manifest: LEGACY_KEY_IN_OSS_MANIFEST ${key}`);
    }
    const url =
      typeof value === 'string'
        ? value
        : ((value as AssetManifestEntry).url ?? (value as AssetManifestEntry).urlTemplate ?? '');
    if (/threechest\.io|keystone\.guru/.test(url)) {
      errors.push(`asset manifest: LEGACY_SOURCE_URL_IN_OSS_MANIFEST ${key}`);
    }
  }
  for (const entry of season2DungeonCatalog.filter((item) => item.season === 'midnight-s2')) {
    const tiles = ossManifestJson.assets[entry.mapAssetKey];
    if (
      !tiles ||
      typeof tiles === 'string' ||
      tiles.type !== 'tiles' ||
      tiles.tileSize !== 64 ||
      !tiles.origin ||
      tiles.origin[0] !== 0 ||
      tiles.origin[1] !== 0 ||
      tiles.flipY !== true ||
      !tiles.urlTemplate?.startsWith(`${OSS_ASSET_ORIGIN}/maps/`)
    ) {
      errors.push(`asset manifest: OSS_TILES_ENTRY_INVALID ${entry.mapAssetKey}`);
    }
    const artworkKey = `${entry.mapAssetKey}:artwork`;
    const artwork = ossManifestJson.assets[artworkKey];
    if (
      !artwork ||
      typeof artwork === 'string' ||
      artwork.type !== 'image' ||
      !artwork.url?.startsWith(`${OSS_ASSET_ORIGIN}/images/dungeons/`)
    ) {
      errors.push(`asset manifest: OSS_ARTWORK_ENTRY_INVALID ${artworkKey}`);
    }
  }
  return errors;
}

/**
 * spellFacts/s2.json 完整性与漂移门禁（不依赖本地镜像或网络，可在 CI 运行）。
 *
 * - 参考层引用的每个 spellId 必须能在字典里解析，或在 unknownGate 登记缺失原因；
 * - 字典登记的 attributes 必须等于参考层跨施法者并集（与生成器同一语义重算）；
 * - 字典自述事实数 + unknownGate 数必须等于参考层引用数（防止手改静默增删）。
 */
export function validateSpellDictionaryGate(): string[] {
  const audit = validateSpellDictionaryCoverage();
  const errors: string[] = [];
  for (const spellId of audit.missingFromDictionary) {
    errors.push(`spell dictionary: SPELL_DICTIONARY_MISSING ${spellId}`);
  }
  for (const mismatch of audit.attributeMismatches) {
    errors.push(
      `spell dictionary: SPELL_DICTIONARY_ATTRIBUTE_MISMATCH ${mismatch.spellId} ` +
        `dictionary=[${mismatch.dictionary.join(',')}] references=[${mismatch.references.join(',')}]`,
    );
  }
  if (audit.dictionaryFacts + audit.dictionaryUnknowns !== audit.referencedSpellIds.length) {
    errors.push(
      `spell dictionary: SPELL_DICTIONARY_COUNT_MISMATCH ` +
        `facts=${audit.dictionaryFacts} unknowns=${audit.dictionaryUnknowns} ` +
        `referenced=${audit.referencedSpellIds.length}`,
    );
  }
  return errors;
}

/**
 * s2.zhTooltips.json 离线快照覆盖门禁（不依赖网络，可在 CI 运行）。
 *
 * 快照键集合（tooltips ∪ unknownGate）必须与参考层引用的 spellId 集合相等：
 * 每个被引用的技能要么有非空的中文名/说明，要么在 unknownGate 登记缺失原因；
 * 参考层已不再引用的键视为陈旧漂移。
 */
export function validateSpellTooltipSnapshotGate(): string[] {
  const snapshot = zhTooltipSnapshotJson as {
    tooltips?: unknown;
    unknownGate?: unknown;
  };
  if (
    typeof snapshot.tooltips !== 'object' ||
    snapshot.tooltips === null ||
    typeof snapshot.unknownGate !== 'object' ||
    snapshot.unknownGate === null
  ) {
    return ['spell tooltips snapshot: ZH_TOOLTIPS_INVALID_SHAPE'];
  }
  const tooltips = snapshot.tooltips as Record<string, unknown>;
  const unknownGate = snapshot.unknownGate as Record<string, unknown>;
  const errors: string[] = [];
  const covered = new Set<number>();
  const snapshotKeys = new Set<string>();
  for (const [spellId, entry] of Object.entries(tooltips)) {
    // 键必须规范十进制整数：Number() 会把 '1e3'/'0x10' 别名成合法 id，
    // 让非规范键既蹭到覆盖又躲过反向漂移检查。
    if (!/^\d+$/.test(spellId)) {
      errors.push(`spell tooltips snapshot: ZH_TOOLTIPS_ENTRY_INVALID ${spellId}`);
      continue;
    }
    const name = (entry as { name?: unknown } | null)?.name;
    const desc = (entry as { desc?: unknown } | null)?.desc;
    if (
      typeof name !== 'string' ||
      typeof desc !== 'string' ||
      (name.trim() === '' && desc.trim() === '')
    ) {
      errors.push(`spell tooltips snapshot: ZH_TOOLTIPS_ENTRY_INVALID ${spellId}`);
      continue;
    }
    snapshotKeys.add(spellId);
    covered.add(Number(spellId));
  }
  for (const [spellId, reason] of Object.entries(unknownGate)) {
    if (!/^\d+$/.test(spellId) || typeof reason !== 'string' || reason.trim() === '') {
      errors.push(`spell tooltips snapshot: ZH_TOOLTIPS_ENTRY_INVALID gate:${spellId}`);
      continue;
    }
    snapshotKeys.add(spellId);
    covered.add(Number(spellId));
  }
  const referenced = validateSpellDictionaryCoverage().referencedSpellIds;
  referenced
    .filter((spellId) => !covered.has(spellId))
    .forEach((spellId) => {
      errors.push(`spell tooltips snapshot: ZH_TOOLTIPS_MISSING ${spellId}`);
    });
  for (const spellId of snapshotKeys) {
    if (!referenced.includes(Number(spellId))) {
      errors.push(`spell tooltips snapshot: ZH_TOOLTIPS_UNREFERENCED ${spellId}`);
    }
  }
  return errors;
}

interface MdtFactsReferenceShape {
  slug?: unknown;
  sourceKey?: unknown;
  source?: { sha256?: unknown };
}

const MDT_FACTS_REFERENCES: Array<{
  slug: string;
  sourceKey: string;
  reference: MdtFactsReferenceShape;
}> = [
  { slug: 'altar-of-fangs', sourceKey: 'aof', reference: altarOfFangsMdtFacts },
  { slug: 'den-of-nalorakk', sourceKey: 'dnl', reference: denOfNalorakkMdtFacts },
  { slug: 'kings-rest', sourceKey: 'kr', reference: kingsRestMdtFacts },
  { slug: 'murder-row', sourceKey: 'mdr', reference: murderRowMdtFacts },
  { slug: 'ruby-life-pools', sourceKey: 'rlp', reference: rubyLifePoolsMdtFacts },
  { slug: 'temple-of-sethraliss', sourceKey: 'tst', reference: templeOfSethralissMdtFacts },
  { slug: 'the-blinding-vale', sourceKey: 'bvl', reference: theBlindingValeMdtFacts },
  { slug: 'voidscar-arena', sourceKey: 'vsa', reference: voidscarArenaMdtFacts },
];

/**
 * mdtFacts 参考层 ↔ sourceRegistry mdt 批次的哈希对账门禁（离线，CI 可运行）。
 *
 * agent_flow 下的原始 MDT JSON 不入库，CI 无法重算原始哈希——原始输入 ↔ 登记
 * 哈希的强制执行在 import-mdt-facts.ts 导入时完成。本门禁守护已提交的派生层：
 * 8 本参考层必须全部登记在 mdt 批次，内嵌 source.sha256（导入时写入的原始
 * 哈希）与登记哈希逐本一致，且 slug/sourceKey 与文件身份相符——防止参考层被
 * 换成未授权来源或登记哈希被静默篡改。
 */
export function validateMdtFactsHashGate(): string[] {
  const errors: string[] = [];
  for (const { slug, sourceKey, reference } of MDT_FACTS_REFERENCES) {
    const approved = getApprovedMdtFactsSnapshot(slug);
    if (!approved) {
      errors.push(`source registry: MDT_FACTS_BATCH_MISSING ${slug}`);
      continue;
    }
    if (reference.slug !== slug || reference.sourceKey !== sourceKey) {
      errors.push(`source registry: MDT_FACTS_IDENTITY_MISMATCH ${slug}`);
    }
    const embedded = reference.source?.sha256;
    if (typeof embedded !== 'string' || embedded === '') {
      errors.push(`source registry: MDT_FACTS_EMBEDDED_HASH_MISSING ${slug}`);
      continue;
    }
    if (approved.hash !== `sha256:${embedded}`) {
      errors.push(`source registry: MDT_FACTS_HASH_MISMATCH ${slug}`);
    }
  }
  return errors;
}

function printSingleResult(
  dungeonId: string,
  result: ReturnType<typeof validateDungeonDocument>,
  authoring: ReturnType<typeof authoringDiagnostics> = [],
): boolean {
  const diagnostics = [...result.errors, ...result.warnings, ...authoring];
  const ok = result.ok && authoring.every((item) => item.severity !== 'error');
  if (jsonOutput) {
    console.log(JSON.stringify({ dungeonId, ok, diagnostics }, null, 2));
  } else {
    console.log(
      `${dungeonId}: ${ok ? 'OK' : 'FAILED'} (${diagnostics.filter((item) => item.severity === 'error').length} errors, ${diagnostics.filter((item) => item.severity === 'warning').length} warnings)`,
    );
    diagnostics.forEach((item) =>
      console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`),
    );
  }
  return ok;
}

async function runSingleDungeonCheck(dungeonId: string): Promise<void> {
  const registeredDocument =
    dungeonDocuments.find((document) => document.id === dungeonId) ??
    dungeonPreviewDocuments.find((document) => document.id === dungeonId);
  try {
    const document = registeredDocument ?? (await loadAuthoringDocument(dungeonId, requestedRoot));
    const staleErrors = staleLedgerErrors();
    const runtimeReleaseErrors = runtimeReleaseArtifactErrors.map(
      (message) => `runtime release artifact: ${message}`,
    );
    const ok = printSingleResult(dungeonId, validateDungeonDocument(document), [
      ...(registeredDocument ? [] : authoringDiagnostics(document)),
      ...staleErrors.map((message) => ({
        severity: 'error' as const,
        code: message.split(':')[0] ?? 'DUNGEON_STALE_LEDGER_INVALID',
        path: 'src/dungeon/data/authoring/stale.json',
        message,
      })),
      ...runtimeReleaseErrors.map((message) => ({
        severity: 'error' as const,
        code: message.split(':')[0] ?? 'DUNGEON_RUNTIME_RELEASE_INVALID',
        path: 'src/dungeon/data/releases/current.json',
        message,
      })),
    ]);
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = {
      severity: 'error' as const,
      code: message.split(':')[0] ?? 'DUNGEON_CHECK_FAILED',
      path: '$',
      message,
    };
    if (jsonOutput) {
      console.log(JSON.stringify({ dungeonId, ok: false, diagnostics: [diagnostic] }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  }
}

function runGlobalDungeonCheck(): void {
  const errors: string[] = [];
  errors.push(...runtimeReleaseArtifactErrors);
  const knownKnowledgeIds = new Set(
    dungeonPreviewDocuments.flatMap((document) => [...documentKnowledgeIds(document)]),
  );
  errors.push(...staleLedgerErrors(knownKnowledgeIds));

  errors.push(
    ...validateForcesSnapshotRegistry(dungeonForcesSnapshotRegistry).map(
      (diagnostic) => `source registry: ${diagnostic}`,
    ),
  );
  errors.push(
    ...validateFactBindingRegistry(dungeonFactBindingRegistry).map(
      (diagnostic) => `source registry: ${diagnostic}`,
    ),
  );
  errors.push(...validateOssAssetManifestGate());
  errors.push(...validateSpellDictionaryGate());
  errors.push(...validateSpellTooltipSnapshotGate());
  errors.push(...validateMdtFactsHashGate());

  validateSeason2DungeonCatalog(
    undefined,
    new Set(dungeonDocuments.map((document) => document.id)),
  ).forEach((diagnostic) => {
    errors.push(`catalog: ${diagnostic.code} ${diagnostic.path} — ${diagnostic.message}`);
  });

  const wclIdentityDigest = createHash('sha256')
    .update(serializeSeason2WclSourceIdentity())
    .digest('hex');
  if (season2WclCatalogSource.identityDigest !== `sha256:${wclIdentityDigest}`) {
    errors.push(
      `catalog: CATALOG_WCL_SOURCE_DIGEST_MISMATCH ${season2WclCatalogSource.identityDigest} !== sha256:${wclIdentityDigest}`,
    );
  }

  let season2CoordinateReferenceCount = 0;
  for (const entry of season2DungeonCatalog) {
    errors.push(
      ...validatePublishedLearningGate(
        entry,
        dungeonDocuments.find((candidate) => candidate.id === entry.id),
      ),
    );
    if (!entry.coordinateSnapshotId) continue;
    season2CoordinateReferenceCount += 1;
    const reference = getCoordinateReference(entry);
    if (!reference) {
      errors.push(`catalog: COORDINATE_SNAPSHOT_MISSING ${entry.id} — ${entry.sourceKey}`);
    } else if (reference.snapshot.snapshotId !== entry.coordinateSnapshotId) {
      errors.push(
        `catalog: COORDINATE_SNAPSHOT_MISMATCH ${entry.id} — ${reference.snapshot.snapshotId} !== ${entry.coordinateSnapshotId}`,
      );
    }
  }

  const coordinateSnapshotHash = createHash('sha256')
    .update(
      legacyThreechestCoordinateInventory
        .map((entry) => {
          const snapshot = getCoordinateSnapshot(entry.sourceKey);
          return `${entry.sourceKey}:${snapshot ? createHash('sha256').update(serializeCoordinateSnapshot(snapshot)).digest('hex') : 'missing'}`;
        })
        .sort()
        .join('\n'),
    )
    .digest('hex');
  const registeredCoordinateHash = dungeonSourceRegistry.snapshots.find(
    (snapshot) =>
      snapshot.sourceId === 'threechest' &&
      snapshot.snapshotId === 'threechest-coordinate-snapshot-2026-08-10',
  )?.hash;
  if (registeredCoordinateHash !== `sha256:${coordinateSnapshotHash}`) {
    errors.push(
      `source registry: COORDINATE_HASH_MISMATCH ${registeredCoordinateHash ?? 'missing'} !== sha256:${coordinateSnapshotHash}`,
    );
  }

  for (const entry of legacyThreechestCoordinateInventory) {
    const snapshot = getCoordinateSnapshot(entry.sourceKey);
    if (!snapshot) {
      errors.push(
        `coordinate inventory: COORDINATE_SNAPSHOT_MISSING ${entry.id} — ${entry.sourceKey}`,
      );
    } else if (snapshot.snapshotId !== entry.coordinateSnapshotId) {
      errors.push(
        `coordinate inventory: COORDINATE_SNAPSHOT_MISMATCH ${entry.id} — ${snapshot.snapshotId} !== ${entry.coordinateSnapshotId}`,
      );
    } else {
      const registeredSnapshot = dungeonSourceRegistry.snapshots.find(
        (candidate) =>
          candidate.sourceId === entry.coordinateSourceId &&
          candidate.snapshotId === entry.coordinateSnapshotId,
      );
      if (
        !registeredSnapshot?.fieldAllowlist ||
        !coordinateSnapshotUsesAllowedFields(snapshot, registeredSnapshot.fieldAllowlist)
      ) {
        errors.push(`coordinate inventory: COORDINATE_FIELD_NOT_ALLOWED ${entry.id}`);
      }
    }
  }

  for (const entry of season2DungeonCatalog) {
    if (!entry.coordinateSnapshotId) continue;
    const snapshot = getCoordinateSnapshot(entry.coordinateSnapshotKey ?? entry.sourceKey);
    const registeredSnapshot = dungeonSourceRegistry.snapshots.find(
      (candidate) =>
        candidate.sourceId === entry.coordinateSourceId &&
        candidate.snapshotId === entry.coordinateSnapshotId,
    );
    if (!snapshot || !registeredSnapshot) {
      errors.push(`source registry: S2_COORDINATE_SNAPSHOT_MISSING ${entry.id}`);
      continue;
    }
    const coordinateSource = checkSourceUse(
      dungeonSourceRegistry,
      entry.coordinateSourceId ?? 'threechest',
      entry.coordinateSnapshotId,
      'commit-derived-data',
    );
    errors.push(...validateS2CoordinateGate(entry, snapshot, registeredSnapshot, coordinateSource));
  }

  for (const document of dungeonPreviewDocuments) {
    const result = validateDungeonDocument(document);
    result.errors.forEach((item) =>
      errors.push(`${document.id}: ${item.code} ${item.path} — ${item.message}`),
    );
  }

  const coordinateSource = checkSourceUse(
    dungeonSourceRegistry,
    'threechest',
    'threechest-coordinate-snapshot-2026-08-10',
    'commit-derived-data',
  );
  if (!coordinateSource.ok) {
    errors.push(`source registry: ${coordinateSource.reason}`);
  }

  if (errors.length > 0) {
    console.error(`Dungeon check failed with ${errors.length} error(s).`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(
      `Dungeon check passed: ${dungeonDocuments.length} registered document(s), ${dungeonPreviewDocuments.length} preview document(s), ${season2DungeonCatalog.length} S2 catalog entries (${season2CoordinateReferenceCount} coordinate reference(s)), ${legacyThreechestCoordinateInventory.length} legacy coordinate snapshot(s), source registry approved.`,
    );
  }
}

if (process.argv[1]?.endsWith('scripts/dungeons/check.ts')) {
  if (requestedDungeon) {
    await runSingleDungeonCheck(requestedDungeon);
  } else {
    runGlobalDungeonCheck();
  }
}
