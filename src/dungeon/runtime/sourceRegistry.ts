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
 * A binding entry is only added after a maintainer reviews the binding plan,
 * the per-row decisions and the mapping manifest together with the bound
 * document.  Draft binding output is not a release credential merely because
 * its digest is well-formed.
 */
/**
 * Maintainer-approved fact binding for altar-of-fangs (S2 MDT pilot).
 * Identity is extracted verbatim from the bound document generated by the
 * fact-binding pipeline; reviewed artifacts live in
 * src/dungeon/data/authoring/altar-of-fangs/binding/ (plan, decisions,
 * manifest).  Evidence chain: agent_flow/mdt-snapshots/s2/README.md.
 */
const altarOfFangsFactBinding: ApprovedFactBinding = {
  registryKey: "fact-binding:mdt-facts-s2-altar-of-fangs-2026-08-26",
  dungeonId: "altar-of-fangs",
  season: "midnight-s2",
  gameBuild: "12.1.0",
  snapshotId: "mdt-facts-s2-altar-of-fangs-2026-08-26",
  snapshotDigest: "sha256:81796bb1157ebbe29b8387363073f8ccf977126703e825ce6f1a8c57cf8fa023" as const,
  manifestDigest: "sha256:b45c18e75bc2c8bfc406475eaa809bbb76ca1fa9430a4df3090db2daab721c64" as const,
  enemyDocumentIds: ["aof-enemy-270306", "aof-enemy-261552", "aof-enemy-261557", "aof-enemy-261556", "aof-enemy-263112", "aof-enemy-261560", "aof-enemy-261553", "aof-enemy-263109", "aof-enemy-261573", "aof-enemy-261554", "aof-enemy-261550", "aof-enemy-262011", "aof-enemy-271453", "aof-enemy-259445", "aof-enemy-259446", "aof-enemy-259447", "aof-enemy-262398", "aof-enemy-264798", "aof-enemy-268358", "aof-enemy-270378", "aof-enemy-270417"],
  enemySourceKeys: ["Ritual Chieftain", "Bloodletter", "High Evolutionist", "Hatchling", "Living Venom", "Primal Serpent", "Ravenous Descendant", "Ula'tek's Chosen", "Ascendant Serpent", "Twinfang Harrower", "Venom Leech", "Rattling Writhe", "Blade of the Altar", "Rav'i", "The Writhing Coil", "Zul'jan", "Uncoiled Writhe [262398]", "Infused Eggs", "Ritual Snake", "Ritual Spirit", "Uncoiled Writhe [270417]"],
  abilityDocumentIds: ["aof-ability-1221063", "aof-ability-1287544", "aof-ability-1287798", "aof-ability-1287811", "aof-ability-1289416", "aof-ability-1292892", "aof-ability-1292904", "aof-ability-1293059", "aof-ability-1293079", "aof-ability-1293420", "aof-ability-1294432", "aof-ability-1294557", "aof-ability-1294567", "aof-ability-1294568", "aof-ability-1294569", "aof-ability-1294570", "aof-ability-1294572", "aof-ability-1294845", "aof-ability-1294849", "aof-ability-1294859", "aof-ability-1294934", "aof-ability-1294958", "aof-ability-1295055", "aof-ability-1295073", "aof-ability-1296050", "aof-ability-1296058", "aof-ability-1296069", "aof-ability-1296216", "aof-ability-1296219", "aof-ability-1296220", "aof-ability-1297876", "aof-ability-1298221", "aof-ability-1298223", "aof-ability-1298683", "aof-ability-1298949", "aof-ability-1299053", "aof-ability-1299080", "aof-ability-1299130", "aof-ability-1299135", "aof-ability-1299154", "aof-ability-1299189", "aof-ability-1299902", "aof-ability-1299940", "aof-ability-1300044", "aof-ability-1300083", "aof-ability-1300503", "aof-ability-1300612", "aof-ability-1300618", "aof-ability-1300686", "aof-ability-1300698", "aof-ability-1300876", "aof-ability-1300885", "aof-ability-1300886", "aof-ability-1300888", "aof-ability-1300892", "aof-ability-1300894", "aof-ability-1300901", "aof-ability-1301111", "aof-ability-1301114", "aof-ability-1301217", "aof-ability-1301350", "aof-ability-1301353", "aof-ability-1301413", "aof-ability-1301508", "aof-ability-1303366", "aof-ability-1305368", "aof-ability-1305393", "aof-ability-1305637", "aof-ability-1306230", "aof-ability-1306232", "aof-ability-1306235", "aof-ability-1306308", "aof-ability-1306333", "aof-ability-1306338", "aof-ability-1306345", "aof-ability-1306381", "aof-ability-1306383", "aof-ability-1306385", "aof-ability-1306517", "aof-ability-1306550", "aof-ability-1306641", "aof-ability-1306657", "aof-ability-1306668", "aof-ability-1306669", "aof-ability-1306844", "aof-ability-1306852", "aof-ability-1306853", "aof-ability-1306856", "aof-ability-1306893", "aof-ability-1306911", "aof-ability-1307098", "aof-ability-1307144", "aof-ability-1307269", "aof-ability-1307526", "aof-ability-1307567", "aof-ability-1307571", "aof-ability-1307573", "aof-ability-1307602", "aof-ability-1307700", "aof-ability-1307703", "aof-ability-1307765", "aof-ability-1307768", "aof-ability-1307894", "aof-ability-1307915", "aof-ability-1307921", "aof-ability-1308518", "aof-ability-1308864", "aof-ability-1308865", "aof-ability-1309382", "aof-ability-1309398", "aof-ability-1309415", "aof-ability-1309416", "aof-ability-1309522", "aof-ability-1310357", "aof-ability-1310378", "aof-ability-1310413", "aof-ability-1310547", "aof-ability-1310666", "aof-ability-1310974"],
  abilitySourceKeys: ["spell-1221063", "spell-1287544", "spell-1287798", "spell-1287811", "spell-1289416", "spell-1292892", "spell-1292904", "spell-1293059", "spell-1293079", "spell-1293420", "spell-1294432", "spell-1294557", "spell-1294567", "spell-1294568", "spell-1294569", "spell-1294570", "spell-1294572", "spell-1294845", "spell-1294849", "spell-1294859", "spell-1294934", "spell-1294958", "spell-1295055", "spell-1295073", "spell-1296050", "spell-1296058", "spell-1296069", "spell-1296216", "spell-1296219", "spell-1296220", "spell-1297876", "spell-1298221", "spell-1298223", "spell-1298683", "spell-1298949", "spell-1299053", "spell-1299080", "spell-1299130", "spell-1299135", "spell-1299154", "spell-1299189", "spell-1299902", "spell-1299940", "spell-1300044", "spell-1300083", "spell-1300503", "spell-1300612", "spell-1300618", "spell-1300686", "spell-1300698", "spell-1300876", "spell-1300885", "spell-1300886", "spell-1300888", "spell-1300892", "spell-1300894", "spell-1300901", "spell-1301111", "spell-1301114", "spell-1301217", "spell-1301350", "spell-1301353", "spell-1301413", "spell-1301508", "spell-1303366", "spell-1305368", "spell-1305393", "spell-1305637", "spell-1306230", "spell-1306232", "spell-1306235", "spell-1306308", "spell-1306333", "spell-1306338", "spell-1306345", "spell-1306381", "spell-1306383", "spell-1306385", "spell-1306517", "spell-1306550", "spell-1306641", "spell-1306657", "spell-1306668", "spell-1306669", "spell-1306844", "spell-1306852", "spell-1306853", "spell-1306856", "spell-1306893", "spell-1306911", "spell-1307098", "spell-1307144", "spell-1307269", "spell-1307526", "spell-1307567", "spell-1307571", "spell-1307573", "spell-1307602", "spell-1307700", "spell-1307703", "spell-1307765", "spell-1307768", "spell-1307894", "spell-1307915", "spell-1307921", "spell-1308518", "spell-1308864", "spell-1308865", "spell-1309382", "spell-1309398", "spell-1309415", "spell-1309416", "spell-1309522", "spell-1310357", "spell-1310378", "spell-1310413", "spell-1310547", "spell-1310666", "spell-1310974"],
  enemyFacts: [{"sourceKey": "Ritual Chieftain", "documentEnemyId": "aof-enemy-270306", "npcId": 270306, "isBoss": false, "forcesPoints": 25}, {"sourceKey": "Bloodletter", "documentEnemyId": "aof-enemy-261552", "npcId": 261552, "isBoss": false, "forcesPoints": 5}, {"sourceKey": "High Evolutionist", "documentEnemyId": "aof-enemy-261557", "npcId": 261557, "isBoss": false, "forcesPoints": 7}, {"sourceKey": "Hatchling", "documentEnemyId": "aof-enemy-261556", "npcId": 261556, "isBoss": false, "forcesPoints": 0}, {"sourceKey": "Living Venom", "documentEnemyId": "aof-enemy-263112", "npcId": 263112, "isBoss": false, "forcesPoints": 1}, {"sourceKey": "Primal Serpent", "documentEnemyId": "aof-enemy-261560", "npcId": 261560, "isBoss": false, "forcesPoints": 7}, {"sourceKey": "Ravenous Descendant", "documentEnemyId": "aof-enemy-261553", "npcId": 261553, "isBoss": false, "forcesPoints": 5}, {"sourceKey": "Ula'tek's Chosen", "documentEnemyId": "aof-enemy-263109", "npcId": 263109, "isBoss": false, "forcesPoints": 25}, {"sourceKey": "Ascendant Serpent", "documentEnemyId": "aof-enemy-261573", "npcId": 261573, "isBoss": false, "forcesPoints": 30}, {"sourceKey": "Twinfang Harrower", "documentEnemyId": "aof-enemy-261554", "npcId": 261554, "isBoss": false, "forcesPoints": 25}, {"sourceKey": "Venom Leech", "documentEnemyId": "aof-enemy-261550", "npcId": 261550, "isBoss": false, "forcesPoints": 1}, {"sourceKey": "Rattling Writhe", "documentEnemyId": "aof-enemy-262011", "npcId": 262011, "isBoss": false, "forcesPoints": 25}, {"sourceKey": "Blade of the Altar", "documentEnemyId": "aof-enemy-271453", "npcId": 271453, "isBoss": false, "forcesPoints": 5}, {"sourceKey": "Rav'i", "documentEnemyId": "aof-enemy-259445", "npcId": 259445, "isBoss": true, "forcesPoints": 0}, {"sourceKey": "The Writhing Coil", "documentEnemyId": "aof-enemy-259446", "npcId": 259446, "isBoss": true, "forcesPoints": 0}, {"sourceKey": "Zul'jan", "documentEnemyId": "aof-enemy-259447", "npcId": 259447, "isBoss": true, "forcesPoints": 0}, {"sourceKey": "Uncoiled Writhe [262398]", "documentEnemyId": "aof-enemy-262398", "npcId": 262398, "isBoss": false, "forcesPoints": 0}, {"sourceKey": "Infused Eggs", "documentEnemyId": "aof-enemy-264798", "npcId": 264798, "isBoss": false, "forcesPoints": 0}, {"sourceKey": "Ritual Snake", "documentEnemyId": "aof-enemy-268358", "npcId": 268358, "isBoss": false, "forcesPoints": 0}, {"sourceKey": "Ritual Spirit", "documentEnemyId": "aof-enemy-270378", "npcId": 270378, "isBoss": false, "forcesPoints": 0}, {"sourceKey": "Uncoiled Writhe [270417]", "documentEnemyId": "aof-enemy-270417", "npcId": 270417, "isBoss": false, "forcesPoints": 0}],
  abilityFacts: [{"sourceKey": "spell-1221063", "documentAbilityId": "aof-ability-1221063", "spellId": 1221063, "casterEnemyKeys": ["Ritual Chieftain", "Bloodletter", "High Evolutionist", "Hatchling", "Primal Serpent", "Ravenous Descendant", "Ascendant Serpent", "Twinfang Harrower", "Rattling Writhe", "Blade of the Altar", "Uncoiled Writhe [262398]"]}, {"sourceKey": "spell-1287544", "documentAbilityId": "aof-ability-1287544", "spellId": 1287544, "casterEnemyKeys": ["High Evolutionist"]}, {"sourceKey": "spell-1287798", "documentAbilityId": "aof-ability-1287798", "spellId": 1287798, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1287811", "documentAbilityId": "aof-ability-1287811", "spellId": 1287811, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1289416", "documentAbilityId": "aof-ability-1289416", "spellId": 1289416, "casterEnemyKeys": ["High Evolutionist", "Ula'tek's Chosen"]}, {"sourceKey": "spell-1292892", "documentAbilityId": "aof-ability-1292892", "spellId": 1292892, "casterEnemyKeys": ["Ula'tek's Chosen"]}, {"sourceKey": "spell-1292904", "documentAbilityId": "aof-ability-1292904", "spellId": 1292904, "casterEnemyKeys": ["High Evolutionist"]}, {"sourceKey": "spell-1293059", "documentAbilityId": "aof-ability-1293059", "spellId": 1293059, "casterEnemyKeys": ["Infused Eggs"]}, {"sourceKey": "spell-1293079", "documentAbilityId": "aof-ability-1293079", "spellId": 1293079, "casterEnemyKeys": ["Infused Eggs"]}, {"sourceKey": "spell-1293420", "documentAbilityId": "aof-ability-1293420", "spellId": 1293420, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1294432", "documentAbilityId": "aof-ability-1294432", "spellId": 1294432, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1294557", "documentAbilityId": "aof-ability-1294557", "spellId": 1294557, "casterEnemyKeys": ["Primal Serpent"]}, {"sourceKey": "spell-1294567", "documentAbilityId": "aof-ability-1294567", "spellId": 1294567, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1294568", "documentAbilityId": "aof-ability-1294568", "spellId": 1294568, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1294569", "documentAbilityId": "aof-ability-1294569", "spellId": 1294569, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1294570", "documentAbilityId": "aof-ability-1294570", "spellId": 1294570, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1294572", "documentAbilityId": "aof-ability-1294572", "spellId": 1294572, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1294845", "documentAbilityId": "aof-ability-1294845", "spellId": 1294845, "casterEnemyKeys": ["Rattling Writhe"]}, {"sourceKey": "spell-1294849", "documentAbilityId": "aof-ability-1294849", "spellId": 1294849, "casterEnemyKeys": ["Rattling Writhe"]}, {"sourceKey": "spell-1294859", "documentAbilityId": "aof-ability-1294859", "spellId": 1294859, "casterEnemyKeys": ["Rattling Writhe"]}, {"sourceKey": "spell-1294934", "documentAbilityId": "aof-ability-1294934", "spellId": 1294934, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1294958", "documentAbilityId": "aof-ability-1294958", "spellId": 1294958, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1295055", "documentAbilityId": "aof-ability-1295055", "spellId": 1295055, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1295073", "documentAbilityId": "aof-ability-1295073", "spellId": 1295073, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1296050", "documentAbilityId": "aof-ability-1296050", "spellId": 1296050, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1296058", "documentAbilityId": "aof-ability-1296058", "spellId": 1296058, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1296069", "documentAbilityId": "aof-ability-1296069", "spellId": 1296069, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1296216", "documentAbilityId": "aof-ability-1296216", "spellId": 1296216, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1296219", "documentAbilityId": "aof-ability-1296219", "spellId": 1296219, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1296220", "documentAbilityId": "aof-ability-1296220", "spellId": 1296220, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1297876", "documentAbilityId": "aof-ability-1297876", "spellId": 1297876, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1298221", "documentAbilityId": "aof-ability-1298221", "spellId": 1298221, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1298223", "documentAbilityId": "aof-ability-1298223", "spellId": 1298223, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1298683", "documentAbilityId": "aof-ability-1298683", "spellId": 1298683, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1298949", "documentAbilityId": "aof-ability-1298949", "spellId": 1298949, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299053", "documentAbilityId": "aof-ability-1299053", "spellId": 1299053, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299080", "documentAbilityId": "aof-ability-1299080", "spellId": 1299080, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299130", "documentAbilityId": "aof-ability-1299130", "spellId": 1299130, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299135", "documentAbilityId": "aof-ability-1299135", "spellId": 1299135, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299154", "documentAbilityId": "aof-ability-1299154", "spellId": 1299154, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299189", "documentAbilityId": "aof-ability-1299189", "spellId": 1299189, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299902", "documentAbilityId": "aof-ability-1299902", "spellId": 1299902, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1299940", "documentAbilityId": "aof-ability-1299940", "spellId": 1299940, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1300044", "documentAbilityId": "aof-ability-1300044", "spellId": 1300044, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1300083", "documentAbilityId": "aof-ability-1300083", "spellId": 1300083, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1300503", "documentAbilityId": "aof-ability-1300503", "spellId": 1300503, "casterEnemyKeys": ["The Writhing Coil", "Uncoiled Writhe [262398]"]}, {"sourceKey": "spell-1300612", "documentAbilityId": "aof-ability-1300612", "spellId": 1300612, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1300618", "documentAbilityId": "aof-ability-1300618", "spellId": 1300618, "casterEnemyKeys": ["Uncoiled Writhe [262398]", "Uncoiled Writhe [270417]"]}, {"sourceKey": "spell-1300686", "documentAbilityId": "aof-ability-1300686", "spellId": 1300686, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1300698", "documentAbilityId": "aof-ability-1300698", "spellId": 1300698, "casterEnemyKeys": ["Uncoiled Writhe [262398]", "Uncoiled Writhe [270417]"]}, {"sourceKey": "spell-1300876", "documentAbilityId": "aof-ability-1300876", "spellId": 1300876, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1300885", "documentAbilityId": "aof-ability-1300885", "spellId": 1300885, "casterEnemyKeys": ["Ritual Snake"]}, {"sourceKey": "spell-1300886", "documentAbilityId": "aof-ability-1300886", "spellId": 1300886, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1300888", "documentAbilityId": "aof-ability-1300888", "spellId": 1300888, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1300892", "documentAbilityId": "aof-ability-1300892", "spellId": 1300892, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1300894", "documentAbilityId": "aof-ability-1300894", "spellId": 1300894, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1300901", "documentAbilityId": "aof-ability-1300901", "spellId": 1300901, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301111", "documentAbilityId": "aof-ability-1301111", "spellId": 1301111, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301114", "documentAbilityId": "aof-ability-1301114", "spellId": 1301114, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301217", "documentAbilityId": "aof-ability-1301217", "spellId": 1301217, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301350", "documentAbilityId": "aof-ability-1301350", "spellId": 1301350, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301353", "documentAbilityId": "aof-ability-1301353", "spellId": 1301353, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301413", "documentAbilityId": "aof-ability-1301413", "spellId": 1301413, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1301508", "documentAbilityId": "aof-ability-1301508", "spellId": 1301508, "casterEnemyKeys": ["Zul'jan"]}, {"sourceKey": "spell-1303366", "documentAbilityId": "aof-ability-1303366", "spellId": 1303366, "casterEnemyKeys": ["Living Venom"]}, {"sourceKey": "spell-1305368", "documentAbilityId": "aof-ability-1305368", "spellId": 1305368, "casterEnemyKeys": ["The Writhing Coil", "Uncoiled Writhe [262398]"]}, {"sourceKey": "spell-1305393", "documentAbilityId": "aof-ability-1305393", "spellId": 1305393, "casterEnemyKeys": ["The Writhing Coil", "Uncoiled Writhe [262398]", "Uncoiled Writhe [270417]"]}, {"sourceKey": "spell-1305637", "documentAbilityId": "aof-ability-1305637", "spellId": 1305637, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1306230", "documentAbilityId": "aof-ability-1306230", "spellId": 1306230, "casterEnemyKeys": ["Living Venom"]}, {"sourceKey": "spell-1306232", "documentAbilityId": "aof-ability-1306232", "spellId": 1306232, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1306235", "documentAbilityId": "aof-ability-1306235", "spellId": 1306235, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1306308", "documentAbilityId": "aof-ability-1306308", "spellId": 1306308, "casterEnemyKeys": ["Ravenous Descendant"]}, {"sourceKey": "spell-1306333", "documentAbilityId": "aof-ability-1306333", "spellId": 1306333, "casterEnemyKeys": ["Ravenous Descendant"]}, {"sourceKey": "spell-1306338", "documentAbilityId": "aof-ability-1306338", "spellId": 1306338, "casterEnemyKeys": ["Ravenous Descendant"]}, {"sourceKey": "spell-1306345", "documentAbilityId": "aof-ability-1306345", "spellId": 1306345, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1306381", "documentAbilityId": "aof-ability-1306381", "spellId": 1306381, "casterEnemyKeys": ["Primal Serpent"]}, {"sourceKey": "spell-1306383", "documentAbilityId": "aof-ability-1306383", "spellId": 1306383, "casterEnemyKeys": ["Hatchling"]}, {"sourceKey": "spell-1306385", "documentAbilityId": "aof-ability-1306385", "spellId": 1306385, "casterEnemyKeys": ["High Evolutionist"]}, {"sourceKey": "spell-1306517", "documentAbilityId": "aof-ability-1306517", "spellId": 1306517, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1306550", "documentAbilityId": "aof-ability-1306550", "spellId": 1306550, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1306641", "documentAbilityId": "aof-ability-1306641", "spellId": 1306641, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1306657", "documentAbilityId": "aof-ability-1306657", "spellId": 1306657, "casterEnemyKeys": ["Ritual Spirit"]}, {"sourceKey": "spell-1306668", "documentAbilityId": "aof-ability-1306668", "spellId": 1306668, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1306669", "documentAbilityId": "aof-ability-1306669", "spellId": 1306669, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1306844", "documentAbilityId": "aof-ability-1306844", "spellId": 1306844, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1306852", "documentAbilityId": "aof-ability-1306852", "spellId": 1306852, "casterEnemyKeys": ["Ula'tek's Chosen"]}, {"sourceKey": "spell-1306853", "documentAbilityId": "aof-ability-1306853", "spellId": 1306853, "casterEnemyKeys": ["Ula'tek's Chosen"]}, {"sourceKey": "spell-1306856", "documentAbilityId": "aof-ability-1306856", "spellId": 1306856, "casterEnemyKeys": ["Ula'tek's Chosen"]}, {"sourceKey": "spell-1306893", "documentAbilityId": "aof-ability-1306893", "spellId": 1306893, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1306911", "documentAbilityId": "aof-ability-1306911", "spellId": 1306911, "casterEnemyKeys": ["Ritual Chieftain"]}, {"sourceKey": "spell-1307098", "documentAbilityId": "aof-ability-1307098", "spellId": 1307098, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1307144", "documentAbilityId": "aof-ability-1307144", "spellId": 1307144, "casterEnemyKeys": ["Venom Leech"]}, {"sourceKey": "spell-1307269", "documentAbilityId": "aof-ability-1307269", "spellId": 1307269, "casterEnemyKeys": ["Twinfang Harrower"]}, {"sourceKey": "spell-1307526", "documentAbilityId": "aof-ability-1307526", "spellId": 1307526, "casterEnemyKeys": ["Bloodletter"]}, {"sourceKey": "spell-1307567", "documentAbilityId": "aof-ability-1307567", "spellId": 1307567, "casterEnemyKeys": ["High Evolutionist", "Ula'tek's Chosen"]}, {"sourceKey": "spell-1307571", "documentAbilityId": "aof-ability-1307571", "spellId": 1307571, "casterEnemyKeys": ["High Evolutionist", "Ula'tek's Chosen"]}, {"sourceKey": "spell-1307573", "documentAbilityId": "aof-ability-1307573", "spellId": 1307573, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307602", "documentAbilityId": "aof-ability-1307602", "spellId": 1307602, "casterEnemyKeys": ["High Evolutionist"]}, {"sourceKey": "spell-1307700", "documentAbilityId": "aof-ability-1307700", "spellId": 1307700, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307703", "documentAbilityId": "aof-ability-1307703", "spellId": 1307703, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307765", "documentAbilityId": "aof-ability-1307765", "spellId": 1307765, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307768", "documentAbilityId": "aof-ability-1307768", "spellId": 1307768, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307894", "documentAbilityId": "aof-ability-1307894", "spellId": 1307894, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307915", "documentAbilityId": "aof-ability-1307915", "spellId": 1307915, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1307921", "documentAbilityId": "aof-ability-1307921", "spellId": 1307921, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1308518", "documentAbilityId": "aof-ability-1308518", "spellId": 1308518, "casterEnemyKeys": ["Blade of the Altar"]}, {"sourceKey": "spell-1308864", "documentAbilityId": "aof-ability-1308864", "spellId": 1308864, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1308865", "documentAbilityId": "aof-ability-1308865", "spellId": 1308865, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1309382", "documentAbilityId": "aof-ability-1309382", "spellId": 1309382, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1309398", "documentAbilityId": "aof-ability-1309398", "spellId": 1309398, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1309415", "documentAbilityId": "aof-ability-1309415", "spellId": 1309415, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1309416", "documentAbilityId": "aof-ability-1309416", "spellId": 1309416, "casterEnemyKeys": ["Ascendant Serpent"]}, {"sourceKey": "spell-1309522", "documentAbilityId": "aof-ability-1309522", "spellId": 1309522, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1310357", "documentAbilityId": "aof-ability-1310357", "spellId": 1310357, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1310378", "documentAbilityId": "aof-ability-1310378", "spellId": 1310378, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1310413", "documentAbilityId": "aof-ability-1310413", "spellId": 1310413, "casterEnemyKeys": ["Rav'i"]}, {"sourceKey": "spell-1310547", "documentAbilityId": "aof-ability-1310547", "spellId": 1310547, "casterEnemyKeys": ["The Writhing Coil"]}, {"sourceKey": "spell-1310666", "documentAbilityId": "aof-ability-1310666", "spellId": 1310666, "casterEnemyKeys": ["Uncoiled Writhe [262398]"]}, {"sourceKey": "spell-1310974", "documentAbilityId": "aof-ability-1310974", "spellId": 1310974, "casterEnemyKeys": ["The Writhing Coil"]}],
  evidenceRef: "agent_flow/mdt-snapshots/s2/README.md",
  status: 'approved',
};

export const dungeonFactBindingRegistry: ApprovedFactBinding[] = [
  altarOfFangsFactBinding,
];

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
