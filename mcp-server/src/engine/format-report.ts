// JSON MistweaverReport / HolyPriestReport → Chinese-language text report for LLM consumption.
//
// Output is plain text (Markdown-flavored, no JSX) optimized for AI agent context
// windows: dense numbers, clear section labels, no UI chrome.

import type { MistweaverReport } from './extractors/mistweaver';
import type { HolyPriestReport } from './extractors/holypriest.js';
import type { HolyPaladinReport } from './extractors/holypaladin.js';
import type { RestoDruidReport } from './extractors/restodruid.js';
import type { RestoShamanReport } from './extractors/restoshaman.js';
import type { DisciplineReport } from './extractors/discipline.js';
import type { PreservationReport } from './extractors/preservation.js';
import type { CombatantInfoEvent } from 'parser/core/Events';

export interface FormatOptions {
  /** Maximum number of per-spell rows to include in the breakdown table */
  perSpellLimit?: number;
  reportCode?: string;
  fightName?: string;
  fightKill?: boolean;
  fightDifficulty?: number;
  combatantInfo?: CombatantInfoEvent;
}

export const NUM = new Intl.NumberFormat('zh-CN');
export const PCT = (v: number | undefined): string =>
  v === undefined ? '—' : `${(v * 100).toFixed(1)}%`;
export const DURATION = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}分${s.toString().padStart(2, '0')}秒`;
};
export const DIFFICULTY: Record<number, string> = {
  1: '随机',
  2: '普通',
  3: '英雄',
  4: '史诗',
  5: '史诗',
  10: '挑战',
  100: '英雄',
  101: '英雄',
};

const BUILD_LABEL: Record<MistweaverReport['detectedBuild'], string> = {
  'ancient-teachings-crane': '谆谆古训 + 仙鹤之道 (Ancient Teachings / Crane Style AoE cleave)',
  'vivify-spam': '焕活主导 (Vivify spam)',
  mixed: '混合构筑 (mixed)',
  unknown: '未识别 (insufficient data)',
};

export function formatMistweaverReport(report: MistweaverReport, opts: FormatOptions = {}): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 织雾武僧战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别构筑: **${BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push(`- 总法力消耗: ${NUM.format(t.manaSpent)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 织雾专项指标');
  lines.push('');

  lines.push('### 复苏之雾 (Renewing Mist)');
  lines.push(`- 施法次数: ${s.renewingMist.casts}`);
  lines.push(
    `- HoT 应用 / 刷新 / 跳动: ${s.renewingMist.hotApplies} / ${s.renewingMist.hotRefreshes} / ${s.renewingMist.hotTicks}`,
  );
  lines.push(
    `- HoT 治疗(有效/溢出): ${NUM.format(s.renewingMist.hotHealing)} / ${NUM.format(s.renewingMist.hotOverhealing)}`,
  );
  lines.push('');

  lines.push('### 包裹之雾 (Enveloping Mist)');
  lines.push(
    `- 施法次数: ${s.envelopingMist.casts} (硬读 ${s.envelopingMist.hardCasts} / 雷霆茶强化 ${s.envelopingMist.tftCasts})`,
  );
  lines.push(
    `- 增益应用 / 刷新: ${s.envelopingMist.buffApplies} / ${s.envelopingMist.buffRefreshes}`,
  );
  lines.push(
    `- 直接治疗(有效/溢出): ${NUM.format(s.envelopingMist.directHealing)} / ${NUM.format(s.envelopingMist.directOverhealing)}`,
  );
  lines.push('');

  lines.push('### 焕活 (Vivify)');
  lines.push(`- 施法次数: ${s.vivify.casts}`);
  lines.push(`- 主目标命中 / 溅射命中: ${s.vivify.directHits} / ${s.vivify.cleaveHits}`);
  lines.push(`- 平均每次施法治疗目标数: ${s.vivify.averageTargetsPerCast.toFixed(2)}`);
  lines.push(
    `- 总治疗(有效/溢出): ${NUM.format(s.vivify.totalHealing)} / ${NUM.format(s.vivify.totalOverhealing)}`,
  );
  if (s.vivify.casts === 0 && report.detectedBuild === 'ancient-teachings-crane') {
    lines.push(
      '- *注: 在 12.x 谆谆古训/仙鹤之道构筑中, Vivify 通常被舍弃，由 Tiger Palm/RSK 触发的被动治疗替代。零施法是预期表现。*',
    );
  }
  lines.push('');

  lines.push('### 12.x 构筑核心: 谆谆古训 + 仙鹤之道');
  lines.push(
    `- 仙鹤之道 命中 / 治疗 / 溢出: ${s.metaBuild.craneStyleHits} / ${NUM.format(s.metaBuild.craneStyleHealing)} / ${NUM.format(s.metaBuild.craneStyleOverhealing)}`,
  );
  lines.push(
    `- 谆谆古训 命中 / 治疗 / 溢出: ${s.metaBuild.ancientTeachingsHits} / ${NUM.format(s.metaBuild.ancientTeachingsHealing)} / ${NUM.format(s.metaBuild.ancientTeachingsOverhealing)}`,
  );
  lines.push(
    `- 天神御身(Celestial Conduit) 命中 / 治疗 / 溢出: ${s.metaBuild.celestialConduitHits} / ${NUM.format(s.metaBuild.celestialConduitHealing)} / ${NUM.format(s.metaBuild.celestialConduitOverhealing)}`,
  );
  lines.push(`- 猛虎掌 / 飞身踢 施法次数: ${s.tigerPalm.casts} / ${s.risingSunKick.casts}`);
  lines.push('');

  lines.push('### 安神之雾 (Soothing Mist)');
  lines.push(`- 引导次数 / 跳动数: ${s.soothingMist.channelStarts} / ${s.soothingMist.ticks}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.soothingMist.healing)} / ${NUM.format(s.soothingMist.overhealing)}`,
  );
  lines.push('');

  lines.push('### 群体救场 (Revival / Restoral)');
  lines.push(`- 施法次数: ${s.revivalRestoral.casts}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.revivalRestoral.totalHealing)} / ${NUM.format(s.revivalRestoral.totalOverhealing)}`,
  );
  lines.push(`- 治疗目标数: ${s.revivalRestoral.uniqueTargetsHealed}`);
  lines.push('');

  lines.push('### 冷却技能');
  lines.push(
    `- 雷霆专注茶 / 生命之茧 / 舍龙之赐: ${s.cooldowns.thunderFocusTeaCasts} / ${s.cooldowns.lifeCocoonCasts} / ${s.cooldowns.sheilunsGiftCasts}`,
  );
  lines.push(
    `- 召唤朱红仙鹤 / 召唤翡翠玉龙: ${s.cooldowns.invokeChiJiCasts} / ${s.cooldowns.invokeYulonCasts}`,
  );
  lines.push(`- 法力茶施法次数: ${s.manaTea.casts}`);
  lines.push('');

  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push(
    '| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 法力消耗 | 唯一目标 |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

export function renderCombatantInfo(lines: string[], ci: CombatantInfoEvent): void {
  lines.push('## 玩家装载 (Loadout)');
  lines.push('');
  const ilvls = ci.gear
    .map((g) => g?.itemLevel)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (ilvls.length > 0) {
    const avg = ilvls.reduce((a, b) => a + b, 0) / ilvls.length;
    const min = Math.min(...ilvls);
    const max = Math.max(...ilvls);
    lines.push(`- 装备数: ${ci.gear.length} (有效 ${ilvls.length})`);
    lines.push(`- 装等: 平均 ${avg.toFixed(1)} / 最低 ${min} / 最高 ${max}`);
  }
  const stats = [
    ['智力', ci.intellect],
    ['耐力', ci.stamina],
    ['爆击', ci.critSpell],
    ['急速', ci.hasteSpell],
    ['全能(治疗加成)', ci.versatilityHealingDone],
    ['精通', ci.mastery],
    ['吸血', ci.leech],
  ] as const;
  const statLine = stats
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k, v]) => `${k}=${NUM.format(v as number)}`)
    .join(' / ');
  if (statLine) {
    lines.push(`- 核心属性: ${statLine}`);
  }
  const talentCount = Array.isArray(ci.talentTree) ? ci.talentTree.length : 0;
  if (talentCount > 0) {
    lines.push(`- 天赋节点数: ${talentCount}`);
  }
  lines.push('');
}

export const BUILD_LABEL_HP: Record<HolyPriestReport['detectedBuild'], string> = {
  archon: '执政官 (Archon — 光环/共鸣能量)',
  oracle: '先知 (Oracle — 虔诚/预感)',
  unknown: '未识别 (insufficient data)',
};

export function formatHolyPriestReport(report: HolyPriestReport, opts: FormatOptions = {}): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 神圣牧师战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别英雄天赋: **${BUILD_LABEL_HP[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push(`- 总法力消耗: ${NUM.format(t.manaSpent)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 神牧专项指标');
  lines.push('');

  lines.push('### 愈合祷言 (Prayer of Mending)');
  lines.push(`- 施法次数: ${s.prayerOfMending.casts}`);
  lines.push(`- 弹跳次数: ${s.prayerOfMending.bounces}`);
  lines.push(`- 平均每次施法弹跳: ${s.prayerOfMending.averageBouncesPerCast.toFixed(2)}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.prayerOfMending.totalHealing)} / ${NUM.format(s.prayerOfMending.totalOverhealing)}`,
  );
  lines.push('');

  lines.push('### 恢复 (Renew)');
  lines.push(`- 施法次数: ${s.renew.casts}`);
  lines.push(
    `- HoT 应用 / 刷新 / 跳动: ${s.renew.hotApplies} / ${s.renew.hotRefreshes} / ${s.renew.hotTicks}`,
  );
  lines.push(
    `- HoT 治疗(有效/溢出): ${NUM.format(s.renew.hotHealing)} / ${NUM.format(s.renew.hotOverhealing)}`,
  );
  lines.push(
    `- 强化恢复 命中 / 治疗: ${s.renew.empoweredRenewHits} / ${NUM.format(s.renew.empoweredRenewHealing)}`,
  );
  lines.push('');

  lines.push('### 圣言术 & CDR 预估');
  lines.push(
    `- 圣言术：静 施法 / 治疗: ${s.holyWords.serenityCasts} / ${NUM.format(s.holyWords.serenityHealing)}`,
  );
  lines.push(
    `- 圣言术：净 施法 / 治疗: ${s.holyWords.sanctifyCasts} / ${NUM.format(s.holyWords.sanctifyHealing)}`,
  );
  lines.push(`- 圣言术：罚 施法: ${s.holyWords.chastiseCasts}`);
  lines.push(`- 究极静念 施法: ${s.holyWords.ultimateSerenityCasts}`);
  lines.push('');
  lines.push('#### CDR 预估 (基于施法次数)');
  lines.push(
    `- 快速治疗 施法: ${s.holyWordCDR.flashHealCasts} × 6s · 愈合祷言 施法: ${s.holyWordCDR.prayerOfMendingCasts} × 4s · 治疗祷言 施法: ${s.holyWordCDR.prayerOfHealingCasts} × 6s`,
  );
  lines.push(`- 预估 圣言术：静 CDR: **${s.holyWordCDR.estimatedSerenityCDR}s**`);
  lines.push(
    `- 预估 圣言术：净 CDR: **${s.holyWordCDR.estimatedSanctifyCDR}s** (治疗祷言 ${s.holyWordCDR.prayerOfHealingCasts} × 6s)`,
  );
  lines.push(
    `- 真言术：惩: ${s.holyWordCDR.smiteCasts} · 神圣灼烧: ${s.holyWordCDR.holyFireCasts} · 神圣新星: ${s.holyWordCDR.holyNovaCasts}`,
  );
  lines.push(`- 预估 圣言术：罚 CDR: **${s.holyWordCDR.estimatedChastiseCDR}s**`);
  lines.push('');

  lines.push('### 群体治疗 (AoE)');
  lines.push(
    `- 治疗祷言 施法 / 治疗: ${s.aoeHeals.prayerOfHealingCasts} / ${NUM.format(s.aoeHeals.prayerOfHealingHealing)}`,
  );
  lines.push(
    `- 神圣赞美诗 施法 / 跳动 / 治疗: ${s.aoeHeals.divineHymnCasts} / ${s.aoeHeals.divineHymnTicks} / ${NUM.format(s.aoeHeals.divineHymnHealing)}`,
  );
  lines.push(`- 光环 命中 / 治疗: ${s.aoeHeals.haloHits} / ${NUM.format(s.aoeHeals.haloHealing)}`);
  lines.push(
    `- 神圣新星 命中 / 治疗: ${s.aoeHeals.holyNovaHits} / ${NUM.format(s.aoeHeals.holyNovaHealing)}`,
  );
  lines.push('');

  lines.push('### 冷却技能');
  lines.push(
    `- 化身 / 守护之魂 / 能量灌注: ${s.cooldowns.apotheosisCasts} / ${s.cooldowns.guardianSpiritCasts} / ${s.cooldowns.powerInfusionCasts}`,
  );
  lines.push('');

  lines.push('### 触发 / 被动收益');
  const proc = s.procs;
  lines.push(`- 光明涌现 触发 / 消耗: ${proc.surgeOfLightProcs} / ${proc.surgeOfLightConsumed}`);
  lines.push(
    `- 圣光足迹 命中 / 治疗: ${proc.trailOfLightHits} / ${NUM.format(proc.trailOfLightHealing)}`,
  );
  lines.push(`- 光井 命中 / 治疗: ${proc.lightwellHits} / ${NUM.format(proc.lightwellHealing)}`);
  lines.push(
    `- 宇宙涟漪 命中 / 治疗: ${proc.cosmicRippleHits} / ${NUM.format(proc.cosmicRippleHealing)}`,
  );
  lines.push(
    `- 共愈合 命中 / 治疗: ${proc.bindingHealsHits} / ${NUM.format(proc.bindingHealsHealing)}`,
  );
  lines.push(
    `- 神圣形象 命中 / 治疗: ${proc.divineImageHits} / ${NUM.format(proc.divineImageHealing)}`,
  );
  lines.push(`- 顿悟 消耗: ${proc.epiphanyConsumed}`);
  lines.push('');

  lines.push('### 精通：光之回响 (Echo of Light)');
  lines.push(
    `- 命中 / 治疗 / 溢出: ${s.mastery.echoOfLightHits} / ${NUM.format(s.mastery.echoOfLightHealing)} / ${NUM.format(s.mastery.echoOfLightOverhealing)}`,
  );
  lines.push('');

  lines.push('### 英雄天赋');
  const arch = s.heroTalent.archon;
  const ora = s.heroTalent.oracle;
  lines.push(
    `- 执政官(Archon) — 光环 命中 / 治疗: ${arch.haloHits} / ${NUM.format(arch.haloHealing)} · 共鸣能量 最高层数: ${arch.resonantEnergyMaxStacks}`,
  );
  lines.push(`- 先知(Oracle) — 虔诚 事件: ${ora.piety} · 预感 使用: ${ora.premonitionUses}`);
  lines.push('');

  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push(
    '| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 法力消耗 | 唯一目标 |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

function formatSpellRow(row: {
  spellId: number;
  spellName: string;
  spellNameCN: string;
  casts: number;
  hits: number;
  ticks: number;
  crits: number;
  healing: number;
  overhealing: number;
  manaSpent: number;
  uniqueTargets: number;
  healingEfficiency: number | undefined;
}): string {
  const label =
    row.spellNameCN !== row.spellName
      ? `${row.spellNameCN} (${row.spellName}, ${row.spellId})`
      : `${row.spellName} (${row.spellId})`;
  return [
    label,
    NUM.format(row.casts),
    NUM.format(row.hits),
    NUM.format(row.ticks),
    NUM.format(row.crits),
    NUM.format(row.healing),
    NUM.format(row.overhealing),
    PCT(row.healingEfficiency),
    NUM.format(row.manaSpent),
    NUM.format(row.uniqueTargets),
  ]
    .map((c) => ` ${c} `)
    .join('|')
    .replace(/^/, '|')
    .replace(/$/, '|');
}

const HPAL_BUILD_LABEL: Record<HolyPaladinReport['detectedBuild'], string> = {
  lightsmith: '圣光匠 (Lightsmith)',
  'herald-of-the-sun': '烈日先驱 (Herald of the Sun)',
  unknown: '未识别 (unknown)',
};

export function formatHolyPaladinReport(
  report: HolyPaladinReport,
  opts: FormatOptions = {},
): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 神圣骑士战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别英雄天赋: **${HPAL_BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 神圣骑士专项指标');
  lines.push('');

  // Beacon
  lines.push('### 信标转移治疗');
  lines.push(`- 信标转移治疗量(有效): ${NUM.format(s.beacon.transferHealing)}`);
  lines.push(`- 信标转移溢出: ${NUM.format(s.beacon.transferOverhealing)}`);
  lines.push(`- 转移命中次数: ${NUM.format(s.beacon.transferHits)}`);
  lines.push(`- 最高活跃信标目标数: ${s.beacon.activeBeaconCount}`);
  if (s.beacon.beaconOfFaithDetected) {
    lines.push('- 检测到信仰信标 (Beacon of Faith)');
  }
  if (s.beacon.beaconOfVirtueCasts > 0) {
    lines.push(`- 美德信标施法次数: ${s.beacon.beaconOfVirtueCasts}`);
  }
  if (s.beacon.bySource.length > 0) {
    lines.push('- 按来源法术:');
    for (const src of s.beacon.bySource.slice(0, 6)) {
      lines.push(`  - ${src.spellNameCN}: ${NUM.format(src.healing)}`);
    }
  }
  lines.push('');

  // Holy Shock
  lines.push('### 神圣震击');
  lines.push(`- 施法次数: ${s.holyShock.casts}`);
  lines.push(`- 治疗命中 / 伤害命中: ${s.holyShock.healHits} / ${s.holyShock.damageHits}`);
  lines.push(`- 暴击次数: ${s.holyShock.crits}`);
  lines.push(`- 圣光灌注触发 / 消耗: ${s.holyShock.iolProcs} / ${s.holyShock.iolConsumed}`);
  lines.push('');

  // Word of Glory
  lines.push('### 荣耀圣言');
  lines.push(`- 施法次数: ${s.wordOfGlory.casts}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.wordOfGlory.healing)} / ${NUM.format(s.wordOfGlory.overhealing)}`,
  );
  if (s.wordOfGlory.empyreanLegacyProcs > 0) {
    lines.push(`- 苍穹遗产触发: ${s.wordOfGlory.empyreanLegacyProcs}`);
  }
  lines.push('');

  // Light of Dawn
  lines.push('### 黎明之光');
  lines.push(`- 施法次数: ${s.lightOfDawn.casts}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.lightOfDawn.healing)} / ${NUM.format(s.lightOfDawn.overhealing)}`,
  );
  lines.push(`- 总命中目标数: ${s.lightOfDawn.targetsHit}`);
  if (s.lightOfDawn.casts > 0) {
    lines.push(
      `- 每次施法平均命中目标: ${(s.lightOfDawn.targetsHit / s.lightOfDawn.casts).toFixed(2)}`,
    );
  }
  lines.push('');

  // Holy Power
  lines.push('### 神圣能量');
  lines.push(
    `- 生成 / 花费 / 浪费: ${NUM.format(s.holyPower.generated)} / ${NUM.format(s.holyPower.spent)} / ${NUM.format(s.holyPower.wasted)}`,
  );
  lines.push(`- 能量效率: ${PCT(s.holyPower.efficiency)}`);
  lines.push('');

  // Cooldowns
  lines.push('### 冷却技能');
  lines.push(`- 复仇之怒: ${s.cooldowns.avengingWrathCasts}`);
  lines.push(`- 复仇圣战士: ${s.cooldowns.avengingCrusaderCasts}`);
  lines.push(`- 神圣警钟: ${s.cooldowns.divineTollCasts}`);
  lines.push(`- 光环掌握: ${s.cooldowns.auraMasteryCasts}`);
  lines.push(`- 圣佑术: ${s.cooldowns.divineProtectionCasts}`);
  lines.push(`- 提尔的拯救: ${s.cooldowns.tyrsDeliveranceCasts}`);
  lines.push(`- 神圣棱镜: ${s.cooldowns.holyPrismCasts}`);
  lines.push(`- 圣疗术: ${s.cooldowns.layOnHandsCasts}`);
  lines.push('');

  // Hero talents
  const ht = s.heroTalents;
  if (report.detectedBuild === 'lightsmith') {
    lines.push('### 英雄天赋: 圣光匠 (Lightsmith)');
    lines.push(
      `- 神圣武器 治疗 / 命中: ${NUM.format(ht.lightsmith.sacredWeaponHealing)} / ${ht.lightsmith.sacredWeaponHits}`,
    );
    lines.push(`- 神圣壁垒 吸收次数: ${ht.lightsmith.holyBulwarkAbsorbs}`);
    if (ht.lightsmith.divineGuidanceHealing > 0) {
      lines.push(`- 神圣指引 治疗: ${NUM.format(ht.lightsmith.divineGuidanceHealing)}`);
    }
    if (ht.lightsmith.blessedAssuranceUses > 0) {
      lines.push(`- 神佑保证 使用次数: ${ht.lightsmith.blessedAssuranceUses}`);
    }
  } else if (report.detectedBuild === 'herald-of-the-sun') {
    lines.push('### 英雄天赋: 烈日先驱 (Herald of the Sun)');
    lines.push(
      `- 晨光 治疗 / 命中: ${NUM.format(ht.heraldOfTheSun.dawnlightHealing)} / ${ht.heraldOfTheSun.dawnlightHits}`,
    );
    if (ht.heraldOfTheSun.sunSearHealing > 0) {
      lines.push(`- 烈日灼烧 治疗: ${NUM.format(ht.heraldOfTheSun.sunSearHealing)}`);
    }
    if (ht.heraldOfTheSun.blessingOfAnsheUses > 0) {
      lines.push(`- 安阿尼之祝 使用次数: ${ht.heraldOfTheSun.blessingOfAnsheUses}`);
    }
    if (ht.heraldOfTheSun.solarGraceMaxStacks > 0) {
      lines.push(`- 太阳恩典 最高层数: ${ht.heraldOfTheSun.solarGraceMaxStacks}`);
    }
  } else {
    lines.push('### 英雄天赋: 未检测到活跃');
    lines.push('- 本场战斗未检测到圣光匠或烈日先驱的相关法术事件。');
  }
  lines.push('');

  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push('| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 唯一目标 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

// ── Restoration Shaman ──────────────────────────────────────────────

const RS_BUILD_LABEL: Record<RestoShamanReport['detectedBuild'], string> = {
  totemic: '图腾祭祀 (Totemic)',
  farseer: '先知 (Farseer)',
  unknown: '未识别 (insufficient data)',
};

export function formatRestoShamanReport(
  report: RestoShamanReport,
  opts: FormatOptions = {},
): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 恢复萨满战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别英雄天赋: **${RS_BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push(`- 总法力消耗: ${NUM.format(t.manaSpent)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 恢复萨满专项指标');
  lines.push('');

  // ── Riptide ──
  lines.push('### 激流 (Riptide)');
  lines.push(`- 施法次数: ${s.riptide.casts}`);
  lines.push(
    `- 初始直击命中 / 治疗: ${s.riptide.initialHits} / ${NUM.format(s.riptide.initialHealing)}`,
  );
  lines.push(`- HoT 应用 / 刷新: ${s.riptide.hotApplies} / ${s.riptide.hotRefreshes}`);
  lines.push(
    `- HoT 跳动 / 治疗 / 溢出: ${s.riptide.hotTicks} / ${NUM.format(s.riptide.hotHealing)} / ${NUM.format(s.riptide.hotOverhealing)}`,
  );
  lines.push('');

  // ── Chain Heal ──
  lines.push('### 治疗链 (Chain Heal)');
  lines.push(`- 施法次数: ${s.chainHeal.casts}`);
  lines.push(`- 总弹跳命中: ${s.chainHeal.bounceHits}`);
  lines.push(`- 平均每次施法弹跳数: ${s.chainHeal.averageBouncesPerCast.toFixed(2)}`);
  lines.push(
    `- 总治疗(有效/溢出): ${NUM.format(s.chainHeal.totalHealing)} / ${NUM.format(s.chainHeal.totalOverhealing)}`,
  );
  lines.push('');

  // ── Cloudburst ──
  lines.push('### 暴雨图腾 (Cloudburst Totem)');
  lines.push(`- 释放命中次数: ${s.cloudburst.releaseHits}`);
  lines.push(`- 总释放治疗: ${NUM.format(s.cloudburst.totalReleaseHealing)}`);
  lines.push(`- 手动召回次数: ${s.cloudburst.manualRecalls}`);
  lines.push('');

  // ── Earthliving ──
  lines.push('### 大地生命武器 (Earthliving Weapon)');
  lines.push(`- HoT 跳动: ${s.earthliving.hotTicks}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.earthliving.hotHealing)} / ${NUM.format(s.earthliving.hotOverhealing)}`,
  );
  lines.push('');

  // ── Totems ──
  lines.push('### 图腾');
  lines.push(
    `- 治疗之泉图腾 施法: ${s.totems.healingStreamTotemCasts} · 跳动治疗: ${NUM.format(s.totems.healingStreamTickHealing)}`,
  );
  lines.push(
    `- 治疗之潮图腾 跳动: ${s.totems.healingTideTotemTicks} · 治疗: ${NUM.format(s.totems.healingTideTotemHealing)}`,
  );
  lines.push(`- 大地之墙图腾 吸收量: ${NUM.format(s.totems.earthenWallTotemAbsorbed)}`);
  lines.push(
    `- 灵魂链接图腾 施法: ${s.totems.spiritLinkTotemCasts} · 法力之潮图腾 施法: ${s.totems.manaTideTotemCasts}`,
  );
  lines.push('');

  // ── Cooldowns ──
  lines.push('### 冷却技能');
  lines.push(`- 升腾 施法: ${s.cooldowns.ascendanceCasts}`);
  lines.push(`- 升腾窗口内总治疗: ${NUM.format(s.cooldowns.ascendanceWindowHealing)}`);
  lines.push(`- 升腾爆发治疗(114083+294020): ${NUM.format(s.cooldowns.ascendanceBurstHealing)}`);
  lines.push(
    `- 灵魂行者恩典: ${s.cooldowns.spiritwalkersGraceCasts} · 自然迅捷: ${s.cooldowns.naturesSwiftnessCasts}`,
  );
  lines.push(`- 始源之潮 施法: ${s.cooldowns.primordialWaveCasts}`);
  lines.push('');

  // ── Hero Talents ──
  const ht = s.heroTalent;
  if (report.detectedBuild === 'totemic') {
    lines.push('### 英雄天赋: 图腾祭祀 (Totemic)');
    lines.push(`- 涌动图腾 施法: ${ht.totemic.surgingTotemCasts}`);
    lines.push(`- 风暴之流图腾 + 风暴涌流 治疗: ${NUM.format(ht.totemic.stormstreamHealing)}`);
    lines.push(`- 图腾祭祀回弹(治疗链) 治疗: ${NUM.format(ht.totemic.totemicReboundChainHealing)}`);
    lines.push(`- 治疗之雨(图腾祭祀) 治疗: ${NUM.format(ht.totemic.healingRainTotemicHealing)}`);
  } else if (report.detectedBuild === 'farseer') {
    lines.push('### 英雄天赋: 先知 (Farseer)');
    lines.push(`- 先祖召唤(治疗链) 治疗: ${NUM.format(ht.farseer.callOfAncestorsChainHealing)}`);
    lines.push(`- 先祖觉醒 治疗: ${NUM.format(ht.farseer.ancestralAwakeningHealing)}`);
  } else {
    lines.push('### 英雄天赋: 未检测到活跃');
    lines.push('- 本场战斗未检测到图腾祭祀或先知的相关法术事件。');
  }
  lines.push('');

  // ── Spell table ──
  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push(
    '| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 法力消耗 | 唯一目标 |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

const RD_BUILD_LABEL: Record<RestoDruidReport['detectedBuild'], string> = {
  wildstalker: '荒野追猎者 (Wildstalker)',
  'keeper-of-the-grove': '林地守护者 (Keeper of the Grove)',
  unknown: '未识别 (unknown)',
};

export function formatRestoDruidReport(report: RestoDruidReport, opts: FormatOptions = {}): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 恢复德鲁伊战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别英雄天赋: **${RD_BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push(`- 总法力消耗: ${NUM.format(t.manaSpent)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 恢复德鲁伊专项指标');
  lines.push('');

  // Rejuvenation + Germination
  lines.push('### 回春术 & 萌芽 (Rejuvenation & Germination)');
  lines.push(`- 施法次数: ${s.rejuvenation.casts}`);
  lines.push(
    `- HoT 应用 / 刷新 / 跳动: ${s.rejuvenation.hotApplies} / ${s.rejuvenation.hotRefreshes} / ${s.rejuvenation.hotTicks}`,
  );
  lines.push(
    `- HoT 治疗(有效/溢出): ${NUM.format(s.rejuvenation.hotHealing)} / ${NUM.format(s.rejuvenation.hotOverhealing)}`,
  );
  if (s.rejuvenation.germinationApplies > 0) {
    lines.push(
      `- 萌芽 应用 / 跳动 / 治疗: ${s.rejuvenation.germinationApplies} / ${s.rejuvenation.germinationTicks} / ${NUM.format(s.rejuvenation.germinationHealing)}`,
    );
  }
  lines.push('');

  // Lifebloom
  lines.push('### 生命绽放 (Lifebloom)');
  lines.push(`- 施法次数: ${s.lifebloom.casts}`);
  lines.push(`- 覆盖率: ${PCT(s.lifebloom.uptimePct)} (${DURATION(s.lifebloom.uptimeMs)})`);
  lines.push(`- 唯一目标数: ${s.lifebloom.uniqueTargets}`);
  lines.push(
    `- 绽放命中 / 治疗: ${s.lifebloom.bloomHits} / ${NUM.format(s.lifebloom.bloomHealing)}`,
  );
  lines.push(`- HoT 跳动 / 治疗: ${s.lifebloom.hotTicks} / ${NUM.format(s.lifebloom.hotHealing)}`);
  lines.push('');

  // Wild Growth
  lines.push('### 野性成长 (Wild Growth)');
  lines.push(`- 施法次数: ${s.wildGrowth.casts}`);
  lines.push(`- HoT 应用总数: ${s.wildGrowth.hotApplies}`);
  lines.push(`- 平均每次施法命中目标: ${s.wildGrowth.averageTargetsPerCast.toFixed(2)}`);
  lines.push(
    `- HoT 跳动 / 治疗(有效/溢出): ${s.wildGrowth.hotTicks} / ${NUM.format(s.wildGrowth.hotHealing)} / ${NUM.format(s.wildGrowth.hotOverhealing)}`,
  );
  lines.push('');

  // Regrowth
  lines.push('### 愈合 (Regrowth)');
  lines.push(`- 施法次数: ${s.regrowth.casts}`);
  lines.push(
    `- 直接治疗 命中 / 有效: ${s.regrowth.directHits} / ${NUM.format(s.regrowth.directHealing)}`,
  );
  lines.push(`- HoT 跳动 / 治疗: ${s.regrowth.hotTicks} / ${NUM.format(s.regrowth.hotHealing)}`);
  lines.push(
    `- 清晰预兆 触发 / 消耗: ${s.regrowth.clearcastingProcs} / ${s.regrowth.clearcastingConsumed}`,
  );
  lines.push('');

  // Swiftmend
  lines.push('### 迅捷治愈 (Swiftmend)');
  lines.push(`- 施法次数: ${s.swiftmend.casts}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.swiftmend.healing)} / ${NUM.format(s.swiftmend.overhealing)}`,
  );
  lines.push('');

  // Tranquility
  lines.push('### 宁静 (Tranquility)');
  lines.push(`- 施法次数: ${s.tranquility.casts}`);
  lines.push(`- 跳动次数: ${s.tranquility.ticks}`);
  lines.push(
    `- 治疗(有效/溢出): ${NUM.format(s.tranquility.healing)} / ${NUM.format(s.tranquility.overhealing)}`,
  );
  lines.push('');

  // Cenarion Ward
  if (s.cenarionWard.casts > 0 || s.cenarionWard.healing > 0) {
    lines.push('### 塞纳里奥结界 (Cenarion Ward)');
    lines.push(`- 施法次数: ${s.cenarionWard.casts}`);
    lines.push(
      `- 治疗(有效/溢出): ${NUM.format(s.cenarionWard.healing)} / ${NUM.format(s.cenarionWard.overhealing)}`,
    );
    lines.push('');
  }

  // Efflorescence
  if (s.efflorescence.casts > 0 || s.efflorescence.healing > 0) {
    lines.push('### 繁盛 (Efflorescence)');
    lines.push(`- 施法次数: ${s.efflorescence.casts}`);
    lines.push(`- 治疗跳动次数: ${s.efflorescence.ticks}`);
    lines.push(
      `- 治疗(有效/溢出): ${NUM.format(s.efflorescence.healing)} / ${NUM.format(s.efflorescence.overhealing)}`,
    );
    lines.push('');
  }

  // Procs: Cultivation & Spring Blossoms
  lines.push('### 触发治疗 (Procs)');
  lines.push(
    `- 栽培 命中 / 治疗: ${s.procs.cultivationHits} / ${NUM.format(s.procs.cultivationHealing)}`,
  );
  lines.push(
    `- 春暖花开 命中 / 治疗: ${s.procs.springBlossomsHits} / ${NUM.format(s.procs.springBlossomsHealing)}`,
  );
  lines.push('');

  // Cooldowns
  lines.push('### 冷却技能');
  lines.push(
    `- 化身：生命之树 / 召集精灵 / 树林守护者: ${s.cooldowns.incarnationTreeOfLifeCasts} / ${s.cooldowns.convokeCasts} / ${s.cooldowns.groveGuardiansCasts}`,
  );
  lines.push(
    `- 铁木树皮 / 激活 / 自然迅捷 / 树皮术: ${s.cooldowns.ironbarkCasts} / ${s.cooldowns.innervateCasts} / ${s.cooldowns.naturesSwiftnessCasts} / ${s.cooldowns.barkskinCasts}`,
  );
  lines.push('');

  // Mastery: Harmony
  lines.push('### 精通：和谐 (Mastery: Harmony)');
  lines.push(`- 加权平均 HoTs 数量 (按治疗量): ${s.mastery.averageHotsPerHeal.toFixed(2)}`);
  lines.push(`- 加权平均精通乘数 (含递减): ${s.mastery.averageMasteryStacks.toFixed(2)}`);
  lines.push(`- 峰值同时 HoTs 数: ${s.mastery.peakSimultaneousHots}`);
  if (s.mastery.harmoniousBloomingDetected) {
    lines.push('- 检测到和谐绽放 (Harmonious Blooming): 精通计算已计入额外 +2 层');
  }
  lines.push('');

  // Hero talents
  const ht2 = s.heroTalent;
  if (report.detectedBuild === 'wildstalker') {
    lines.push('### 英雄天赋: 荒野追猎者 (Wildstalker)');
    lines.push(
      `- 共生绽放 命中 / 治疗: ${ht2.wildstalker.symbioticBloomsHits} / ${NUM.format(ht2.wildstalker.symbioticBloomsHealing)}`,
    );
  } else if (report.detectedBuild === 'keeper-of-the-grove') {
    lines.push('### 英雄天赋: 林地守护者 (Keeper of the Grove)');
    lines.push(
      `- 愈合(林地守护者) 命中 / 治疗: ${ht2.keeperOfTheGrove.dryadRegrowthHits} / ${NUM.format(ht2.keeperOfTheGrove.dryadRegrowthHealing)}`,
    );
    lines.push(
      `- 宁静(林地守护者) 命中 / 治疗: ${ht2.keeperOfTheGrove.dryadTranquilityHits} / ${NUM.format(ht2.keeperOfTheGrove.dryadTranquilityHealing)}`,
    );
  } else {
    lines.push('### 英雄天赋: 未检测到活跃');
    lines.push('- 本场战斗未检测到荒野追猎者或林地守护者的相关法术事件。');
  }
  lines.push('');

  // Per-spell table
  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push(
    '| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 法力消耗 | 唯一目标 |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

const DISC_BUILD_LABEL: Record<DisciplineReport['detectedBuild'], string> = {
  voidweaver: '虚空编织者 (Voidweaver)',
  oracle: '先知 (Oracle)',
  mixed: '混合构筑 (mixed — 检测到双英雄天赋事件)',
  unknown: '未识别 (insufficient data)',
};

export function formatDisciplineReport(report: DisciplineReport, opts: FormatOptions = {}): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 戒律牧师战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别构筑: **${DISC_BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t.casts)}`);
  lines.push(`- 总法力消耗: ${NUM.format(t.manaSpent)}`);
  lines.push('');

  const s = report.specifics;
  lines.push('## 戒律专项指标');
  lines.push('');

  // ── Atonement ──
  lines.push('### 救赎 (Atonement)');
  lines.push(
    `- 救赎总治疗(有效/溢出): **${NUM.format(s.atonement.totalAtonementHealing)}** / ${NUM.format(s.atonement.totalAtonementOverhealing)}`,
  );
  lines.push(`- 平均活跃救赎目标数: ${s.atonement.averageAtonements.toFixed(2)}`);
  lines.push(`- 峰值活跃救赎目标数: ${s.atonement.peakAtonements}`);
  lines.push('');
  lines.push('#### 救赎应用者 (Applicators)');
  lines.push(`- 真言术：盾: ${s.atonement.applicators.powerWordShield}`);
  lines.push(`- 请求: ${s.atonement.applicators.plea}`);
  lines.push(`- 快速治疗: ${s.atonement.applicators.flashHeal}`);
  lines.push(`- 苦修: ${s.atonement.applicators.penance}`);
  lines.push(`- 真言术：光辉: ${s.atonement.applicators.powerWordRadiance}`);
  lines.push('');
  if (s.atonement.bySource.length > 0) {
    lines.push('#### 救赎来源法术 (by damage source)');
    lines.push('| 法术 | 有效治疗 | 命中次数 |');
    lines.push('|---|---:|---:|');
    for (const src of s.atonement.bySource.slice(0, 10)) {
      lines.push(
        `| ${src.spellNameCN} (${src.spellId}) | ${NUM.format(src.healing)} | ${src.hits} |`,
      );
    }
    lines.push('');
  }

  // ── Penance ──
  lines.push('### 苦修 (Penance)');
  lines.push(`- 施法次数: ${s.penance.casts}`);
  lines.push(
    `- 进攻苦修弹 / 防御苦修弹: ${s.penance.offensiveBolts} / ${s.penance.defensiveBolts}`,
  );
  lines.push(`- 苦修总伤害: ${NUM.format(s.penance.totalDamage)}`);
  lines.push(`- 苦修总治疗: ${NUM.format(s.penance.totalHealing)}`);
  lines.push('');

  // ── Shields ──
  lines.push('### 护盾');
  lines.push(`- 真言术：盾 施法次数: ${s.shields.powerWordShieldCasts}`);
  lines.push(`- 护盾吸收总量: ${NUM.format(s.shields.shieldAbsorbed)}`);
  lines.push('');

  // ── Cooldowns ──
  lines.push('### 冷却技能');
  lines.push(
    `- 福音 / 真言术：盾障 / 痛苦压制: ${s.cooldowns.evangelismCasts} / ${s.cooldowns.powerWordBarrierCasts} / ${s.cooldowns.painSuppressionCasts}`,
  );
  lines.push(`- 终极忏悔: ${s.cooldowns.ultimatePenitenceCasts}`);
  lines.push(
    `- 暗影魔 / 神志屈服: ${s.cooldowns.shadowfiendCasts} / ${s.cooldowns.mindbenderCasts}`,
  );
  lines.push(`- 能量灌注: ${s.cooldowns.powerInfusionCasts}`);
  lines.push('');

  // ── Voidweaver (if applicable) ──
  if (s.voidweaver) {
    lines.push('### 虚空编织者 (Voidweaver)');
    lines.push(`- 虚空爆发 伤害: ${NUM.format(s.voidweaver.voidBlastDamage)}`);
    lines.push(`- 虚空剥蚀 伤害: ${NUM.format(s.voidweaver.voidFlayDamage)}`);
    lines.push(`- 熵能裂隙 伤害: ${NUM.format(s.voidweaver.entropicRiftDamage)}`);
    lines.push(`- 坍缩虚空 伤害: ${NUM.format(s.voidweaver.collapsingVoidDamage)}`);
    lines.push('');
  }

  // ── Per-spell table ──
  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push(
    '| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 法力消耗 | 唯一目标 |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  // ── Warnings ──
  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}

// ── Preservation Evoker ──────────────────────────────────────────────

const PRES_BUILD_LABEL: Record<PreservationReport['detectedBuild'], string> = {
  chronowarden: '时空守卫 (Chronowarden)',
  flameshaper: '塑焰者 (Flameshaper)',
  unknown: '未识别 (unknown)',
};

export function formatPreservationReport(
  report: PreservationReport,
  opts: FormatOptions = {},
): string {
  const limit = opts.perSpellLimit ?? 15;
  const lines: string[] = [];

  lines.push('# 恩护唤魔师战斗分析报告');
  lines.push('');
  if (opts.reportCode) {
    lines.push(`- 报告代码: \`${opts.reportCode}\``);
  }
  if (opts.fightName) {
    const diff = opts.fightDifficulty
      ? `${DIFFICULTY[opts.fightDifficulty] ?? `难度${opts.fightDifficulty}`}`
      : '';
    const result = opts.fightKill === undefined ? '' : opts.fightKill ? '✅击杀' : '❌灭团';
    lines.push(`- 战斗: ${opts.fightName}${diff ? ` (${diff})` : ''} ${result}`);
  }
  lines.push(`- 玩家: ${report.playerName} (ID ${report.playerId})`);
  lines.push(`- 战斗时长: ${DURATION(report.fightDurationMs)}`);
  lines.push(`- 总事件数: ${NUM.format(report.totals.eventCount)}`);
  lines.push(`- 自动识别英雄天赋: **${PRES_BUILD_LABEL[report.detectedBuild]}**`);
  lines.push('');

  if (opts.combatantInfo) {
    renderCombatantInfo(lines, opts.combatantInfo);
  }

  const t2 = report.totals;
  lines.push('## 总览');
  lines.push('');
  lines.push(`- 有效治疗: **${NUM.format(t2.healing)}**`);
  lines.push(`- 治疗溢出: ${NUM.format(t2.overhealing)}`);
  lines.push(`- 治疗效率(非溢出比例): **${PCT(t2.healingEfficiency)}**`);
  lines.push(`- HPS: **${NUM.format(Math.round(t2.hps))}**`);
  lines.push(`- 总施法次数: ${NUM.format(t2.casts)}`);
  lines.push(`- 精华消耗: ${NUM.format(report.specifics.essence.totalSpent)}`);
  lines.push('');

  const s2 = report.specifics;
  lines.push('## 恩护专项指标');
  lines.push('');

  // ── Empower ──
  lines.push('### 蓄能法术 (Empower)');
  lines.push('');

  const db = s2.empower.dreamBreath;
  lines.push('#### 梦境吐息 (Dream Breath)');
  lines.push(`- 施法次数: ${db.casts}`);
  lines.push(`- 各层蓄能施法: ${db.castsByLevel.map((c, i) => `L${i}:${c}`).join(' / ')}`);
  lines.push(`- HoT 跳动: ${db.hotTicks}`);
  lines.push(`- 总治疗量: **${NUM.format(db.totalHealing)}**`);
  lines.push(
    `- 各层蓄能治疗: ${db.healingByLevel.map((c, i) => `L${i}:${NUM.format(c)}`).join(' / ')}`,
  );
  lines.push('');

  const sb3 = s2.empower.spiritbloom;
  lines.push('#### 灵魄之花 (Spiritbloom)');
  lines.push(`- 施法次数: ${sb3.casts}`);
  lines.push(`- 各层蓄能施法: ${sb3.castsByLevel.map((c, i) => `L${i}:${c}`).join(' / ')}`);
  lines.push(`- 总治疗量: **${NUM.format(sb3.totalHealing)}**`);
  lines.push(
    `- 各层蓄能治疗: ${sb3.healingByLevel.map((c, i) => `L${i}:${NUM.format(c)}`).join(' / ')}`,
  );
  lines.push('');

  const fb3 = s2.empower.fireBreath;
  lines.push('#### 火焰吐息 (Fire Breath)');
  lines.push(`- 施法次数: ${fb3.casts}`);
  lines.push(`- 各层蓄能施法: ${fb3.castsByLevel.map((c, i) => `L${i}:${c}`).join(' / ')}`);
  lines.push(`- 总伤害: **${NUM.format(fb3.totalDamage)}**`);
  lines.push('');

  lines.push(`- 取消蓄能: ${s2.empower.cancelledEmpowers}`);
  lines.push(`- 改换天平施法次数: ${s2.empower.tipTheScalesCasts}`);
  lines.push('');

  // ── Echo ──
  lines.push('### 回响 (Echo)');
  lines.push(`- 施法次数: ${s2.echo.casts}`);
  lines.push(`- 增益应用: ${s2.echo.buffApplies}`);
  lines.push(`- 回响触发治疗次数: ${s2.echo.replayHeals}`);
  lines.push(`- 回响触发治疗量: **${NUM.format(s2.echo.replayHealing)}**`);
  lines.push('');

  // ── Reversion ──
  lines.push('### 还原 (Reversion)');
  lines.push(`- 施法次数: ${s2.reversion.casts}`);
  lines.push(
    `- HoT 应用 / 刷新 / 跳动: ${s2.reversion.hotApplies} / ${s2.reversion.hotRefreshes} / ${s2.reversion.hotTicks}`,
  );
  lines.push(
    `- HoT 治疗(有效/溢出): ${NUM.format(s2.reversion.hotHealing)} / ${NUM.format(s2.reversion.hotOverhealing)}`,
  );
  lines.push(
    `- 回响触发跳动 / 治疗: ${s2.reversion.echoReplayTicks} / **${NUM.format(s2.reversion.echoReplayHealing)}**`,
  );
  lines.push('');

  // ── Living Flame ──
  lines.push('### 生命烈焰 (Living Flame)');
  lines.push(`- 施法次数: ${s2.livingFlame.casts}`);
  lines.push(`- 治疗命中: ${s2.livingFlame.heals}`);
  lines.push(
    `- 总治疗(有效/溢出): ${NUM.format(s2.livingFlame.totalHealing)} / ${NUM.format(s2.livingFlame.totalOverhealing)}`,
  );
  lines.push(`- 总伤害: ${NUM.format(s2.livingFlame.totalDamage)}`);
  lines.push('');

  // ── Emerald Blossom ──
  lines.push('### 翠绿之芽 (Emerald Blossom)');
  lines.push(`- 施法次数: ${s2.emeraldBlossom.casts}`);
  lines.push(`- 命中次数: ${s2.emeraldBlossom.hits}`);
  lines.push(
    `- 总治疗(有效/溢出): ${NUM.format(s2.emeraldBlossom.totalHealing)} / ${NUM.format(s2.emeraldBlossom.totalOverhealing)}`,
  );
  lines.push(
    `- 回响命中 / 治疗: ${s2.emeraldBlossom.echoHits} / **${NUM.format(s2.emeraldBlossom.echoHealing)}**`,
  );
  lines.push('');

  // ── Cooldowns ──
  lines.push('### 冷却技能');
  lines.push(`- 倒流: ${s2.cooldowns.rewindCasts}`);
  lines.push(`- 梦境飞行: ${s2.cooldowns.dreamFlightCasts}`);
  lines.push(`- 改换天平: ${s2.cooldowns.tipTheScalesCasts}`);
  lines.push(`- 魔力之源: ${s2.cooldowns.sourceOfMagicCasts}`);
  lines.push(`- 微风: ${s2.cooldowns.zephyrCasts}`);
  lines.push(`- 复苏炎息: ${s2.cooldowns.renewingBlazeCasts}`);
  lines.push(`- 静滞: ${s2.cooldowns.stasisCasts}`);
  lines.push(`- 翠绿拥抱: ${s2.cooldowns.verdantEmbraceCasts}`);
  lines.push('');

  // ── Essence ──
  lines.push('### 精华 (Essence)');
  lines.push(`- 精华总消耗: ${NUM.format(s2.essence.totalSpent)}`);
  lines.push(`- 精华迸发 触发: ${s2.essence.essenceBurstProcs}`);
  lines.push(`- 精华迸发 消耗: ${s2.essence.essenceBurstConsumed}`);
  lines.push('');

  // ── Procs ──
  lines.push('### 触发 / 被动收益');
  lines.push(
    `- 黄金时刻 命中 / 治疗: ${s2.procs.goldenHourHits} / **${NUM.format(s2.procs.goldenHourHealing)}**`,
  );
  lines.push(
    `- 生命缚结 命中 / 治疗: ${s2.procs.lifebindHits} / **${NUM.format(s2.procs.lifebindHealing)}**`,
  );
  lines.push(`- 时空异象 护盾次数: ${s2.procs.temporalAnomalyShields}`);
  lines.push('');

  // ── Hero Talent ──
  const ht4 = s2.heroTalent;
  if (report.detectedBuild === 'chronowarden') {
    lines.push('### 英雄天赋: 时空守卫 (Chronowarden)');
    lines.push(`- 时之烈焰 治疗: **${NUM.format(ht4.chronowarden.chronoFlameHealing)}**`);
  } else if (report.detectedBuild === 'flameshaper') {
    lines.push('### 英雄天赋: 塑焰者 (Flameshaper)');
    lines.push(
      `- 吞噬烈焰 命中 / 治疗: ${ht4.flameshaper.engulfHits} / **${NUM.format(ht4.flameshaper.engulfHealing)}**`,
    );
  } else {
    lines.push('### 英雄天赋: 未检测到活跃');
    lines.push('- 本场战斗未检测到时空守卫或塑焰者的相关法术事件。');
  }
  lines.push('');

  // ── Per-spell ──
  lines.push(`## 按法术明细 (Top ${limit} by effective healing)`);
  lines.push('');
  lines.push('| 法术 | 施法 | 命中 | HoT跳动 | 暴击 | 有效治疗 | 溢出 | 治疗效率 | 唯一目标 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.perSpell.slice(0, limit)) {
    lines.push(formatSpellRow(row));
  }
  if (report.perSpell.length > limit) {
    lines.push('');
    lines.push(`*(另有 ${report.perSpell.length - limit} 个次要法术未显示)*`);
  }
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('## 分析警告');
    lines.push('');
    const shown = report.warnings.slice(0, 10);
    for (const w of shown) {
      lines.push(`- ${w}`);
    }
    if (report.warnings.length > shown.length) {
      lines.push(`- *(另有 ${report.warnings.length - shown.length} 条警告未显示)*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*数据由 WoWAnalyzerCN MCP 服务器从原始战斗日志事件流直接聚合生成，未经 SPA 渲染层处理。法术 ID 已校准至 WoW 12.x (TWW Midnight, patch 11.2+)。法术中文名为机译/通译，以下游 LLM 输出为准。*',
  );

  return lines.join('\n');
}
