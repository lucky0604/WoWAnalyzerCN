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
    const result = await buildWclFactSnapshot(
      { ...report, fights: [{ id: 1 }, { id: 2 }] },
      events,
      options,
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('WCL_FACT_FIGHT_SCOPE_REQUIRED');
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
