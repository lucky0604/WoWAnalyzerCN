// Spec extractor registry — central spec-id → extractor+formatter dispatch table.
//
// Each entry pairs a spec-specific event-stream extractor (Path-A) with its
// Chinese-language formatter. The runner uses this table to dispatch on
// `inferSpecId(player)`; adding a new spec = adding one row here, no runner
// changes required.
//
// Contract for any new spec:
//   - `extract(input: ExtractInput): TReport` — pure event-stream aggregation,
//     no analyzer DI, no JSX, deterministic.
//   - `format(report, ctx): string` — produce Chinese-language Markdown report.
//   - `specName` — Chinese display name used in error messages.

import type { AnyEvent, CombatantInfoEvent } from 'parser/core/Events';

import { extractMistweaverReport, type MistweaverReport } from './mistweaver.js';
import { extractHolyPriestReport, type HolyPriestReport } from './holypriest.js';
import { extractHolyPaladinReport, type HolyPaladinReport } from './holypaladin.js';
import { extractRestoDruidReport, type RestoDruidReport } from './restodruid.js';
import { extractRestoShamanReport, type RestoShamanReport } from './restoshaman.js';
import { extractDisciplineReport, type DisciplineReport } from './discipline.js';
import { extractPreservationReport, type PreservationReport } from './preservation.js';
import {
  formatMistweaverReport,
  formatHolyPriestReport,
  formatHolyPaladinReport,
  formatRestoDruidReport,
  formatRestoShamanReport,
  formatDisciplineReport,
  formatPreservationReport,
} from '../format-report.js';

// ── Shared types ────────────────────────────────────────────────────

/** Standard input every extractor receives. Match against mistweaver.ts ExtractInput. */
export interface ExtractInput {
  events: AnyEvent[];
  playerId: number;
  playerName: string;
  fightStart: number;
  fightEnd: number;
  warnings: string[];
}

/** Standard context every formatter receives (in addition to its own report). */
export interface FormatContext {
  reportCode?: string;
  fightName?: string;
  fightKill?: boolean;
  fightDifficulty?: number;
  combatantInfo?: CombatantInfoEvent;
  perSpellLimit?: number;
}

/** Every spec report MUST include these top-level fields so generic tooling
 *  (server logging, future cross-spec comparison) can read them uniformly. */
export interface BaseSpecReport {
  fightDurationMs: number;
  playerId: number;
  playerName: string;
  totals: {
    casts: number;
    healing: number;
    overhealing: number;
    rawHealing: number;
    healingEfficiency: number;
    manaSpent: number;
    hps: number;
    eventCount: number;
  };
  warnings: string[];
}

/** One row in the dispatch table. Generic over the spec's report type. */
export interface SpecExtractor<TReport extends BaseSpecReport = BaseSpecReport> {
  specId: number;
  /** Chinese display name, e.g. "织雾武僧". Used in error messages. */
  specName: string;
  /** Internal slug for logs / future routing. */
  slug: string;
  extract(input: ExtractInput): TReport;
  format(report: TReport, ctx: FormatContext): string;
}

// ── Registry ────────────────────────────────────────────────────────

/** Type-erased registry entry — what callers actually see. */
type AnySpecExtractor = SpecExtractor<BaseSpecReport>;

/** Cast a typed extractor into the erased shape stored in the registry.
 *  All extractors satisfy BaseSpecReport structurally; this cast is safe
 *  because runner.ts only consumes the BaseSpecReport surface. */
function entry<TReport extends BaseSpecReport>(spec: SpecExtractor<TReport>): AnySpecExtractor {
  return spec as unknown as AnySpecExtractor;
}

export const EXTRACTORS_BY_SPEC_ID: Record<number, AnySpecExtractor> = {
  // ── Monk ──
  270: entry<MistweaverReport>({
    specId: 270,
    specName: '织雾武僧',
    slug: 'mistweaver',
    extract: extractMistweaverReport,
    format: (report, ctx) =>
      formatMistweaverReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),

  // ── Paladin ──
  65: entry<HolyPaladinReport>({
    specId: 65,
    specName: '神圣骑士',
    slug: 'holypaladin',
    extract: extractHolyPaladinReport,
    format: (report, ctx) =>
      formatHolyPaladinReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),

  // ── Priest ──
  256: entry<DisciplineReport>({
    specId: 256,
    specName: '戒律牧师',
    slug: 'discipline',
    extract: extractDisciplineReport,
    format: (report, ctx) =>
      formatDisciplineReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),
  257: entry<HolyPriestReport>({
    specId: 257,
    specName: '神圣牧师',
    slug: 'holy-priest',
    extract: extractHolyPriestReport,
    format: (report, ctx) =>
      formatHolyPriestReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),

  // ── Druid ──
  105: entry<RestoDruidReport>({
    specId: 105,
    specName: '恢复德鲁伊',
    slug: 'restodruid',
    extract: extractRestoDruidReport,
    format: (report, ctx) =>
      formatRestoDruidReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),

  // ── Shaman ──
  264: entry<RestoShamanReport>({
    specId: 264,
    specName: '恢复萨满',
    slug: 'resto-shaman',
    extract: extractRestoShamanReport,
    format: (report, ctx) =>
      formatRestoShamanReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),

  // ── Evoker ──
  1468: entry<PreservationReport>({
    specId: 1468,
    specName: '恩护唤魔师',
    slug: 'preservation',
    extract: extractPreservationReport,
    format: (report, ctx) =>
      formatPreservationReport(report, {
        reportCode: ctx.reportCode,
        fightName: ctx.fightName,
        fightKill: ctx.fightKill,
        fightDifficulty: ctx.fightDifficulty,
        combatantInfo: ctx.combatantInfo,
        perSpellLimit: ctx.perSpellLimit,
      }),
  }),
};

export function getExtractor(specId: number): AnySpecExtractor | undefined {
  return EXTRACTORS_BY_SPEC_ID[specId];
}

export function supportedSpecIds(): number[] {
  return Object.keys(EXTRACTORS_BY_SPEC_ID)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
}

export function supportedSpecsLabel(): string {
  return supportedSpecIds()
    .map((id) => {
      const e = EXTRACTORS_BY_SPEC_ID[id];
      return `${e.specName} (${id})`;
    })
    .join('、');
}
