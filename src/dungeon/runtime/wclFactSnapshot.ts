import type { DungeonCatalogEntry } from '../data/season2Catalog';
import { getDungeonCatalogEntry } from '../data/season2Catalog';
import type { ProvenanceLicenseStatus } from '../schema/types';
import {
  createFactSnapshot,
  type FactSnapshot,
  type FactSnapshotDiagnostic,
  type FactSnapshotDraft,
} from './factSnapshot';

/**
 * WCL report/event payloads are deliberately treated as unknown JSON here.
 * The dungeon domain must not import parser runtime types just to read a
 * source export, and WCL has historically changed optional fields between
 * API versions.
 */
export interface WclFactSnapshotOptions {
  dungeonId: string;
  season: string;
  gameBuild: string;
  snapshotId: string;
  evidenceRef: string;
  capturedAt: string;
  /** Explicit WCL fight id used to scope a multi-fight report before parsing. */
  fightId?: number;
  licenseStatus?: ProvenanceLicenseStatus;
  requireApproved?: boolean;
  catalogEntry?: DungeonCatalogEntry;
}

export interface WclFactSnapshotStats {
  reportEnemies: number;
  groupedEnemies: number;
  enemyActors: number;
  castEvents: number;
  groupedAbilities: number;
  skippedEventsWithoutEnemyCaster: number;
}

export interface WclFactSnapshotResult {
  ok: boolean;
  snapshot?: FactSnapshot;
  errors: FactSnapshotDiagnostic[];
  warnings: FactSnapshotDiagnostic[];
  stats: WclFactSnapshotStats;
}

type RecordValue = Record<string, unknown>;

interface EnemyGroup {
  npcId: number;
  isBoss: boolean;
  actorIds: Set<number>;
}

interface AbilityGroup {
  spellId: number;
  casterEnemyKeys: Set<string>;
}

const diagnostic = (
  severity: FactSnapshotDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): FactSnapshotDiagnostic => ({ severity, code, path, message });

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const castEventTypes = new Set(['cast', 'begincast', 'channel', 'beginchannel', 'empowerstart']);

function readSourceCodeAliases(
  value: RecordValue,
  path: string,
): { sourceCode?: string; errors: FactSnapshotDiagnostic[] } {
  const aliases = [value.code, value.reportCode].filter(nonEmptyString);
  const uniqueAliases = [...new Set(aliases)];
  if (uniqueAliases.length > 1) {
    return {
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_SOURCE_CODE_ALIAS_MISMATCH',
          path,
          '同一输入中的 code 与 reportCode 不一致，拒绝选择其中一个继续处理。',
        ),
      ],
    };
  }
  return { sourceCode: uniqueAliases[0], errors: [] };
}

function emptyStats(): WclFactSnapshotStats {
  return {
    reportEnemies: 0,
    groupedEnemies: 0,
    enemyActors: 0,
    castEvents: 0,
    groupedAbilities: 0,
    skippedEventsWithoutEnemyCaster: 0,
  };
}

function readEvents(rawEvents: unknown): {
  events: unknown[];
  sourceCode?: string;
  errors: FactSnapshotDiagnostic[];
} {
  if (rawEvents === undefined) return { events: [], errors: [] };
  if (Array.isArray(rawEvents)) return { events: rawEvents, errors: [] };
  if (isRecord(rawEvents) && Array.isArray(rawEvents.events)) {
    const sourceCode = readSourceCodeAliases(rawEvents, 'events');
    const hasPaginationMarker =
      (rawEvents.nextPageTimestamp !== undefined && rawEvents.nextPageTimestamp !== null) ||
      rawEvents.hasMore === true ||
      rawEvents.nextPage !== undefined;
    if (hasPaginationMarker) {
      return {
        events: [],
        errors: [
          ...sourceCode.errors,
          diagnostic(
            'error',
            'WCL_FACT_EVENTS_PAGINATED',
            'events',
            'WCL events 仍带有分页标记；必须先汇总完整事件数组，不能只用单页生成事实快照。',
          ),
        ],
      };
    }
    return {
      events: rawEvents.events,
      sourceCode: sourceCode.sourceCode,
      errors: sourceCode.errors,
    };
  }
  return {
    events: [],
    errors: [
      diagnostic(
        'error',
        'WCL_FACT_EVENTS_INVALID',
        'events',
        'WCL events 导出必须是数组，或包含 events 数组的对象。',
      ),
    ],
  };
}

interface WclFightScopeResult {
  report: RecordValue;
  events: unknown;
  errors: FactSnapshotDiagnostic[];
}

function scopeWclFightInputs(
  rawReport: RecordValue,
  rawEvents: unknown,
  fightId: number | undefined,
): WclFightScopeResult {
  const rawFights = rawReport.fights;
  if (rawFights !== undefined && !Array.isArray(rawFights)) {
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_FIGHTS_INVALID',
          'report.fights',
          'report.fights 必须是数组；不能用其它形状表示 fight scope。',
        ),
      ],
    };
  }
  if (!Array.isArray(rawFights) || rawFights.length === 0) {
    if (fightId === undefined) {
      return { report: rawReport, events: rawEvents, errors: [] };
    }
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_FIGHT_SCOPE_UNAVAILABLE',
          'report.fights',
          '--fight-id 只能用于包含可验证 fights 数组的 report；不能对缺失或空 fights 的输入猜测范围。',
        ),
      ],
    };
  }
  if (fightId !== undefined || rawFights.length > 1) {
    const invalidFight = rawFights.find(
      (candidate) => !isRecord(candidate) || !positiveInteger(candidate.id),
    );
    if (invalidFight !== undefined) {
      return {
        report: rawReport,
        events: rawEvents,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_FIGHT_RECORD_INVALID',
            'report.fights',
            'report.fights 中每个 fight 都必须包含正整数 id，才能执行安全 scope。',
          ),
        ],
      };
    }
    const fightIds = rawFights.map((candidate) => (candidate as RecordValue).id as number);
    if (new Set(fightIds).size !== fightIds.length) {
      return {
        report: rawReport,
        events: rawEvents,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_DUPLICATE_FIGHT_ID',
            'report.fights',
            'report.fights 中存在重复 id，不能无歧义地选择目标战斗。',
          ),
        ],
      };
    }
    const invalidRange = rawFights.find((candidate) => {
      const range = candidate as RecordValue;
      return (
        typeof range.start_time !== 'number' ||
        !Number.isFinite(range.start_time) ||
        typeof range.end_time !== 'number' ||
        !Number.isFinite(range.end_time) ||
        (range.end_time as number) < (range.start_time as number)
      );
    });
    if (invalidRange !== undefined) {
      return {
        report: rawReport,
        events: rawEvents,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_FIGHT_RANGE_INVALID',
            'report.fights',
            'report.fights 中每个 fight 都必须包含有限且非倒置的 start_time/end_time。',
          ),
        ],
      };
    }
    const ranges = rawFights.map((candidate) => candidate as RecordValue);
    for (let leftIndex = 0; leftIndex < ranges.length; leftIndex += 1) {
      const left = ranges[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < ranges.length; rightIndex += 1) {
        const right = ranges[rightIndex]!;
        if (
          (left.start_time as number) <= (right.end_time as number) &&
          (right.start_time as number) <= (left.end_time as number)
        ) {
          return {
            report: rawReport,
            events: rawEvents,
            errors: [
              diagnostic(
                'error',
                'WCL_FACT_FIGHT_RANGE_OVERLAP',
                'report.fights',
                'report.fights 的时间范围重叠或边界相等，无法仅凭 timestamp 安全归属事件。',
              ),
            ],
          };
        }
      }
    }
  }
  if (fightId === undefined) {
    if (rawFights.length <= 1) {
      return { report: rawReport, events: rawEvents, errors: [] };
    }
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_FIGHT_SCOPE_REQUIRED',
          'report.fights',
          'report 包含多场 fight；请提供 --fight-id，不能把全报告 roster 与单场 events 直接拼接。',
        ),
      ],
    };
  }
  const selectedFight = rawFights.find(
    (candidate) => isRecord(candidate) && candidate.id === fightId,
  );
  if (!isRecord(selectedFight)) {
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_FIGHT_ID_NOT_FOUND',
          'fightId',
          `report.fights 中不存在 fight id：${fightId}。`,
        ),
      ],
    };
  }
  const startTime = selectedFight.start_time as number;
  const endTime = selectedFight.end_time as number;
  const rawEnemies = rawReport.enemies;
  if (!Array.isArray(rawEnemies)) {
    return { report: rawReport, events: rawEvents, errors: [] };
  }
  const unscopableEnemy = rawEnemies.find(
    (candidate) => !isRecord(candidate) || !Array.isArray(candidate.fights),
  );
  if (unscopableEnemy !== undefined) {
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_ENEMY_SCOPE_UNAVAILABLE',
          'report.enemies',
          `fight ${fightId} 的 report.enemies 缺少逐 actor fights 归属，拒绝按不完整 roster 生成快照。`,
        ),
      ],
    };
  }
  const scopedEnemies = rawEnemies.filter(
    (candidate) =>
      isRecord(candidate) &&
      Array.isArray(candidate.fights) &&
      candidate.fights.some(
        (enemyFight: unknown) => isRecord(enemyFight) && enemyFight.id === fightId,
      ),
  );
  const parsedEvents = readEvents(rawEvents);
  if (parsedEvents.errors.length > 0) {
    return { report: rawReport, events: rawEvents, errors: parsedEvents.errors };
  }
  const scopedEvents: unknown[] = [];
  let hasUnscopableCast = false;
  parsedEvents.events.forEach((candidate) => {
    if (!isRecord(candidate) || !castEventTypes.has(String(candidate.type))) return;
    const timestamp = candidate.timestamp;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      hasUnscopableCast = true;
      return;
    }
    if (timestamp >= startTime && timestamp <= endTime) scopedEvents.push(candidate);
  });
  if (hasUnscopableCast) {
    return {
      report: rawReport,
      events: rawEvents,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_EVENT_SCOPE_TIMESTAMP_INVALID',
          'events',
          `fight ${fightId} 的施法事件缺少可比较 timestamp，拒绝跨 fight 猜测施法归属。`,
        ),
      ],
    };
  }
  const scopedReport: RecordValue = {
    ...rawReport,
    fights: [selectedFight],
    enemies: scopedEnemies,
  };
  const scopedRawEvents = isRecord(rawEvents)
    ? { ...rawEvents, events: scopedEvents }
    : rawEvents === undefined
      ? undefined
      : scopedEvents;
  return { report: scopedReport, events: scopedRawEvents, errors: [] };
}

function buildEnemyGroups(
  report: RecordValue,
  errors: FactSnapshotDiagnostic[],
): {
  groups: EnemyGroup[];
  actorToNpcId: ReadonlyMap<number, number>;
  stats: WclFactSnapshotStats;
} {
  const stats = emptyStats();
  const rawEnemies = report.enemies;
  if (!Array.isArray(rawEnemies)) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_REPORT_ENEMIES_INVALID',
        'report.enemies',
        'WCL report 必须包含 enemies 数组。',
      ),
    );
    return { groups: [], actorToNpcId: new Map(), stats };
  }

  stats.reportEnemies = rawEnemies.length;
  if (rawEnemies.length === 0) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_REPORT_ENEMIES_EMPTY',
        'report.enemies',
        'WCL report.enemies 不能为空；不输出没有敌人事实的快照。',
      ),
    );
    return { groups: [], actorToNpcId: new Map(), stats };
  }
  const groupsByNpcId = new Map<number, EnemyGroup>();
  const actorToNpcId = new Map<number, number>();
  rawEnemies.forEach((rawEnemy, index) => {
    const path = `report.enemies[${index}]`;
    if (!isRecord(rawEnemy)) {
      errors.push(diagnostic('error', 'WCL_FACT_ENEMY_INVALID', path, 'WCL enemy 必须是对象。'));
      return;
    }
    const actorId = rawEnemy.id;
    const npcId = rawEnemy.guid;
    if (!positiveInteger(actorId)) {
      errors.push(
        diagnostic(
          'error',
          'WCL_FACT_ENEMY_ACTOR_ID_INVALID',
          `${path}.id`,
          'WCL enemy actor id 必须是正整数。',
        ),
      );
      return;
    }
    if (!positiveInteger(npcId)) {
      errors.push(
        diagnostic(
          'error',
          'WCL_FACT_ENEMY_NPC_ID_INVALID',
          `${path}.guid`,
          'WCL enemy guid（NPC ID）必须是正整数；不能用 actor id 猜测 NPC ID。',
        ),
      );
      return;
    }
    if (actorToNpcId.has(actorId)) {
      errors.push(
        diagnostic(
          'error',
          'WCL_FACT_DUPLICATE_ENEMY_ACTOR',
          `${path}.id`,
          `WCL report 中 actor id 重复：${actorId}。`,
        ),
      );
      return;
    }
    const subtype = rawEnemy.subType;
    const type = rawEnemy.type;
    const kind = subtype === 'Boss' || subtype === 'NPC' ? subtype : type;
    if (kind !== 'Boss' && kind !== 'NPC') {
      errors.push(
        diagnostic(
          'error',
          'WCL_FACT_ENEMY_KIND_INVALID',
          `${path}.subType`,
          'WCL enemy 必须明确标记为 Boss 或 NPC；不能从名称推断 Boss 身份。',
        ),
      );
      return;
    }
    const isBoss = kind === 'Boss';
    const existing = groupsByNpcId.get(npcId);
    if (existing && existing.isBoss !== isBoss) {
      errors.push(
        diagnostic(
          'error',
          'WCL_FACT_ENEMY_KIND_CONFLICT',
          path,
          `同一 NPC ID ${npcId} 在 report 中同时出现 Boss/NPC 身份。`,
        ),
      );
      return;
    }
    const group = existing ?? { npcId, isBoss, actorIds: new Set<number>() };
    group.actorIds.add(actorId);
    groupsByNpcId.set(npcId, group);
    actorToNpcId.set(actorId, npcId);
  });

  const groups = [...groupsByNpcId.values()].sort((left, right) => left.npcId - right.npcId);
  stats.groupedEnemies = groups.length;
  stats.enemyActors = [...groups].reduce((total, group) => total + group.actorIds.size, 0);
  return { groups, actorToNpcId, stats };
}

function buildAbilityGroups(
  rawEvents: readonly unknown[],
  actorToNpcId: ReadonlyMap<number, number>,
  stats: WclFactSnapshotStats,
): Map<string, AbilityGroup> {
  const groups = new Map<string, AbilityGroup>();
  rawEvents.forEach((rawEvent) => {
    if (!isRecord(rawEvent)) return;
    if (typeof rawEvent.type !== 'string' || !castEventTypes.has(rawEvent.type)) return;
    const sourceId = rawEvent.sourceID;
    const ability = isRecord(rawEvent.ability) ? rawEvent.ability : undefined;
    const spellId = ability?.guid;
    if (!positiveInteger(sourceId) || !positiveInteger(spellId)) return;
    const npcId = actorToNpcId.get(sourceId);
    if (npcId === undefined) {
      stats.skippedEventsWithoutEnemyCaster += 1;
      return;
    }
    stats.castEvents += 1;
    const casterEnemyKey = `wcl:npc:${npcId}`;
    const key = `${spellId}:${casterEnemyKey}`;
    const group = groups.get(key) ?? {
      spellId,
      casterEnemyKeys: new Set<string>(),
    };
    group.casterEnemyKeys.add(casterEnemyKey);
    groups.set(key, group);
  });
  stats.groupedAbilities = groups.size;
  return groups;
}

/**
 * Convert an exported WCL report plus optional events into a draft-only
 * FactSnapshot. This adapter intentionally does not derive forces, routes,
 * coordinates, interruptibility, or player advice. Missing events are a
 * warning for draft use; release validation still fails on missing forces and
 * incomplete evidence.
 */
export async function buildWclFactSnapshot(
  rawReport: unknown,
  rawEvents: unknown,
  options: WclFactSnapshotOptions,
): Promise<WclFactSnapshotResult> {
  const errors: FactSnapshotDiagnostic[] = [];
  const warnings: FactSnapshotDiagnostic[] = [];
  const stats = emptyStats();
  if (!isRecord(rawReport)) {
    errors.push(
      diagnostic('error', 'WCL_FACT_REPORT_INVALID', 'report', 'WCL report 必须是对象。'),
    );
    return { ok: false, errors, warnings, stats };
  }
  if (
    !nonEmptyString(options.dungeonId) ||
    !nonEmptyString(options.season) ||
    !nonEmptyString(options.gameBuild) ||
    !nonEmptyString(options.snapshotId) ||
    !nonEmptyString(options.evidenceRef) ||
    !nonEmptyString(options.capturedAt)
  ) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_OPTIONS_INVALID',
        'options',
        'dungeonId、season、gameBuild、snapshotId、evidenceRef、capturedAt 均必须是非空字符串。',
      ),
    );
    return { ok: false, errors, warnings, stats };
  }
  if (options.fightId !== undefined && !positiveInteger(options.fightId)) {
    errors.push(
      diagnostic('error', 'WCL_FACT_FIGHT_ID_INVALID', 'options.fightId', 'fightId 必须是正整数。'),
    );
    return { ok: false, errors, warnings, stats };
  }

  const catalogEntry = options.catalogEntry ?? getDungeonCatalogEntry(options.dungeonId);
  if (!catalogEntry) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_CATALOG_ENTRY_REQUIRED',
        'dungeonId',
        `S2 目录中不存在副本：${options.dungeonId}。`,
      ),
    );
    return { ok: false, errors, warnings, stats };
  }
  if (catalogEntry.id !== options.dungeonId || catalogEntry.season !== options.season) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_CATALOG_MISMATCH',
        'options',
        `目录 ${catalogEntry.id}/${catalogEntry.season} 与请求 ${options.dungeonId}/${options.season} 不匹配。`,
      ),
    );
    return { ok: false, errors, warnings, stats };
  }

  const scopedInputs = scopeWclFightInputs(rawReport, rawEvents, options.fightId);
  if (scopedInputs.errors.length > 0) {
    return { ok: false, errors: scopedInputs.errors, warnings, stats };
  }
  const report = scopedInputs.report;
  const eventsInput = scopedInputs.events;

  const enemyResult = buildEnemyGroups(report, errors);
  Object.assign(stats, enemyResult.stats);
  const events = readEvents(eventsInput);
  appendDiagnostics(errors, events.errors);
  const reportSourceCode = readSourceCodeAliases(report, 'report');
  appendDiagnostics(errors, reportSourceCode.errors);
  const reportCode = reportSourceCode.sourceCode;
  if (reportCode && events.sourceCode && reportCode !== events.sourceCode) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_SOURCE_IDENTITY_MISMATCH',
        'events.code',
        `report code ${reportCode} 与 events code ${events.sourceCode} 不一致；拒绝拼接两个来源。`,
      ),
    );
  } else if (eventsInput !== undefined && (!reportCode || !events.sourceCode)) {
    const severity = options.requireApproved ? 'error' : 'warning';
    (severity === 'error' ? errors : warnings).push(
      diagnostic(
        severity,
        'WCL_FACT_SOURCE_IDENTITY_UNVERIFIED',
        'events',
        options.requireApproved
          ? 'release 预检要求 report/events 同时提供可比较的 report code。'
          : 'report/events 未同时提供可比较的 report code；请人工确认两个导出来自同一报告。',
      ),
    );
  }
  if (eventsInput === undefined) {
    warnings.push(
      diagnostic(
        'warning',
        'WCL_FACT_EVENTS_MISSING',
        'events',
        '未提供 WCL events；输出不会包含 Ability 事实，只能作为敌人目录 draft。',
      ),
    );
  }
  if (errors.length > 0) return { ok: false, errors, warnings, stats };

  const enemyRows: FactSnapshot['enemies'] = enemyResult.groups.map((group) => ({
    enemyKey: `wcl:npc:${group.npcId}`,
    npcId: group.npcId,
    isBoss: group.isBoss,
  }));
  const abilityGroups = buildAbilityGroups(events.events, enemyResult.actorToNpcId, stats);
  const abilityRows: FactSnapshot['abilities'] = [...abilityGroups.values()]
    .sort((left, right) => {
      if (left.spellId !== right.spellId) return left.spellId - right.spellId;
      return [...left.casterEnemyKeys]
        .join('|')
        .localeCompare([...right.casterEnemyKeys].join('|'));
    })
    .map((group) => {
      const casterEnemyKeys = [...group.casterEnemyKeys].sort();
      return {
        abilityKey: `wcl:spell:${group.spellId}:${casterEnemyKeys.join('+')}`,
        spellId: group.spellId,
        casterEnemyKeys,
      };
    });
  if (abilityRows.length === 0 && eventsInput !== undefined) {
    warnings.push(
      diagnostic(
        'warning',
        'WCL_FACT_ABILITIES_EMPTY',
        'events',
        'events 中没有可绑定到 report.enemies 的施法事件；不会猜测 Spell 或施法者。',
      ),
    );
  }
  warnings.push(
    diagnostic(
      'warning',
      'WCL_FACT_FORCES_NOT_DERIVED',
      'enemies',
      'WCL report/events 不提供可审计的逐敌人 forces；输出明确省略 forces，不能直接 release。',
    ),
  );

  const draft: FactSnapshotDraft = {
    version: 1,
    snapshotId: options.snapshotId,
    ...(options.fightId === undefined ? {} : { fightId: options.fightId }),
    dungeonId: options.dungeonId,
    season: options.season,
    gameBuild: options.gameBuild,
    source: 'wcl',
    licenseStatus: options.licenseStatus ?? 'reference-only',
    evidenceRef: options.evidenceRef,
    capturedAt: options.capturedAt,
    enemies: enemyRows,
    abilities: abilityRows,
  };
  const validation = await createFactSnapshot(draft, {
    entry: catalogEntry,
    expectedGameBuild: options.gameBuild,
    requireApproved: options.requireApproved,
  });
  appendDiagnostics(errors, validation.errors);
  appendDiagnostics(warnings, validation.warnings);
  return {
    ok: errors.length === 0 && validation.ok,
    snapshot: errors.length === 0 && validation.snapshot ? validation.snapshot : undefined,
    errors,
    warnings,
    stats,
  };
}

function appendDiagnostics(
  target: FactSnapshotDiagnostic[],
  incoming: readonly FactSnapshotDiagnostic[],
): void {
  incoming.forEach((item) => target.push(item));
}
