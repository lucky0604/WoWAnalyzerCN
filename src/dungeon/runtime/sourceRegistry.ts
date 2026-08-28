import type { Provenance, ProvenanceLicenseStatus } from '../schema/types';

export type SourceAllowedUse =
  | 'local-research'
  | 'commit-derived-data'
  | 'redistribute'
  | 'production-asset';

export interface ApprovedSourceSnapshot {
  sourceId: string;
  snapshotId: string;
  hash: string;
  allowedUses: SourceAllowedUse[];
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
  status: 'approved' | 'revoked' | 'expired';
  evidenceRef: string;
  fieldAllowlist?: string[];
  /** Digest of the fixed raw source payload, retained separately from normalized hash. */
  rawSha256?: string;
  /** Digest of the committed source→stable sidecar, when one exists. */
  identityHash?: string;
}

/**
 * An independently committed forces snapshot.  The registry entry is the
 * binding between a digest and the exact enemy→forces payload; a document may
 * not certify editable `forcesPoints` values by itself.
 */
export interface ApprovedForcesSnapshot {
  registryKey: string;
  dungeonId: string;
  snapshotId: string;
  source: Extract<Provenance['type'], 'official' | 'game-data' | 'wcl' | 'manual-test'>;
  gameBuild: string;
  digest: string;
  enemyForces: Record<string, number>;
  totalEnemyForcesPoints: number;
  evidenceRef: string;
  status: 'approved' | 'revoked' | 'expired';
}

/** Reviewed identity for a complete fact snapshot + source→owned mapping. */
export interface ApprovedFactBinding {
  registryKey: string;
  dungeonId: string;
  season: string;
  gameBuild: string;
  snapshotId: string;
  snapshotDigest: `sha256:${string}`;
  manifestDigest: `sha256:${string}`;
  enemyDocumentIds: string[];
  abilityDocumentIds: string[];
  enemySourceKeys: string[];
  abilitySourceKeys: string[];
  enemyFacts: Array<{
    sourceKey: string;
    documentEnemyId: string;
    npcId: number;
    isBoss: boolean;
    forcesPoints: number;
  }>;
  abilityFacts: Array<{
    sourceKey: string;
    documentAbilityId: string;
    spellId: number;
    casterEnemyKeys: string[];
  }>;
  evidenceRef: string;
  status: 'approved' | 'revoked' | 'expired';
}

export interface SourceRegistry {
  version: 1;
  snapshots: ApprovedSourceSnapshot[];
}

const coordinateFieldAllowlist = [
  'sourceId',
  'floorId',
  'position',
  'patrol',
  'groupId',
  'coordinateSpace',
  'sourceEnemyId',
  'sourceEnemyIndex',
];

const approvedCoordinateSnapshot = (
  snapshotId: string,
  hash: string,
  evidenceRef: string,
  approvedAt: string,
  identityHash?: string,
  rawSha256?: string,
): ApprovedSourceSnapshot => ({
  sourceId: 'threechest',
  snapshotId,
  hash: `sha256:${hash}`,
  allowedUses: ['local-research', 'commit-derived-data', 'redistribute'],
  approvedBy: 'project-owner',
  approvedAt,
  status: 'approved',
  evidenceRef,
  fieldAllowlist: [...coordinateFieldAllowlist],
  ...(identityHash ? { identityHash: `sha256:${identityHash}` } : {}),
  ...(rawSha256 ? { rawSha256 } : {}),
});

/**
 * MDT 衍生怪物事实（NPC 身份、forces 点数、技能清单、CC 特性）。
 * 上游 MythicDungeonTools → threechest → wcl-mp-client；授权与更新流程见
 * agent_flow/mdt-snapshots/s2/README.md。hash 即对应原始 JSON 的 sha256。
 */
const approvedMdtFactsSnapshot = (
  slug: string,
  sourceKey: string,
  rawSha256: string,
): ApprovedSourceSnapshot => ({
  sourceId: 'mdt',
  snapshotId: `mdt-facts-s2-${slug}-2026-08-26`,
  hash: `sha256:${rawSha256}`,
  allowedUses: ['local-research', 'commit-derived-data', 'redistribute'],
  approvedBy: 'project-owner',
  approvedAt: '2026-08-26',
  status: 'approved',
  evidenceRef: 'agent_flow/mdt-snapshots/s2/README.md',
});

/**
 * 生产资产镜像（wcl-mp-client/downloaded）：8 本 S2 的地图瓦片（192）、NPC
 * 头像（259）、封面（8），已同步到自建 OSS（wcl-mythic-dungeon）。hash 即镜像
 * manifest.json 的 sha256；生产注入通道见 scripts/dungeons/generate-oss-manifest.ts
 * 与 src/dungeon/data/assets/oss.manifest.json。
 */
const approvedAssetMirrorSnapshot = (): ApprovedSourceSnapshot => ({
  sourceId: 'wcl-mp-client-assets',
  snapshotId: 'oss-asset-mirror-s2-2026-08-26',
  hash: 'sha256:6e6b5a6d1a90161998031b36408a00340bff4bf59791661ff3baecd38d37505b',
  allowedUses: ['local-research', 'production-asset'],
  approvedBy: 'project-owner',
  approvedAt: '2026-08-26',
  status: 'approved',
  evidenceRef: 'agent_flow/dungeon-learning/37-oss-assets-phase.md',
});

/**
 * 8 本 S2 技能字典（src/dungeon/data/spellFacts/s2.json）：spellId → 暴雪技能名与
 * 图标，来自 grimoire-wow@12.1.0-69189.3（DBC 数据）构建期生成；attributes 来自
 * mdtFacts 参考层跨施法者并集。hash 即已提交 s2.json 自身的 sha256；生成方式与
 * 门禁见 scripts/dungeons/generate-spell-dictionary.ts 与 38 号阶段文档。
 */
const approvedSpellDictionarySnapshot = (): ApprovedSourceSnapshot => ({
  sourceId: 'grimoire-wow',
  snapshotId: 'spell-dictionary-s2-2026-08-26',
  hash: 'sha256:60ed27af85efb74e3d8d65b931bbb13857049aa3b53299c4f641ea0fde454c17',
  allowedUses: ['local-research', 'commit-derived-data'],
  approvedBy: 'project-owner',
  approvedAt: '2026-08-26',
  status: 'approved',
  evidenceRef: 'agent_flow/dungeon-learning/38-spell-dictionary-phase.md',
});

export interface SourceUseCheck {
  ok: boolean;
  reason?: string;
  snapshot?: ApprovedSourceSnapshot;
}

export function checkSourceUse(
  registry: SourceRegistry,
  sourceId: string,
  snapshotId: string,
  use: SourceAllowedUse,
  now = new Date(),
): SourceUseCheck {
  const snapshot = registry.snapshots.find(
    (candidate) => candidate.sourceId === sourceId && candidate.snapshotId === snapshotId,
  );
  if (!snapshot) {
    return { ok: false, reason: `未找到来源 snapshot：${sourceId}/${snapshotId}` };
  }
  if (snapshot.status !== 'approved') {
    return { ok: false, reason: `来源 snapshot 状态为 ${snapshot.status}。`, snapshot };
  }
  if (snapshot.expiresAt && new Date(snapshot.expiresAt) <= now) {
    return { ok: false, reason: `来源 snapshot 已过期：${snapshot.expiresAt}`, snapshot };
  }
  if (!snapshot.allowedUses.includes(use)) {
    return { ok: false, reason: `来源 snapshot 未批准用途：${use}`, snapshot };
  }
  return { ok: true, snapshot };
}

export function provenanceFromSnapshot(
  snapshot: ApprovedSourceSnapshot,
  title: string,
  type: Provenance['type'] = 'threechest',
  licenseStatus: ProvenanceLicenseStatus = 'approved',
): Provenance {
  return {
    type,
    title,
    snapshot: snapshot.snapshotId,
    retrievedAt: snapshot.approvedAt,
    verifiedAt: snapshot.approvedAt,
    licenseStatus,
    notes: `source=${snapshot.sourceId}; hash=${snapshot.hash}; evidence=${snapshot.evidenceRef}`,
  };
}

export const dungeonSourceRegistry: SourceRegistry = {
  version: 1,
  snapshots: [
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-fang-ptr',
      '45c87b37dbf155ecda50b78cf3318fee4c1958f19d8e774231a863d55154df8a',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '2936511b39c756434286158624dfb620e21f5ce1cfbcaacb8e14dc8e45583883',
      'd78b7c86052d28f26849abc8784ebdba678d029844693c2b61307bab73cfa86c',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-kr-ptr',
      '43923bf6ee7c39252802234580f4581379905b13001aa45b7cbc83fcc4a1fb57',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      'c261f60e458f9f38e5d72a9b41a49489d1babf7f19d6587cb03abf64c4eaba40',
      '1336443887b5621f5253e427fcf5fc5e00ccc4e9e676a71f55ddb57ec8c0807d',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-murd-ptr',
      'c4fc5d5f8810c3ede0fa7e525bcc8c37121a65c50f8446e2363f48d40a99eba5',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '39fe7cbcffeb229acc13eb67ecab46ef2061604e69fb086235150a19afb34359',
      '941862fbb05bb5fb2eae488dbee7ce2b9fdd56b84f35c760e9209e5ed127507b',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-nalo-ptr',
      '69ba60e311c94a50278f415c8770f7eee6ad21a165b61d7eb108cb9c08b8d758',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '1a10e704ebc49acce9db09853ed389e13a5774d29f6d7bfb999a99820382cdd8',
      '5371292d3fb4e68a6031556b8fec866003f45873ce57d60560f6f94af6a1dd94',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
      '0b4e156ae5f84d490fa1f000823a233776b6c50fa9df4b03c51f55a82e270ecd',
      'agent_flow/dungeon-learning/15-rlp-s2-coordinate-import-review.md',
      '2026-08-11',
      '8c7cc69dad716d50e2b9fa426916d59ff731ca249db44aa139b24df8f8a1284b',
      '2f0736b96608b8899b823a902c755563de245f484ebf2c8c439b9d08d226c60a',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-12-rlp-s2',
      '600a49515bee6817d9f202a56644097e4ed40bc5570b953cca16707d7fe0f613',
      'agent_flow/dungeon-learning/15-rlp-s2-coordinate-import-review.md',
      '2026-08-12',
      'b0f1547113d10529c9c7f947f1493c11acfdd8a998e87cd9033a4518513d438a',
      '2dd1303529cba98420fc9c0114125458249e7721d0b2ff0bec7c754d799e18b6',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-tos-ptr',
      '76a379c38f2fe1c1031f8abd5d1e4700ee3fde01eea2b05357d4d8e8bae75900',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '9c2f2586345bf838ef6eae1e5c552cf0b7dca874a82526a02efc7021aaabd8f5',
      '4a9282f3053a5b7f24a13cf793426be593758d9f7d046afa31521e9640645713',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-vale-ptr',
      '6904372f5245324b505c66ecbe0b81cc24de653c4eb8f8e8599dd036574ae2d6',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '933dfc91a882838a0b7ccc0ea641ef41bc709dcd22ba2272a49496e218e9e044',
      '51e9901bb6df9f55632a9e50279773c7c2d1a7ee761a89e032608960a76e257b',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-11-s2-void-ptr',
      'e691dd8df1f0207e08c41a219517b79037aebccd30aeca6e99dd1899766c5659',
      'agent_flow/dungeon-learning/18-s2-fact-and-asset-preflight.md',
      '2026-08-11',
      '132e414899929355512bb8351dc3faa99183b04484657b8176919fb7eada3cfe',
      '95b315b5ffde21f819ff382ff0e1a353f53bd3f0972a632887c09c807e83256f',
    ),
    approvedCoordinateSnapshot(
      'threechest-coordinate-snapshot-2026-08-10',
      '983bf234e029516ed1e0c90de75b8b2bca82ecc06b54a59326d97976d8578612',
      'agent_flow/dungeon-learning/08-confirmed-development-source-decisions.md',
      '2026-08-10',
    ),
    // mdt 批次：8 本 Midnight S2 原始 MDT 事实快照（导入器
    // scripts/dungeons/import-mdt-facts.ts 消费这些哈希做来源校验）。
    approvedMdtFactsSnapshot(
      'altar-of-fangs',
      'aof',
      'd3a30433743b0c35d7d3b0e9b875fe7c03b478a83c36fe749a654cb1bb91cdf1',
    ),
    approvedMdtFactsSnapshot(
      'den-of-nalorakk',
      'dnl',
      '3d51dc1c6ff8aacb85288990a33c206d2dc884346dd3a035fc88bf92481acc83',
    ),
    approvedMdtFactsSnapshot(
      'kings-rest',
      'kr',
      'd105c6589a8a89c7e0a68127af04c9ed4a43f81db06bcf3072b48f8d1b92a040',
    ),
    approvedMdtFactsSnapshot(
      'murder-row',
      'mdr',
      'e479dd33f3dcb877fe351477e722321c0d5cbf20c81c582189a6e9a4335c2592',
    ),
    approvedMdtFactsSnapshot(
      'ruby-life-pools',
      'rlp',
      '2dd1303529cba98420fc9c0114125458249e7721d0b2ff0bec7c754d799e18b6',
    ),
    approvedMdtFactsSnapshot(
      'temple-of-sethraliss',
      'tst',
      '4e95019a8425c3dfaf9efe04578d7974326d332b705858459c207312e6489b5d',
    ),
    approvedMdtFactsSnapshot(
      'the-blinding-vale',
      'bvl',
      '8a90e1493df268a955ae5570de267ef682c97a1aa41eeab787c02091a65b1c39',
    ),
    approvedMdtFactsSnapshot(
      'voidscar-arena',
      'vsa',
      '513aa9ce0d36b73af87ebaf642b60fe9633746148602c718136bfdc602bc220d',
    ),
    // 资产镜像批次：OSS 上的瓦片/头像/封面（Phase B）。
    approvedAssetMirrorSnapshot(),
    approvedSpellDictionarySnapshot(),
  ],
};

/**
 * 按地城 slug 查找已登记的 mdt 事实批次（snapshotId 由本模块统一拼装）。
 * 导入器（scripts/dungeons/import-mdt-facts.ts）在导入前用它校验原始 JSON
 * 哈希；check.ts 门禁用它对账已提交参考层内嵌的 source.sha256。
 */
export function getApprovedMdtFactsSnapshot(
  slug: string,
): ApprovedSourceSnapshot | undefined {
  return dungeonSourceRegistry.snapshots.find(
    (candidate) =>
      candidate.sourceId === 'mdt' &&
      candidate.snapshotId === `mdt-facts-s2-${slug}-2026-08-26`,
  );
}

/**
 * No S2 forces snapshot is approved yet.  Keeping this registry explicit makes
 * the readiness gate fail closed until a maintainer commits the canonical
 * payload, build, source evidence and digest together.
 */
export const dungeonForcesSnapshotRegistry: readonly ApprovedForcesSnapshot[] = [];

/**
 * Intentionally empty until a maintainer reviews a real current-build fact
 * snapshot and its mapping manifest. Draft binding output is not a release
 * credential merely because its digest is well-formed.
 */
export const dungeonFactBindingRegistry: ApprovedFactBinding[] = [];

export function getForcesSnapshotRegistryEntry(
  registryKey: string,
): ApprovedForcesSnapshot | undefined {
  const matches = dungeonForcesSnapshotRegistry.filter(
    (entry) => entry.registryKey === registryKey,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function getFactBindingRegistryEntry(
  registryKey: string,
  registry: readonly ApprovedFactBinding[] = dungeonFactBindingRegistry,
): ApprovedFactBinding | undefined {
  if (!Array.isArray(registry)) return undefined;
  const matches = registry.filter(
    (entry) => entry && typeof entry === 'object' && entry.registryKey === registryKey,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function validateFactBindingRegistry(
  registry: readonly ApprovedFactBinding[] = dungeonFactBindingRegistry,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(registry)) return ['FACT_BINDING_REGISTRY_INVALID_SHAPE'];
  const keys = new Set<string>();
  registry.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`FACT_BINDING_REGISTRY_INVALID_ENTRY #${index}`);
      return;
    }
    const candidate = entry as Partial<ApprovedFactBinding>;
    if (
      typeof candidate.registryKey !== 'string' ||
      !candidate.registryKey.trim() ||
      keys.has(candidate.registryKey)
    ) {
      errors.push(`FACT_BINDING_REGISTRY_DUPLICATE_KEY ${candidate.registryKey || `#${index}`}`);
    }
    if (typeof candidate.registryKey === 'string' && candidate.registryKey.trim()) {
      keys.add(candidate.registryKey);
    }
    if (
      typeof candidate.dungeonId !== 'string' ||
      !candidate.dungeonId.trim() ||
      typeof candidate.season !== 'string' ||
      !candidate.season.trim() ||
      typeof candidate.gameBuild !== 'string' ||
      !candidate.gameBuild.trim() ||
      typeof candidate.snapshotId !== 'string' ||
      !candidate.snapshotId.trim() ||
      typeof candidate.evidenceRef !== 'string' ||
      !candidate.evidenceRef.trim() ||
      !/^sha256:[a-f0-9]{64}$/.test(candidate.snapshotDigest ?? '') ||
      !/^sha256:[a-f0-9]{64}$/.test(candidate.manifestDigest ?? '') ||
      !['approved', 'revoked', 'expired'].includes(candidate.status ?? '')
    ) {
      errors.push(`FACT_BINDING_REGISTRY_INVALID_METADATA ${candidate.registryKey ?? `#${index}`}`);
    }
    if (
      !Array.isArray(candidate.enemyDocumentIds) ||
      !Array.isArray(candidate.abilityDocumentIds) ||
      !Array.isArray(candidate.enemySourceKeys) ||
      !Array.isArray(candidate.abilitySourceKeys) ||
      !Array.isArray(candidate.enemyFacts) ||
      !Array.isArray(candidate.abilityFacts) ||
      candidate.enemyDocumentIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      candidate.abilityDocumentIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      candidate.enemySourceKeys.some((key) => typeof key !== 'string' || !key.trim()) ||
      candidate.abilitySourceKeys.some((key) => typeof key !== 'string' || !key.trim()) ||
      new Set(candidate.enemyDocumentIds).size !== candidate.enemyDocumentIds.length ||
      new Set(candidate.abilityDocumentIds).size !== candidate.abilityDocumentIds.length ||
      new Set(candidate.enemySourceKeys).size !== candidate.enemySourceKeys.length ||
      new Set(candidate.abilitySourceKeys).size !== candidate.abilitySourceKeys.length
    ) {
      errors.push(`FACT_BINDING_REGISTRY_INVALID_MAPPING ${candidate.registryKey ?? `#${index}`}`);
    }
    const enemyFacts = candidate.enemyFacts;
    const abilityFacts = candidate.abilityFacts;
    if (
      !Array.isArray(enemyFacts) ||
      !Array.isArray(abilityFacts) ||
      enemyFacts.length !== candidate.enemyDocumentIds?.length ||
      abilityFacts.length !== candidate.abilityDocumentIds?.length ||
      enemyFacts.some(
        (fact) =>
          !fact ||
          typeof fact !== 'object' ||
          typeof fact.sourceKey !== 'string' ||
          !fact.sourceKey.trim() ||
          typeof fact.documentEnemyId !== 'string' ||
          !fact.documentEnemyId.trim() ||
          typeof fact.npcId !== 'number' ||
          !Number.isInteger(fact.npcId) ||
          fact.npcId < 1 ||
          typeof fact.isBoss !== 'boolean' ||
          typeof fact.forcesPoints !== 'number' ||
          !Number.isInteger(fact.forcesPoints) ||
          fact.forcesPoints < 0,
      ) ||
      abilityFacts.some(
        (fact) =>
          !fact ||
          typeof fact !== 'object' ||
          typeof fact.sourceKey !== 'string' ||
          !fact.sourceKey.trim() ||
          typeof fact.documentAbilityId !== 'string' ||
          !fact.documentAbilityId.trim() ||
          typeof fact.spellId !== 'number' ||
          !Number.isInteger(fact.spellId) ||
          fact.spellId < 1 ||
          !Array.isArray(fact.casterEnemyKeys) ||
          fact.casterEnemyKeys.length === 0 ||
          new Set(fact.casterEnemyKeys).size !== fact.casterEnemyKeys.length ||
          fact.casterEnemyKeys.some((key) => typeof key !== 'string' || !key.trim()),
      )
    ) {
      errors.push(`FACT_BINDING_REGISTRY_INVALID_FACTS ${candidate.registryKey ?? `#${index}`}`);
    }
    if (
      Array.isArray(enemyFacts) &&
      Array.isArray(abilityFacts) &&
      (enemyFacts.some(
        (fact, factIndex) =>
          !fact ||
          typeof fact !== 'object' ||
          fact.sourceKey !== candidate.enemySourceKeys?.[factIndex] ||
          fact.documentEnemyId !== candidate.enemyDocumentIds?.[factIndex],
      ) ||
        abilityFacts.some(
          (fact, factIndex) =>
            !fact ||
            typeof fact !== 'object' ||
            fact.sourceKey !== candidate.abilitySourceKeys?.[factIndex] ||
            fact.documentAbilityId !== candidate.abilityDocumentIds?.[factIndex],
        ))
    ) {
      errors.push(
        `FACT_BINDING_REGISTRY_FACT_MAPPING_MISMATCH ${candidate.registryKey ?? `#${index}`}`,
      );
    }
  });
  return errors;
}

export function validateForcesSnapshotRegistry(
  registry: readonly ApprovedForcesSnapshot[] = dungeonForcesSnapshotRegistry,
): string[] {
  const errors: string[] = [];
  const allowedSources = new Set(['official', 'game-data', 'wcl', 'manual-test']);
  const keys = new Set<string>();
  registry.forEach((entry, index) => {
    if (!entry.registryKey || keys.has(entry.registryKey)) {
      errors.push(`FORCES_REGISTRY_DUPLICATE_KEY ${entry.registryKey || `#${index}`}`);
    }
    keys.add(entry.registryKey);
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.digest)) {
      errors.push(`FORCES_REGISTRY_INVALID_DIGEST ${entry.registryKey}`);
    }
    if (!allowedSources.has(entry.source)) {
      errors.push(`FORCES_REGISTRY_INVALID_SOURCE ${entry.registryKey}`);
    }
    if (!entry.evidenceRef || !entry.gameBuild || !entry.snapshotId || !entry.dungeonId) {
      errors.push(`FORCES_REGISTRY_MISSING_METADATA ${entry.registryKey}`);
    }
    const enemyForces = entry.enemyForces as unknown;
    const isRecord =
      typeof enemyForces === 'object' && enemyForces !== null && !Array.isArray(enemyForces);
    const values = isRecord ? Object.values(enemyForces) : [];
    if (
      values.length === 0 ||
      values.some((value) => !Number.isInteger(value) || value < 0) ||
      values.reduce((total, value) => total + value, 0) !== entry.totalEnemyForcesPoints
    ) {
      errors.push(`FORCES_REGISTRY_INVALID_PAYLOAD ${entry.registryKey}`);
    }
  });
  return errors;
}
