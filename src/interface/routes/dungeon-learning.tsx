import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';

import {
  buildLearningPlan,
  createAssetProviderFromEnv,
  DungeonMap,
  getDueLessons,
  getDungeonCatalogEntry,
  getDungeonDocument,
  getDungeonScopedLearningAccess,
  getLearningProgressSummary,
  getLessonSharePath,
  getLessonRecallRecord,
  getRoleText,
  getWeakLessons,
  isAllowedProvenanceUrl,
  readLearningProgress,
  recordRecall,
  writeLearningProgress,
} from '../../dungeon';
import type {
  DungeonDocument,
  LearningLesson,
  LearningMode,
  LearningWaveContext,
  RecallConfidence,
  Role,
} from '../../dungeon';

import { DungeonSpellIcon, NpcPortrait } from './dungeonReference';

import './dungeon-learning.scss';
import './dungeons.scss';

const modeOrder: LearningMode[] = ['quick', 'overview', 'full'];
const roleOrder: Role[] = ['tank', 'healer', 'dps'];
const validModes = new Set<LearningMode>(['quick', 'overview', 'full']);
const validRoles = new Set<Role>(['tank', 'healer', 'dps']);

function modeLabel(mode: LearningMode): string {
  switch (mode) {
    case 'quick':
      return t({ id: 'dungeon.learning.mode.quick', message: '60 秒复习' });
    case 'overview':
      return t({ id: 'dungeon.learning.mode.overview', message: '5 分钟速览' });
    default:
      return t({ id: 'dungeon.learning.mode.full', message: '完整学习' });
  }
}

function modeDetail(mode: LearningMode): string {
  switch (mode) {
    case 'quick':
      return t({ id: 'dungeon.learning.modeDetail.quick', message: '只看 Critical 与 Boss' });
    case 'overview':
      return t({
        id: 'dungeon.learning.modeDetail.overview',
        message: '建立路线和危险全貌',
      });
    default:
      return t({ id: 'dungeon.learning.modeDetail.full', message: '逐个场景理解因果' });
  }
}

function roleLabel(role: Role): string {
  switch (role) {
    case 'tank':
      return t({ id: 'dungeon.learning.role.tank', message: '坦克' });
    case 'healer':
      return t({ id: 'dungeon.learning.role.healer', message: '治疗' });
    default:
      return t({ id: 'dungeon.learning.role.dps', message: '输出' });
  }
}

function confidenceLabel(confidence: RecallConfidence): string {
  switch (confidence) {
    case 'ready':
      return t({ id: 'dungeon.learning.confidence.ready', message: '我能处理' });
    case 'fuzzy':
      return t({ id: 'dungeon.learning.confidence.fuzzy', message: '有点模糊' });
    default:
      return t({ id: 'dungeon.learning.confidence.unknown', message: '还不会' });
  }
}

const parseMode = (value: string | null): LearningMode =>
  value && validModes.has(value as LearningMode) ? (value as LearningMode) : 'quick';
const parseRole = (value: string | null): Role =>
  value && validRoles.has(value as Role) ? (value as Role) : 'dps';

function updateSearch(
  searchParams: URLSearchParams,
  updates: Partial<{ mode: LearningMode; situation: string; role: Role; review: 'weak' | null }>,
): string {
  const next = new URLSearchParams(searchParams);
  Object.entries(updates).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });
  return `?${next.toString()}`;
}

const isWeakReview = (searchParams: URLSearchParams) => searchParams.get('review') === 'weak';

function LearningNotFound() {
  return (
    <>
      <DocumentTitle title={t({ id: 'dungeon.learning.notFoundTitle', message: '副本不存在' })} />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-learning-shell">
        <section className="dungeon-learning-panel dungeon-learning-panel--error">
          <h1>{t({ id: 'dungeon.learning.notFoundHeading', message: '找不到这个副本' })}</h1>
          <p>
            {t({
              id: 'dungeon.learning.notFoundDetail',
              message: '这个学习入口尚未注册，或者链接已经过期。',
            })}
          </p>
          <Link to="/dungeons">
            {t({ id: 'dungeon.common.backToList', message: '返回副本列表' })}
          </Link>
        </section>
      </main>
    </>
  );
}

function LearningUnavailable({
  dungeonId,
  title = t({
    id: 'dungeon.learning.unavailableTitle',
    message: '学习内容待审校',
  }),
  detail = t({
    id: 'dungeon.learning.unavailableDetail',
    message: '当前链接指向开发契约 fixture，不提供可学习的正式攻略内容。',
  }),
}: {
  dungeonId: string;
  title?: string;
  detail?: string;
}) {
  return (
    <>
      <DocumentTitle title={title} />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-learning-shell">
        <section className="dungeon-learning-panel dungeon-learning-panel--error">
          <h1>{title}</h1>
          <p>{detail}</p>
          <Link to={`/dungeons/${dungeonId}?view=inspector`}>
            {t({ id: 'dungeon.common.openInspector', message: '打开 Inspector' })}
          </Link>
        </section>
      </main>
    </>
  );
}

function LearningReviewEmpty({ dungeonId, mode }: { dungeonId: string; mode: LearningMode }) {
  return (
    <>
      <DocumentTitle title={t({ id: 'dungeon.learning.reviewEmptyTitle', message: '薄弱项已清空' })} />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-learning-shell">
        <section className="dungeon-learning-panel dungeon-learning-panel--error learning-review-empty">
          <span className="learning-panel-kicker">WEAK REVIEW</span>
          <h1>
            {t({
              id: 'dungeon.learning.reviewEmptyHeading',
              message: '当前模式没有待复习薄弱项',
            })}
          </h1>
          <p>
            {t({
              id: 'dungeon.learning.reviewEmptyDetail',
              message:
                '你已经把当前范围的场景回忆为“我能处理”。可以继续完整学习，或等待内容变更后重新复习。',
            })}
          </p>
          <div className="learning-review-empty__actions">
            <Link to={`/dungeons/${dungeonId}/learn?mode=${mode}`}>
              {t({ id: 'dungeon.learning.backToMode', message: '返回当前模式' })}
            </Link>
            <Link to={`/dungeons/${dungeonId}/learn?mode=full`}>
              {t({ id: 'dungeon.learning.openFullLearning', message: '打开完整学习' })}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function ConfidenceButton({
  confidence,
  selected,
  onClick,
}: {
  confidence: RecallConfidence;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`learning-confidence learning-confidence--${confidence} ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      {confidenceLabel(confidence)}
    </button>
  );
}

function LearningWaveContextCard({
  documentId,
  context,
}: {
  documentId: string;
  context: LearningWaveContext;
}) {
  const enemyNames = context.enemies.map((enemy) => enemy.name.zhCN).join('、');
  const locationLabel =
    context.anchorSpawnIds.length > 0
      ? t({
          id: 'dungeon.learning.anchorCount',
          message: `${context.anchorSpawnIds.length} 个位置参考锚点`,
        })
      : t({ id: 'dungeon.learning.anchorPending', message: '位置参考待接入' });
  const forceLabel = context.hasVerifiedForces
    ? t({
        id: 'dungeon.learning.forcesValue',
        message: `${context.forcesPoints} forces`,
      })
    : t({ id: 'dungeon.learning.forcesPending', message: 'forces 待核验' });

  return (
    <article className="learning-wave-context">
      <div className="learning-wave-context__header">
        <div>
          <span className="learning-panel-kicker">
            {t({
              id: 'dungeon.learning.routeNodeKicker',
              message: `路线节点 P${context.step.order}`,
            })}
          </span>
          <strong>{context.step.title.zhCN}</strong>
        </div>
        <span
          className={`learning-wave-context__status${context.hasCompletePull ? ' is-complete' : ''}`}
        >
          {context.hasCompletePull
            ? t({ id: 'dungeon.learning.waveComplete', message: '完整波次' })
            : t({ id: 'dungeon.learning.waveAnchor', message: '学习锚点' })}
        </span>
      </div>
      <p>{context.step.rationale.zhCN}</p>
      <dl className="learning-wave-context__facts">
        <div>
          <dt>{t({ id: 'dungeon.learning.factEnemies', message: '怪物上下文' })}</dt>
          <dd>
            {enemyNames ||
              t({ id: 'dungeon.learning.monstersPending', message: '完整怪物组成待核验' })}
          </dd>
        </div>
        <div>
          <dt>{t({ id: 'dungeon.learning.factSpatial', message: '空间' })}</dt>
          <dd>{locationLabel}</dd>
        </div>
        <div>
          <dt>{t({ id: 'dungeon.learning.factForces', message: '力量' })}</dt>
          <dd>{forceLabel}</dd>
        </div>
      </dl>
      <Link
        className="learning-wave-context__route-link"
        to={`/dungeons/${encodeURIComponent(documentId)}/route/${encodeURIComponent(context.route.id)}`}
      >
        {t({ id: 'dungeon.learning.openRouteNode', message: '打开只读路线节点 →' })}
      </Link>
    </article>
  );
}

/** 当前场景的只读空间上下文：渲染该场景锚点所在楼层，并高亮全部位置锚点。 */
function LearningSpatialPanel({
  document,
  lesson,
  assetProvider,
}: {
  document: DungeonDocument;
  lesson: LearningLesson;
  assetProvider: ReturnType<typeof createAssetProviderFromEnv>;
}) {
  const anchorFloorId = useMemo(
    () =>
      lesson.waveContexts[0]?.step.floorId ??
      lesson.situation.floorIds[0] ??
      document.floors[0]?.id,
    [document, lesson],
  );
  const floor = document.floors.find((candidate) => candidate.id === anchorFloorId);
  const floorSpawns = useMemo(
    () => (floor ? document.spawns.filter((spawn) => spawn.floorId === floor.id) : []),
    [document, floor],
  );
  const anchorSpawnIds = useMemo(
    () =>
      [...new Set([
        ...lesson.situation.anchorSpawnIds,
        ...lesson.waveContexts.flatMap((wave) => wave.anchorSpawnIds),
      ])].filter((spawnId) => floorSpawns.some((spawn) => spawn.id === spawnId)),
    [floorSpawns, lesson],
  );
  const anchorSpawns = useMemo(
    () => floorSpawns.filter((spawn) => anchorSpawnIds.includes(spawn.id)),
    [anchorSpawnIds, floorSpawns],
  );
  if (!floor) return null;
  return (
    <div className="learning-spatial">
      <div className="learning-section-heading">
        <span className="learning-panel-kicker">SPATIAL CONTEXT</span>
        <h3>{t({ id: 'dungeon.learning.spatialHeading', message: '这一节的位置上下文' })}</h3>
      </div>
      <p className="learning-route-context__intro">
        {t({
          id: 'dungeon.learning.spatialHint',
          message: '位置锚点用于确认上下文；完整 Pull 与 forces 结论以路线节点为准。',
        })}
      </p>
      <div className="learning-spatial__floor">
        {t({ id: 'dungeon.learning.spatialFloor', message: `楼层 · ${floor.name.zhCN}` })}
      </div>
      <div className="learning-spatial__map">
        <DungeonMap
          abilities={document.abilities}
          asset={assetProvider.getFloorMap(floor.mapAssetKey ?? '')}
          enemies={document.enemies}
          floor={floor}
          hullSpawns={anchorSpawns.length > 0 ? anchorSpawns : floorSpawns}
          selectedSpawnIds={anchorSpawnIds}
          spawns={floorSpawns}
        />
      </div>
    </div>
  );
}

export function Component() {
  const { dungeonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const entry = dungeonId ? getDungeonCatalogEntry(dungeonId) : undefined;
  const learningAccess = entry ? getDungeonScopedLearningAccess(entry, document) : undefined;
  const [progress, setProgress] = useState(() => readLearningProgress());
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const mode = parseMode(searchParams.get('mode'));
  const weakReview = isWeakReview(searchParams);
  const role = parseRole(searchParams.get('role') ?? progress.lastRole ?? null);
  // basePlan 只依赖 document+mode，每次打点(progress 变化)不必重建整个计划；
  // weakReview 过滤才依赖 progress。
  const basePlan = useMemo(
    () => (document ? buildLearningPlan(document, mode) : []),
    [document, mode],
  );
  const plan = useMemo(
    () => (weakReview && document ? getWeakLessons(basePlan, progress, document.id) : basePlan),
    [basePlan, progress, weakReview, document],
  );
  const requestedSituation = searchParams.get('situation');
  const foundIndex = plan.findIndex((lesson) => lesson.situation.id === requestedSituation);
  const currentIndex = foundIndex < 0 ? 0 : foundIndex;
  const lesson = plan[currentIndex];
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    if (document && lesson && requestedSituation !== lesson.situation.id) {
      navigate(
        { search: updateSearch(searchParams, { situation: lesson.situation.id }) },
        { replace: true },
      );
    }
  }, [document, lesson, navigate, requestedSituation, searchParams]);

  if (!dungeonId) return <LearningNotFound />;
  if (!entry) {
    return (
      <LearningUnavailable
        dungeonId={dungeonId}
        title={t({ id: 'dungeon.learning.notRegisteredTitle', message: '副本尚未登记' })}
        detail={t({
          id: 'dungeon.learning.notRegisteredDetail',
          message: '该 DungeonDocument 没有对应的 S2 目录门禁，不能通过深链打开学习页。',
        })}
      />
    );
  }
  if (!document) {
    return (
      <LearningUnavailable
        dungeonId={entry.id}
        title={t({ id: 'dungeon.learning.notIntegratedTitle', message: '攻略尚未接入' })}
        detail={t({
          id: 'dungeon.learning.notIntegratedDetail',
          message: '该副本已有目录或位置参考，但尚未登记可学习的 DungeonDocument。',
        })}
      />
    );
  }
  if (!learningAccess) {
    return (
      <LearningUnavailable
        dungeonId={document.id}
        title={t({ id: 'dungeon.learning.noAccessTitle', message: '学习入口不可用' })}
        detail={t({
          id: 'dungeon.learning.noAccessDetail',
          message: '未能建立副本内容门禁，已按 fail-closed 处理。',
        })}
      />
    );
  }
  if (!learningAccess.canOpen) {
    if (learningAccess.state === 'fixture') {
      return <LearningUnavailable dungeonId={document.id} />;
    }
    return (
      <LearningUnavailable
        dungeonId={document.id}
        title={
          learningAccess.state === 'stale'
            ? t({ id: 'dungeon.learning.staleTitle', message: '学习内容已过期' })
            : learningAccess.label
        }
        detail={learningAccess.reason}
      />
    );
  }
  if (!lesson) {
    if (weakReview) return <LearningReviewEmpty dungeonId={document.id} mode={mode} />;
    return (
      <>
        <DocumentTitle
          title={t({
            id: 'dungeon.learning.emptyModeTitle',
            message: `${document.name.zhCN} · 学习内容`,
          })}
        />
        <NavigationBar style={{ margin: 0, position: 'static' }} />
        <main className="dungeon-learning-shell">
          <section className="dungeon-learning-panel dungeon-learning-panel--error">
            <h1>{t({ id: 'dungeon.learning.emptyModeHeading', message: '该模式暂无学习内容' })}</h1>
            <p>
              {t({
                id: 'dungeon.learning.emptyModeDetail',
                message: '当前副本还没有完成该模式所需的内容。',
              })}
            </p>
            <Link to={`/dungeons/${document.id}?view=inspector`}>
              {t({ id: 'dungeon.boss.backToInspector', message: '返回 Inspector →' })}
            </Link>
          </section>
        </main>
      </>
    );
  }

  const record = getLessonRecallRecord(progress, document.id, lesson);
  const dueLessons = getDueLessons(plan, progress, document.id);
  const { completedCount, fuzzyCount, unknownCount, weakCount } = getLearningProgressSummary(
    plan,
    progress,
    document.id,
  );
  const updateProgress = (nextProgress: typeof progress) => {
    setProgress(nextProgress);
    setStorageWarning(!writeLearningProgress(nextProgress));
  };
  const go = (
    updates: Partial<{ mode: LearningMode; situation: string; role: Role; review: 'weak' | null }>,
  ) => navigate({ search: updateSearch(searchParams, updates) }, { replace: true });
  const moveLesson = (direction: -1 | 1) => {
    const target = plan[currentIndex + direction];
    if (target) go({ situation: target.situation.id });
  };
  const onConfidence = (confidence: RecallConfidence) =>
    updateProgress(
      recordRecall(
        progress,
        document.id,
        lesson.situation.id,
        confidence,
        false,
        lesson.fingerprint,
      ),
    );
  const onReveal = () =>
    record?.confidence &&
    updateProgress(
      recordRecall(
        progress,
        document.id,
        lesson.situation.id,
        record.confidence,
        true,
        lesson.fingerprint,
      ),
    );
  const onRoleChange = (nextRole: Role) => {
    go({ role: nextRole });
    updateProgress({ ...progress, lastRole: nextRole });
  };

  return (
    <>
      <DocumentTitle
        title={t({
          id: 'dungeon.learning.pageTitle',
          message: `${document.name.zhCN} · 大秘境学习`,
        })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
        <span className="learning-nav-separator">/</span>
        <span>{document.name.zhCN}</span>
      </NavigationBar>
      <main className="dungeon-learning-shell">
        <div className="dungeon-learning-breadcrumb">
          <Link to={`/dungeons/${document.id}?view=inspector`}>Inspector</Link>
          <span>/</span>
          {t({ id: 'dungeon.learning.breadcrumbMode', message: '学习模式' })}
        </div>
        {learningAccess?.state === 'preview' && (
          <div className="learning-fixture-notice">
            {t({
              id: 'dungeon.learning.fixtureNotice',
              message: '内容草稿：以下内容用于验证学习交互和来源链路，不代表已审校的正式 S2 攻略。',
            })}
          </div>
        )}
        {storageWarning && (
          <div className="learning-storage-notice" role="status">
            {t({
              id: 'dungeon.learning.storageWarning',
              message: '当前浏览器未能保存复习进度；本次页面内仍可继续学习，但刷新后可能丢失记录。',
            })}
          </div>
        )}
        <header className="learning-hero">
          <div>
            <span className="learning-kicker">
              LEARNING COMPANION · {document.season.toUpperCase()}
            </span>
            <h1>{document.name.zhCN}</h1>
            <p>
              {weakReview
                ? t({
                    id: 'dungeon.learning.heroWeakReview',
                    message: '这次只复习尚未稳定回忆的场景；完成后再回到路线确认空间位置。',
                  })
                : t({
                    id: 'dungeon.learning.heroFull',
                    message: '先记住危险和动作，再回到路线确认空间位置。页面不会要求你编辑路线。',
                  })}
            </p>
            <div
              className="learning-hero__sources"
              aria-label={t({ id: 'dungeon.learning.sourcesLabel', message: '内容来源' })}
            >
              <span>
                {t({
                  id: 'dungeon.learning.sourceVersion',
                  message: `来源版本 · ${document.version.build}`,
                })}
              </span>
              {document.provenance
                .filter((source) => source.url && isAllowedProvenanceUrl(source.url))
                .slice(0, 3)
                .map((source) => (
                  <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.title}
                  </a>
                ))}
            </div>
          </div>
          <div className="learning-hero__progress">
            <span>
              {weakReview
                ? t({ id: 'dungeon.learning.weakReviewLabel', message: '薄弱项复习' })
                : t({ id: 'dungeon.learning.sessionLabel', message: '本次学习' })}
            </span>
            <strong>
              {completedCount}/{plan.length}
            </strong>
            <small>
              {weakCount > 0
                ? t({
                    id: 'dungeon.learning.pendingWeakLabel',
                    message: `${weakCount} 个待复习`,
                  })
                : t({ id: 'dungeon.learning.allRecalledLabel', message: '场景已完成回忆' })}
            </small>
          </div>
        </header>
        <div
          className="learning-mode-bar"
          role="tablist"
          aria-label={t({ id: 'dungeon.learning.modeBarLabel', message: '学习时长' })}
        >
          {modeOrder.map((item) => (
            <button
              type="button"
              role="tab"
              id={`learning-mode-tab-${item}`}
              aria-selected={item === mode}
              aria-controls="learning-lesson-panel"
              className={item === mode ? 'is-active' : undefined}
              key={item}
              onClick={() => go({ mode: item, review: null, situation: plan[0]?.situation.id })}
            >
              <strong>{modeLabel(item)}</strong>
              <span>{modeDetail(item)}</span>
            </button>
          ))}
        </div>
        <div className="learning-layout">
          <aside className="dungeon-learning-panel learning-outline">
            <div className="learning-panel-kicker">CHAPTERS</div>
            <h2>{t({ id: 'dungeon.learning.outlineHeading', message: '学习章节' })}</h2>
            <ol>
              {plan.map((item, index) => {
                const itemRecord = getLessonRecallRecord(progress, document.id, item);
                return (
                  <li key={item.situation.id}>
                    <button
                      type="button"
                      className={index === currentIndex ? 'is-active' : undefined}
                      aria-current={index === currentIndex ? 'step' : undefined}
                      onClick={() => go({ situation: item.situation.id })}
                    >
                      <span className="learning-outline__index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <strong>{item.situation.title.zhCN}</strong>
                        <small>
                          {itemRecord?.revealed
                            ? t({ id: 'dungeon.learning.recalledLabel', message: '已回忆' })
                            : item.situation.kind === 'boss'
                              ? t({ id: 'dungeon.learning.kindBoss', message: 'Boss' })
                              : t({ id: 'dungeon.learning.kindCritical', message: '关键场景' })}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Link
              className="learning-outline__reference"
              to={`/dungeons/${document.id}?view=inspector`}
            >
              {t({ id: 'dungeon.learning.viewObjects', message: '查看对象与坐标 →' })}
            </Link>
            {weakReview ? (
              <button
                className="learning-outline__review-link"
                type="button"
                onClick={() => go({ review: null, situation: plan[0]?.situation.id })}
              >
                {t({ id: 'dungeon.learning.backToAll', message: '回到全部章节 →' })}
              </button>
            ) : (
              <button
                className="learning-outline__review-link"
                type="button"
                onClick={() => go({ review: 'weak', situation: undefined })}
              >
                {t({ id: 'dungeon.learning.reviewWeakLink', message: '只复习薄弱项 →' })}
              </button>
            )}
          </aside>
          <section
            className="dungeon-learning-panel learning-lesson"
            id="learning-lesson-panel"
            role="tabpanel"
            aria-labelledby={`learning-mode-tab-${mode}`}
          >
            <div className="learning-lesson__live" aria-live="polite">
              <div className="learning-lesson__meta">
                <span className={`learning-kind learning-kind--${lesson.situation.kind}`}>
                  {lesson.situation.kind === 'boss'
                    ? 'BOSS'
                    : lesson.situation.kind.toUpperCase()}
                </span>
                <span>
                  {t({
                    id: 'dungeon.learning.scenarioPosition',
                    message: `场景 ${currentIndex + 1} / ${plan.length}`,
                  })}
                </span>
              </div>
              <h2>{lesson.situation.title.zhCN}</h2>
              <p className="learning-lesson__summary">{lesson.situation.summary.zhCN}</p>
              {lesson.situation.memoryCue && (
                <div className="learning-memory-cue">
                  <span>{t({ id: 'dungeon.learning.memoryCueLabel', message: '今晚先记住' })}</span>
                  <strong>{lesson.situation.memoryCue.zhCN}</strong>
                </div>
              )}
              <div className="learning-section-heading">
                <span className="learning-panel-kicker">WHAT TO DO</span>
                <h3>
                  {t({
                    id: 'dungeon.learning.whatToDoHeading',
                    message: '看到这些技能时，你要做什么',
                  })}
                </h3>
              </div>
              <div className="learning-ability-list">
                {lesson.abilities.map((ability) => {
                  const roleText = getRoleText(role, lesson.situation, ability);
                  return (
                    <article className="learning-ability" key={ability.id}>
                      <div
                        className={`learning-ability__severity learning-ability__severity--${ability.severity}`}
                        aria-label={ability.severity}
                      />
                      <div className="learning-ability__body">
                        <div className="learning-ability__title">
                          <DungeonSpellIcon spellId={ability.spellId} />
                          <div>
                            <h4>{ability.name.zhCN}</h4>
                            <span>
                              Spell{' '}
                              {ability.spellId ??
                                t({ id: 'dungeon.learning.spellPending', message: '待核验' })}
                            </span>
                          </div>
                        </div>
                        {ability.casterEnemyIds.length > 0 && (
                          <div className="learning-ability__casters">
                            <span>{t({ id: 'dungeon.learning.castersLabel', message: '施放者' })}</span>
                            {ability.casterEnemyIds.map((enemyId) => {
                              const caster = document.enemies.find(
                                (enemy) => enemy.id === enemyId,
                              );
                              return caster ? (
                                <span className="learning-ability__caster" key={enemyId}>
                                  <NpcPortrait
                                    npcId={caster.npcId}
                                    name={caster.name.zhCN}
                                    size={18}
                                  />
                                  {caster.name.zhCN}
                                </span>
                              ) : (
                                <span className="learning-ability__caster" key={enemyId}>
                                  {enemyId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="learning-action-row">
                          <strong>{t({ id: 'dungeon.learning.actionLabel', message: '动作' })}</strong>
                          <p>{ability.action.zhCN}</p>
                        </div>
                        <div className="learning-action-row learning-action-row--consequence">
                          <strong>{t({ id: 'dungeon.learning.consequenceLabel', message: '后果' })}</strong>
                          <p>{ability.consequence.zhCN}</p>
                        </div>
                        {roleText && (
                          <div className="learning-role-advice">
                            <span>
                              {t({
                                id: 'dungeon.learning.roleView',
                                message: `${roleLabel(role)}视角`,
                              })}
                            </span>
                            {roleText}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {(lesson.waveContexts.length > 0 || lesson.situation.anchorSpawnIds.length > 0) && (
                <LearningSpatialPanel
                  assetProvider={assetProvider}
                  document={document}
                  lesson={lesson}
                />
              )}
              {lesson.waveContexts.length > 0 && (
                <div className="learning-route-context">
                  <div className="learning-section-heading">
                    <span className="learning-panel-kicker">ROUTE CONTEXT</span>
                    <h3>
                      {t({
                        id: 'dungeon.learning.waveHeading',
                        message: '这一节对应哪些波次',
                      })}
                    </h3>
                  </div>
                  <p className="learning-route-context__intro">
                    {t({
                      id: 'dungeon.learning.waveIntro',
                      message:
                        '先用动作理解这波的风险，再用位置锚点确认上下文；位置锚点不等于完整 Pull 或 forces 结论。',
                    })}
                  </p>
                  {lesson.waveContexts.map((context) => (
                    <LearningWaveContextCard
                      context={context}
                      documentId={document.id}
                      key={context.step.id}
                    />
                  ))}
                </div>
              )}
              <div className="learning-recall">
                <div className="learning-section-heading">
                  <span className="learning-panel-kicker">RECALL</span>
                  <h3>
                    {t({
                      id: 'dungeon.learning.recallHeading',
                      message: '合上页面，你会怎么处理？',
                    })}
                  </h3>
                </div>
                <p>
                  {t({
                    id: 'dungeon.learning.recallIntro',
                    message: '先选择你的把握程度，再揭示参考答案。结果只保存在当前浏览器。',
                  })}
                </p>
                <div className="learning-confidence-row">
                  <ConfidenceButton
                    confidence="ready"
                    selected={record?.confidence === 'ready'}
                    onClick={() => onConfidence('ready')}
                  />
                  <ConfidenceButton
                    confidence="fuzzy"
                    selected={record?.confidence === 'fuzzy'}
                    onClick={() => onConfidence('fuzzy')}
                  />
                  <ConfidenceButton
                    confidence="unknown"
                    selected={record?.confidence === 'unknown'}
                    onClick={() => onConfidence('unknown')}
                  />
                </div>
                {record?.revealed ? (
                  <div className="learning-answer">
                    <strong>{t({ id: 'dungeon.learning.answerLabel', message: '参考答案' })}</strong>
                    <p>
                      {lesson.situation.memoryCue?.zhCN ??
                        lesson.abilities[0]?.action.zhCN ??
                        lesson.situation.summary.zhCN}
                    </p>
                  </div>
                ) : (
                  <button
                    className="learning-reveal"
                    type="button"
                    onClick={onReveal}
                    disabled={!record?.confidence}
                  >
                    {record?.confidence
                      ? t({ id: 'dungeon.learning.revealReady', message: '显示参考答案' })
                      : t({ id: 'dungeon.learning.chooseConfidence', message: '先选择把握程度' })}
                  </button>
                )}
              </div>
            </div>
            <div className="learning-step-navigation">
              <button type="button" onClick={() => moveLesson(-1)} disabled={currentIndex === 0}>
                {t({ id: 'dungeon.learning.prevScenario', message: '← 上一个场景' })}
              </button>
              <Link
                aria-label={t({
                  id: 'dungeon.learning.shareLessonLabel',
                  message: '分享本节学习链接',
                })}
                className="learning-share-link"
                to={getLessonSharePath(document.id, mode, lesson.situation.id, role)}
              >
                {t({ id: 'dungeon.learning.shareLesson', message: '分享本节链接 ↗' })}
              </Link>
              <button
                type="button"
                onClick={() => moveLesson(1)}
                disabled={currentIndex === plan.length - 1}
              >
                {t({ id: 'dungeon.learning.nextScenario', message: '下一个场景 →' })}
              </button>
            </div>
          </section>
          <aside className="dungeon-learning-panel learning-sidebar">
            <div className="learning-panel-kicker">YOUR VIEW</div>
            <h2>{t({ id: 'dungeon.learning.sidebarHeading', message: '我的职责' })}</h2>
            <p>
              {t({
                id: 'dungeon.learning.roleSwitchIntro',
                message: '切换角色只改变建议优先级，不会隐藏团队共同需要处理的机制。',
              })}
            </p>
            <div className="learning-role-switcher">
              {roleOrder.map((item) => (
                <button
                  type="button"
                  aria-pressed={role === item}
                  className={role === item ? 'is-active' : undefined}
                  key={item}
                  onClick={() => onRoleChange(item)}
                >
                  {roleLabel(item)}
                </button>
              ))}
            </div>
            <p className="learning-role-switcher__note">
              {t({
                id: 'dungeon.learning.progressSharedNote',
                message: '回忆进度按场景共享，切换职责不会重置你的复习记录。',
              })}
            </p>
            <div className="learning-sidebar__review">
              <strong>{t({ id: 'dungeon.learning.review3Heading', message: '进本前 3 条复习' })}</strong>
              <div
                className="learning-progress-summary"
                aria-label={t({
                  id: 'dungeon.learning.progressSummaryLabel',
                  message: '学习状态',
                })}
              >
                <span>
                  {t({ id: 'dungeon.learning.countRecalled', message: '已回忆' })} <b>{completedCount}</b>
                </span>
                <span>
                  {t({ id: 'dungeon.learning.countFuzzy', message: '模糊' })} <b>{fuzzyCount}</b>
                </span>
                <span>
                  {t({ id: 'dungeon.learning.countUnknown', message: '不会' })} <b>{unknownCount}</b>
                </span>
              </div>
              {dueLessons.length > 0 ? (
                <ol>
                  {dueLessons.map((dueLesson) => {
                    const recall = getLessonRecallRecord(progress, document.id, dueLesson);
                    return (
                      <li key={dueLesson.situation.id}>
                        <button
                          type="button"
                          onClick={() => go({ situation: dueLesson.situation.id })}
                        >
                          <span>{dueLesson.situation.title.zhCN}</span>
                          <small>
                            {recall?.confidence
                              ? confidenceLabel(recall.confidence)
                              : dueLesson.situation.kind === 'boss'
                                ? t({
                                    id: 'dungeon.learning.bossNotRecall',
                                    message: 'Boss · 尚未回忆',
                                  })
                                : t({
                                    id: 'dungeon.learning.notRecalled',
                                    message: '尚未回忆',
                                  })}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p>
                  {t({
                    id: 'dungeon.learning.dueEmptyDetail',
                    message: '当前模式已完成回忆，下一次复习会在内容变更或 24 小时后出现。',
                  })}
                </p>
              )}
              {!weakReview && weakCount > 0 && (
                <button
                  className="learning-sidebar__weak-link"
                  type="button"
                  onClick={() => go({ review: 'weak', situation: undefined })}
                >
                  {t({
                    id: 'dungeon.learning.weakCountLink',
                    message: `只看 ${weakCount} 个薄弱场景 →`,
                  })}
                </button>
              )}
            </div>
            <div className="learning-sidebar__note">
              <strong>
                {t({
                  id: 'dungeon.learning.roleFirst',
                  message: `${roleLabel(role)}先看什么`,
                })}
              </strong>
              <p>
                {lesson.situation.roleAdvice?.[role]?.zhCN ??
                  t({
                    id: 'dungeon.learning.roleAdviceMissing',
                    message: '先理解场景的共同目标，再确认自己能提供的能力。',
                  })}
              </p>
            </div>
            <div className="learning-sidebar__note">
              <strong>{t({ id: 'dungeon.learning.keyRangeHeading', message: '当前层级假设' })}</strong>
              <p>
                {t({
                  id: 'dungeon.learning.keyRangeSentence',
                  message: `学习路线 ${
                    lesson.route?.keyRange
                      ? `${lesson.route.keyRange.min}–${lesson.route.keyRange.max ?? '∞'}`
                      : t({ id: 'dungeon.learning.keyRangeUnset', message: '未指定' })
                  } 层；不代表所有队伍的唯一解。`,
                })}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
