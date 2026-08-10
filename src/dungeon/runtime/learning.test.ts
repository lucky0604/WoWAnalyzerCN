import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { buildLearningPlan, getLessonSharePath, getRoleText } from './learning';

describe('learning plan', () => {
  it('keeps critical and boss situations in quick review', () => {
    const plan = buildLearningPlan(phase0FixtureDocuments.rubyLifePools, 'quick');
    expect(plan.map((lesson) => lesson.situation.id)).toEqual([
      'rlp-situation-infusion-first-pack',
      'rlp-situation-melidrussa-entrance',
    ]);
  });

  it('resolves ability and route context without changing authored data', () => {
    const document = phase0FixtureDocuments.altarOfFangs;
    const plan = buildLearningPlan(document, 'full');
    expect(plan[0]?.abilities.map((ability) => ability.id)).toEqual([
      'altar-ability-venomous-chant',
      'altar-ability-hidden-lunge',
    ]);
    expect(plan[0]?.routeSteps[0]?.id).toBe('altar-route-step-1');
    expect(getRoleText('dps', plan[0]!.situation, plan[0]!.abilities[0]!)).toBeUndefined();
  });

  it('creates a shareable URL with only stable learning state', () => {
    expect(
      getLessonSharePath('ruby-life-pools', 'quick', 'rlp-situation-infusion-first-pack', 'tank'),
    ).toBe(
      '/dungeons/ruby-life-pools/learn?mode=quick&situation=rlp-situation-infusion-first-pack&role=tank',
    );
  });
});
