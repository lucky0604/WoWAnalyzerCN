import { beforeEach, describe, expect, test, vi } from 'vitest';

import GameBranch from 'game/GameBranch';
import SPECS from 'game/SPECS';
import Report from 'parser/core/Report';
import { WCLFight } from 'parser/core/Fight';
import { fetchCombatants } from 'common/fetchWclApi';
import { derivePlayers } from './PlayerLoader';

vi.mock('common/fetchWclApi', () => ({
  fetchCombatants: vi.fn(),
}));

const fetchCombatantsMock = vi.mocked(fetchCombatants);

beforeEach(() => {
  fetchCombatantsMock.mockReset();
});

const findRetailSpec = (wclClassName: string, wclSpecName: string) => {
  const spec = Object.values(SPECS).find(
    (candidate) =>
      candidate.branch === GameBranch.Retail &&
      candidate.wclClassName === wclClassName &&
      candidate.wclSpecName === wclSpecName,
  );
  if (!spec) {
    throw new Error(`No retail spec for ${wclClassName}-${wclSpecName}`);
  }
  return spec;
};

const asCombatants = (list: Array<Record<string, unknown>>) =>
  list as unknown as Awaited<ReturnType<typeof fetchCombatants>>;

const makeReport = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    code: 'ABC123',
    gameVersion: 1,
    friendlies: [],
    fights: [],
    ...overrides,
  }) as unknown as Report;

const makeFight = (overrides: Partial<WCLFight> = {}) =>
  ({
    id: 42,
    boss: 1193,
    originalBoss: 1193,
    start_time: 1000,
    end_time: 2000,
    ...overrides,
  }) as WCLFight;

describe('derivePlayers', () => {
  test('maps combatants to friendlies and resolves specs by specID', async () => {
    const frostDk = findRetailSpec('DeathKnight', 'Frost');
    fetchCombatantsMock.mockResolvedValueOnce(
      asCombatants([
        { sourceID: 1, specID: frostDk.id },
        // duplicate sourceID must be de-duplicated
        { sourceID: 1, specID: frostDk.id },
        { sourceID: 2, specID: -1 },
      ]),
    );
    const report = makeReport({
      friendlies: [
        { id: 1, name: 'Platey', guid: 'g1', type: 'DeathKnight', icon: 'DeathKnight-Frost' },
        { id: 2, name: 'Icy', guid: 'g2', type: 'Mage', icon: 'Mage-Frost' },
      ],
    });

    const players = await derivePlayers(report, makeFight());

    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({
      id: 1,
      name: 'Platey',
      className: 'DeathKnight',
      specID: frostDk.id,
      role: 'dps',
    });
  });

  test('resolves specs from the friendly icon when combatantinfo has no specID', async () => {
    const frostMage = findRetailSpec('Mage', 'Frost');
    fetchCombatantsMock.mockResolvedValueOnce(asCombatants([{ sourceID: 2, specID: -1 }]));
    const report = makeReport({
      friendlies: [{ id: 2, name: 'Icy', guid: 'g2', type: 'Mage', icon: 'Mage-Frost' }],
    });

    const players = await derivePlayers(report, makeFight());

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      id: 2,
      specID: frostMage.id,
      className: 'Mage',
    });
  });

  test('keeps players that have neither a specID nor a matchable icon', async () => {
    fetchCombatantsMock.mockResolvedValueOnce(asCombatants([{ sourceID: 3, specID: -1 }]));
    const report = makeReport({
      friendlies: [{ id: 3, name: 'Mystery', guid: 'g3', type: 'Warrior', icon: 'Warrior' }],
    });

    const players = await derivePlayers(report, makeFight());

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      id: 3,
      specID: 0,
      className: 'Warrior',
      specName: undefined,
    });
  });

  test('falls back to the previous fight using normalized encounter ids in classic', async () => {
    // 重新击杀的 BOSS 编号被 WCL 加上 50000 偏移；prev-fight 回退必须归一化后比对。
    // 回归测试：未归一化的旧实现对重复击杀永远匹配不上，名单会静默变空。
    fetchCombatantsMock
      .mockResolvedValueOnce(asCombatants([]))
      .mockResolvedValueOnce(asCombatants([{ sourceID: 7, specID: -1 }]));
    const report = makeReport({
      gameVersion: 6,
      friendlies: [{ id: 7, name: 'Retro', guid: 'g7', type: 'Warrior', icon: 'Warrior-Fury' }],
      fights: [
        { id: 41, boss: 0, originalBoss: 1193, start_time: 0, end_time: 10 } as WCLFight,
        makeFight({ id: 42, boss: 1193 + 50000, originalBoss: 1193 }),
      ],
    });

    const players = await derivePlayers(report, makeFight({ id: 42, boss: 1193 + 50000 }));

    expect(fetchCombatantsMock).toHaveBeenCalledTimes(2);
    expect(fetchCombatantsMock).toHaveBeenLastCalledWith('ABC123', 0, 10);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: 7, name: 'Retro' });
  });

  test('does not fetch the previous fight when the boss ids do not match', async () => {
    fetchCombatantsMock.mockResolvedValueOnce(asCombatants([]));
    const report = makeReport({
      gameVersion: 6,
      fights: [
        { id: 41, boss: 0, originalBoss: 1194, start_time: 0, end_time: 10 } as WCLFight,
        makeFight({ id: 42, boss: 1193 + 50000, originalBoss: 1193 }),
      ],
    });

    await derivePlayers(report, makeFight({ id: 42, boss: 1193 + 50000 }));

    expect(fetchCombatantsMock).toHaveBeenCalledTimes(1);
  });
});
