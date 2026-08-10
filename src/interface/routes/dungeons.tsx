import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';

import {
  dungeonDocuments,
  getDungeonDocument,
  getPullStepForces,
  resolveRoute,
  validateDungeonDocument,
} from '../../dungeon';
import type { DungeonDocument, RouteStep } from '../../dungeon';

import './dungeons.scss';

const statusLabel: Record<DungeonDocument['dataStatus'], string> = {
  fixture: '开发 fixture',
  draft: '草稿',
  reviewed: '已审校',
  published: '已发布',
};

function StatusBadge({ status }: { status: DungeonDocument['dataStatus'] }) {
  return <span className={`dungeon-status dungeon-status-${status}`}>{statusLabel[status]}</span>;
}

function DungeonCard({ document }: { document: DungeonDocument }) {
  return (
    <article className="dungeon-card">
      <div className="dungeon-card__eyebrow">
        <span>Midnight S2</span>
        <StatusBadge status={document.dataStatus} />
      </div>
      <h2>{document.name.zhCN}</h2>
      <p>
        Phase 0 数据合同样本 · {document.situations.length} 个 Situation ·{' '}
        {document.abilities.length} 个技能知识
      </p>
      <div className="dungeon-card__actions">
        <Link className="dungeon-card__action" to={`/dungeons/${document.id}/learn`}>
          开始学习 →
        </Link>
        <Link className="dungeon-card__reference" to={`/dungeons/${document.id}`}>
          打开 Inspector
        </Link>
      </div>
    </article>
  );
}

function StepRow({ document, step }: { document: DungeonDocument; step: RouteStep }) {
  if (step.type === 'pull') {
    const forces = getPullStepForces(document, step);
    return (
      <li className="dungeon-step dungeon-step--pull">
        <div className="dungeon-step__index">{step.order.toString().padStart(2, '0')}</div>
        <div className="dungeon-step__body">
          <strong>{step.title.zhCN}</strong>
          <span>
            {step.spawnIds.length} spawns · {forces} forces
          </span>
          <p>{step.rationale.zhCN}</p>
        </div>
      </li>
    );
  }
  return (
    <li className="dungeon-step dungeon-step--transition">
      <div className="dungeon-step__index">{step.order.toString().padStart(2, '0')}</div>
      <div className="dungeon-step__body">
        <strong>{step.title.zhCN}</strong>
        <span>{step.type === 'transition' ? '楼层/区域过渡' : '事件步骤'}</span>
        <p>{step.type === 'transition' ? step.instruction.zhCN : step.instruction.zhCN}</p>
      </div>
    </li>
  );
}

function DungeonDetail({ document }: { document: DungeonDocument }) {
  const validation = useMemo(() => validateDungeonDocument(document), [document]);
  const route = document.routes[0];
  const resolvedRoute = route ? resolveRoute(document, route) : undefined;

  return (
    <>
      <DocumentTitle title={`${document.name.zhCN} · 大秘境学习`} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">大秘境学习</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to="/dungeons">大秘境学习</Link>
          <span>/</span>
          {document.name.zhCN}
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>Phase 0 Inspector</span>
              <StatusBadge status={document.dataStatus} />
            </div>
            <h1>{document.name.zhCN}</h1>
            <p>这是数据合同和内容引用的可视化检查入口，不是最终的攻略学习页面。</p>
          </div>
          <div className="dungeon-hero__metric">
            <span>验证状态</span>
            <strong className={validation.ok ? 'is-ok' : 'is-error'}>
              {validation.ok ? '通过' : `${validation.errors.length} 个错误`}
            </strong>
            <small>{validation.warnings.length} 个 warning</small>
          </div>
        </header>

        <section className="dungeon-grid dungeon-grid--summary" aria-label="数据摘要">
          <article className="dungeon-panel dungeon-summary-card">
            <span>楼层</span>
            <strong>{document.floors.length}</strong>
            <small>{document.floors.map((floor) => floor.name.zhCN).join('、')}</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>敌人 / Spawn</span>
            <strong>
              {document.enemies.length} / {document.spawns.length}
            </strong>
            <small>forces 总量 {document.totalEnemyForcesPoints}</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>教学知识</span>
            <strong>
              {document.situations.length} / {document.abilities.length}
            </strong>
            <small>Situation / 技能知识</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>学习路线</span>
            <strong>{document.routes.length}</strong>
            <small>{resolvedRoute?.totalForcesPoints ?? 0} forces 覆盖</small>
          </article>
        </section>

        <div className="dungeon-grid dungeon-grid--main">
          <section className="dungeon-panel dungeon-panel--wide">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">LEARNING ANCHORS</span>
                <h2>Situation 场景</h2>
              </div>
              <span className="dungeon-panel__hint">稳定知识身份，不绑定波次编号</span>
            </div>
            <div className="dungeon-situation-list">
              {document.situations.map((situation) => (
                <article className="dungeon-situation" key={situation.id}>
                  <div className="dungeon-situation__marker">
                    {situation.kind === 'boss' ? 'B' : 'S'}
                  </div>
                  <div>
                    <div className="dungeon-situation__title">
                      <h3>{situation.title.zhCN}</h3>
                      <span>{situation.id}</span>
                    </div>
                    <p>{situation.summary.zhCN}</p>
                    <div className="dungeon-chip-row">
                      {situation.focusAbilityIds.map((abilityId) => (
                        <span className="dungeon-chip" key={abilityId}>
                          {document.abilities.find((ability) => ability.id === abilityId)?.name
                            .zhCN ?? abilityId}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dungeon-panel">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">ROUTE CONTEXT</span>
                <h2>只读路线</h2>
              </div>
            </div>
            {route ? (
              <>
                <h3 className="dungeon-route-name">{route.name.zhCN}</h3>
                <ol className="dungeon-step-list">
                  {route.steps.map((step) => (
                    <StepRow document={document} step={step} key={step.id} />
                  ))}
                </ol>
              </>
            ) : (
              <p>暂无路线。</p>
            )}
          </section>
        </div>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">REFERENCE</span>
              <h2>怪物、技能与坐标</h2>
            </div>
            <span className="dungeon-panel__hint">
              Normalized coordinate space · {document.version.build}
            </span>
          </div>
          <div className="dungeon-table-wrap">
            <table className="dungeon-table">
              <thead>
                <tr>
                  <th>敌人</th>
                  <th>技能知识</th>
                  <th>楼层</th>
                  <th>坐标</th>
                  <th>来源 ID</th>
                </tr>
              </thead>
              <tbody>
                {document.spawns.map((spawn) => {
                  const enemy = document.enemies.find(
                    (candidate) => candidate.id === spawn.enemyId,
                  );
                  const floor = document.floors.find((candidate) => candidate.id === spawn.floorId);
                  return (
                    <tr key={spawn.id}>
                      <td>
                        <strong>{enemy?.name.zhCN ?? spawn.enemyId}</strong>
                        <small>{enemy?.npcId}</small>
                      </td>
                      <td>
                        {enemy?.abilityIds
                          .map(
                            (abilityId) =>
                              document.abilities.find((ability) => ability.id === abilityId)?.name
                                .zhCN ?? abilityId,
                          )
                          .join('、')}
                      </td>
                      <td>{floor?.name.zhCN ?? spawn.floorId}</td>
                      <td className="dungeon-coordinate">
                        {spawn.position[0].toFixed(2)}, {spawn.position[1].toFixed(2)}
                      </td>
                      <td>
                        <code>{spawn.sourceId}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {!validation.ok && (
          <section className="dungeon-panel dungeon-panel--error">
            <h2>校验错误</h2>
            <ul>
              {validation.errors.map((error) => (
                <li key={`${error.code}-${error.path}`}>
                  <code>{error.code}</code> {error.path}：{error.message}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId } = useParams();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;

  if (dungeonId && !document) {
    return <DungeonNotFound />;
  }

  if (document) {
    return <DungeonDetail document={document} />;
  }

  return (
    <>
      <DocumentTitle title="大秘境学习" />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <span>大秘境学习</span>
      </NavigationBar>
      <main className="dungeon-shell">
        <header className="dungeon-hero dungeon-hero--index">
          <div>
            <span className="dungeon-kicker">DUNGEON LEARNING COMPANION</span>
            <h1>先学会处理，再进入副本</h1>
            <p>
              Phase 0 先验证数据合同、稳定 Situation 和内容来源。最终页面会将这里的 Inspector 演进成
              60 秒复习、5 分钟速览和完整学习体验。
            </p>
          </div>
          <div className="dungeon-hero__callout">
            <strong>开发状态</strong>
            <span>只读 · fixture · 可审计</span>
          </div>
        </header>
        <section className="dungeon-grid dungeon-grid--cards">
          {dungeonDocuments.map((item) => (
            <DungeonCard document={item} key={item.id} />
          ))}
        </section>
      </main>
    </>
  );
}

function DungeonNotFound() {
  return (
    <>
      <DocumentTitle title="副本不存在" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>找不到这个副本</h1>
          <p>链接中的 dungeon ID 尚未注册。</p>
          <Link to="/dungeons">返回副本列表</Link>
        </section>
      </main>
    </>
  );
}
