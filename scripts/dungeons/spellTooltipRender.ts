/**
 * 技能说明变量填充算法（wago.tools Journal tooltip 语义的 TypeScript 移植）。
 *
 * 原始实现在 2026-08-12 的 RLP 一次性流程里（未入库）；本文件按其语义重建：
 * 先展开难度条件块与 $@spellname/$@spelldesc 链接，再按文档顺序单遍填充
 * 数值变量（$s 值 / $o 持续伤害总量 / $t 周期 / $d 时长 / $a 半径 /
 * $x 目标数 …），最后剥离图标标签并规整空白。数值读
 * SpellEffect.EffectBasePointsF（当前 wago 构建已解码，直接使用，不再除以
 * 100）；输出格式与 rlpSpellTooltips.ts 金标准一致（整数不带小数、非整数
 * 最多 1 位、$d 渲染为 "N 秒"）。
 */

export interface TooltipEffectRow {
  effect: number;
  effectIndex: number;
  effectBasePointsF: number;
  effectAura: number;
  effectAmplitude: number;
  effectAuraPeriod: number;
  effectRadiusIndex0: number;
  effectRadiusIndex1: number;
  effectMiscValue0: number;
  effectChainTargets: number;
  effectPointsPerResource: number;
  difficultyId: number;
}

export interface TooltipSpell {
  /** 中文技能名（SpellName.Name_lang, zhCN）。 */
  name: string;
  /** 原始中文说明（Spell.Description_lang, zhCN），含未填充的 $ 变量。 */
  desc: string;
  effects: TooltipEffectRow[];
  /** SpellMisc.DurationIndex：$d 的 SpellDuration 键。 */
  durationIndex: number;
}

export interface TooltipTables {
  spells: Map<number, TooltipSpell>;
  /** SpellDuration.ID → Duration(ms)。 */
  durations: Map<number, number>;
  /** SpellRadius.ID → Radius(yd)。 */
  radii: Map<number, number>;
}

const ALL_DIFFICULTIES = new Set([16, 0]);

function number(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const x = Number(value);
  if (!Number.isFinite(x)) return '0';
  if (Number.isInteger(x)) return String(x);
  // 1 位小数、银行家舍入（python :.1f 语义：4.25→"4.2"，与金标准一致）。
  const scaled = Math.round(x * 100) / 100;
  const scaledByTen = scaled * 10;
  const floor = Math.floor(scaledByTen);
  const diff = scaledByTen - floor;
  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaledByTen);
  }
  const result = rounded / 10;
  return String(result);
}

/**
 * 变量目标行解析：All（{16,0}）难度效果行先按 DifficultyID 0 优先、再按
 * EffectIndex 升序排序；token 索引是 1 基的位置下标（$s2 = 第 2 行），
 * 不带索引 = 第 1 行。
 * 金标准验证证据：190485 行序 [75, 15, −70]，desc "$s2%"/"$s3%" 渲染 15/70；
 * 373973 的 "$373972t2" 需要落到 EffectIndex 1 的周期 3000ms 行——若保持
 * DB 原始行序会命中周期为 0 的行。
 */
function effectAt(spell: TooltipSpell | undefined, position: number): TooltipEffectRow | undefined {
  if (!spell) return undefined;
  const rows = spell.effects
    .filter((row) => ALL_DIFFICULTIES.has(row.difficultyId))
    .sort((left, right) => {
      const leftFirst = (left.difficultyId === 0 ? -1 : 0) - (right.difficultyId === 0 ? -1 : 0);
      return leftFirst !== 0 ? leftFirst : left.effectIndex - right.effectIndex;
    });
  if (position <= 1) return rows[0];
  return rows[position - 1];
}

interface RenderContext {
  tables: TooltipTables;
  /** 嵌套 $@spelldesc 渲染深度（防循环）。 */
  depth: number;
}

export function renderTooltipDesc(spellId: number, tables: TooltipTables): string {
  const spell = tables.spells.get(spellId);
  if (!spell || !spell.desc) return '';
  return render(spell.desc, spellId, { tables, depth: 3 });
}

function render(text: string, override: number, context: RenderContext): string {
  const { tables, depth } = context;
  // 默认上下文恒为“当前法术”（override）：跨技能引用（$397077t1）只作用于
  // 该 token 本身，不改变后续无前缀变量的归属——372047 的金标准 "$s1…持续$d"
  // 证明 $d 恒解析回当前法术的时长，而非继承前面的跨引用。
  const self = override;
  let t = text.replaceAll('\r\n', '\n');

  // 1. $?条件[主][?条件[备]][其余]：按难度 All 只保留主方括号内容。
  //    条件列表写法多样（diff8|diff23、"DIFF23 | DIFF8"、a382293），统一按
  //    “到第一个左方括号为止都是条件”处理；紧随其后的空括号对（如
  //    "$?[…][正文][][]文本" 形态）没有内容，一并移除。
  //    金标准证据：RLP 的难度条件内容在 All 下全部保留。
  t = t.replace(
    /\$\?[^\][]*\[([^\][]*)\](?:(?:\?[^[\]]*\s*)?\[[^\][]*\])*/g,
    (_match, main: string) => main,
  );
  if (t.includes('[]')) t = t.split('[]').join('');

  // 2. $[diffs] 文本 $]：All 保留；$[!diffs] 文本 $]：All 排除。
  //    难度组后必须有 \]：否则闭括号被 ([^$]*) 吞进文本组（历史实现把
  //    数字组当替换值，这个缺陷从未暴露）。
  t = t.replace(
    /\$\[([\d, ]+)\]\s*?\n?([^$]*)\$\]/g,
    (_match, _diffs: string | undefined, kept: string | undefined) => kept ?? '',
  );
  t = t.replace(/\$\[!([\d, ]+)\s*?\n?([^$]*)\$\]/g, () => '');

  // 3. $@spellname/$@spelldesc/$@spellaura 链接（在数值变量前处理）。
  const linkRef = (kind: string, sid: number): string => {
    if (kind === 'icon' || kind === 'tooltip') return '';
    const target = tables.spells.get(sid);
    if (kind === 'name' || kind === 'aura') {
      return target?.name || `技能 ${sid}`;
    }
    // desc：嵌套渲染，深度递减。
    if (!target || !target.desc || depth <= 0) return target?.name || '';
    return render(target.desc, sid, { tables, depth: depth - 1 });
  };
  t = t.replace(/\$?@?spell(name|desc|aura|icon|tooltip)(\d+)/gi, (_m, kind: string, sid: string) =>
    linkRef(kind.toLowerCase(), Number(sid)),
  );

  // 4. 数值变量：合并成单遍扫描、按文档顺序处理。跨技能 token
  //    （如 $187897s1）只在该 token 内生效；无前缀的变量恒用当前法术上下文。
  // $a 与 $A 语义不同（半径索引 0/1），其余大小写同义。
  t = t.replace(
    /\$(\d+)?([aAsSmMwWoOtTdDxXfFbBqQeE])(\d+)?/g,
    (_m: string, rawRid: string | undefined, rawLetter: string, rawIdx: string | undefined) => {
      const which = rawLetter.toLowerCase();
      const hasRid = rawRid !== undefined && rawRid !== '';
      const refId = hasRid ? Number(rawRid) : self;
      const row = effectAt(tables.spells.get(refId), rawIdx ? Number(rawIdx) : 1);
      switch (which) {
        case 's':
        case 'm':
        case 'w':
          // EffectBasePointsF 在当前构建已是解码值，直接取绝对值。
          return number(Math.abs(row?.effectBasePointsF ?? 0));
        case 'e':
          return number(row?.effectAmplitude);
        case 'o': {
          const duration =
            tables.durations.get(tables.spells.get(refId)?.durationIndex ?? 0) ?? 0;
          const period = row?.effectAuraPeriod ?? 0;
          if (!period || !duration) return '0';
          return number(Math.round(Math.abs(row!.effectBasePointsF) * (duration / period)));
        }
        case 'a':
        case 'A': {
          // 半径语义与 $s/$t 不同：数字后缀是该效果行的半径槽位
          // （R0/R1 对，$A 默认槽 2、$a 默认槽 1），效果恒取第 1 行。
          // 金标准证据：373087 单效果行 R0=0/R1=9，"$A2" 渲染 20 码——
          // 若把后缀当效果位置会因第 2 行不存在而输出 0。
          const radiusRow = effectAt(tables.spells.get(refId), 1);
          const defaultSlot = which === 'a' ? 1 : 2;
          const slot = rawIdx ? Number(rawIdx) : defaultSlot;
          const slots = [radiusRow?.effectRadiusIndex0 ?? 0, radiusRow?.effectRadiusIndex1 ?? 0];
          // 目标槽为空时回退到任一非零槽。
          const radiusIndex = slots[slot - 1] || slots.find((index) => index > 0) || 0;
          if (!radiusIndex) return '0';
          const radius = tables.radii.get(radiusIndex);
          return radius === undefined ? '0' : number(radius);
        }
        case 't':
          return number((row?.effectAuraPeriod ?? 0) / 1000);
        case 'd': {
          const durationIndex = tables.spells.get(refId)?.durationIndex ?? 0;
          const duration = durationIndex ? tables.durations.get(durationIndex) : undefined;
          if (!durationIndex || duration === undefined) return '取消';
          if (duration === 0) return '持续施法';
          return `${number(duration / 1000)} 秒`;
        }
        case 'x':
          return number(row?.effectChainTargets);
        case 'f':
          // 链式衰减：旧实现固定 0。
          return '0';
        case 'b':
          return number(row?.effectPointsPerResource);
        case 'q':
          return number(row?.effectMiscValue0);
        default:
          // 其余变量（$r/$u/$n 等）原样保留，由残余清理步骤兜底删除。
          return _m;
      }
    },
  );

  // 5. ${…} 算术括号：内部变量已填充，纯数值/运算表达式就地求值，否则去括号留文。
  t = t.replace(/\$\{([^}]*)\}/g, (_match, expression: string) => {
    const trimmed = expression.trim();
    if (/^[\d.+\-*/() ]+$/.test(trimmed)) {
      try {
        const value = Function(`"use strict";return (${trimmed})`)() as unknown;
        if (typeof value === 'number' && Number.isFinite(value)) return number(value);
      } catch {
        // 表达式非法：退回原文。
      }
    }
    return trimmed;
  });

  // 6. 残余变量、光杆条件块、图标标签与空白规整（金标准输出无 \r、无 $
  //    与 |T…|t 残留，但保留 |cff…|r 颜色码）。
  t = t.replace(/\|[TA][^|\n]*\|[ta]/g, '');
  // 无字母前缀的条件残段（如尾缀 "$?"）：字母变量已被填充或剥离。
  t = t.replace(/\$\?\s*(\[[^\]]*\])*/g, '');
  // 悬空的链接前缀：个别模板把 $@spellname 直接写在中文词前（非数字 ID），
  // 剥掉前缀保留后面的词，句子仍然通顺。
  t = t.replace(/\$@?(?:spell(?:name|desc|aura|icon|tooltip))\s*/gi, '');
  t = t.replace(/\$\w+/g, '');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/ ?\n ?/g, '\n');
  return t.trim();
}
