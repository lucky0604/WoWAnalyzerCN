import type { WCLFight } from 'parser/core/Fight';
import type Report from 'parser/core/Report';

import { getDungeonDocument } from '../registry';
import { getDungeonScopedLearningAccess } from './formalAccess';
import type { DungeonDocument } from '../schema/types';
import { season2DungeonCatalog, season2WclCatalogSource } from '../data/season2Catalog';

export type WclDungeonMatchReason = 'encounter-id' | 'report-title';

export interface WclDungeonMatch {
  entry: (typeof season2DungeonCatalog)[number];
  reason: WclDungeonMatchReason;
}

export interface WclDungeonInput {
  reportZone?: number;
  reportTitle?: string;
  fightBoss?: number;
  fightOriginalBoss?: number;
  fightName?: string;
}

const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const entryTitleTokens = (entry: (typeof season2DungeonCatalog)[number]): string[] => {
  const values = [entry.id, entry.slug, entry.name.enUS];
  return values
    .filter((value): value is string => typeof value === 'string' && value.length >= 4)
    .map(normalizeText)
    .filter(Boolean);
};

const isUnscopedReportZone = (reportZone: number | undefined): boolean =>
  reportZone === undefined || reportZone === 0;

const isZoneCompatible = (
  entry: (typeof season2DungeonCatalog)[number],
  reportZone: number | undefined,
): boolean => {
  if (isUnscopedReportZone(reportZone)) {
    return true;
  }

  // Keep the source-zone check in addition to the per-entry fields so a
  // manually drifted catalog entry cannot turn an unrelated report into a
  // match. PTR IDs are intentionally accepted for local/pre-release reports.
  return (
    (reportZone === season2WclCatalogSource.zoneId && entry.wclZoneId === reportZone) ||
    (reportZone === season2WclCatalogSource.ptrZoneId && entry.wclPtrZoneId === reportZone)
  );
};

type WclEncounterVariant = 'live' | 'ptr';

const getEncounterVariant = (
  entry: (typeof season2DungeonCatalog)[number],
  encounterId: number,
): WclEncounterVariant | undefined => {
  if (entry.wclEncounterId === encounterId) return 'live';
  if (entry.wclPtrEncounterId === encounterId) return 'ptr';
  return undefined;
};

const isEncounterCompatible = (
  entry: (typeof season2DungeonCatalog)[number],
  encounterId: number,
  reportZone: number | undefined,
): boolean => {
  if (isUnscopedReportZone(reportZone)) {
    return true;
  }
  if (!isZoneCompatible(entry, reportZone)) {
    return false;
  }
  if (reportZone === season2WclCatalogSource.zoneId) {
    return entry.wclZoneId === reportZone && entry.wclEncounterId === encounterId;
  }
  if (reportZone === season2WclCatalogSource.ptrZoneId) {
    return entry.wclPtrZoneId === reportZone && entry.wclPtrEncounterId === encounterId;
  }
  return false;
};

/**
 * Resolve a WCL fight to a catalog entry without touching the parser or fetching new data.
 * Encounter IDs are the only high-confidence match. Title matching is a conservative fallback
 * for report pages that carry the dungeon name but omit a final-boss fight ID.
 */
export function matchDungeonFromWcl(input: WclDungeonInput): WclDungeonMatch | undefined {
  const encounterIds = [input.fightBoss, input.fightOriginalBoss].filter(
    (value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0,
  );
  const encounterEvidence = encounterIds
    .map((encounterId) => ({
      encounterId,
      entry: season2DungeonCatalog.find((entry) => getEncounterVariant(entry, encounterId)),
      variant: season2DungeonCatalog
        .map((entry) => getEncounterVariant(entry, encounterId))
        .find((variant): variant is WclEncounterVariant => variant !== undefined),
    }))
    .filter(
      (
        evidence,
      ): evidence is {
        encounterId: number;
        entry: (typeof season2DungeonCatalog)[number];
        variant: WclEncounterVariant;
      } => evidence.entry !== undefined,
    );
  const encounterMatches = encounterEvidence.map((evidence) => evidence.entry);
  // An explicit but unregistered encounter is not equivalent to “no
  // encounter”. Do not let a copied title override an identity we failed to
  // verify, and do not mix a known ID with an unknown companion field.
  if (encounterIds.length > 0 && encounterEvidence.length !== encounterIds.length) {
    return undefined;
  }
  const distinctEncounterMatches = encounterMatches.filter(
    (entry, index) =>
      encounterMatches.findIndex((candidate) => candidate.id === entry.id) === index,
  );

  // A report can carry both boss and originalBoss. If they resolve to two
  // different catalog entries, the input is internally contradictory and must
  // not be resolved by catalog order.
  if (distinctEncounterMatches.length > 1) {
    return undefined;
  }
  if (new Set(encounterEvidence.map((evidence) => evidence.variant)).size > 1) {
    return undefined;
  }
  const byEncounter = distinctEncounterMatches[0];
  if (byEncounter) {
    return encounterEvidence.every((evidence) =>
      isEncounterCompatible(byEncounter, evidence.encounterId, input.reportZone),
    )
      ? { entry: byEncounter, reason: 'encounter-id' }
      : undefined;
  }

  // A title is only a fallback when the report is unscoped or explicitly from
  // an S2 WCL live/PTR zone. This prevents a copied title in a multi-zone/raid report
  // from being treated as a dungeon identity.
  if (
    !isUnscopedReportZone(input.reportZone) &&
    input.reportZone !== season2WclCatalogSource.zoneId &&
    input.reportZone !== season2WclCatalogSource.ptrZoneId
  ) {
    return undefined;
  }

  const reportText = normalizeText(`${input.reportTitle ?? ''} ${input.fightName ?? ''}`);
  if (!reportText) {
    return undefined;
  }
  const titleMatches = season2DungeonCatalog.filter((entry) =>
    entryTitleTokens(entry).some((token) => reportText.includes(token)),
  );
  return titleMatches.length === 1
    ? { entry: titleMatches[0]!, reason: 'report-title' }
    : undefined;
}

export function getPublishedDungeonFromWcl(
  report: Pick<Report, 'zone' | 'title'>,
  fight: Pick<WCLFight, 'boss' | 'originalBoss' | 'name'>,
): DungeonDocument | undefined {
  const match = matchDungeonFromWcl({
    reportZone: report.zone,
    reportTitle: report.title,
    fightBoss: fight.boss,
    fightOriginalBoss: fight.originalBoss,
    fightName: fight.name,
  });
  if (!match) {
    return undefined;
  }
  const document = getDungeonDocument(match.entry.id);
  return document && getDungeonScopedLearningAccess(match.entry, document).isFormal
    ? document
    : undefined;
}

export function makeDungeonLearningPath(document: DungeonDocument): string {
  return `/dungeons/${encodeURIComponent(document.id)}/learn`;
}

/**
 * Keep the existing report selector as the single WCL entry point. The dungeon
 * query is an intent hint only; it must never be treated as a report match or
 * passed into the combat-log parser.
 */
export function makeDungeonAnalysisPath(document: Pick<DungeonDocument, 'id'>): string {
  return `/?dungeon=${encodeURIComponent(document.id)}`;
}

export function getPublishedDungeonLearningPathFromWcl(
  report: Pick<Report, 'zone' | 'title'>,
  fight: Pick<WCLFight, 'boss' | 'originalBoss' | 'name'>,
): string | undefined {
  const document = getPublishedDungeonFromWcl(report, fight);
  return document ? makeDungeonLearningPath(document) : undefined;
}
