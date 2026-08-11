import { describe, expect, it } from 'vitest';

import { buildLearningPlan } from '../runtime/learning';
import { getDungeonDocument } from '../registry';
import { validateDungeonDocument } from '../schema/validate';
import { rubyLifePoolsPhase1Draft } from './phase1Prototypes';
import { rubyLifePoolsSpatialPreview } from './rlpSpatialPreview';

describe('phase 1 learning prototypes', () => {
  it('keeps RLP content useful before spatial facts are verified', () => {
    expect(rubyLifePoolsPhase1Draft.dataStatus).toBe('draft');
    expect(rubyLifePoolsPhase1Draft.spatialStatus).toBe('pending');
    expect(rubyLifePoolsPhase1Draft.situations).toHaveLength(7);
    expect(rubyLifePoolsPhase1Draft.bosses).toHaveLength(3);
    expect(rubyLifePoolsPhase1Draft.spawns).toHaveLength(0);

    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'quick')).toHaveLength(6);
    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'overview')).toHaveLength(7);
    expect(buildLearningPlan(rubyLifePoolsPhase1Draft, 'full')).toHaveLength(7);
    expect(rubyLifePoolsPhase1Draft.abilities.map((ability) => ability.id)).toEqual(
      expect.arrayContaining([
        'rlp-ability-frigid-shard',
        'rlp-ability-molten-boulder',
        'rlp-ability-searing-blows',
        'rlp-ability-inferno-spit',
        'rlp-ability-winds',
      ]),
    );
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
    expect(getDungeonDocument('ruby-life-pools')).toBe(rubyLifePoolsSpatialPreview);
  });

  it('adds only a source-plane spatial overlay to the local preview', () => {
    expect(rubyLifePoolsSpatialPreview.spatialStatus).toBe('pending');
    expect(rubyLifePoolsSpatialPreview.spawns).toHaveLength(166);
    expect(rubyLifePoolsSpatialPreview.floors[0]).toMatchObject({
      id: 'rlp-source-plane',
      mapAssetKey: 'midnight-s2:ruby-life-pools',
    });
    expect(rubyLifePoolsSpatialPreview.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rlp-melidrussa', spawnIds: ['spawn-79'] }),
        expect.objectContaining({
          id: 'rlp-source-enemy-187969',
          forcesStatus: 'pending',
          spawnIds: expect.arrayContaining(['spawn-3']),
        }),
      ]),
    );
    expect(
      rubyLifePoolsSpatialPreview.situations.find(
        (situation) => situation.id === 'rlp-situation-kokia-boss',
      )?.anchorSpawnIds,
    ).toEqual(['spawn-127']);
  });
});
