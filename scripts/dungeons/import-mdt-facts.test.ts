import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runImport } from './import-mdt-facts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writeInput(
  root: string,
  sourceKey: string,
  source: unknown,
  zhTable?: Record<string, Record<string, string>>,
): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(join(root, `${sourceKey}_mdt.json`), `${JSON.stringify(source)}\n`, 'utf8');
  if (zhTable) {
    await writeFile(join(root, 'npc-names.zh.json'), `${JSON.stringify(zhTable)}\n`, 'utf8');
  }
}

const validSource = {
  dungeonIndex: 42,
  totalCount: 999,
  enemies: [
    {
      id: 1001,
      enemyIndex: 1,
      name: 'Trash Mob',
      count: 5,
      creatureType: 'Humanoid',
      scale: 1,
      isBoss: false,
      characteristics: ['Taunt', 'Stun'],
      spells: [
        { id: 111, attributes: [] },
        { id: 222, attributes: ['interruptible'] },
      ],
      spawns: [{ id: '1-1', idx: 1, group: 2, pos: [-211.78, 46.13] }],
    },
    {
      id: 1002,
      enemyIndex: 2,
      name: 'Trash Mob',
      count: 0,
      isBoss: false,
      characteristics: [],
      spells: [],
      spawns: [{ id: '1-2', idx: 2, group: 2, pos: [-210.0, 45.0] }],
    },
    {
      id: 2001,
      enemyIndex: 3,
      name: 'Boss Person',
      count: 0,
      isBoss: true,
      spells: [{ id: 222, attributes: [] }],
      spawns: [{ id: '9-9', pos: [0, 0] }],
    },
  ],
};

function args(inputRoot: string, outRoot: string, ...flags: string[]): string[] {
  return [
    '--dungeon=aof',
    `--input-dir=${inputRoot}`,
    `--facts-dir=${join(outRoot, 'facts')}`,
    `--reference-dir=${join(outRoot, 'mdtFacts')}`,
    '--captured-at=2026-08-26T00:00:00.000Z',
    ...flags,
  ];
}

/** 放行桩：fixture 不在真实 sourceRegistry 里，注入"按内容一致放行"的登记项。 */
const approveAnyHash = (_slug: string, rawSha256: string) => ({
  hash: `sha256:${rawSha256}`,
});

describe('MDT facts importer', () => {
  it('writes a reference layer and a validated fact snapshot', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource, {
      aof: { 'Trash Mob': '小怪', 'Boss Person': '首领' },
    });

    const summaries = await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      slug: 'altar-of-fangs',
      enemyCount: 3,
      abilityCount: 2,
      totalEnemyForcesPoints: 5,
      mode: 'write',
    });

    const reference = JSON.parse(
      await readFile(join(outRoot, 'mdtFacts/altar-of-fangs.json'), 'utf8'),
    );
    expect(reference.nameZhCoverage).toBe('full');
    expect(reference.totalEnemyForcesPoints).toBe(5);
    expect(reference.mdtDungeonTotalCount).toBe(999);
    const trashMob = reference.enemies.find((enemy: { npcId: number }) => enemy.npcId === 1001);
    expect(trashMob.name).toEqual({ enUS: 'Trash Mob', zhCN: '小怪' });
    expect(trashMob.spells).toEqual([
      { id: 111, attributes: [] },
      { id: 222, attributes: ['interruptible'] },
    ]);

    const snapshot = JSON.parse(
      await readFile(join(outRoot, 'facts/altar-of-fangs.s2.json'), 'utf8'),
    );
    expect(snapshot.source).toBe('game-data');
    expect(snapshot.licenseStatus).toBe('approved');
    // 重名敌人带 [npcId] 后缀；唯一名字保持可读。
    const keys = snapshot.enemies.map((enemy: { enemyKey: string }) => enemy.enemyKey);
    expect(keys).toContain('Trash Mob [1001]');
    expect(keys).toContain('Trash Mob [1002]');
    expect(keys).toContain('Boss Person');
    const interruptible = snapshot.abilities.find(
      (ability: { spellId: number }) => ability.spellId === 222,
    );
    expect(interruptible.interruptible).toBe(true);
    // 同一 spellId 的多 caster 分组覆盖 boss（不带 interruptible 属性）：
    // trash [1001] 与 boss [2001]，共 2 个 caster。
    expect(interruptible.casterEnemyKeys).toHaveLength(2);
    expect(snapshot.totalEnemyForcesPoints).toBe(5);
  });

  it('falls back to English names when the zh table is missing or empty', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    const reference = JSON.parse(
      await readFile(join(outRoot, 'mdtFacts/altar-of-fangs.json'), 'utf8'),
    );
    expect(reference.nameZhCoverage).toBe('none');
    expect(reference.enemies[0].name).toEqual({ enUS: 'Trash Mob' });
  });

  it('is deterministic across runs and supports check mode', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    const firstSnapshot = await readFile(join(outRoot, 'facts/altar-of-fangs.s2.json'), 'utf8');
    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    const secondSnapshot = await readFile(join(outRoot, 'facts/altar-of-fangs.s2.json'), 'utf8');
    expect(secondSnapshot).toBe(firstSnapshot);

    const checked = await runImport(args(inputRoot, outRoot, '--check'), { approveMdtSnapshot: approveAnyHash });
    expect(checked[0]).toMatchObject({ mode: 'check', changed: false });
  });

  it('rejects duplicate npc ids and invalid counts', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    const broken = {
      ...validSource,
      enemies: [
        ...validSource.enemies.slice(0, 2),
        { ...validSource.enemies[0], id: 1001, enemyIndex: 4, name: 'Other' },
      ],
    };
    await writeInput(inputRoot, 'aof', broken);
    await expect(runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(/DUPLICATE_NPC_ID/);

    const negativeCount = {
      ...validSource,
      enemies: [{ ...validSource.enemies[0], count: -3 }],
    };
    await writeInput(inputRoot, 'aof', negativeCount);
    await expect(runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(
      /FIELD_INVALID|COUNT_MISSING/,
    );

    const missingCount = {
      ...validSource,
      enemies: [
        Object.fromEntries(
          Object.entries(validSource.enemies[0]).filter(([key]) => key !== 'count'),
        ),
      ],
    };
    await writeInput(inputRoot, 'aof', missingCount);
    await expect(runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(
      /FIELD_INVALID|COUNT_MISSING/,
    );
  });

  it('rejects unknown dungeon keys', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    const bogusArgs = args(inputRoot, outRoot).map((argument) =>
      argument === '--dungeon=aof' ? '--dungeon=bogus' : argument,
    );
    await expect(runImport(bogusArgs)).rejects.toThrow(/MDT_FACTS_KEY_UNKNOWN/);
  });

  it('rejects a structurally invalid source snapshot', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await mkdir(inputRoot, { recursive: true });
    await writeFile(join(inputRoot, 'aof_mdt.json'), '{ not json', 'utf8');
    await expect(runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(/MDT_FACTS_SNAPSHOT_INVALID/);
  });

  it('rejects invalid enemy names, duplicate spawn ids and malformed spell/spawn fields', async () => {
    const cases: Array<[string, unknown]> = [
      [
        'MDT_FACTS_NAME_INVALID',
        { dungeonIndex: 42, enemies: [{ id: 1001, enemyIndex: 1, name: '', count: 0 }] },
      ],
      [
        'MDT_FACTS_DUPLICATE_SPAWN_ID',
        {
          ...validSource,
          enemies: [
            validSource.enemies[0],
            { ...validSource.enemies[1], spawns: [{ id: '1-1', idx: 2 }] },
          ],
        },
      ],
      [
        'MDT_FACTS_SPELLS_INVALID',
        { dungeonIndex: 42, enemies: [{ ...validSource.enemies[0], spells: 'interruptible' }] },
      ],
      [
        'MDT_FACTS_SPELL_ATTRIBUTES_INVALID',
        {
          dungeonIndex: 42,
          enemies: [
            { ...validSource.enemies[0], spells: [{ id: 111, attributes: 'interruptible' }] },
          ],
        },
      ],
      [
        'MDT_FACTS_SPAWNS_INVALID',
        { dungeonIndex: 42, enemies: [{ ...validSource.enemies[0], spawns: '1-1' }] },
      ],
      [
        'MDT_FACTS_SPAWN_ID_INVALID',
        {
          dungeonIndex: 42,
          enemies: [{ ...validSource.enemies[0], spawns: [{ idx: 1, group: 2 }] }],
        },
      ],
    ];
    for (const [code, source] of cases) {
      const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
      const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
      temporaryRoots.push(inputRoot, outRoot);
      await writeInput(inputRoot, 'aof', source);
      await expect(
        runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash }),
        `expected ${code} to reject the mutated source`,
      ).rejects.toThrow(new RegExp(code));
    }
  });

  it('rejects sources that fail fact snapshot creation', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    // capturedAt 不是 UTC ISO 时间戳：validateSource 放行、createFactSnapshot 拒绝，
    // 导入器必须把它包成 MDT_FACTS_SNAPSHOT_REJECTED 而不是静默写出。
    const error = await runImport(
      args(inputRoot, outRoot).map((argument) =>
        argument === '--captured-at=2026-08-26T00:00:00.000Z'
          ? '--captured-at=not-a-timestamp'
          : argument,
      ),
      { approveMdtSnapshot: approveAnyHash },
    ).then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/MDT_FACTS_SNAPSHOT_REJECTED/);
    expect((error as Error).message).toMatch(/FACT_SNAPSHOT_CAPTURED_AT_INVALID/);
  });

  it('reports partial zh name coverage when only some enemies have zhCN names', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource, {
      aof: { 'Trash Mob': '小怪' },
    });

    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    const reference = JSON.parse(
      await readFile(join(outRoot, 'mdtFacts/altar-of-fangs.json'), 'utf8'),
    );
    expect(reference.nameZhCoverage).toBe('partial');
    const names = reference.enemies.map((enemy: { name: { zhCN?: string } }) => enemy.name.zhCN);
    expect(names).toEqual(['小怪', '小怪', undefined]);
  });

  it('fails check mode when committed artifacts are missing', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    await expect(runImport(args(inputRoot, outRoot, '--check'), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(
      /MDT_FACTS_CHECK_MISSING/,
    );
  });

  it('fails check mode when committed artifact JSON is unreadable', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);
    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    await writeFile(join(outRoot, 'facts/altar-of-fangs.s2.json'), '{ corrupt', 'utf8');

    await expect(runImport(args(inputRoot, outRoot, '--check'), { approveMdtSnapshot: approveAnyHash })).rejects.toThrow(
      /MDT_FACTS_CHECK_INVALID/,
    );
  });

  it('fails check mode when regenerated artifacts drift from committed ones', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);
    await runImport(args(inputRoot, outRoot), { approveMdtSnapshot: approveAnyHash });
    const drifted = {
      ...validSource,
      enemies: validSource.enemies.map((enemy) =>
        enemy.id === 1001 ? { ...enemy, count: 6 } : enemy,
      ),
    };
    await writeInput(inputRoot, 'aof', drifted);

    await expect(
      runImport(args(inputRoot, outRoot, '--check'), { approveMdtSnapshot: approveAnyHash }),
    ).rejects.toThrow(/MDT_FACTS_CHECK_MISMATCH/);
  });

  it('rejects raw input that is not registered in the mdt batch', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    await expect(
      runImport(args(inputRoot, outRoot), { approveMdtSnapshot: () => undefined }),
    ).rejects.toThrow(/MDT_FACTS_SNAPSHOT_UNREGISTERED/);
  });

  it('rejects raw input whose sha256 drifts from the registered mdt batch', async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-in-'));
    const outRoot = await mkdtemp(join(tmpdir(), 'wowa-mdt-out-'));
    temporaryRoots.push(inputRoot, outRoot);
    await writeInput(inputRoot, 'aof', validSource);

    await expect(
      runImport(args(inputRoot, outRoot), {
        approveMdtSnapshot: () => ({ hash: `sha256:${'0'.repeat(64)}` }),
      }),
    ).rejects.toThrow(/MDT_FACTS_SOURCE_HASH_MISMATCH/);
  });
});
