import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const report = {
  code: 'WCLTEST1',
  enemies: [
    { id: 11, guid: 1001, type: 'NPC', subType: 'NPC' },
    { id: 12, guid: 1002, type: 'NPC', subType: 'Boss' },
  ],
};

const events = {
  code: 'WCLTEST1',
  events: [
    { type: 'cast', sourceID: 11, ability: { guid: 2001 } },
    { type: 'cast', sourceID: 12, ability: { guid: 2002 } },
  ],
};

const multiFightReport = {
  code: 'WCLTEST1',
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
  code: 'WCLTEST1',
  events: [
    { type: 'cast', timestamp: 100, sourceID: 11, ability: { guid: 2001 } },
    { type: 'cast', timestamp: 300, sourceID: 12, ability: { guid: 2002 } },
  ],
};

function runCli(
  directory: string,
  extra: string[] = [],
  outputPath = join(directory, 'snapshot.json'),
) {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-from-wcl.ts');
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      scriptPath,
      `--report=${join(directory, 'report.json')}`,
      `--events=${join(directory, 'events.json')}`,
      `--dungeon=ruby-life-pools`,
      `--build=midnight-s2-test-build`,
      `--captured-at=2026-08-11T00:00:00.000Z`,
      `--out=${outputPath}`,
      '--json',
      ...extra,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

describe('dungeon:fact-from-wcl CLI', () => {
  it('writes a draft snapshot and preserves the explicit no-forces boundary', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'report.json'), JSON.stringify(report), 'utf8'),
        writeFile(join(directory, 'events.json'), JSON.stringify(events), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        stats: { groupedEnemies: 2, groupedAbilities: 2 },
      });
      const snapshot = JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8')) as {
        source: string;
        totalEnemyForcesPoints?: number;
        enemies: unknown[];
        abilities: unknown[];
      };
      expect(snapshot.source).toBe('wcl');
      expect(snapshot.totalEnemyForcesPoints).toBeUndefined();
      expect(snapshot.enemies).toHaveLength(2);
      expect(snapshot.abilities).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails release mode and does not write a snapshot without forces evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'report.json'), JSON.stringify(report), 'utf8'),
        writeFile(join(directory, 'events.json'), JSON.stringify(events), 'utf8'),
      ]);
      const result = runCli(directory, ['--release', '--license-status=approved']);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FACT_SNAPSHOT_FORCES_REQUIRED' }),
        ]),
      );
      await expect(readFile(join(directory, 'snapshot.json'))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects an output path that aliases the raw report', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'report.json'), JSON.stringify(report), 'utf8'),
        writeFile(join(directory, 'events.json'), JSON.stringify(events), 'utf8'),
      ]);
      const result = runCli(directory, [], join(directory, 'report.json'));

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors[0]).toMatchObject({
        code: 'WCL_FACT_OUTPUT_MUST_DIFFER',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('requires explicit evidence when report.code is malformed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      await Promise.all([
        writeFile(
          join(directory, 'report.json'),
          JSON.stringify({ ...report, code: null }),
          'utf8',
        ),
        writeFile(join(directory, 'events.json'), JSON.stringify(events), 'utf8'),
      ]);
      const result = runCli(directory);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors[0]).toMatchObject({
        code: 'WCL_FACT_EVIDENCE_REQUIRED',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns a stable report diagnostic when the input file is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      const result = runCli(directory);

      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors[0]).toMatchObject({
        code: 'WCL_FACT_REPORT_INVALID',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('accepts an explicit fight scope for a standard multi-fight report export', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-'));
    try {
      await Promise.all([
        writeFile(join(directory, 'report.json'), JSON.stringify(multiFightReport), 'utf8'),
        writeFile(join(directory, 'events.json'), JSON.stringify(multiFightEvents), 'utf8'),
      ]);
      const result = runCli(directory, ['--fight-id=1']);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        snapshotId: 'wcl:wcl-report:WCLTEST1:ruby-life-pools:midnight-s2-test-build:fight-1',
        stats: { groupedEnemies: 1, groupedAbilities: 1 },
      });
      const snapshot = JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8')) as {
        fightId?: number;
        enemies: unknown[];
        abilities: unknown[];
      };
      expect(snapshot.fightId).toBe(1);
      expect(snapshot.enemies).toHaveLength(1);
      expect(snapshot.abilities).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
