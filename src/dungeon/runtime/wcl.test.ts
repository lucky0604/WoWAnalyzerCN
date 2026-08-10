import { describe, expect, it } from 'vitest';

import { getPublishedDungeonFromWcl, matchDungeonFromWcl } from './wcl';

describe('WCL dungeon adapter', () => {
  it('prefers an exact encounter ID over title heuristics', () => {
    const match = matchDungeonFromWcl({
      fightBoss: 12811,
      reportTitle: 'A report with a different title',
      fightName: 'Final encounter',
    });
    expect(match?.entry.id).toBe('magisters-terrace');
    expect(match?.reason).toBe('encounter-id');
  });

  it('supports conservative report-title matching when there is no encounter ID', () => {
    const match = matchDungeonFromWcl({
      reportTitle: 'Maisara Caverns +12',
      fightName: 'Trash pulls',
    });
    expect(match?.entry.id).toBe('maisara-caverns');
    expect(match?.reason).toBe('report-title');
  });

  it('does not guess from an unknown report', () => {
    expect(
      matchDungeonFromWcl({ reportTitle: 'A raid report', fightName: 'Trash' }),
    ).toBeUndefined();
  });

  it('does not expose a learning link while the matched catalog entry is still building', () => {
    expect(
      getPublishedDungeonFromWcl(
        { zone: 0, title: 'Maisara Caverns +12' },
        { boss: 0, name: 'Trash pulls' },
      ),
    ).toBeUndefined();
  });
});
