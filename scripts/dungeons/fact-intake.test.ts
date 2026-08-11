import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const report = {
  code: 'INTAKE_CLI',
  start: 100,
  end: 200,
  fights: [{ id: 1, start_time: 100, end_time: 200 }],
  enemies: [{ id: 11, guid: 1001, type: 'NPC', fights: [{ id: 1 }] }],
};

const document = {
  id: 'ruby-life-pools',
  slug: 'ruby-life-pools',
  name: { zhCN: '红玉新生法池' },
  season: 'midnight-s2',
  dataStatus: 'draft',
  spatialStatus: 'pending',
  version: { season: 'midnight-s2', build: 'midnight-s2-test-build', revision: 2, status: 'draft' },
  totalEnemyForcesPoints: 1,
  floors: [
    {
      id: 'floor-1',
      name: { zhCN: '大厅' },
      coordinateSpace: 'normalized-v1',
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
    },
  ],
  spawns: [],
  enemies: [
    {
      id: 'enemy-1',
      npcId: 1001,
      name: { zhCN: '测试小怪' },
      forcesPoints: 1,
      isBoss: false,
      spawnIds: [],
      abilityIds: ['ability-1'],
      provenance: [],
    },
  ],
  abilities: [
    {
      id: 'ability-1',
      spellId: 2001,
      name: { zhCN: '测试技能' },
      casterEnemyIds: ['enemy-1'],
      decisionCritical: true,
      severity: 'critical',
      action: { zhCN: '打断' },
      consequence: { zhCN: '会受伤' },
      version: {
        season: 'midnight-s2',
        build: 'midnight-s2-test-build',
        revision: 1,
        status: 'draft',
      },
      provenance: [],
    },
  ],
  situations: [],
  routes: [],
  bosses: [],
  provenance: [],
};

function runCli(
  args: string[],
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const scriptPath = resolve(process.cwd(), 'scripts/dungeons/fact-intake.ts');
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', scriptPath, ...args, '--json'], {
      cwd: process.cwd(),
      env: process.env,
    });
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
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', finish);
  });
}

async function startApiServer(): Promise<{ server: Server; base: string }> {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url?.startsWith('/v1/report/fights/INTAKE_CLI')) {
      response.end(JSON.stringify(report));
      return;
    }
    if (request.url?.startsWith('/v1/report/events/INTAKE_CLI')) {
      response.end(
        JSON.stringify({
          code: 'INTAKE_CLI',
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
  return { server, base: `http://127.0.0.1:${address.port}/v1` };
}

describe('dungeon:fact-intake CLI', () => {
  it('writes a snapshot-only bundle and preserves implicit fight scope', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-intake-'));
    const api = await startApiServer();
    try {
      const outputDir = join(directory, 'nested', 'bundle');
      const result = await runCli([
        `--api-base=${api.base}`,
        '--report-code=INTAKE_CLI',
        '--dungeon=ruby-life-pools',
        '--build=midnight-s2-test-build',
        `--out-dir=${outputDir}`,
        '--skip-events',
      ]);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        status: 'snapshot-only',
        snapshot: { fightId: 1 },
      });
      expect(JSON.parse(await readFile(join(outputDir, 'intake.json'), 'utf8'))).toMatchObject({
        status: 'snapshot-only',
        snapshot: { fightId: 1 },
      });
      expect(
        JSON.parse(await readFile(join(outputDir, 'snapshot.json'), 'utf8')).snapshotId,
      ).toContain(':fight-1');
      expect(await readdir(outputDir)).toEqual(
        expect.arrayContaining(['snapshot.json', 'intake.json']),
      );
      expect(await readdir(outputDir)).not.toContain('report.json');
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        api.server.close((error) => (error ? reject(error) : resolvePromise())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('writes a plan and TODO decision template only with explicit reviewer metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-intake-'));
    const api = await startApiServer();
    try {
      const documentPath = join(directory, 'document.json');
      const outputDir = join(directory, 'bundle');
      await writeFile(documentPath, `${JSON.stringify(document)}\n`);
      const result = await runCli([
        `--api-base=${api.base}`,
        '--report-code=INTAKE_CLI',
        '--dungeon=ruby-life-pools',
        '--build=midnight-s2-test-build',
        `--document=${documentPath}`,
        '--reviewer=content-owner',
        '--reviewed-at=2026-08-11T01:00:00.000Z',
        `--out-dir=${outputDir}`,
      ]);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        status: 'template-ready',
        files: { authoringDocument: 'authoring-document.json' },
      });
      expect(await readdir(outputDir)).toEqual(
        expect.arrayContaining([
          'snapshot.json',
          'binding-plan.json',
          'decisions.template.json',
          'authoring-document.json',
          'intake.json',
        ]),
      );
      const template = JSON.parse(
        await readFile(join(outputDir, 'decisions.template.json'), 'utf8'),
      );
      expect(template.enemies[0]).toMatchObject({ decision: 'TODO', reason: '' });
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        api.server.close((error) => (error ? reject(error) : resolvePromise())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects an existing output directory without force and leaves it unchanged', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wac-fact-intake-'));
    const api = await startApiServer();
    try {
      const outputDir = join(directory, 'bundle');
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, 'keep.txt'), 'keep');
      const result = await runCli([
        `--api-base=${api.base}`,
        '--report-code=INTAKE_CLI',
        '--dungeon=ruby-life-pools',
        '--build=midnight-s2-test-build',
        `--out-dir=${outputDir}`,
      ]);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        errors: [expect.objectContaining({ code: 'FACT_INTAKE_OUTPUT_EXISTS' })],
      });
      expect(await readFile(join(outputDir, 'keep.txt'), 'utf8')).toBe('keep');
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        api.server.close((error) => (error ? reject(error) : resolvePromise())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
});
