import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import {
  buildLearningPlan,
  getDueLessons,
  getKnowledgeFingerprint,
  getLearningWaveContexts,
  getLearningProgressSummary,
  getLessonSharePath,
  getRoleText,
  getWeakLessons,
} from './learning';
import { emptyLearningProgress, recordRecall } from './progress';
import { rubyLifePoolsSpatialPreview } from '../data/rlpSpatialPreview';

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

  it('exposes source-plane anchors without presenting them as a complete pull', () => {
    const route = rubyLifePoolsSpatialPreview.routes[0]!;
    const situation = rubyLifePoolsSpatialPreview.situations.find(
      (candidate) => candidate.id === 'rlp-situation-first-caster-pack',
    )!;
    const routeSteps = route.steps.flatMap((step) =>
      step.type === 'pull' &&
      step.situationRefs.some(({ situationId }) => situationId === situation.id)
        ? [step]
        : [],
    );
    const contexts = getLearningWaveContexts(rubyLifePoolsSpatialPreview, route, routeSteps);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      anchorSpawnIds: ['spawn-1', 'spawn-2', 'spawn-20', 'spawn-21', 'spawn-22', 'spawn-23'],
      hasCompletePull: false,
      hasVerifiedForces: false,
      forcesPoints: 0,
    });
    expect(contexts[0]?.enemies.map((enemy) => enemy.id)).toEqual([
      'rlp-primal-juggernaut',
      'rlp-flashfrost-chillweaver',
    ]);
  });

  it('invalidates the lesson fingerprint when its wave anchor context changes', () => {
    const document = rubyLifePoolsSpatialPreview;
    const lesson = buildLearningPlan(document, 'quick').find(
      (candidate) => candidate.situation.id === 'rlp-situation-first-caster-pack',
    )!;
    const changedWaveContexts = lesson.waveContexts.map((context) => ({
      ...context,
      anchorSpawnIds: [],
    }));

    expect(
      getKnowledgeFingerprint(
        lesson.situation,
        lesson.abilities,
        lesson.routeSteps,
        changedWaveContexts,
      ),
    ).not.toBe(lesson.fingerprint);
  });

  it('keeps route identity paired when one situation appears in multiple routes', () => {
    const sourceRoute = rubyLifePoolsSpatialPreview.routes[0]!;
    const alternateRoute = {
      ...sourceRoute,
      id: 'rlp-alternate-learning-route',
      name: { zhCN: '备用学习路线', enUS: 'Alternate learning route' },
      steps: sourceRoute.steps.map((step) => ({ ...step, id: `alternate-${step.id}` })),
    };
    const document = {
      ...rubyLifePoolsSpatialPreview,
      routes: [sourceRoute, alternateRoute],
    };
    const lesson = buildLearningPlan(document, 'quick').find(
      (candidate) => candidate.situation.id === 'rlp-situation-first-caster-pack',
    )!;

    expect(lesson.waveContexts.map((context) => context.route.id)).toEqual([
      sourceRoute.id,
      alternateRoute.id,
    ]);
    expect(lesson.waveContexts.map((context) => context.step.id)).toEqual([
      'rlp-phase1-pull-01',
      'alternate-rlp-phase1-pull-01',
    ]);
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
