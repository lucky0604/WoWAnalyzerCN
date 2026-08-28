import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { getGrimoireSpell } from 'grimoire-wow';

// 8 本 Midnight S2 的 MDT 敌人事实（Phase A 生成，raw source of record）。
import altarOfFangsReference from '../../src/dungeon/data/mdtFacts/altar-of-fangs.json';
import denOfNalorakkReference from '../../src/dungeon/data/mdtFacts/den-of-nalorakk.json';
import kingsRestReference from '../../src/dungeon/data/mdtFacts/kings-rest.json';
import murderrowReference from '../../src/dungeon/data/mdtFacts/murder-row.json';
import rubylifepoolsReference from '../../src/dungeon/data/mdtFacts/ruby-life-pools.json';
import templeofsethralissReference from '../../src/dungeon/data/mdtFacts/temple-of-sethraliss.json';
import theblindingvaleReference from '../../src/dungeon/data/mdtFacts/the-blinding-vale.json';
import voidscararenaReference from '../../src/dungeon/data/mdtFacts/voidscar-arena.json';

/**
 * 阶段C：8 本 S2 技能字典生成器。
 *
 * 消费 mdtFacts 参考层（每本所有敌人的 spellId + attributes），用 grimoire-wow
 * 包（真实 DBC 数据，暴雪技能名 + 图标）为每个 spellId 生成事实，输出
 * src/dungeon/data/spellFacts/s2.json。运行时取名/图标、完整性测试、以及未来
 * 建议引擎都来自这份字典；attributes 按 spellId 跨施法者取并集保留
 * （interruptible / 驱散类型等），逐 NPC 的精确标记仍以参考层为准。
 *
 * grimoire-wow 版本固定在 package.json devDependencies（与 threechest 上游同版本
 * 12.1.0-69189.3），包内 spell 详情随版本走；输出记录 packageVersion 与
 * gameBuild，保证可审计。
 */

const GRIMOIRE_SOURCE = 'grimoire-wow';
const GRIMOIRE_VERSION = '12.1.0-69189.3';
const GAME_BUILD = '12.1.0';
const OUTPUT_PATH = resolve('src/dungeon/data/spellFacts/s2.json');

interface ReferenceEnemy {
  npcId: number;
  spells: Array<{ id: number; attributes: string[] }>;
}

interface ReferenceShape {
  nameZhCoverage: string;
  enemies: ReferenceEnemy[];
}

const REFERENCES: Array<{ slug: string; reference: ReferenceShape }> = [
  { slug: 'altar-of-fangs', reference: altarOfFangsReference as unknown as ReferenceShape },
  { slug: 'den-of-nalorakk', reference: denOfNalorakkReference as unknown as ReferenceShape },
  { slug: 'kings-rest', reference: kingsRestReference as unknown as ReferenceShape },
  { slug: 'murder-row', reference: murderrowReference as unknown as ReferenceShape },
  { slug: 'ruby-life-pools', reference: rubylifepoolsReference as unknown as ReferenceShape },
  { slug: 'temple-of-sethraliss', reference: templeofsethralissReference as unknown as ReferenceShape },
  { slug: 'the-blinding-vale', reference: theblindingvaleReference as unknown as ReferenceShape },
  { slug: 'voidscar-arena', reference: voidscararenaReference as unknown as ReferenceShape },
];

export interface SpellDictionary {
  version: 1;
  source: string;
  packageVersion: string;
  gameBuild: string;
  capturedAt: string;
  dungeonCount: number;
  enemyCount: number;
  spellCount: number;
  /** grimoire 无法解析的 spellId 及其原因；完整性测试据此拒绝未知增量。 */
  unknownGate: Record<string, string>;
  spells: Record<string, { name: string; icon: string; attributes: string[] }>;
}

interface GenerateOptions {
  capturedAt: string;
  outputPath: string;
  allowMissing: string[];
  check: boolean;
}

function parseOptions(args: string[]): GenerateOptions {
  const argument = (name: string, fallback: string) =>
    args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
  const allowMissing = args
    .find((value) => value.startsWith('--allow-missing='))
    ?.slice('--allow-missing='.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  return {
    capturedAt: argument('--captured-at', '2026-08-26T00:00:00.000Z'),
    outputPath: resolve(argument('--output', OUTPUT_PATH)),
    allowMissing,
    check: args.includes('--check'),
  };
}

/** 跨 8 本：spellId → 施法者 attributes 并集（排序去重）。 */
function aggregateAttributes(references: ReferenceShape[]): Map<number, Set<string>> {
  const bySpellId = new Map<number, Set<string>>();
  references.forEach((reference) => {
    reference.enemies.forEach((enemy) => {
      enemy.spells.forEach((spell) => {
        let attributes = bySpellId.get(spell.id);
        if (!attributes) {
          attributes = new Set<string>();
          bySpellId.set(spell.id, attributes);
        }
        spell.attributes.forEach((attribute) => attributes.add(attribute));
      });
    });
  });
  return bySpellId;
}

export function buildDictionary(options: GenerateOptions): SpellDictionary {
  const attributesBySpellId = aggregateAttributes(REFERENCES.map((item) => item.reference));
  const uniqueSpellIds = [...attributesBySpellId.keys()].sort((left, right) => left - right);
  const enemies = REFERENCES.reduce(
    (total, item) => total + item.reference.enemies.length,
    0,
  );

  const spells: Record<string, { name: string; icon: string; attributes: string[] }> = {};
  const unknownGate: Record<string, string> = {};
  uniqueSpellIds.forEach((spellId) => {
    let fact: ReturnType<typeof getGrimoireSpell>;
    try {
      fact = getGrimoireSpell(spellId);
      spells[String(spellId)] = {
        name: fact.name,
        icon: fact.icon,
        attributes: [...(attributesBySpellId.get(spellId) ?? new Set<string>())].sort(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      unknownGate[String(spellId)] = message;
    }
  });
  // 未登记的解析失败一律拒绝生成，避免字典悄悄缺技能。
  const unexpectedMissing = Object.keys(unknownGate).filter(
    (spellId) => !options.allowMissing.includes(spellId),
  );
  if (unexpectedMissing.length > 0) {
    throw new Error(
      `SPELL_DICTIONARY_UNRESOLVED: ${unexpectedMissing.join(', ')}（可在 --allow-missing 登记并说明原因）`,
    );
  }

  return {
    version: 1,
    source: GRIMOIRE_SOURCE,
    packageVersion: GRIMOIRE_VERSION,
    gameBuild: GAME_BUILD,
    capturedAt: options.capturedAt,
    dungeonCount: REFERENCES.length,
    enemyCount: enemies,
    spellCount: uniqueSpellIds.length,
    unknownGate,
    spells,
  };
}

function serialize(dictionary: SpellDictionary): string {
  return `${JSON.stringify(dictionary, null, 2)}\n`;
}

async function semanticJsonEqual(path: string, next: unknown): Promise<boolean> {
  let existing: string;
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`SPELL_DICTIONARY_CHECK_MISSING: ${path}`);
    }
    throw error;
  }
  return JSON.stringify(JSON.parse(existing)) === JSON.stringify(next);
}

/**
 * check 模式下读取已提交字典的 unknownGate，把它视作已授权的登记位：
 * --check 不需要重复 --allow-missing，但仍会拒绝新增的未解析 spellId。
 */
async function committedUnknowns(outputPath: string): Promise<string[]> {
  try {
    const existing = JSON.parse(await readFile(outputPath, 'utf8')) as {
      unknownGate?: Record<string, string>;
    };
    return Object.keys(existing.unknownGate ?? {});
  } catch {
    return [];
  }
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

export async function runGenerateDictionary(args: string[]): Promise<{
  dictionary: SpellDictionary;
  mode: 'write' | 'check';
  changed?: boolean;
}> {
  const options = parseOptions(args);
  if (options.check) {
    const authorized = [...new Set([...options.allowMissing, ...(await committedUnknowns(options.outputPath))])];
    const dictionary = buildDictionary({ ...options, allowMissing: authorized });
    const changed = !(await semanticJsonEqual(options.outputPath, dictionary));
    return { dictionary, mode: 'check', changed };
  }
  const dictionary = buildDictionary(options);
  await writeFileAtomic(options.outputPath, serialize(dictionary));
  return { dictionary, mode: 'write' };
}

if (process.argv[1]?.endsWith('scripts/dungeons/generate-spell-dictionary.ts')) {
  runGenerateDictionary(process.argv.slice(2))
    .then(({ dictionary, mode, changed }) => {
      console.log(
        `${mode === 'check' ? (changed ? 'CHANGED' : 'Checked') : 'Wrote'} spell dictionary: ` +
          `${dictionary.spellCount} spells / ${dictionary.enemyCount} enemies across ` +
          `${dictionary.dungeonCount} dungeons (grimoire-wow@${dictionary.packageVersion}, ` +
          `unknown ${Object.keys(dictionary.unknownGate).length})`,
      );
      if (mode === 'check' && changed) {
        console.error('SPELL_DICTIONARY_DRIFT: 已提交字典与生成结果不一致（重跑生成器更新）');
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}