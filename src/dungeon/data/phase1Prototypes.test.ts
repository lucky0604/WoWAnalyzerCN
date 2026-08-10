import { describe, expect, it } from 'vitest';

import { buildLearningPlan } from '../runtime/learning';
import { getDungeonDocument } from '../registry';
import { validateDungeonDocument } from '../schema/validate';
import { rubyLifePoolsPhase1Draft } from './phase1Prototypes';

describe('phase 1 learning prototypes', () => {
  it('keeps RLP content useful before spatial facts are verified', () => {
    expect(rubyLifePoolsPhase1Draft.dataStatus).toBe('draft');
    expect(rubyLifePoolsPhase1Draft.spatialStatus).toBe('pending');
    expect(rubyLifePoolsPhase1Draft.situations).toHaveLength(5);
    expect(rubyLifePoolsPhase1Draft.bosses).toHaveLength(1);
    expect(rubyLifePoolsPhase1Draft.spawns).toHaveLength(0);

    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'quick')).toHaveLength(4);
    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'overview')).toHaveLength(5);
    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'full')).toHaveLength(5);
  });

  it('reports pending source gates as warnings for drafts, not release-ready facts', () => {
    const result = validateDungeonDocument(rubyLifePoolsPhase1Draft);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'DUNGEON_SPATIAL_DATA_PENDING',
        'DUNGEON_FORCES_SNAPSHOT_PENDING',
        'DUNGEON_PULL_SPAWN_PENDING',
        'DUNGEON_SPELL_ID_PENDING',
      ]),
    );
  });

  it('uses the content draft for the local RLP preview route', () => {
    expect(getDungeonDocument('ruby-life-pools')).toBe(rubyLifePoolsPhase1Draft);
  });
});
