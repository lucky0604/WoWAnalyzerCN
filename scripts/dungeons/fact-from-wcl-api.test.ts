import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const report = {
  code: 'API_TEST1',
  start: 100,
  end: 200,
  fights: [{ id: 1, start_time: 100, end_time: 200 }],
  enemies: [{ id: 11, guid: 1001, type: 'NPC', subType: 'NPC', fights: [{ id: 1 }] }],
};

function runCli(
  apiBase: string,
  outputPath: string,
  extra: string[] = [],
): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-from-wcl-api.ts');
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx/esm',
        scriptPath,
        `--api-base=${apiBase}`,
        '--report-code=API_TEST1',
        '--dungeon=ruby-life-pools',
        '--build=midnight-s2-test-build',
        '--captured-at=2026-08-11T00:00:00.000Z',
        `--out=${outputPath}`,
        '--json',
        ...extra,
      ],
      { cwd: process.cwd(), env: process.env },
    );
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (!settled) {
        settled = true;
        resolvePromise({ status: null, stdout, stderr: `${stderr}\nCLI timeout` });
      }
    }, 15000);
    const finish = (status: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ status, stdout, stderr });
    };
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', finish);
  });
}

async function startApiServer(): Promise<{
  server: Server;
  base: string;
  eventsRequests: () => number;
}> {
  let eventsRequests = 0;
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url?.startsWith('/v1/report/fights/API_TEST1')) {
      response.end(JSON.stringify(report));
      return;
    }
    if (request.url?.startsWith('/v1/report/events/API_TEST1')) {
      eventsRequests += 1;
      response.end(
        JSON.stringify({
          code: 'API_TEST1',
          events: [{ type: 'cast', sourceID: 11, ability: { guid: 2001 }, timestamp: 120 }],
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise<void>((resolvePromise, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolvePromise();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test API server did not start');
  return {
    server,
    base: `http://127.0.0.1:${address.port}/v1`,
    eventsRequests: () => eventsRequests,
  };
}

describe('dungeon:fact-from-wcl-api CLI', () => {
  it('captures a report through a configured API base and writes the same draft contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-api-'));
    const api = await startApiServer();
    try {
      const outputPath = join(directory, 'snapshot.json');
      const result = await runCli(api.base, outputPath, ['--fight-id=1']);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        snapshotId: 'wcl:wcl-report:API_TEST1:ruby-life-pools:midnight-s2-test-build:fight-1',
        stats: { groupedEnemies: 1, groupedAbilities: 1 },
      });
      const snapshot = JSON.parse(await readFile(outputPath, 'utf8')) as {
        source: string;
        fightId?: number;
        abilities: unknown[];
      };
      expect(snapshot.source).toBe('wcl');
      expect(snapshot.fightId).toBe(1);
      expect(snapshot.abilities).toHaveLength(1);
      expect(api.eventsRequests()).toBe(1);
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        api.server.close((error) => (error ? reject(error) : resolvePromise())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('supports enemy-only capture without calling the events endpoint', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-api-'));
    const api = await startApiServer();
    try {
      const outputPath = join(directory, 'snapshot.json');
      const result = await runCli(api.base, outputPath, ['--skip-events']);

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: 'WCL_FACT_API_EVENTS_SKIPPED' }),
          expect.objectContaining({ code: 'WCL_FACT_EVENTS_MISSING' }),
        ]),
      });
      expect(api.eventsRequests()).toBe(0);
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        api.server.close((error) => (error ? reject(error) : resolvePromise())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails closed when the API base is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-from-wcl-api-'));
    try {
      const result = await new Promise<{ status: number | null; stdout: string }>(
        (resolvePromise, reject) => {
          const child = spawn(
            process.execPath,
            [
              '--import',
              'tsx/esm',
              resolve(process.cwd(), 'scripts/dungeons/fact-from-wcl-api.ts'),
              '--report-code=API_TEST1',
              '--dungeon=ruby-life-pools',
              '--build=midnight-s2-test-build',
              `--out=${join(directory, 'snapshot.json')}`,
              '--json',
            ],
            {
              cwd: process.cwd(),
              env: { ...process.env, DUNGEON_WCL_API_BASE: '', VITE_WCL_API_BASE: '' },
            },
          );
          let stdout = '';
          child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
          });
          child.on('error', reject);
          child.on('close', (status) => resolvePromise({ status, stdout }));
        },
      );
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).errors[0]).toMatchObject({
        code: 'WCL_FACT_API_INPUT_REQUIRED',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
