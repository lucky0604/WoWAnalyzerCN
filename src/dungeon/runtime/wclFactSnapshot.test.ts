import { buildWclFactSnapshot } from './wclFactSnapshot';

const options = {
  dungeonId: 'ruby-life-pools',
  season: 'midnight-s2',
  gameBuild: 'midnight-s2-test-build',
  snapshotId: 'wcl-report-test-v1',
  evidenceRef: 'wcl-report:TEST123',
  capturedAt: '2026-08-11T00:00:00.000Z',
} as const;

const report = {
  code: 'TEST123',
  enemies: [
    { id: 11, guid: 1001, type: 'NPC', subType: 'NPC' },
    { id: 12, guid: 1002, type: 'NPC', subType: 'Boss' },
  ],
};

const events = {
  code: 'TEST123',
  events: [
    { type: 'cast', sourceID: 11, ability: { guid: 2001, name: 'Test cast' } },
    { type: 'cast', sourceID: 11, ability: { guid: 2001, name: 'Test cast' } },
    { type: 'cast', sourceID: 12, ability: { guid: 2002, name: 'Boss cast' } },
    { type: 'damage', sourceID: 11, ability: { guid: 2998, name: 'Damage event' } },
    { type: 'cast', sourceID: 99, ability: { guid: 2999, name: 'Player cast' } },
  ],
};

const multiFightReport = {
  code: 'TEST123',
  fights: [
    { id: 1, start_time: 0, end_time: 200 },
    { id: 2, start_time: 201, end_time: 400 },
  ],
  enemies: [
    { id: 11, guid: 1001, type: 'NPC', subType: 'NPC', fights: [{ id: 1 }] },
    { id: 12, guid: 1002, type: 'NPC', subType: 'Boss', fights: [{ id: 2 }] },
  ],
};

const multiFightEvents = {
  code: 'TEST123',
  events: [
    { type: 'cast', timestamp: 100, sourceID: 11, ability: { guid: 2001 } },
    { type: 'cast', timestamp: 300, sourceID: 12, ability: { guid: 2002 } },
  ],
};

describe('WCL fact snapshot adapter', () => {
  it('groups report enemies and enemy casts without inventing forces', async () => {
    const result = await buildWclFactSnapshot(report, events, options);

    expect(result.ok).toBe(true);
    expect(result.snapshot).toMatchObject({
      source: 'wcl',
      dungeonId: 'ruby-life-pools',
      enemies: [
        { enemyKey: 'wcl:npc:1001', npcId: 1001, isBoss: false },
        { enemyKey: 'wcl:npc:1002', npcId: 1002, isBoss: true },
      ],
      abilities: [
        {
          abilityKey: 'wcl:spell:2001:wcl:npc:1001',
          spellId: 2001,
          casterEnemyKeys: ['wcl:npc:1001'],
        },
        {
          abilityKey: 'wcl:spell:2002:wcl:npc:1002',
          spellId: 2002,
          casterEnemyKeys: ['wcl:npc:1002'],
        },
      ],
    });
    expect(result.snapshot?.totalEnemyForcesPoints).toBeUndefined();
    expect(result.stats).toMatchObject({
      reportEnemies: 2,
      groupedEnemies: 2,
      enemyActors: 2,
      castEvents: 3,
      groupedAbilities: 2,
      skippedEventsWithoutEnemyCaster: 1,
    });
    expect(result.warnings.map((warning) => warning.code)).toContain('WCL_FACT_FORCES_NOT_DERIVED');
  });

  it('is deterministic for the same report export and metadata', async () => {
    const first = await buildWclFactSnapshot(report, events, options);
    const second = await buildWclFactSnapshot(report, events, options);

    expect(first.snapshot).toEqual(second.snapshot);
  });

  it('allows an enemy-only draft when events are omitted, but reports the missing learning facts', async () => {
    const result = await buildWclFactSnapshot(report, undefined, options);

    expect(result.ok).toBe(true);
    expect(result.snapshot?.abilities).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['WCL_FACT_EVENTS_MISSING', 'WCL_FACT_FORCES_NOT_DERIVED']),
    );
  });

  it('fails closed on duplicate actors and conflicting Boss identity', async () => {
    const result = await buildWclFactSnapshot(
      {
        enemies: [
          { id: 11, guid: 1001, type: 'NPC', subType: 'NPC' },
          { id: 11, guid: 1001, type: 'NPC', subType: 'NPC' },
          { id: 12, guid: 1001, type: 'NPC', subType: 'Boss' },
        ],
      },
      [],
      options,
    );

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['WCL_FACT_DUPLICATE_ENEMY_ACTOR', 'WCL_FACT_ENEMY_KIND_CONFLICT']),
    );
  });

  it('rejects a report with no enemy roster', async () => {
    const result = await buildWclFactSnapshot({ enemies: [] }, [], options);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_REPORT_ENEMIES_EMPTY');
  });

  it('rejects events explicitly identified as a different report', async () => {
    const result = await buildWclFactSnapshot(report, { ...events, code: 'OTHER_REPORT' }, options);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_SOURCE_IDENTITY_MISMATCH');
  });

  it('rejects a paginated events envelope instead of silently omitting later pages', async () => {
    const result = await buildWclFactSnapshot(
      report,
      { ...events, nextPageTimestamp: 123456 },
      options,
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_EVENTS_PAGINATED');
  });

  it('requires a report to be pre-cropped to one dungeon fight', async () => {
    const result = await buildWclFactSnapshot(multiFightReport, multiFightEvents, options);

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_FIGHT_SCOPE_REQUIRED');
  });

  it('scopes a multi-fight report and events when fightId is explicit', async () => {
    const result = await buildWclFactSnapshot(multiFightReport, multiFightEvents, {
      ...options,
      fightId: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.fightId).toBe(1);
    expect(result.snapshot?.enemies).toEqual([
      { enemyKey: 'wcl:npc:1001', npcId: 1001, isBoss: false },
    ]);
    expect(result.snapshot?.abilities).toEqual([
      {
        abilityKey: 'wcl:spell:2001:wcl:npc:1001',
        spellId: 2001,
        casterEnemyKeys: ['wcl:npc:1001'],
      },
    ]);
    expect(result.stats).toMatchObject({ groupedEnemies: 1, castEvents: 1, groupedAbilities: 1 });
  });

  it('fails closed when a selected fight has no actor-level scope metadata', async () => {
    const result = await buildWclFactSnapshot(
      {
        ...multiFightReport,
        enemies: [{ id: 11, guid: 1001, type: 'NPC', subType: 'NPC' }],
      },
      multiFightEvents,
      { ...options, fightId: 1 },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_ENEMY_SCOPE_UNAVAILABLE');
  });

  it('rejects an unknown fight id and an unscopable cast timestamp', async () => {
    const unknownFight = await buildWclFactSnapshot(multiFightReport, multiFightEvents, {
      ...options,
      fightId: 99,
    });
    expect(unknownFight.ok).toBe(false);
    expect(unknownFight.errors.map((error) => error.code)).toContain('WCL_FACT_FIGHT_ID_NOT_FOUND');

    const missingTimestamp = await buildWclFactSnapshot(
      multiFightReport,
      {
        ...multiFightEvents,
        events: [{ type: 'cast', sourceID: 11, ability: { guid: 2001 } }],
      },
      { ...options, fightId: 1 },
    );
    expect(missingTimestamp.ok).toBe(false);
    expect(missingTimestamp.errors.map((error) => error.code)).toContain(
      'WCL_FACT_EVENT_SCOPE_TIMESTAMP_INVALID',
    );
  });

  it('rejects duplicate fight ids and conflicting report code aliases', async () => {
    const duplicateFight = await buildWclFactSnapshot(
      {
        ...multiFightReport,
        fights: [
          { id: 1, start_time: 0, end_time: 200 },
          { id: 1, start_time: 201, end_time: 400 },
        ],
      },
      multiFightEvents,
      { ...options, fightId: 1 },
    );
    expect(duplicateFight.ok).toBe(false);
    expect(duplicateFight.errors.map((error) => error.code)).toContain(
      'WCL_FACT_DUPLICATE_FIGHT_ID',
    );

    const aliasMismatch = await buildWclFactSnapshot(
      { ...report, reportCode: 'OTHER_REPORT' },
      events,
      options,
    );
    expect(aliasMismatch.ok).toBe(false);
    expect(aliasMismatch.errors.map((error) => error.code)).toContain(
      'WCL_FACT_SOURCE_CODE_ALIAS_MISMATCH',
    );

    const invalidRange = await buildWclFactSnapshot(
      {
        ...multiFightReport,
        fights: [
          { id: 1, start_time: 200, end_time: 100 },
          { id: 2, start_time: 201, end_time: 400 },
        ],
      },
      multiFightEvents,
      { ...options, fightId: 1 },
    );
    expect(invalidRange.ok).toBe(false);
    expect(invalidRange.errors.map((error) => error.code)).toContain(
      'WCL_FACT_FIGHT_RANGE_INVALID',
    );

    const overlappingRanges = await buildWclFactSnapshot(
      {
        ...multiFightReport,
        fights: [
          { id: 1, start_time: 0, end_time: 200 },
          { id: 2, start_time: 100, end_time: 400 },
        ],
      },
      multiFightEvents,
      { ...options, fightId: 1 },
    );
    expect(overlappingRanges.ok).toBe(false);
    expect(overlappingRanges.errors.map((error) => error.code)).toContain(
      'WCL_FACT_FIGHT_RANGE_OVERLAP',
    );

    const malformedFights = await buildWclFactSnapshot(
      { ...report, fights: { id: 1 } },
      events,
      options,
    );
    expect(malformedFights.ok).toBe(false);
    expect(malformedFights.errors.map((error) => error.code)).toContain('WCL_FACT_FIGHTS_INVALID');
  });

  it('never turns a WCL draft into a release candidate without forces evidence', async () => {
    const result = await buildWclFactSnapshot(report, events, {
      ...options,
      licenseStatus: 'approved',
      requireApproved: true,
    });

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.errors.map((error) => error.code)).toContain('FACT_SNAPSHOT_FORCES_REQUIRED');
  });
});
