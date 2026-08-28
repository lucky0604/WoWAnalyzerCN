import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { getDungeonCatalogEntry } from '../../src/dungeon/data/season2Catalog';
import {
  createFactSnapshot,
  factSnapshotSchemaVersion,
  validateFactSnapshot,
  type FactSnapshotAbility,
  type FactSnapshotEnemy,
  type FactSnapshotSource,
} from '../../src/dungeon/runtime/factSnapshot';
import {
  getApprovedMdtFactsSnapshot,
  type ApprovedSourceSnapshot,
} from '../../src/dungeon/runtime/sourceRegistry';

/**
 * MDT 怪物事实导入器。
 *
 * 消费 agent_flow/mdt-snapshots/s2/ 的原始 MDT 衍生快照（raw source of record，
 * 授权与更新流程见该目录 README），生成两类派生工件：
 *
 *  1. src/dungeon/data/mdtFacts/<slug>.json —— 运行时参考层（双语名、
 *     characteristics、per-enemy spells 及其 attributes 原样保留，供地图
 *     tooltip、打断标记和未来的建议引擎消费）；
 *  2. src/dungeon/data/facts/<slug>.s2.json —— 正式 FactSnapshot（schema v1，
 *     source: game-data，digest 由 createFactSnapshot 以 canonical payload 计算）。
 *
 * 不要在运行时直接 import agent_flow 下的原始 JSON；一切消费都应经过本脚本
 * 生成的派生工件。导入时强制校验原始 JSON 的 sha256 与 sourceRegistry.ts mdt
 * 批次登记一致（未登记或不一致直接拒绝，见 mdt 批次注释）。更新流程：覆盖
 * 原始 JSON → 更新 sourceRegistry.ts 中 mdt 批次哈希 → `pnpm
 * dungeon:import-mdt-facts -- --dungeon=all` → 跑 `pnpm dungeon:check` 与
 * `src/dungeon/data/mdtFacts/mdtFacts.test.ts`。
 */

/** MDT 快照 key → S2 catalog slug。 */
const DUNGEON_KEYS: Record<string, string> = {
  aof: 'altar-of-fangs',
  bvl: 'the-blinding-vale',
  dnl: 'den-of-nalorakk',
  kr: 'kings-rest',
  mdr: 'murder-row',
  rlp: 'ruby-life-pools',
  tst: 'temple-of-sethraliss',
  vsa: 'voidscar-arena',
};

const SOURCE_DISTRIBUTION = 'MythicDungeonTools 6.2.4 → threechest → wcl-mp-client';
const EVIDENCE_REF = 'agent_flow/mdt-snapshots/s2/README.md';
const SNAPSHOT_SOURCE: FactSnapshotSource = 'game-data';

interface MdtSpell {
  id: number;
  attributes?: unknown;
}

interface MdtSpawn {
  id: string;
}

interface MdtEnemy {
  id: number;
  enemyIndex: number;
  name: string;
  count?: unknown;
  creatureType?: unknown;
  scale?: unknown;
  isBoss?: unknown;
  characteristics?: unknown;
  spells?: unknown;
  spawns?: unknown;
}

interface MdtDungeon {
  dungeonIndex: number;
  totalCount?: unknown;
  enemies: MdtEnemy[];
}

export interface MdtReferenceEnemy {
  npcId: number;
  enemyIndex: number;
  name: { enUS: string; zhCN?: string };
  count: number;
  isBoss: boolean;
  creatureType: string | null;
  /** MDT NPC 默认体型；spawn 级体型在坐标快照 Spawn.scale 中。 */
  scale: number | null;
  characteristics: string[];
  spawnCount: number;
  spells: Array<{ id: number; attributes: string[] }>;
}

/**
 * 运行时参考层。只包含客观游戏事实；攻略性文字永远不在这里。
 */
export interface MdtDungeonReference {
  version: 1;
  slug: string;
  sourceKey: string;
  source: {
    kind: 'mythic-dungeon-tools';
    distribution: string;
    sha256: string;
    retrievedAt: string;
  };
  /** 'full' 表示每个敌人都有 zhCN 名；'none' 表示整本回退英文（当前为 bvl）。 */
  nameZhCoverage: 'full' | 'partial' | 'none';
  dungeonIndex: number;
  /**
   * MDT 自带 dungeonTotalCount 字段原样保留。它与 Σcount 的关系尚未与上游
   * 核对（两者不相等且无固定比例），进度百分比不得使用该值。
   */
  mdtDungeonTotalCount: number | null;
  totalEnemyForcesPoints: number;
  enemies: MdtReferenceEnemy[];
}

interface ImportOptions {
  dungeonArgument: string;
  inputDir: string;
  factsDir: string;
  referenceDir: string;
  build: string;
  capturedAt: string;
  dryRun: boolean;
  check: boolean;
}

export interface ImportSummary {
  sourceKey: string;
  slug: string;
  inputPath: string;
  referencePath: string;
  snapshotPath: string;
  enemyCount: number;
  abilityCount: number;
  totalEnemyForcesPoints: number;
  mode: 'write' | 'dry-run' | 'check';
  changed?: boolean;
}

const argument = (args: string[], name: string, fallback: string): string =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;

function parseOptions(args: string[]): ImportOptions {
  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run') || check;
  return {
    dungeonArgument: argument(args, '--dungeon', 'all'),
    inputDir: resolve(argument(args, '--input-dir', 'agent_flow/mdt-snapshots/s2')),
    // 本导入器不产生 source URL，无脱敏需求，默认直接写 tracked 规范位置；
    // 覆盖参数仅供测试或临时导出使用。
    factsDir: resolve(argument(args, '--facts-dir', 'src/dungeon/data/facts')),
    referenceDir: resolve(argument(args, '--reference-dir', 'src/dungeon/data/mdtFacts')),
    build: argument(args, '--build', '12.1.0'),
    // 固定默认值而非取当前时间：保证同一输入重复运行产出逐字节一致的工件。
    capturedAt: argument(args, '--captured-at', '2026-08-26T00:00:00.000Z'),
    dryRun,
    check,
  };
}

function expectInteger(value: unknown, label: string, minimum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new Error(`MDT_FACTS_FIELD_INVALID: ${label}`);
  }
  return value as number;
}

function validateSource(source: MdtDungeon, inputPath: string): void {
  if (
    !source ||
    typeof source !== 'object' ||
    !Number.isInteger(source.dungeonIndex) ||
    !Array.isArray(source.enemies)
  ) {
    throw new Error(`MDT_FACTS_SNAPSHOT_INVALID: ${inputPath}`);
  }
  const npcIds = new Set<number>();
  const spawnIds = new Set<string>();
  source.enemies.forEach((enemy, enemyIndex) => {
    if (!enemy || typeof enemy !== 'object') {
      throw new Error(`MDT_FACTS_ENEMY_INVALID: ${inputPath}#${enemyIndex}`);
    }
    expectInteger(enemy.id, `${inputPath}#${enemyIndex}.id`, 1);
    expectInteger(enemy.enemyIndex, `${inputPath}#${enemyIndex}.enemyIndex`, 0);
    if (typeof enemy.name !== 'string' || !enemy.name.trim()) {
      throw new Error(`MDT_FACTS_NAME_INVALID: ${inputPath}#${enemyIndex}`);
    }
    if (npcIds.has(enemy.id)) {
      throw new Error(`MDT_FACTS_DUPLICATE_NPC_ID: ${enemy.id}`);
    }
    npcIds.add(enemy.id);
    // count 参与总 forces 合计（default 0 会在队列/波次里静默低估），
    // 缺失直接拒绝而不是补 0——8 本已登记的源头都带 count，缺了就是源数据坏了。
    expectInteger(enemy.count, `${inputPath}#${enemy.id}.count`, 0);
    if (enemy.characteristics !== undefined) {
      if (
        !Array.isArray(enemy.characteristics) ||
        (enemy.characteristics as unknown[]).some(
          (item) => typeof item !== 'string' || !(item as string).trim(),
        )
      ) {
        throw new Error(`MDT_FACTS_CHARACTERISTICS_INVALID: ${inputPath}#${enemy.id}`);
      }
    }
    if (enemy.spells !== undefined) {
      if (!Array.isArray(enemy.spells)) {
        throw new Error(`MDT_FACTS_SPELLS_INVALID: ${inputPath}#${enemy.id}`);
      }
      enemy.spells.forEach((spell) => {
        if (!spell || typeof spell !== 'object') {
          throw new Error(`MDT_FACTS_SPELL_INVALID: ${inputPath}#${enemy.id}`);
        }
        expectInteger(spell.id, `${inputPath}#${enemy.id}.spellId`, 1);
        if (
          spell.attributes !== undefined &&
          (!Array.isArray(spell.attributes) ||
            spell.attributes.some((item) => typeof item !== 'string'))
        ) {
          throw new Error(`MDT_FACTS_SPELL_ATTRIBUTES_INVALID: ${inputPath}#${enemy.id}/${spell.id}`);
        }
      });
    }
    if (enemy.spawns !== undefined) {
      if (!Array.isArray(enemy.spawns)) {
        throw new Error(`MDT_FACTS_SPAWNS_INVALID: ${inputPath}#${enemy.id}`);
      }
      enemy.spawns.forEach((spawn: MdtSpawn) => {
        if (!spawn || typeof spawn !== 'object' || typeof spawn.id !== 'string' || !spawn.id) {
          throw new Error(`MDT_FACTS_SPAWN_ID_INVALID: ${inputPath}#${enemy.id}`);
        }
        if (spawnIds.has(spawn.id)) {
          throw new Error(`MDT_FACTS_DUPLICATE_SPAWN_ID: ${spawn.id}`);
        }
        spawnIds.add(spawn.id);
      });
    }
  });
}

async function loadZhNameTable(inputDir: string): Promise<Record<string, Record<string, string>>> {
  try {
    const raw = await readFile(resolve(inputDir, 'npc-names.zh.json'), 'utf8');
    return JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch (error) {
    // 缺文件 = 该本没有双语名表（允许）；坏 JSON 等其他读取错误必须暴露。
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
    return {};
  }
}

function buildReference(
  source: MdtDungeon,
  rawSha256: string,
  slug: string,
  sourceKey: string,
  zhTable: Record<string, string> | undefined,
  options: ImportOptions,
): MdtDungeonReference {
  const enemies: MdtReferenceEnemy[] = [...source.enemies]
    .sort((left, right) => left.enemyIndex - right.enemyIndex || left.id - right.id)
    .map((enemy) => {
      const spells = (Array.isArray(enemy.spells) ? enemy.spells : []) as MdtSpell[];
      return {
        npcId: enemy.id,
        enemyIndex: enemy.enemyIndex,
        name: {
          enUS: enemy.name,
          ...(zhTable && typeof zhTable[enemy.name] === 'string'
            ? { zhCN: zhTable[enemy.name] }
            : {}),
        },
        count: typeof enemy.count === 'number' ? enemy.count : 0,
        isBoss: enemy.isBoss === true,
        creatureType: typeof enemy.creatureType === 'string' ? enemy.creatureType : null,
        scale: typeof enemy.scale === 'number' ? enemy.scale : null,
        characteristics: (Array.isArray(enemy.characteristics) ? enemy.characteristics : []).map(
          String,
        ),
        spawnCount: Array.isArray(enemy.spawns) ? enemy.spawns.length : 0,
        spells: spells
          .map((spell) => ({
            id: spell.id,
            attributes: (Array.isArray(spell.attributes) ? spell.attributes : []).map(String),
          }))
          .sort((left, right) => left.id - right.id),
      };
    });
  const withZh = enemies.filter((enemy) => enemy.name.zhCN !== undefined).length;
  const nameZhCoverage =
    enemies.length === 0 || withZh === 0
      ? 'none'
      : withZh === enemies.length
        ? 'full'
        : 'partial';
  return {
    version: 1,
    slug,
    sourceKey,
    source: {
      kind: 'mythic-dungeon-tools',
      distribution: SOURCE_DISTRIBUTION,
      sha256: rawSha256,
      retrievedAt: options.capturedAt,
    },
    nameZhCoverage,
    dungeonIndex: source.dungeonIndex,
    mdtDungeonTotalCount: typeof source.totalCount === 'number' ? source.totalCount : null,
    totalEnemyForcesPoints: enemies.reduce((total, enemy) => total + enemy.count, 0),
    enemies,
  };
}

interface AbilityGroup {
  spellId: number;
  casterEnemyKeys: string[];
  interruptible: boolean;
}

function buildAbilityGroups(
  enemies: MdtReferenceEnemy[],
  keys: Map<number, string>,
): AbilityGroup[] {
  const bySpellId = new Map<number, AbilityGroup>();
  enemies.forEach((enemy) => {
    const enemyKey = keys.get(enemy.npcId);
    if (!enemyKey) return;
    enemy.spells.forEach((spell) => {
      let group = bySpellId.get(spell.id);
      if (!group) {
        group = { spellId: spell.id, casterEnemyKeys: [], interruptible: false };
        bySpellId.set(spell.id, group);
      }
      if (!group.casterEnemyKeys.includes(enemyKey)) group.casterEnemyKeys.push(enemyKey);
      if (spell.attributes.includes('interruptible')) group.interruptible = true;
    });
  });
  return [...bySpellId.values()].sort((left, right) => left.spellId - right.spellId);
}

/** enemyKey：名字在本本内唯一时直接用名字；重名追加 npcId 保证唯一与可读。 */
export function enemyKeysFor(reference: MdtDungeonReference): Map<number, string> {
  const counts = new Map<string, number>();
  reference.enemies.forEach((enemy) => {
    counts.set(enemy.name.enUS, (counts.get(enemy.name.enUS) ?? 0) + 1);
  });
  return new Map(
    reference.enemies.map((enemy) => [
      enemy.npcId,
      counts.get(enemy.name.enUS)! > 1
        ? `${enemy.name.enUS} [${enemy.npcId}]`
        : enemy.name.enUS,
    ]),
  );
}

function buildSnapshotEnemies(
  reference: MdtDungeonReference,
  keys: Map<number, string>,
): FactSnapshotEnemy[] {
  return reference.enemies.map((enemy) => ({
    enemyKey: keys.get(enemy.npcId)!,
    npcId: enemy.npcId,
    isBoss: enemy.isBoss,
    forcesPoints: enemy.count,
  }));
}

function buildSnapshotAbilities(
  groups: AbilityGroup[],
): FactSnapshotAbility[] {
  return groups.map((group) => ({
    abilityKey: `spell-${group.spellId}`,
    spellId: group.spellId,
    casterEnemyKeys: [...group.casterEnemyKeys],
    ...(group.interruptible ? { interruptible: true } : {}),
  }));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function semanticJsonEqual(path: string, next: unknown): Promise<boolean> {
  let existing: string;
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`MDT_FACTS_CHECK_MISSING: ${path}`);
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(existing);
  } catch {
    throw new Error(`MDT_FACTS_CHECK_INVALID: ${path}`);
  }
  return JSON.stringify(parsed) === JSON.stringify(next);
}

export interface ImportDependencies {
  /**
   * 测试注入口：返回该 slug 已登记的 mdt 批次（hash 形如 `sha256:<hex>`），
   * undefined 表示未登记。默认实现走 sourceRegistry 真实批次；测试 fixture
   * 不在 registry 里，注入放行桩即可。
   */
  approveMdtSnapshot?: (
    slug: string,
    rawSha256: string,
  ) => Pick<ApprovedSourceSnapshot, 'hash'> | undefined;
}

export async function runImport(
  args: string[],
  dependencies: ImportDependencies = {},
): Promise<ImportSummary[]> {
  const approveMdtSnapshot =
    dependencies.approveMdtSnapshot ??
    ((slug: string) => {
      const approved = getApprovedMdtFactsSnapshot(slug);
      return approved ? { hash: approved.hash } : undefined;
    });
  const options = parseOptions(args);
  const zhTables = await loadZhNameTable(options.inputDir);
  const sourceKeys =
    options.dungeonArgument === 'all'
      ? Object.keys(DUNGEON_KEYS).sort()
      : [options.dungeonArgument];

  const summaries: ImportSummary[] = [];
  for (const sourceKey of sourceKeys) {
    const slug = DUNGEON_KEYS[sourceKey];
    if (!slug) {
      throw new Error(
        `MDT_FACTS_KEY_UNKNOWN: ${sourceKey}（已知 key：${Object.keys(DUNGEON_KEYS).join(', ')}）`,
      );
    }
    const entry = getDungeonCatalogEntry(slug);
    if (!entry) throw new Error(`MDT_FACTS_CATALOG_ENTRY_MISSING: ${slug}`);

    const inputPath = resolve(options.inputDir, `${sourceKey}_mdt.json`);
    const raw = await readFile(inputPath, 'utf8');
    let source: MdtDungeon;
    try {
      source = JSON.parse(raw) as MdtDungeon;
    } catch {
      throw new Error(`MDT_FACTS_SNAPSHOT_INVALID: ${inputPath}`);
    }
    validateSource(source, inputPath);

    const rawSha256 = createHash('sha256').update(raw).digest('hex');
    // 授权链强制执行：registry.hash 即"对应原始 JSON 的 sha256"（见
    // sourceRegistry.ts mdt 批次注释）。未登记或哈希不一致一律拒绝导入，
    // 防止未授权/漂移的原始快照静默生成派生工件。
    const approved = approveMdtSnapshot(slug, rawSha256);
    if (!approved) {
      throw new Error(
        `MDT_FACTS_SNAPSHOT_UNREGISTERED: ${slug}（原始快照未在 sourceRegistry.ts mdt 批次登记；` +
          '先登记 agent_flow/mdt-snapshots/s2 原始 JSON 的 sha256 再导入）',
      );
    }
    if (approved.hash !== `sha256:${rawSha256}`) {
      throw new Error(
        `MDT_FACTS_SOURCE_HASH_MISMATCH: ${slug} registered=${approved.hash} ` +
          `actual=sha256:${rawSha256}（原始 JSON 与登记批次不一致；按 ` +
          'agent_flow/mdt-snapshots/s2/README.md 更新流程重登记后再导入）',
      );
    }
    const reference = buildReference(
      source,
      rawSha256,
      slug,
      sourceKey,
      zhTables[sourceKey],
      options,
    );
    reference.enemies.forEach((enemy) => {
      if (!Number.isInteger(enemy.count) || enemy.count < 0) {
        throw new Error(`MDT_FACTS_COUNT_MISSING: ${inputPath}:${enemy.npcId}`);
      }
    });

    const keys = enemyKeysFor(reference);
    const abilities = buildAbilityGroups(reference.enemies, keys);

    const draft = {
      version: factSnapshotSchemaVersion,
      snapshotId: `mdt-facts-s2-${slug}-${options.capturedAt.slice(0, 10)}`,
      dungeonId: entry.id,
      season: entry.season,
      gameBuild: options.build,
      source: SNAPSHOT_SOURCE,
      licenseStatus: 'approved',
      evidenceRef: EVIDENCE_REF,
      capturedAt: options.capturedAt,
      enemies: buildSnapshotEnemies(reference, keys),
      abilities: buildSnapshotAbilities(abilities),
      totalEnemyForcesPoints: reference.totalEnemyForcesPoints,
    };
    const validation = await createFactSnapshot(draft, { entry });
    if (!validation.ok || !validation.snapshot) {
      throw new Error(
        `MDT_FACTS_SNAPSHOT_REJECTED: ${slug}\n${validation.errors
          .map((item) => `${item.code} ${item.path}: ${item.message}`)
          .join('\n')}`,
      );
    }

    const referencePath = resolve(options.referenceDir, `${slug}.json`);
    const snapshotPath = resolve(options.factsDir, `${slug}.s2.json`);

    if (options.check) {
      const referenceChanged = !(await semanticJsonEqual(referencePath, reference));
      const snapshotChanged = !(await semanticJsonEqual(snapshotPath, validation.snapshot));
      // 已提交的快照必须同时通过独立完整性校验（含 canonical digest 复核）。
      const committedRaw = await readFile(snapshotPath, 'utf8');
      const committedValidation = await validateFactSnapshot(JSON.parse(committedRaw), { entry });
      if (!committedValidation.ok) {
        throw new Error(
          `MDT_FACTS_COMMITTED_SNAPSHOT_INVALID: ${snapshotPath}\n${committedValidation.errors
            .map((item) => `${item.code}: ${item.message}`)
            .join('\n')}`,
        );
      }
      summaries.push({
        sourceKey,
        slug,
        inputPath,
        referencePath,
        snapshotPath,
        enemyCount: reference.enemies.length,
        abilityCount: abilities.length,
        totalEnemyForcesPoints: reference.totalEnemyForcesPoints,
        mode: 'check',
        changed: referenceChanged || snapshotChanged,
      });
      if (referenceChanged || snapshotChanged) {
        throw new Error(
          `MDT_FACTS_CHECK_MISMATCH: ${referenceChanged ? referencePath : snapshotPath}`,
        );
      }
    } else {
      if (!options.dryRun) {
        await writeFileAtomic(referencePath, serialize(reference));
        await writeFileAtomic(snapshotPath, serialize(validation.snapshot));
      }
      summaries.push({
        sourceKey,
        slug,
        inputPath,
        referencePath,
        snapshotPath,
        enemyCount: reference.enemies.length,
        abilityCount: abilities.length,
        totalEnemyForcesPoints: reference.totalEnemyForcesPoints,
        mode: options.dryRun ? 'dry-run' : 'write',
      });
    }
  }
  return summaries;
}

if (process.argv[1]?.endsWith('scripts/dungeons/import-mdt-facts.ts')) {
  runImport(process.argv.slice(2))
    .then((summaries) =>
      summaries.forEach((summary) => {
        const action =
          summary.mode === 'write'
            ? 'Wrote'
            : summary.mode === 'check'
              ? summary.changed
                ? 'CHANGED'
                : 'Checked'
              : 'Would write';
        console.log(
          `${action} ${summary.slug} (${summary.enemyCount} enemies / ${summary.abilityCount} abilities / ` +
            `${summary.totalEnemyForcesPoints} forces) from ${summary.inputPath}`,
        );
      }),
    )
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
