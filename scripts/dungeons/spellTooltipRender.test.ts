import { describe, expect, it } from 'vitest';

import {
  renderTooltipDesc,
  type TooltipEffectRow,
  type TooltipSpell,
  type TooltipTables,
} from './spellTooltipRender';

/**
 * wago Journal tooltip 变量填充算法的离线单测（合成 fixture，无网络依赖）。
 *
 * 断言逐条对应实现注释里登记的金标准证据：
 * - 190485：行序 [75, 15, −70]，"$s2%"/"$s3%" 渲染 15/70（1 基位置索引）；
 * - 373973："$373972t2" 必须落到 EffectIndex 1 的周期 3000ms 行；
 * - 373087：单效果行 R0=0/R1=9，"$A2" 渲染 20 码（后缀是半径槽位非行位置）；
 * - 372047："$s1…持续$d" 证明跨技能引用不改变后续变量的上下文归属。
 *
 * 已知偏差（故意不测，避免把 bug 固化成契约）：number() 对非半值边界的
 * 预舍入双重舍入（如 4.251 → "4.2"，正确应为 "4.3"）。
 */

const row = (overrides: Partial<TooltipEffectRow> = {}): TooltipEffectRow => ({
  effect: 0,
  effectIndex: 0,
  effectBasePointsF: 0,
  effectAura: 0,
  effectAmplitude: 0,
  effectAuraPeriod: 0,
  effectRadiusIndex0: 0,
  effectRadiusIndex1: 0,
  effectMiscValue0: 0,
  effectChainTargets: 0,
  effectPointsPerResource: 0,
  difficultyId: 0,
  ...overrides,
});

const spell = (overrides: Partial<TooltipSpell> = {}): TooltipSpell => ({
  name: '测试技能',
  desc: '',
  effects: [],
  durationIndex: 0,
  ...overrides,
});

interface RenderOptions {
  spellId?: number;
  durationIndex?: number;
  name?: string;
  durations?: Record<number, number>;
  radii?: Record<number, number>;
  extraSpells?: Array<[number, TooltipSpell]>;
}

function renderDesc(desc: string, effects: TooltipEffectRow[] = [], options: RenderOptions = {}) {
  const spellId = options.spellId ?? 1000;
  const tables: TooltipTables = {
    spells: new Map<number, TooltipSpell>([
      [
        spellId,
        spell({
          name: options.name ?? '测试技能',
          desc,
          effects,
          durationIndex: options.durationIndex ?? 0,
        }),
      ],
      ...(options.extraSpells ?? []),
    ]),
    durations: new Map(
      Object.entries(options.durations ?? {}).map(([key, value]) => [Number(key), value]),
    ),
    radii: new Map(Object.entries(options.radii ?? {}).map(([key, value]) => [Number(key), value])),
  };
  return renderTooltipDesc(spellId, tables);
}

describe('effect row resolution', () => {
  it('resolves 1-based positions over EffectIndex-ascending rows (golden 190485)', () => {
    // 190485：行序 [75, 15, −70]，"$s2%"/"$s3%" 渲染 15/70（−70 取绝对值）。
    const rendered = renderDesc('$s1%/$s2%/$s3%', [
      row({ effectIndex: 1, effectBasePointsF: 75, difficultyId: 16 }),
      row({ effectIndex: 2, effectBasePointsF: 15, difficultyId: 16 }),
      row({ effectIndex: 3, effectBasePointsF: -70, difficultyId: 16 }),
    ]);
    expect(rendered).toBe('75%/15%/70%');
  });

  it('sorts DifficultyID 0 rows before difficulty 16 rows', () => {
    // 0 难度行优先于 16，即使 EffectIndex 更大。
    const rendered = renderDesc('$s1 $s2', [
      row({ effectIndex: 1, effectBasePointsF: 9, difficultyId: 16 }),
      row({ effectIndex: 5, effectBasePointsF: 4, difficultyId: 0 }),
    ]);
    expect(rendered).toBe('4 9');
  });

  it('renders 0 when the position has no row', () => {
    const rendered = renderDesc('$s5', [
      row({ effectBasePointsF: 1 }),
      row({ effectBasePointsF: 2 }),
    ]);
    expect(rendered).toBe('0');
  });

  it('treats $s/$m/$w as synonyms of the absolute base points', () => {
    const rendered = renderDesc('$s $m $w', [row({ effectBasePointsF: -70 })]);
    expect(rendered).toBe('70 70 70');
  });
});

describe('cross-spell tokens and context isolation', () => {
  const subSpells: Array<[number, TooltipSpell]> = [
    [
      373972,
      spell({
        name: '子法术',
        effects: [
          row({ effectIndex: 0, effectAuraPeriod: 0 }),
          row({ effectIndex: 1, effectAuraPeriod: 3000 }),
        ],
      }),
    ],
  ];

  it('resolves "$373972t2" against EffectIndex 1 (golden 373973)', () => {
    const rendered = renderDesc('$373972t2 秒一次', [], { extraSpells: subSpells });
    expect(rendered).toBe('3 秒一次');
  });

  it('does not let a cross-spell token change the context of later variables', () => {
    const rendered = renderDesc(
      '$373972s1 然后自身 $s1',
      [row({ effectBasePointsF: 9 })],
      {
        extraSpells: [
          [373972, spell({ effects: [row({ effectBasePointsF: 12 })] })],
        ],
      },
    );
    expect(rendered).toBe('12 然后自身 9');
  });

  it('resolves $d against the current spell, not the last referenced one (golden 372047)', () => {
    // 主法术时长 8s（durationIndex 7），子法术 2s（durationIndex 3）：
    // 若上下文被 $373972s1 传染，$d 会错误渲染成 "2 秒"。
    const rendered = renderDesc('$373972s1 持续$d', [row({ effectBasePointsF: 12 })], {
      durationIndex: 7,
      durations: { 7: 8000, 3: 2000 },
      extraSpells: [
        [373972, spell({ durationIndex: 3, effects: [row({ effectBasePointsF: 12 })] })],
      ],
    });
    expect(rendered).toBe('12 持续8 秒');
  });

  it('renders $d duration edge cases', () => {
    expect(renderDesc('$d', [], { durationIndex: 0 })).toBe('取消');
    expect(renderDesc('$d', [], { durationIndex: 5, durations: { 5: 0 } })).toBe('持续施法');
    expect(renderDesc('$d', [], { durationIndex: 9 })).toBe('取消');
  });
});

describe('radius slots', () => {
  const radii = { 9: 20 };

  it('renders $a/$A/$A2 to the same radius via slot fallback (golden 373087)', () => {
    // 单效果行 R0=0/R1=9：$A 默认槽 2 命中 R1，$a 默认槽 1 为空回退到 R1；
    // 若把 $A2 的后缀当效果位置，会因第 2 行不存在而输出 0。
    const rendered = renderDesc('$a/$A/$A2', [row({ effectRadiusIndex0: 0, effectRadiusIndex1: 9 })], {
      radii,
    });
    expect(rendered).toBe('20/20/20');
  });

  it('falls back to any non-zero slot when the requested slot is out of range', () => {
    const rendered = renderDesc('$A3', [row({ effectRadiusIndex1: 9 })], { radii });
    expect(rendered).toBe('20');
  });

  it('renders 0 when both radius slots are empty or the radius id is unknown', () => {
    expect(renderDesc('$A', [row({ effectRadiusIndex0: 0, effectRadiusIndex1: 0 })])).toBe('0');
    expect(renderDesc('$A', [row({ effectRadiusIndex1: 9 })], { radii: { 999: 5 } })).toBe('0');
  });
});

describe('over-time, period and misc effect variables', () => {
  it('computes $o as base points × duration ÷ period', () => {
    const rendered = renderDesc('$o 伤害', [row({ effectBasePointsF: 100, effectAuraPeriod: 1000 })], {
      durationIndex: 7,
      durations: { 7: 6000 },
    });
    expect(rendered).toBe('600 伤害');
  });

  it('renders $t as the aura period in seconds', () => {
    expect(renderDesc('$t 秒', [row({ effectAuraPeriod: 3000 })])).toBe('3 秒');
    expect(renderDesc('$t 秒', [row({ effectAuraPeriod: 0 })])).toBe('0 秒');
  });

  it('renders $e/$x/$b/$q from the effect row and $f as the legacy constant 0', () => {
    const rendered = renderDesc('$e $x $b $q $f', [
      row({ effectAmplitude: 5, effectChainTargets: 3, effectPointsPerResource: 2, effectMiscValue0: 7 }),
    ]);
    expect(rendered).toBe('5 3 2 7 0');
  });

  it('renders 0 for variables without a matching effect row', () => {
    expect(renderDesc('$s $e $x', [])).toBe('0 0 0');
  });
});

describe('number formatting', () => {
  it('passes integers through without decimals', () => {
    expect(renderDesc('$s', [row({ effectBasePointsF: 15 })])).toBe('15');
  });

  it('formats one decimal place with banker rounding at the half edge', () => {
    // 金标准语义（python :.1f）：4.25 → "4.2"。
    expect(renderDesc('$s', [row({ effectBasePointsF: 4.25 })])).toBe('4.2');
    expect(renderDesc('$s', [row({ effectBasePointsF: 4.26 })])).toBe('4.3');
    expect(renderDesc('$s', [row({ effectBasePointsF: 0.5 })])).toBe('0.5');
  });
});

describe('difficulty conditionals', () => {
  it('keeps the main branch of $?condition[main][alt] blocks', () => {
    const rendered = renderDesc('$?diff8[强化][普通] 正文');
    expect(rendered).toBe('强化 正文');
  });

  it('drops empty bracket pairs after the $? main branch', () => {
    // 条件裸写（a382293 是条件形式之一），[正文] 是主内容，空括号对一并移除。
    const rendered = renderDesc('$?a382293[正文][][]');
    expect(rendered).toBe('正文');
  });

  it('keeps the text of $[diffs] blocks and drops $[!diffs] blocks on All', () => {
    expect(renderDesc('$[8,16]英雄文本$] 普通')).toBe('英雄文本 普通');
    expect(renderDesc('$[8,23]\n多行文本$]')).toBe('多行文本');
    expect(renderDesc('$[!8]仅限非8难度$] 保留')).toBe('保留');
  });
});

describe('spell links', () => {
  it('renders $@spellname with the target name and a fallback for unknown ids', () => {
    const rendered = renderDesc('$@spellname200 冻结 $@spellname300', [], {
      extraSpells: [[200, spell({ name: '冰冻' })]],
    });
    expect(rendered).toBe('冰冻 冻结 技能 300');
  });

  it('renders $@spellicon as empty', () => {
    expect(renderDesc('icon=$@spellicon200 x', [], {
      extraSpells: [[200, spell({ name: '冰冻' })]],
    })).toBe('icon= x');
  });

  it('terminates self-referencing $@spelldesc at depth 3', () => {
    // depth 3 → 3 层各自渲染"冰冻 "前缀，最内层（depth 0）退化为技能名
    // "冰冻"，共 5 个；关键断言是递归终止而非具体层数。
    const tables: TooltipTables = {
      spells: new Map([[200, spell({ name: '冰冻', desc: '冰冻 $@spelldesc200' })]]),
      durations: new Map(),
      radii: new Map(),
    };
    expect(renderTooltipDesc(200, tables)).toBe('冰冻 冰冻 冰冻 冰冻 冰冻');
  });
});

describe('arithmetic brackets and residual cleanup', () => {
  it('evaluates ${…} arithmetic after variables are filled', () => {
    expect(renderDesc('${$s1*2}', [row({ effectBasePointsF: 5 })])).toBe('10');
    expect(renderDesc('${1+1}')).toBe('2');
  });

  it('leaves non-numeric expressions as text without evaluating them', () => {
    expect(renderDesc('${未知表达式}')).toBe('未知表达式');
  });

  it('strips unknown variable letters', () => {
    expect(renderDesc('$s1 点 $r $u', [row({ effectBasePointsF: 5 })])).toBe('5 点');
  });

  it('strips icon tags but keeps |cff…|r color codes', () => {
    const rendered = renderDesc('|TInterface\\\\Icons\\\\foo:0|t |cffff0000红字|r');
    expect(rendered).toBe('|cffff0000红字|r');
  });

  it('normalizes CRLF, runs of spaces and newlines', () => {
    const rendered = renderDesc('\r\n  a   b\n  c \r\n');
    expect(rendered).toBe('a b\nc');
  });
});

describe('renderTooltipDesc guards', () => {
  it('returns empty for unknown spell ids', () => {
    expect(renderTooltipDesc(404, {
      spells: new Map(),
      durations: new Map(),
      radii: new Map(),
    })).toBe('');
  });

  it('returns empty when the spell has no description', () => {
    const tables: TooltipTables = {
      spells: new Map([[1000, spell({ desc: '' })]]),
      durations: new Map(),
      radii: new Map(),
    };
    expect(renderTooltipDesc(1000, tables)).toBe('');
  });
});
