import type { WCLFight } from 'parser/core/Fight';
import type Report from 'parser/core/Report';

import { getDungeonDocument } from '../registry';
import type { DungeonDocument } from '../schema/types';
import { season2DungeonCatalog } from '../data/season2Catalog';

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

/**
 * Resolve a WCL fight to a catalog entry without touching the parser or fetching new data.
 * Encounter IDs are the only high-confidence match. Title matching is a conservative fallback
 * for report pages that carry the dungeon name but omit a final-boss fight ID.
 */
export function matchDungeonFromWcl(input: WclDungeonInput): WclDungeonMatch | undefined {
  const encounterIds = [input.fightBoss, input.fightOriginalBoss].filter(
    (value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0,
  );
  const byEncounter = season2DungeonCatalog.find(
    (entry) => entry.wclEncounterId !== undefined && encounterIds.includes(entry.wclEncounterId),
  );
  if (byEncounter) {
    return { entry: byEncounter, reason: 'encounter-id' };
  }

  const reportText = normalizeText(`${input.reportTitle ?? ''} ${input.fightName ?? ''}`);
  if (!reportText) {
    return undefined;
  }
  const byTitle = season2DungeonCatalog.find((entry) =>
    entryTitleTokens(entry).some((token) => reportText.includes(token)),
  );
  return byTitle ? { entry: byTitle, reason: 'report-title' } : undefined;
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
  return document && (document.dataStatus === 'reviewed' || document.dataStatus === 'published')
    ? document
    : undefined;
}

export function makeDungeonLearningPath(document: DungeonDocument): string {
  return `/dungeons/${encodeURIComponent(document.id)}/learn`;
}
