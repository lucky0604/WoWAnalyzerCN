// MCP tool: analyze_fight — runs full mistweaver combat analysis on a specific
// fight + player from a WCL report and returns a Chinese-language text report
// ready for LLM consumption.

import { z } from 'zod';
import {
  runAnalysis,
  FightNotFoundError,
  PlayerNotFoundError,
  CombatantInfoNotFoundError,
  UnsupportedSpecError,
} from '../engine/runner.js';
import { extractMistweaverReport } from '../engine/extractors/mistweaver.js';
import { formatMistweaverReport } from '../engine/format-report.js';
import { LogNotFoundError } from '../wcl-client.js';

const WCL_REPORT_URL_RE =
  /(?:https?:\/\/)?(?:www\.|(?:[a-z]+\.)?(?:classic\.)?warcraftlogs\.com)\/reports\/([a-zA-Z0-9]{8,32})/;
const REPORT_CODE_RE = /^[a-zA-Z0-9]{16}$/;

function extractReportCode(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(WCL_REPORT_URL_RE);
  if (urlMatch) {
    return urlMatch[1];
  }
  const codeMatch = trimmed.match(REPORT_CODE_RE);
  if (codeMatch) {
    return codeMatch[0];
  }
  const fallback = trimmed.match(/[a-zA-Z0-9]{16}/);
  if (fallback) {
    return fallback[0];
  }
  throw new Error(`无效的 WCL 战报标识: "${input}"。请提供完整的 WCL 战报 URL 或 16 位战报代码。`);
}

export const analyzeFightInputSchema = {
  reportUrlOrCode: z
    .string()
    .describe('WCL 战报 URL 或 16 位战报代码 (例如 https://cn.warcraftlogs.com/reports/ABC123)'),
  fightId: z.number().int().positive().describe('要分析的战斗 ID (通过 analyze_report 获取)'),
  playerId: z.number().int().positive().describe('要分析的玩家 ID (必须为织雾武僧, specId=270)'),
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

    const jsonReport = extractMistweaverReport({
      events: result.parser.normalizedEvents,
      playerId: input.playerId,
      playerName: result.player.name,
      fightStart: result.fight.start_time,
      fightEnd: result.fight.end_time,
      warnings: result.warnings,
    });

    const out: AnalyzeFightOutput = {
      reportCode: code,
      fightId: input.fightId,
      playerId: input.playerId,
      warnings: result.warnings,
    };

    if (format === 'text' || format === 'both') {
      out.text = formatMistweaverReport(jsonReport, {
        reportCode: code,
        fightName: result.fight.name,
        fightKill: result.fight.kill,
        fightDifficulty: result.fight.difficulty,
        combatantInfo: result.combatantInfo,
      });
    }
    if (format === 'json' || format === 'both') {
      out.json = jsonReport;
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
      throw new Error(
        `${err.message}\n\n目前仅支持织雾武僧 (specId=270)。其他专精分析将在后续版本中提供。`,
      );
    }
    if (err instanceof Error) {
      throw new Error(
        `分析失败 (${code}, fight ${input.fightId}, player ${input.playerId}): ${err.message}`,
      );
    }
    throw err;
  }
}
