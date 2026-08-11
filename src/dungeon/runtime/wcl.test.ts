import { describe, expect, it } from 'vitest';

import {
  getPublishedDungeonFromWcl,
  getPublishedDungeonLearningPathFromWcl,
  makeDungeonAnalysisPath,
  matchDungeonFromWcl,
} from './wcl';

describe('WCL dungeon adapter', () => {
  it('matches every S2 catalog entry by its verified WCL encounter identity', () => {
    const expected = [
      ['altar-of-fangs', 12993],
      ['murder-row', 12813],
      ['den-of-nalorakk', 12825],
      ['the-blinding-vale', 12859],
      ['voidscar-arena', 12923],
      ['ruby-life-pools', 112521],
      ['kings-rest', 61762],
      ['temple-of-sethraliss', 61877],
    ] as const;
    expected.forEach(([id, encounterId]) => {
      expect(matchDungeonFromWcl({ reportZone: 55, fightBoss: encounterId })).toMatchObject({
        entry: { id },
        reason: 'encounter-id',
      });
    });
  });

  it('matches PTR encounter identities for local pre-release reports', () => {
    const expected = [
      ['altar-of-fangs', 62993],
      ['murder-row', 62813],
      ['den-of-nalorakk', 62825],
      ['the-blinding-vale', 62859],
      ['voidscar-arena', 62923],
      ['ruby-life-pools', 162521],
      ['kings-rest', 111762],
      ['temple-of-sethraliss', 111877],
    ] as const;
    expected.forEach(([id, encounterId]) => {
      expect(matchDungeonFromWcl({ reportZone: 56, fightBoss: encounterId })).toMatchObject({
        entry: { id },
        reason: 'encounter-id',
      });
    });
  });

  it('does not invent an encounter match when the catalog has no verified ID', () => {
    const match = matchDungeonFromWcl({
      fightBoss: 12811,
      reportTitle: 'A report with a different title',
      fightName: 'Final encounter',
    });
    expect(match).toBeUndefined();
  });

  it('does not fall back to a copied title when an encounter ID is unknown', () => {
    expect(
      matchDungeonFromWcl({
        fightBoss: 999999,
        reportTitle: 'Ruby Life Pools +12',
      }),
    ).toBeUndefined();
  });

  it('supports conservative report-title matching when there is no encounter ID', () => {
    const match = matchDungeonFromWcl({
      reportTitle: 'Ruby Life Pools +12',
      fightName: 'Trash pulls',
    });
    expect(match?.entry.id).toBe('ruby-life-pools');
    expect(match?.reason).toBe('report-title');
  });

  it('does not guess from an unknown report', () => {
    expect(
      matchDungeonFromWcl({ reportTitle: 'A raid report', fightName: 'Trash' }),
    ).toBeUndefined();
  });

  it('does not use a copied dungeon title from a different WCL zone', () => {
    expect(
      matchDungeonFromWcl({
        reportZone: 47,
        reportTitle: 'Ruby Life Pools +12',
        fightName: 'Trash pulls',
      }),
    ).toBeUndefined();
  });

  it('does not let an encounter ID override an explicitly different WCL zone', () => {
    expect(
      matchDungeonFromWcl({
        reportZone: 47,
        fightBoss: 112521,
      }),
    ).toBeUndefined();
  });

  it('does not mix live encounter IDs with a PTR report zone', () => {
    expect(
      matchDungeonFromWcl({
        reportZone: 56,
        fightBoss: 112521,
      }),
    ).toBeUndefined();
  });

  it('rejects a report that mixes live and PTR encounter identities', () => {
    expect(
      matchDungeonFromWcl({
        fightBoss: 112521,
        fightOriginalBoss: 162521,
      }),
    ).toBeUndefined();
  });

  it('rejects reports whose boss and original boss identify different dungeons', () => {
    expect(
      matchDungeonFromWcl({
        reportZone: 55,
        fightBoss: 112521,
        fightOriginalBoss: 12993,
      }),
    ).toBeUndefined();
  });

  it('does not choose the first dungeon from an ambiguous report title', () => {
    expect(
      matchDungeonFromWcl({
        reportZone: 55,
        reportTitle: 'Ruby Life Pools +12 / Altar of Fangs',
      }),
    ).toBeUndefined();
  });

  it('does not expose a learning link while the matched catalog entry is not published', () => {
    expect(
      getPublishedDungeonFromWcl(
        { zone: 0, title: 'Ruby Life Pools +12' },
        { boss: 0, name: 'Trash pulls' },
      ),
    ).toBeUndefined();
  });

  it('keeps the WCL entry intent in a query parameter', () => {
    expect(makeDungeonAnalysisPath({ id: 'ruby-life-pools' })).toBe('/?dungeon=ruby-life-pools');
    expect(makeDungeonAnalysisPath({ id: 'dungeon/with space' })).toBe(
      '/?dungeon=dungeon%2Fwith%20space',
    );
  });

  it('does not produce a report-side learning path for draft content', () => {
    expect(
      getPublishedDungeonLearningPathFromWcl(
        { zone: 0, title: 'Ruby Life Pools +12' },
        { boss: 0, name: 'Trash pulls' },
      ),
    ).toBeUndefined();
  });
});
