// JSON MistweaverReport → Chinese-language text report for LLM consumption.
//
// Output is plain text (Markdown-flavored, no JSX) optimized for AI agent context
// windows: dense numbers, clear section labels, no UI chrome.

import type { MistweaverReport, SpellSummary } from './extractors/mistweaver';
import type { CombatantInfoEvent } from 'parser/core/Events';

interface FormatOptions {
  /** Maximum number of per-spell rows to include in the breakdown table */
  perSpellLimit?: number;
  reportCode?: string;
  fightName?: string;
  fightKill?: boolean;
  fightDifficulty?: number;
  combatantInfo?: CombatantInfoEvent;
}

const NUM = new Intl.NumberFormat('zh-CN');
const PCT = (v: number | undefined): string => (v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const DURATION = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}分${s.toString().padStart(2, '0')}秒`;
};
const DIFFICULTY: Record<number, string> = {
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

function renderCombatantInfo(lines: string[], ci: CombatantInfoEvent): void {
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

function formatSpellRow(row: SpellSummary): string {
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
