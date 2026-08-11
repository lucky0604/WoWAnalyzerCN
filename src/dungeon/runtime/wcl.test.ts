import { describe, expect, it } from 'vitest';

import {
  getPublishedDungeonFromWcl,
  getPublishedDungeonLearningPathFromWcl,
  makeDungeonAnalysisPath,
  matchDungeonFromWcl,
} from './wcl';

describe('WCL dungeon adapter', () => {
  it('does not invent an encounter match when the catalog has no verified ID', () => {
    const match = matchDungeonFromWcl({
      fightBoss: 12811,
      reportTitle: 'A report with a different title',
      fightName: 'Final encounter',
    });
    expect(match).toBeUndefined();
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
