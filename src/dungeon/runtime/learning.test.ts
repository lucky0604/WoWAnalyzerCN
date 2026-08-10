import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import {
  buildLearningPlan,
  getDueLessons,
  getLearningProgressSummary,
  getLessonSharePath,
  getRoleText,
  getWeakLessons,
} from './learning';
import { emptyLearningProgress, recordRecall } from './progress';

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

  it('invalidates recall when the lesson fingerprint changes and prioritizes weak lessons', () => {
    const document = phase0FixtureDocuments.rubyLifePools;
    const plan = buildLearningPlan(document, 'full');
    let progress = emptyLearningProgress();
    progress = recordRecall(
      progress,
      document.id,
      plan[0]!.situation.id,
      'ready',
      true,
      plan[0]!.fingerprint,
    );
    progress = recordRecall(
      progress,
      document.id,
      plan[1]!.situation.id,
      'unknown',
      true,
      plan[1]!.fingerprint,
    );
    expect(
      getDueLessons(plan, progress, document.id, 1).map((lesson) => lesson.situation.id),
    ).toEqual([plan[1]!.situation.id]);
    expect(
      getDueLessons(
        plan,
        recordRecall(progress, document.id, plan[0]!.situation.id, 'ready', true, 'changed'),
        document.id,
        1,
      )[0]?.situation.id,
    ).toBe(plan[0]!.situation.id);
  });

  it('filters a dedicated weak review without treating revealed ready lessons as weak', () => {
    const document = phase0FixtureDocuments.rubyLifePools;
    const plan = buildLearningPlan(document, 'full');
    let progress = emptyLearningProgress();
    progress = recordRecall(
      progress,
      document.id,
      plan[0]!.situation.id,
      'ready',
      true,
      plan[0]!.fingerprint,
    );
    progress = recordRecall(
      progress,
      document.id,
      plan[1]!.situation.id,
      'fuzzy',
      true,
      plan[1]!.fingerprint,
    );

    const weak = getWeakLessons(plan, progress, document.id);
    expect(weak.map((lesson) => lesson.situation.id)).toEqual(
      expect.arrayContaining(plan.slice(1).map((lesson) => lesson.situation.id)),
    );
    expect(weak).not.toEqual(expect.arrayContaining([plan[0]]));
  });

  it('summarizes only current-fingerprint progress', () => {
    const document = phase0FixtureDocuments.rubyLifePools;
    const plan = buildLearningPlan(document, 'full');
    let progress = emptyLearningProgress();
    progress = recordRecall(
      progress,
      document.id,
      plan[0]!.situation.id,
      'ready',
      true,
      plan[0]!.fingerprint,
    );
    progress = recordRecall(
      progress,
      document.id,
      plan[1]!.situation.id,
      'fuzzy',
      true,
      plan[1]!.fingerprint,
    );
    progress = recordRecall(
      progress,
      document.id,
      'removed-situation',
      'unknown',
      true,
      'stale-fingerprint',
    );

    expect(getLearningProgressSummary(plan, progress, document.id)).toEqual({
      completedCount: 2,
      masteredCount: 1,
      fuzzyCount: 1,
      unknownCount: 0,
      weakCount: plan.length - 1,
    });
  });
});
