// MCP tool: analyze_fight — runs full combat analysis on a specific fight +
// player from a WCL report. Dispatches to the spec-specific extractor via the
// registry, returning a Chinese-language text report for LLM consumption.

import { z } from 'zod';
import {
  runAnalysis,
  runExtractAndFormat,
  FightNotFoundError,
  PlayerNotFoundError,
  CombatantInfoNotFoundError,
  UnsupportedSpecError,
} from '../engine/runner.js';
import { LogNotFoundError } from '../wcl-client.js';
import { extractReportCode } from './wcl-utils.js';

export const analyzeFightInputSchema = {
  reportUrlOrCode: z
    .string()
    .describe('WCL 战报 URL 或 16 位战报代码 (例如 https://cn.warcraftlogs.com/reports/ABC123)'),
  fightId: z.number().int().positive().describe('要分析的战斗 ID (通过 analyze_report 获取)'),
  playerId: z
    .number()
    .int()
    .positive()
    .describe('要分析的玩家 ID (目前支持的治疗专精: 织雾/戒律/神圣牧/奶骑/奶德/恢复萨/保存唤)'),
  format: z
    .enum(['text', 'json', 'both'])
    .optional()
    .default('text')
    .describe('返回格式: text=中文报告, json=原始结构化数据, both=两者都返回'),
};

export interface AnalyzeFightInput {
  reportUrlOrCode: string;
  fightId: number;
  playerId: number;
  format?: 'text' | 'json' | 'both';
}

export interface AnalyzeFightOutput {
  reportCode: string;
  fightId: number;
  playerId: number;
  specId: number;
  text?: string;
  json?: unknown;
  warnings: string[];
}

export async function analyzeFight(input: AnalyzeFightInput): Promise<AnalyzeFightOutput> {
  const code = extractReportCode(input.reportUrlOrCode);
  const format = input.format ?? 'text';

  try {
    const result = await runAnalysis({
      reportCode: code,
      fightId: input.fightId,
      playerId: input.playerId,
    });

    const { json, text } = runExtractAndFormat(result, {
      reportCode: code,
      fightName: result.fight.name,
      fightKill: result.fight.kill,
      fightDifficulty: result.fight.difficulty,
      combatantInfo: result.combatantInfo,
    });

    const out: AnalyzeFightOutput = {
      reportCode: code,
      fightId: input.fightId,
      playerId: input.playerId,
      specId: result.specId,
      warnings: result.warnings,
    };

    if (format === 'text' || format === 'both') {
      out.text = text;
    }
    if (format === 'json' || format === 'both') {
      out.json = json;
    }
    return out;
  } catch (err: unknown) {
    if (err instanceof LogNotFoundError) {
      throw new Error(`战报未找到或已设为私有: ${code}`);
    }
    if (err instanceof FightNotFoundError) {
      throw new Error(
        `战斗 ID ${input.fightId} 不存在于战报 ${code}。请先用 analyze_report 列出所有战斗。`,
      );
    }
    if (err instanceof PlayerNotFoundError) {
      throw new Error(
        `玩家 ID ${input.playerId} 不存在于战报 ${code}。请先用 analyze_report 列出所有玩家。`,
      );
    }
    if (err instanceof CombatantInfoNotFoundError) {
      throw new Error(
        `玩家 ${input.playerId} 缺少 combatantinfo 事件 (无法重建天赋/装备载入)。该战报可能不完整。`,
      );
    }
    if (err instanceof UnsupportedSpecError) {
      throw new Error(`${err.message}\n\n如需支持新专精，请联系维护者。`);
    }
    if (err instanceof Error) {
      throw new Error(
        `分析失败 (${code}, fight ${input.fightId}, player ${input.playerId}): ${err.message}`,
      );
    }
    throw err;
  }
}
