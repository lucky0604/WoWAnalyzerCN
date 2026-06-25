import type { CombatantInfoEvent } from 'parser/core/Events';
import { EventType } from 'parser/core/Events';
import type { PlayerInfo } from 'parser/core/Player';
import CombatLogParser, {
  type MinimalConfig,
  type MinimalReport,
  type MinimalFight,
  type MinimalPlayerDetails,
} from '../stubs/parser/core/CombatLogParser';
import { fetchFights, fetchEvents, fetchCombatants } from '../wcl-client';

export interface RunOptions {
  reportCode: string;
  fightId: number;
  playerId: number;
}

export interface RunResult {
  reportCode: string;
  fight: MinimalFight;
  player: PlayerInfo;
  combatantInfo: CombatantInfoEvent;
  eventCount: number;
  duration: number;
  parser: CombatLogParser;
  warnings: string[];
}

export class FightNotFoundError extends Error {
  constructor(reportCode: string, fightId: number) {
    super(`Fight ${fightId} not found in report ${reportCode}`);
    this.name = 'FightNotFoundError';
  }
}

export class PlayerNotFoundError extends Error {
  constructor(reportCode: string, playerId: number) {
    super(`Player ${playerId} not found in report ${reportCode}`);
    this.name = 'PlayerNotFoundError';
  }
}

export class CombatantInfoNotFoundError extends Error {
  constructor(playerId: number) {
    super(`combatantinfo event missing for player ${playerId} (cannot reconstruct loadout)`);
    this.name = 'CombatantInfoNotFoundError';
  }
}

export class UnsupportedSpecError extends Error {
  constructor(specId: number) {
    super(`Spec ${specId} is not yet supported in MCP analysis (mistweaver only for M2)`);
    this.name = 'UnsupportedSpecError';
  }
}

const MISTWEAVER_SPEC_ID = 270;

export async function runAnalysis(opts: RunOptions): Promise<RunResult> {
  const warnings: string[] = [];

  const reportJson = await fetchFights(opts.reportCode);
  const fight = reportJson.fights.find((f) => f.id === opts.fightId);
  if (!fight) {
    throw new FightNotFoundError(opts.reportCode, opts.fightId);
  }
  const player = reportJson.friendlies?.find((p) => p.id === opts.playerId);
  if (!player) {
    throw new PlayerNotFoundError(opts.reportCode, opts.playerId);
  }

  const specId = inferSpecId(player);
  if (specId !== MISTWEAVER_SPEC_ID) {
    throw new UnsupportedSpecError(specId);
  }

  const combatantInfos = await fetchCombatants(opts.reportCode, fight.start_time, fight.end_time);
  const playerCombatantInfo = combatantInfos.find(
    (e): e is CombatantInfoEvent =>
      e.type === EventType.CombatantInfo && (e as CombatantInfoEvent).sourceID === opts.playerId,
  );
  if (!playerCombatantInfo) {
    throw new CombatantInfoNotFoundError(opts.playerId);
  }

  const rawEvents = await fetchEvents(
    opts.reportCode,
    fight.start_time,
    fight.end_time,
    opts.playerId,
  );

  const config = buildHeadlessConfig(specId);
  const report = adaptReport(reportJson);
  const minimalFight = adaptFight(fight);
  const playerDetails = reportJson.friendlies.map(adaptPlayer);
  const selectedPlayer = adaptPlayer(player);

  const parser = new CombatLogParser(
    config,
    report,
    selectedPlayer,
    minimalFight,
    playerCombatantInfo,
    { race: null },
    playerDetails,
  );

  const normalized = parser.normalize(rawEvents).sort((a, b) => a.timestamp - b.timestamp);
  parser.normalizedEvents = normalized;

  let triggered = 0;
  const emitter = parser.getModule((await import('parser/core/modules/EventEmitter')).default);
  for (const ev of normalized) {
    parser._timestamp = ev.timestamp;
    try {
      emitter.triggerEvent(ev);
      triggered += 1;
    } catch (err) {
      warnings.push(`event ${ev.type}@${ev.timestamp} dispatch error: ${(err as Error).message}`);
    }
  }
  parser.finish();

  return {
    reportCode: opts.reportCode,
    fight: minimalFight,
    player,
    combatantInfo: playerCombatantInfo,
    eventCount: triggered,
    duration: minimalFight.end_time - minimalFight.start_time,
    parser,
    warnings,
  };
}

function inferSpecId(player: PlayerInfo): number {
  const specs = (player as PlayerInfo & { specs?: string[] }).specs ?? [];
  const cls = (player as PlayerInfo & { type?: string; icon?: string }).type ?? '';
  if (cls === 'Monk' && specs.some((s) => /mist/i.test(s))) {
    return MISTWEAVER_SPEC_ID;
  }
  const icon = (player as PlayerInfo & { icon?: string }).icon ?? '';
  if (/Monk-?Mistweaver/i.test(icon)) {
    return MISTWEAVER_SPEC_ID;
  }
  return -1;
}

function buildHeadlessConfig(specId: number): MinimalConfig {
  return {
    branch: 'retail',
    spec: { id: specId, branch: 'retail' },
  };
}

function adaptReport(reportJson: Awaited<ReturnType<typeof fetchFights>>): MinimalReport {
  return {
    title: reportJson.title,
    start: reportJson.start,
    end: reportJson.end,
    friendlies: reportJson.friendlies as PlayerInfo[],
    friendlyPets: (reportJson.friendlyPets ?? []) as MinimalReport['friendlyPets'],
    enemies: reportJson.enemies ?? [],
    enemyPets: reportJson.enemyPets ?? [],
    gameVersion: reportJson.gameVersion,
  };
}

function adaptFight(fight: {
  id: number;
  name: string;
  start_time: number;
  end_time: number;
  boss: number;
  offset_time?: number;
  kill?: boolean;
  difficulty?: number;
}): MinimalFight {
  return {
    id: fight.id,
    name: fight.name,
    start_time: fight.start_time,
    end_time: fight.end_time,
    boss: fight.boss,
    offset_time: fight.offset_time ?? 0,
    kill: fight.kill,
    difficulty: fight.difficulty,
  };
}

function adaptPlayer(p: PlayerInfo): MinimalPlayerDetails {
  const extra = p as PlayerInfo & { type?: string; specs?: string[] };
  return {
    id: p.id,
    name: p.name,
    type: extra.type,
    className: extra.type,
    specName: extra.specs?.[0],
  };
}
