import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// 8 本 Midnight S2 的 MDT 敌人事实（raw source of record）。
import altarOfFangsReference from '../../src/dungeon/data/mdtFacts/altar-of-fangs.json';
import denOfNalorakkReference from '../../src/dungeon/data/mdtFacts/den-of-nalorakk.json';
import kingsRestReference from '../../src/dungeon/data/mdtFacts/kings-rest.json';
import murderrowReference from '../../src/dungeon/data/mdtFacts/murder-row.json';
import rubylifepoolsReference from '../../src/dungeon/data/mdtFacts/ruby-life-pools.json';
import templeofsethralissReference from '../../src/dungeon/data/mdtFacts/temple-of-sethraliss.json';
import theblindingvaleReference from '../../src/dungeon/data/mdtFacts/the-blinding-vale.json';
import voidscararenaReference from '../../src/dungeon/data/mdtFacts/voidscar-arena.json';

import {
  renderTooltipDesc,
  type TooltipEffectRow,
  type TooltipSpell,
  type TooltipTables,
} from './spellTooltipRender';
import { RLP_SPELL_TOOLTIPS } from '../../src/dungeon/data/rlpSpellTooltips';
import s2SpellDictionaryJson from '../../src/dungeon/data/spellFacts/s2.json';

interface SpellDictionaryGate {
  unknownGate: Record<string, string>;
}
const SPELL_DICTIONARY = s2SpellDictionaryJson as unknown as SpellDictionaryGate;

/**
 * S2 中文技能说明快照生成器（离线浮层的数据层）。
 *
 * 消费 mdtFacts 参考层的全部 spellId（8 本 S2），从 wago.tools DB2 API 抓取
 * zhCN 的技能名/说明 + SpellEffect/SpellMisc/SpellDuration/SpellRadius，用
 * spellTooltipRender.ts（wago Journal tooltip 算法移植）在生成时填好数值变量，
 * 输出 src/dungeon/data/spellFacts/s2.zhTooltips.json。运行时零网络依赖。
 *
 * 与 RLP 的旧一次性流程（/tmp/rlp_fetch，build 12.1.0.69299）同源同算法；
 * 该 build 已从 wago 下线，重跑会得到当前构建的新数值 —— rlpSpellTooltips.ts
 * 金标准保持为覆盖层，运行时优先级：已审校 abilities > RLP 快照 > 本快照。
 *
 * 用法：
 *   pnpm tsx scripts/dungeons/generate-spell-tooltips.ts                 # 全量
 *   pnpm tsx scripts/dungeons/generate-spell-tooltips.ts --limit=6 --output=/tmp/smoke.json  # 冒烟（必须显式 --output）
 *   pnpm tsx scripts/dungeons/generate-spell-tooltips.ts --validate-rlp  # 对照金标准
 *   pnpm tsx scripts/dungeons/generate-spell-tooltips.ts --check         # 门禁（离线：不抓取、不写盘）
 */

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

const OUTPUT_PATH = resolve('src/dungeon/data/spellFacts/s2.zhTooltips.json');
/** 原始抓取缓存：node_modules 默认不入库，重跑断点续传（/tmp 会被清）。 */
const CACHE_PATH = resolve('node_modules/.cache/wago-spell-tooltips/cache.json');

interface GenerateOptions {
  capturedAt: string;
  outputPath: string;
  limit: number;
  validateRlp: boolean;
  check: boolean;
}

function parseOptions(args: string[]): GenerateOptions {
  const argument = (name: string, fallback: string) =>
    args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
  return {
    capturedAt: argument('--captured-at', '2026-08-27T00:00:00.000Z'),
    outputPath: resolve(argument('--output', OUTPUT_PATH)),
    limit: Number(argument('--limit', '0')),
    validateRlp: args.includes('--validate-rlp'),
    check: args.includes('--check'),
  };
}

/** 跨 8 本收集全部 spellId（排序去重）。 */
function collectSpellIds(): number[] {
  const ids = new Set<number>();
  REFERENCES.forEach(({ reference }) => {
    reference.enemies.forEach((enemy) => {
      enemy.spells.forEach((spell) => ids.add(spell.id));
    });
  });
  return [...ids].sort((left, right) => left - right);
}

// ---------- wago.tools DB2 fetch 层 ----------

const WAGO_HOST = 'https://wago.tools';
/** 值表钉在 RLP 金标准同源构建：SpellMisc.DurationIndex 只有这个构建暴露，
    效果数值也与 rlpSpellTooltips.ts 一致。SpellName 在该构建不存在，走当前构建。 */
const PINNED_BUILD = '12.1.0.69299';
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_RETRIES = 3;

interface CachedRow {
  status: 'ok' | 'empty';
  row?: Record<string, unknown>;
}

type FetchCache = Map<string, CachedRow>;

async function fetchFindRow(
  cache: FetchCache,
  table: string,
  field: string,
  value: string | number,
  locale?: string,
): Promise<CachedRow> {
  const key = `${table}|${field}|${value}${locale ? `|${locale}` : ''}`;
  const hit = cache.get(key);
  miss: {
    if (hit) break miss;
    const url =
      `${WAGO_HOST}/api/db2-find/${table}?filter%5B${field}%5D=exact%3A${value}` +
      (locale ? `&locale=${locale}` : '') +
      (table === 'SpellName' ? '' : `&build=${PINNED_BUILD}`);
    let row: CachedRow = { status: 'empty' };
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'WoWAnalyzerCN-dungeon-facts' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (response.status === 429) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * (attempt + 1)));
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
        const rows = Array.isArray(body.data) ? body.data : [];
        row = rows.length > 0 ? { status: 'ok', row: rows[0] } : { status: 'empty' };
        break;
      } catch (error) {
        if (attempt === FETCH_RETRIES - 1) {
          console.warn(`fetch failed: ${table} ${field}=${value} (${String(error)})`);
        } else {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000 * (attempt + 1)));
        }
      }
    }
    cache.set(key, row);
  }
  return cache.get(key)!;
}

/** 复数行版本（SpellEffect 等一对多表）。 */
async function fetchFindRows(
  cache: FetchCache,
  table: string,
  field: string,
  value: string | number,
  locale?: string,
): Promise<Array<Record<string, unknown>>> {
  const key = `${table}|${field}|${value}${locale ? `|${locale}` : ''}`;
  const hit = cache.get(key);
  if (hit) return (hit.row?.__rows as Array<Record<string, unknown>> | undefined) ?? [];
  const rows = await fetchFindRowsUncached(table, field, value, locale);
  cache.set(key, { status: rows.length > 0 ? 'ok' : 'empty', row: { __rows: rows } });
  return rows;
}

async function fetchFindRowsUncached(
  table: string,
  field: string,
  value: string | number,
  locale?: string,
): Promise<Array<Record<string, unknown>>> {
  const url =
    `${WAGO_HOST}/api/db2-find/${table}?filter%5B${field}%5D=exact%3A${value}` +
    (locale ? `&locale=${locale}` : '') +
    (table === 'SpellName' ? '' : `&build=${PINNED_BUILD}`);
  for (let attempt = 0; attempt < FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WoWAnalyzerCN-dungeon-facts' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status === 429) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
      return Array.isArray(body.data) ? body.data : [];
    } catch (error) {
      if (attempt === FETCH_RETRIES - 1) {
        console.warn(`fetch failed: ${table} ${field}=${value} (${String(error)})`);
        return [];
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000 * (attempt + 1)));
    }
  }
  return [];
}

/** 定并发抓取池（礼貌限速 + 缓存命中零成本）。 */
async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------- 行映射 ----------

function toEffectRow(raw: Record<string, unknown>): TooltipEffectRow {
  const number = (value: unknown): number => (typeof value === 'number' ? value : 0);
  return {
    effect: number(raw.Effect),
    effectIndex: number(raw.EffectIndex),
    effectBasePointsF: number(raw.EffectBasePointsF),
    effectAura: number(raw.EffectAura),
    effectAmplitude: number(raw.EffectAmplitude),
    effectAuraPeriod: number(raw.EffectAuraPeriod),
    effectRadiusIndex0: number(raw.EffectRadiusIndex_0),
    effectRadiusIndex1: number(raw.EffectRadiusIndex_1),
    effectMiscValue0: number(raw.EffectMiscValue_0),
    effectChainTargets: number(raw.EffectChainTargets),
    effectPointsPerResource: number(raw.EffectPointsPerResource),
    difficultyId: number(raw.DifficultyID),
  };
}

interface SpellRecord {
  name: string;
  desc: string;
  effects: TooltipEffectRow[];
  durationIndex: number;
}


/** 单个 spellId 的原始行抓取（说明 zhCN + 名 zhCN + 效果行 + Misc）。 */
async function fetchSpellRecord(
  cache: FetchCache,
  sid: number,
): Promise<SpellRecord> {
  const [spellRow, nameRow, effectRows, miscRows] = await Promise.all([
    fetchFindRow(cache, 'Spell', 'ID', sid, 'zhCN'),
    fetchFindRow(cache, 'SpellName', 'ID', sid, 'zhCN'),
    fetchFindRows(cache, 'SpellEffect', 'SpellID', sid),
    fetchFindRows(cache, 'SpellMisc', 'SpellID', sid),
  ]);
  const misc =
    miscRows.find((row) => row.DifficultyID === 0) ?? miscRows[0] ?? undefined;
  return {
    name: typeof nameRow.row?.Name_lang === 'string' ? nameRow.row.Name_lang : '',
    desc: typeof spellRow.row?.Description_lang === 'string' ? spellRow.row.Description_lang : '',
    effects: effectRows.map(toEffectRow),
    durationIndex: typeof misc?.DurationIndex === 'number' ? misc.DurationIndex : 0,
  };
}

// ---------- 引用收集（子法术/时长/半径） ----------

/** 说明里的跨技能引用：$397077t1 的数字前缀、$@spellname<id> 等。 */
const TOKEN_REF_RE =
  /\$(\d*)(@spellname|@spelldesc|@spellaura|@spellicon|@spelltooltip|[aAsSmMwWoOtTdDxXfFbBqQeEirRuUnNhH])(\d*)/g;

function collectSubRefs(desc: string, mainIds: Set<number>): number[] {
  const subs = new Set<number>();
  for (const match of desc.matchAll(TOKEN_REF_RE)) {
    const kind = match[2] ?? '';
    if (kind.startsWith('@spell')) {
      const sid = Number(match[3] ?? 0);
      if (sid > 0 && kind !== '@spellicon' && kind !== '@spelltooltip') subs.add(sid);
      continue;
    }
    const refId = Number(match[1] ?? 0);
    if (refId > 0 && !mainIds.has(refId)) subs.add(refId);
  }
  return [...subs].sort((left, right) => left - right);
}

async function loadCache(): Promise<FetchCache> {
  try {
    const raw = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as Record<string, CachedRow>;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

async function saveCache(cache: FetchCache): Promise<void> {
  if (cache.size === 0) return;
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)));
}

interface ZhTooltipFile {
  version: 1;
  source: 'wago.tools';
  capturedAt: string;
  dungeonCount: 8;
  spellCount: number;
  tooltips: Record<string, { name: string; desc: string }>;
  /** mdtFacts 引用但 wago.tools 查无此 spell 的登记位（与 s2.json 字典同语义）。 */
  unknownGate: Record<string, string>;
}

/** --check 门禁：离线、只读、fail-closed——不抓取、不写盘，直接校验已提交快照。 */
async function runOfflineCheck(options: GenerateOptions, ids: number[]): Promise<void> {
  let file: ZhTooltipFile;
  try {
    file = JSON.parse(await readFile(options.outputPath, 'utf8')) as ZhTooltipFile;
  } catch (error) {
    console.error(`[check] snapshot unreadable/invalid: ${options.outputPath} (${String(error)})`);
    process.exitCode = 1;
    return;
  }
  if (
    typeof file.tooltips !== 'object' ||
    file.tooltips === null ||
    typeof file.unknownGate !== 'object' ||
    file.unknownGate === null
  ) {
    console.error(`[check] snapshot shape invalid: ${options.outputPath}`);
    process.exitCode = 1;
    return;
  }
  const tooltips = file.tooltips;
  const unknownGate = new Set(
    Object.entries(file.unknownGate)
      .filter(
        ([key, reason]) =>
          /^\d+$/.test(key) && typeof reason === 'string' && reason.trim() !== '',
      )
      .map(([key]) => key),
  );
  // 覆盖语义与 check.ts 门禁一致：名/说明必须是非空字符串；查无此法的以
  // unknownGate 登记位放行（键必须规范整数、理由必须非空，否则视为未登记）。
  const gaps = ids.filter((sid) => {
    if (unknownGate.has(String(sid))) return false;
    const entry = tooltips[String(sid)];
    if (!entry) return true;
    if (typeof entry.name !== 'string' || typeof entry.desc !== 'string') return true;
    return entry.name.trim() === '' && entry.desc.trim() === '';
  });
  if (gaps.length > 0) {
    console.error(`[check] ${gaps.length} spell ids missing from snapshot: ${gaps.slice(0, 20)}`);
    process.exitCode = 1;
  } else {
    console.log(`[check] snapshot covers all ${ids.length} mdtFacts spell ids`);
  }
  // 反向漂移：快照里参考层已不再引用的键（含非规范键）一律失败。
  const referenced = new Set(ids.map(String));
  const stale = [...new Set([...Object.keys(tooltips), ...Object.keys(file.unknownGate)])].filter(
    (key) => !referenced.has(key),
  );
  if (stale.length > 0) {
    console.error(
      `[check] ${stale.length} snapshot keys not referenced by mdtFacts: ${stale.slice(0, 20)}`,
    );
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const ids = collectSpellIds();
  // --check 先行短路：绝不抓取、绝不写盘，校验对象永远是已提交快照。
  if (options.check) {
    await runOfflineCheck(options, ids);
    return;
  }
  const limited = options.limit > 0 ? ids.slice(0, options.limit) : ids;
  // --limit 冒烟只允许显式 --output：截断输出绝不能静默覆盖已提交快照。
  if (options.limit > 0 && options.outputPath === OUTPUT_PATH) {
    throw new Error(
      'TOOLTIPS_LIMIT_COMMITTED_PATH: --limit 冒烟必须显式传 --output=…，避免截断覆盖已提交快照',
    );
  }
  const cache = await loadCache();

  // 校验模式额外抓取金标准覆盖的 spellId（子法术如 397077 不在 mdtFacts 主集合里）。
  const goldenIds = Object.keys(RLP_SPELL_TOOLTIPS).map(Number);
  const fetchIds = options.validateRlp
    ? [...new Set([...limited, ...goldenIds])].sort((left, right) => left - right)
    : limited;
  console.log(`fetching ${fetchIds.length} spell records from wago.tools (current build)…`);

  const records = new Map<number, SpellRecord>();
  await mapPool(fetchIds, 6, async (sid) => {
    records.set(sid, await fetchSpellRecord(cache, sid));
    if (records.size % 100 === 0) console.log(`  … ${records.size}/${fetchIds.length}`);
  });

  // 子法术：说明中跨技能引用的 spellId（$397077t1 / $@spellname372963）。
  const mainIds = new Set(fetchIds);
  const subIds = new Set<number>();
  records.forEach((record) => {
    collectSubRefs(record.desc, mainIds).forEach((sub) => subIds.add(sub));
  });
  if (subIds.size > 0) {
    console.log(`fetching ${subIds.size} sub-spell records…`);
    await mapPool([...subIds], 6, async (sid) => {
      records.set(sid, await fetchSpellRecord(cache, sid));
    });
  }

  // 时长/半径字典（小表，逐 ID）。
  const durations = new Map<number, number>();
  const radii = new Map<number, number>();
  const durationIndexes = new Set<number>();
  const radiusIndexes = new Set<number>();
  records.forEach((record) => {
    if (record.durationIndex > 0) durationIndexes.add(record.durationIndex);
    record.effects.forEach((effect) => {
      if (effect.effectRadiusIndex0 > 0) radiusIndexes.add(effect.effectRadiusIndex0);
      if (effect.effectRadiusIndex1 > 0) radiusIndexes.add(effect.effectRadiusIndex1);
    });
  });
  await mapPool([...durationIndexes], 6, async (index) => {
    const row = await fetchFindRow(cache, 'SpellDuration', 'ID', index);
    if (row.status === 'ok' && typeof row.row?.Duration === 'number') {
      durations.set(index, row.row.Duration);
    }
  });
  await mapPool([...radiusIndexes], 6, async (index) => {
    const row = await fetchFindRow(cache, 'SpellRadius', 'ID', index);
    if (row.status === 'ok' && typeof row.row?.Radius === 'number') {
      radii.set(index, row.row.Radius);
    }
  });
  console.log(
    `fetched: ${records.size} spells, ${durationIndexes.size} durations, ${radiusIndexes.size} radii`,
  );

  const tables: TooltipTables = {
    spells: new Map(
      [...records.entries()].map(([sid, record]) => [
        sid,
        { name: record.name, desc: record.desc, effects: record.effects, durationIndex: record.durationIndex } satisfies TooltipSpell,
      ]),
    ),
    durations,
    radii,
  };

  // 金标准对照（--validate-rlp）：渲染 125 条 RLP 说明并与 rlpSpellTooltips.ts 比对。
  if (options.validateRlp) {
    let exact = 0;
    let fuzzy = 0;
    let mismatch = 0;
    let noDesc = 0;
    const samples: string[] = [];
    for (const gid of goldenIds) {
      const golden = RLP_SPELL_TOOLTIPS[gid]?.zh ?? '';
      const record = records.get(gid);
      if (!record?.desc) {
        noDesc += 1;
        continue;
      }
      const got = renderTooltipDesc(gid, tables);
      if (got === golden) {
        exact += 1;
        continue;
      }
      if (got.replace(/ /g, '') === golden.replace(/ /g, '')) {
        fuzzy += 1;
        continue;
      }
      mismatch += 1;
      if (samples.length < 4) {
        samples.push(
          `--- spell ${gid}\n  golden: ${golden.slice(0, 120)}\n  got   : ${got.slice(0, 120)}`,
        );
      }
    }
    console.log(
      `[validate-rlp] exact=${exact} fuzzy(空格差异)=${fuzzy} mismatch=${mismatch} noDesc=${noDesc} / ${goldenIds.length}`,
    );
    samples.forEach((sample) => console.log(sample));
    await saveCache(cache);
    if (mismatch > 0) {
      console.error('数值/文本差异可能来自 wago 当前构建与 RLP 快照 build 的游戏调参变化。');
      process.exitCode = 1;
    }
    return;
  }

  // 生成快照：只输出主集合；desc 已填充，name 为 zhCN 名。
  const tooltips: Record<string, { name: string; desc: string }> = {};
  for (const sid of limited) {
    const record = records.get(sid);
    if (!record) continue;
    const desc = record.desc ? renderTooltipDesc(sid, tables) : '';
    const name = record.name;
    if (name || desc) {
      tooltips[String(sid)] = { name, desc };
    }
  }
  const leftover = Object.values(tooltips).filter((entry) => /\$\S/.test(entry.desc)).length;
  // 查无此法的 spellId（如 1300666，wago 任何构建都无行）登记进 unknownGate：
  // --check 放行已登记 ID，除此之外不允许静默缺口。
  const unknownGate: Record<string, string> = {};
  for (const sid of limited) {
    if (!tooltips[String(sid)]) {
      unknownGate[String(sid)] =
        SPELL_DICTIONARY.unknownGate[String(sid)] ??
        'no rows in wago.tools db2 (pinned build + current build)';
    }
  }
  const file: ZhTooltipFile = {
    version: 1,
    source: 'wago.tools',
    capturedAt: options.capturedAt,
    dungeonCount: 8,
    spellCount: Object.keys(tooltips).length,
    tooltips,
    unknownGate,
  };
  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(file, null, 2)}\n`);
  await saveCache(cache);
  console.log(
    `wrote ${options.outputPath}: ${file.spellCount} entries, ${leftover} 条残留 $ 变量`,
  );
}

// 仅直接执行本文件时运行；被测试或其他脚本 import 时不产生副作用（与兄弟生成器一致）。
if (process.argv[1]?.endsWith('generate-spell-tooltips.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}