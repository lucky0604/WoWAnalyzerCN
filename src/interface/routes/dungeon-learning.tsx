import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import {
  buildLearningPlan,
  getDueLessons,
  getDungeonLearningAccess,
  getDungeonDocument,
  getLessonSharePath,
  getLessonRecallRecord,
  getRoleText,
  readLearningProgress,
  recordRecall,
  writeLearningProgress,
} from '../../dungeon';
import type { LearningMode, RecallConfidence, Role } from '../../dungeon';

import './dungeon-learning.scss';

const modeLabels: Record<LearningMode, { label: string; detail: string }> = {
  quick: { label: '60 秒复习', detail: '只看 Critical 与 Boss' },
  overview: { label: '5 分钟速览', detail: '建立路线和危险全貌' },
  full: { label: '完整学习', detail: '逐个场景理解因果' },
};
const roleLabels: Record<Role, string> = { tank: '坦克', healer: '治疗', dps: 'DPS' };
const confidenceLabels: Record<RecallConfidence, string> = {
  ready: '我能处理',
  fuzzy: '有点模糊',
  unknown: '还不会',
};
const validModes = new Set<LearningMode>(['quick', 'overview', 'full']);
const validRoles = new Set<Role>(['tank', 'healer', 'dps']);

const parseMode = (value: string | null): LearningMode =>
  value && validModes.has(value as LearningMode) ? (value as LearningMode) : 'quick';
const parseRole = (value: string | null): Role =>
  value && validRoles.has(value as Role) ? (value as Role) : 'dps';

function updateSearch(
  searchParams: URLSearchParams,
  updates: Partial<{ mode: LearningMode; situation: string; role: Role }>,
): string {
  const next = new URLSearchParams(searchParams);
  Object.entries(updates).forEach(([key, value]) => value && next.set(key, value));
  return `?${next.toString()}`;
}

function LearningNotFound() {
  return (
    <>
      <DocumentTitle title="副本不存在" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-learning-shell">
        <section className="dungeon-learning-panel dungeon-learning-panel--error">
          <h1>找不到这个副本</h1>
          <p>这个学习入口尚未注册，或者链接已经过期。</p>
          <Link to="/dungeons">返回副本列表</Link>
        </section>
      </main>
    </>
  );
}

function LearningUnavailable({
  dungeonId,
  title = '学习内容待审校',
  detail = '当前链接指向开发契约 fixture，不提供可学习的正式攻略内容。',
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
          <Link to={`/dungeons/${dungeonId}`}>打开 Inspector</Link>
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
  const labels: Record<RecallConfidence, string> = {
    ready: '我能处理',
    fuzzy: '有点模糊',
    unknown: '还不会',
  };
  return (
    <button
      aria-pressed={selected}
      className={`learning-confidence learning-confidence--${confidence} ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      {labels[confidence]}
    </button>
  );
}

export function Component() {
  const { dungeonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const learningAccess = document ? getDungeonLearningAccess(document) : undefined;
  const [progress, setProgress] = useState(() => readLearningProgress());
  const mode = parseMode(searchParams.get('mode'));
  const role = parseRole(searchParams.get('role') ?? progress.lastRole ?? null);
  const plan = useMemo(() => (document ? buildLearningPlan(document, mode) : []), [document, mode]);
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

  if (!document || !dungeonId) return <LearningNotFound />;
  if (learningAccess && !learningAccess.canOpen) {
    if (learningAccess.state === 'fixture') {
      return <LearningUnavailable dungeonId={document.id} />;
    }
    return (
      <LearningUnavailable
        dungeonId={document.id}
        title={learningAccess.state === 'stale' ? '学习内容已过期' : learningAccess.label}
        detail={learningAccess.reason}
      />
    );
  }
  if (!lesson) {
    return (
      <>
        <DocumentTitle title={`${document.name.zhCN} · 学习内容`} />
        <NavigationBar style={{ margin: 0, position: 'static' }} />
        <main className="dungeon-learning-shell">
          <section className="dungeon-learning-panel dungeon-learning-panel--error">
            <h1>该模式暂无学习内容</h1>
            <p>当前副本还没有完成该模式所需的内容。</p>
            <Link to={`/dungeons/${document.id}`}>返回 Inspector</Link>
          </section>
        </main>
      </>
    );
  }

  const record = getLessonRecallRecord(progress, document.id, lesson);
  const dueLessons = getDueLessons(plan, progress, document.id);
  const completedCount = plan.filter(
    (item) => getLessonRecallRecord(progress, document.id, item)?.revealed,
  ).length;
  const fuzzyCount = plan.filter(
    (item) => getLessonRecallRecord(progress, document.id, item)?.confidence === 'fuzzy',
  ).length;
  const unknownCount = plan.filter(
    (item) => getLessonRecallRecord(progress, document.id, item)?.confidence === 'unknown',
  ).length;
  const weakCount =
    plan.length -
    plan.filter(
      (item) =>
        getLessonRecallRecord(progress, document.id, item)?.revealed &&
        getLessonRecallRecord(progress, document.id, item)?.confidence === 'ready',
    ).length;
  const updateProgress = (nextProgress: typeof progress) => {
    setProgress(nextProgress);
    setStorageWarning(!writeLearningProgress(nextProgress));
  };
  const go = (updates: Partial<{ mode: LearningMode; situation: string; role: Role }>) =>
    navigate({ search: updateSearch(searchParams, updates) }, { replace: true });
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
      <DocumentTitle title={`${document.name.zhCN} · 大秘境学习`} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">大秘境学习</Link>
        <span className="learning-nav-separator">/</span>
        <span>{document.name.zhCN}</span>
      </NavigationBar>
      <main className="dungeon-learning-shell">
        <div className="dungeon-learning-breadcrumb">
          <Link to={`/dungeons/${document.id}`}>Inspector</Link>
          <span>/</span>学习模式
        </div>
        {learningAccess?.state === 'preview' && (
          <div className="learning-fixture-notice">
            内容草稿：以下内容用于验证学习交互和来源链路，不代表已审校的正式 S2 攻略。
          </div>
        )}
        {storageWarning && (
          <div className="learning-storage-notice" role="status">
            当前浏览器未能保存复习进度；本次页面内仍可继续学习，但刷新后可能丢失记录。
          </div>
        )}
        <header className="learning-hero">
          <div>
            <span className="learning-kicker">
              LEARNING COMPANION · {document.season.toUpperCase()}
            </span>
            <h1>{document.name.zhCN}</h1>
            <p>先记住危险和动作，再回到路线确认空间位置。页面不会要求你编辑路线。</p>
            <div className="learning-hero__sources" aria-label="内容来源">
              <span>来源版本 · {document.version.build}</span>
              {document.provenance
                .filter((source) => source.url)
                .slice(0, 3)
                .map((source) => (
                  <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.title}
                  </a>
                ))}
            </div>
          </div>
          <div className="learning-hero__progress">
            <span>本次学习</span>
            <strong>
              {completedCount}/{plan.length}
            </strong>
            <small>{weakCount > 0 ? `${weakCount} 个待复习` : '场景已完成回忆'}</small>
          </div>
        </header>
        <div className="learning-mode-bar" role="tablist" aria-label="学习时长">
          {(Object.keys(modeLabels) as LearningMode[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item === mode}
              aria-controls="learning-lesson-panel"
              className={item === mode ? 'is-active' : undefined}
              key={item}
              onClick={() => go({ mode: item, situation: plan[0]?.situation.id })}
            >
              <strong>{modeLabels[item].label}</strong>
              <span>{modeLabels[item].detail}</span>
            </button>
          ))}
        </div>
        <div className="learning-layout">
          <aside className="dungeon-learning-panel learning-outline">
            <div className="learning-panel-kicker">CHAPTERS</div>
            <h2>学习章节</h2>
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
                            ? '已回忆'
                            : item.situation.kind === 'boss'
                              ? 'Boss'
                              : '关键场景'}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Link className="learning-outline__reference" to={`/dungeons/${document.id}`}>
              查看对象与坐标 →
            </Link>
          </aside>
          <section
            className="dungeon-learning-panel learning-lesson"
            id="learning-lesson-panel"
            aria-live="polite"
          >
            <div className="learning-lesson__meta">
              <span className={`learning-kind learning-kind--${lesson.situation.kind}`}>
                {lesson.situation.kind === 'boss' ? 'BOSS' : lesson.situation.kind.toUpperCase()}
              </span>
              <span>
                场景 {currentIndex + 1} / {plan.length}
              </span>
            </div>
            <h2>{lesson.situation.title.zhCN}</h2>
            <p className="learning-lesson__summary">{lesson.situation.summary.zhCN}</p>
            {lesson.situation.memoryCue && (
              <div className="learning-memory-cue">
                <span>今晚先记住</span>
                <strong>{lesson.situation.memoryCue.zhCN}</strong>
              </div>
            )}
            <div className="learning-section-heading">
              <span className="learning-panel-kicker">WHAT TO DO</span>
              <h3>看到这些技能时，你要做什么</h3>
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
                        <h4>{ability.name.zhCN}</h4>
                        <span>Spell {ability.spellId ?? '待核验'}</span>
                      </div>
                      <div className="learning-action-row">
                        <strong>动作</strong>
                        <p>{ability.action.zhCN}</p>
                      </div>
                      <div className="learning-action-row learning-action-row--consequence">
                        <strong>后果</strong>
                        <p>{ability.consequence.zhCN}</p>
                      </div>
                      {roleText && (
                        <div className="learning-role-advice">
                          <span>{roleLabels[role]}视角</span>
                          {roleText}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {lesson.routeSteps.length > 0 && (
              <div className="learning-route-context">
                <div className="learning-section-heading">
                  <span className="learning-panel-kicker">ROUTE CONTEXT</span>
                  <h3>这条路线为什么这样组织</h3>
                </div>
                {lesson.routeSteps.map((step) => (
                  <div key={step.id}>
                    <strong>{step.title.zhCN}</strong>
                    <p>{step.rationale.zhCN}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="learning-recall">
              <div className="learning-section-heading">
                <span className="learning-panel-kicker">RECALL</span>
                <h3>合上页面，你会怎么处理？</h3>
              </div>
              <p>先选择你的把握程度，再揭示参考答案。结果只保存在当前浏览器。</p>
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
                  <strong>参考答案</strong>
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
                  {record?.confidence ? '显示参考答案' : '先选择把握程度'}
                </button>
              )}
            </div>
            <div className="learning-step-navigation">
              <button type="button" onClick={() => moveLesson(-1)} disabled={currentIndex === 0}>
                ← 上一个场景
              </button>
              <span>
                {getLessonSharePath(document.id, mode, lesson.situation.id, role).split('?')[1]}
              </span>
              <button
                type="button"
                onClick={() => moveLesson(1)}
                disabled={currentIndex === plan.length - 1}
              >
                下一个场景 →
              </button>
            </div>
          </section>
          <aside className="dungeon-learning-panel learning-sidebar">
            <div className="learning-panel-kicker">YOUR VIEW</div>
            <h2>我的职责</h2>
            <p>切换角色只改变建议优先级，不会隐藏团队共同需要处理的机制。</p>
            <div className="learning-role-switcher">
              {(Object.keys(roleLabels) as Role[]).map((item) => (
                <button
                  type="button"
                  aria-pressed={role === item}
                  className={role === item ? 'is-active' : undefined}
                  key={item}
                  onClick={() => onRoleChange(item)}
                >
                  {roleLabels[item]}
                </button>
              ))}
            </div>
            <div className="learning-sidebar__review">
              <strong>进本前 3 条复习</strong>
              <div className="learning-progress-summary" aria-label="学习状态">
                <span>
                  已回忆 <b>{completedCount}</b>
                </span>
                <span>
                  模糊 <b>{fuzzyCount}</b>
                </span>
                <span>
                  不会 <b>{unknownCount}</b>
                </span>
              </div>
              {dueLessons.length > 0 ? (
                <ol>
                  {dueLessons.map((dueLesson) => (
                    <li key={dueLesson.situation.id}>
                      <button
                        type="button"
                        onClick={() => go({ situation: dueLesson.situation.id })}
                      >
                        <span>{dueLesson.situation.title.zhCN}</span>
                        <small>
                          {getLessonRecallRecord(progress, document.id, dueLesson)?.confidence
                            ? confidenceLabels[
                                getLessonRecallRecord(progress, document.id, dueLesson)!.confidence
                              ]
                            : dueLesson.situation.kind === 'boss'
                              ? 'Boss · 尚未回忆'
                              : '尚未回忆'}
                        </small>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>当前模式已完成回忆，下一次复习会在内容变更或 24 小时后出现。</p>
              )}
            </div>
            <div className="learning-sidebar__note">
              <strong>{roleLabels[role]}先看什么</strong>
              <p>
                {lesson.situation.roleAdvice?.[role]?.zhCN ??
                  '先理解场景的共同目标，再确认自己能提供的能力。'}
              </p>
            </div>
            <div className="learning-sidebar__note">
              <strong>当前层级假设</strong>
              <p>
                学习路线{' '}
                {lesson.route?.keyRange
                  ? `${lesson.route.keyRange.min}–${lesson.route.keyRange.max ?? '∞'}`
                  : '未指定'}{' '}
                层；不代表所有队伍的唯一解。
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
