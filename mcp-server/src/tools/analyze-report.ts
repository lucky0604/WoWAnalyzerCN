import { z } from 'zod';
import { fetchFights, LogNotFoundError } from '../wcl-client';
import type { WCLReport } from 'parser/core/Report';
import type { WCLFight } from 'parser/core/Fight';
import type { PlayerInfo } from 'parser/core/Player';

// ── WCL URL parsing ────────────────────────────────────────────────

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

  throw new Error(
    `无效的 WCL 战报标识: "${input}"。请提供完整的 WCL 战报 URL (如 https://cn.warcraftlogs.com/reports/ABC123...) 或 16 位战报代码。`,
  );
}

// ── Tool input schema ───────────────────────────────────────────────

export const analyzeReportInputSchema = {
  reportUrlOrCode: z
    .string()
    .describe('WCL 战报 URL (例如 https://cn.warcraftlogs.com/reports/ABC123) 或 16 位战报代码'),
};

export interface AnalyzeReportInput {
  reportUrlOrCode: string;
}

// ── Output types ─────────────────────────────────────────────────────

export interface FightSummary {
  id: number;
  name: string;
  difficulty?: number;
  kill?: boolean;
  start_time: number;
  end_time: number;
  friendlyPlayers: number;
}

export interface PlayerSummary {
  id: number;
  name: string;
  server?: string;
  region?: string;
}

export interface AnalyzeReportOutput {
  reportTitle: string;
  reportCode: string;
  startTime: number;
  endTime: number;
  zone: number;
  fights: FightSummary[];
  players: PlayerSummary[];
  meta: {
    wclApiBase: string;
    fetchedAt: string;
  };
}

// ── Implementation ──────────────────────────────────────────────────

export async function analyzeReport(input: AnalyzeReportInput): Promise<AnalyzeReportOutput> {
  const code = extractReportCode(input.reportUrlOrCode);

  let report: WCLReport;
  try {
    report = await fetchFights(code);
  } catch (err: unknown) {
    if (err instanceof LogNotFoundError) {
      throw new Error(`战报未找到或已设为私有: ${code}`);
    }
    if (err instanceof Error) {
      throw new Error(`获取战报失败 (${code}): ${err.message}`);
    }
    throw err;
  }

  // CN WCL returns HTTP 200 with `{status, error}` body on lookup failure.
  const maybeError = report as unknown as { status?: number; error?: string };
  if (typeof maybeError.error === 'string' && maybeError.error.length > 0) {
    throw new Error(`WCL 返回错误 (${code}): ${maybeError.error}`);
  }

  if (!report.fights || !report.friendlies) {
    throw new Error(`战报响应不完整或战报无效: ${code}`);
  }

  const fights: FightSummary[] = (report.fights ?? []).map((f: WCLFight) => ({
    id: f.id,
    name: f.name,
    difficulty: f.difficulty,
    kill: f.kill,
    start_time: f.start_time,
    end_time: f.end_time,
    friendlyPlayers: (report.friendlies ?? []).length,
  }));

  const players: PlayerSummary[] = (report.friendlies ?? []).map((p: PlayerInfo) => ({
    id: p.id,
    name: p.name,
    server: p.server,
    region: p.region,
  }));

  return {
    reportTitle: report.title,
    reportCode: code,
    startTime: report.start,
    endTime: report.end,
    zone: report.zone,
    fights,
    players,
    meta: {
      wclApiBase: process.env.WCL_API_BASE ?? 'http://localhost:9528/v1',
      fetchedAt: new Date().toISOString(),
    },
  };
}
