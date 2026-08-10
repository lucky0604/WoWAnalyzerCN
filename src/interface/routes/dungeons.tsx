import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

import {
  createAssetProviderFromEnv,
  DungeonMap,
  dungeonCoverageStatusLabel,
  dungeonDocuments,
  dungeonPreviewDocuments,
  getCoordinateReference,
  getDungeonDocument,
  getPullStepForces,
  isLearningPublished,
  resolveRoute,
  season2DungeonCatalog,
  validateDungeonDocument,
} from '../../dungeon';
import type {
  DungeonCatalogEntry,
  DungeonDocument,
  DungeonCoverageStatus,
  RouteStep,
} from '../../dungeon';

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

function CoverageBadge({ status }: { status: DungeonCoverageStatus }) {
  return (
    <span className={`dungeon-status dungeon-status-${status}`}>
      {dungeonCoverageStatusLabel[status]}
    </span>
  );
}

function DungeonCard({ document }: { document: DungeonDocument }) {
  const isSpatialPending = document.spatialStatus === 'pending';
  return (
    <article className="dungeon-card">
      <div className="dungeon-card__eyebrow">
        <span>Midnight S2</span>
        <StatusBadge status={document.dataStatus} />
      </div>
      <h2>{document.name.zhCN}</h2>
      <p>
        {document.dataStatus === 'fixture' ? '数据合同样本' : '内容学习草稿'} ·{' '}
        {document.situations.length} 个 Situation · {document.abilities.length} 个技能知识
      </p>
      {isSpatialPending && (
        <small className="dungeon-card__next-milestone">
          空间数据待核验：当前只用于验证学习闭环，不代表正式路线。
        </small>
      )}
      <div className="dungeon-card__actions">
        {document.dataStatus === 'fixture' ? (
          <span className="dungeon-card__action dungeon-card__action--disabled">
            学习内容仅用于契约测试
          </span>
        ) : (
          <Link className="dungeon-card__action" to={`/dungeons/${document.id}/learn`}>
            开始学习 →
          </Link>
        )}
        <Link className="dungeon-card__reference" to={`/dungeons/${document.id}`}>
          打开 Inspector
        </Link>
      </div>
    </article>
  );
}

function DungeonCoverageCard({ entry }: { entry: DungeonCatalogEntry }) {
  const learningAvailable = isLearningPublished(entry.status);
  const coordinateAvailable = Boolean(entry.coordinateSnapshotId && getCoordinateReference(entry));
  return (
    <article className="dungeon-card dungeon-card--coverage">
      <div className="dungeon-card__eyebrow">
        <span>Midnight S2 · {entry.sourceKey}</span>
        <CoverageBadge status={entry.status} />
      </div>
      <h2>{entry.name.zhCN}</h2>
      <p>{entry.summary.zhCN}</p>
      <div className="dungeon-coverage-meta">
        <span>坐标快照</span>
        <code>{entry.coordinateSnapshotId ?? '位置参考待接入'}</code>
      </div>
      <div className="dungeon-card__actions">
        {learningAvailable ? (
          <Link className="dungeon-card__action" to={`/dungeons/${entry.id}/learn`}>
            开始学习 →
          </Link>
        ) : (
          <span className="dungeon-card__action dungeon-card__action--disabled">攻略尚未开放</span>
        )}
        {coordinateAvailable ? (
          <Link className="dungeon-card__reference" to={`/dungeons/${entry.id}/reference`}>
            查看位置参考 →
          </Link>
        ) : (
          <span className="dungeon-card__reference dungeon-card__reference--disabled">
            位置参考待接入
          </span>
        )}
      </div>
      <small className="dungeon-card__next-milestone">下一步：{entry.nextMilestone.zhCN}</small>
    </article>
  );
}

function StepRow({
  document,
  step,
  selected,
  onSelect,
}: {
  document: DungeonDocument;
  step: RouteStep;
  selected: boolean;
  onSelect: () => void;
}) {
  if (step.type === 'pull') {
    const forces = getPullStepForces(document, step);
    return (
      <li>
        <button
          className={`dungeon-step dungeon-step--pull ${selected ? 'is-selected' : ''}`}
          onClick={onSelect}
          type="button"
        >
          <div className="dungeon-step__index">{step.order.toString().padStart(2, '0')}</div>
          <div className="dungeon-step__body">
            <strong>{step.title.zhCN}</strong>
            <span>
              {document.spatialStatus === 'pending'
                ? '位置 / forces 待接入'
                : `${step.spawnIds.length} spawns · ${forces} forces`}
            </span>
            <p>{step.rationale.zhCN}</p>
          </div>
        </button>
      </li>
    );
  }
  return (
    <li>
      <button
        className={`dungeon-step dungeon-step--transition ${selected ? 'is-selected' : ''}`}
        onClick={onSelect}
        type="button"
      >
        <div className="dungeon-step__index">{step.order.toString().padStart(2, '0')}</div>
        <div className="dungeon-step__body">
          <strong>{step.title.zhCN}</strong>
          <span>{step.type === 'transition' ? '楼层/区域过渡' : '事件步骤'}</span>
          <p>{step.instruction.zhCN}</p>
        </div>
      </button>
    </li>
  );
}

function DungeonDetail({ document }: { document: DungeonDocument }) {
  const validation = useMemo(() => validateDungeonDocument(document), [document]);
  const route = document.routes[0];
  const resolvedRoute = route ? resolveRoute(document, route) : undefined;
  const [selectedStepId, setSelectedStepId] = useState(route?.steps[0]?.id);
  const [selectedFloorId, setSelectedFloorId] = useState(document.floors[0]?.id);
  const [selectedSpawnId, setSelectedSpawnId] = useState<string>();
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const selectedStep = route?.steps.find((step) => step.id === selectedStepId);
  const selectedPull = selectedStep?.type === 'pull' ? selectedStep : undefined;
  const selectedFloor =
    document.floors.find((floor) => floor.id === selectedFloorId) ?? document.floors[0];
  const floorSpawns = selectedFloor
    ? document.spawns.filter((spawn) => spawn.floorId === selectedFloor.id)
    : [];
  const selectedSpawn = selectedSpawnId
    ? document.spawns.find((spawn) => spawn.id === selectedSpawnId)
    : undefined;

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
            {(document.dataStatus === 'reviewed' || document.dataStatus === 'published') && (
              <Link className="dungeon-hero__link" to="/">
                已有 WCL 日志？回到日志分析入口 →
              </Link>
            )}
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
            <small>
              {document.spatialStatus === 'pending'
                ? '位置与 forces 待核验'
                : `forces 总量 ${document.totalEnemyForcesPoints}`}
            </small>
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
            <small>
              {document.spatialStatus === 'pending'
                ? '路线空间上下文待接入'
                : `${resolvedRoute?.totalForcesPoints ?? 0} forces 覆盖`}
            </small>
          </article>
        </section>

        {selectedFloor && (
          <section className="dungeon-panel dungeon-map-panel">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">SPATIAL CONTEXT</span>
                <h2>地图与路线位置</h2>
              </div>
              <span className="dungeon-panel__hint">
                {document.spatialStatus === 'pending'
                  ? '位置数据待核验；当前仅展示学习章节上下文'
                  : '点击路线步骤或地图 spawn 查看上下文'}
              </span>
            </div>
            <div className="dungeon-floor-tabs" role="tablist" aria-label="楼层选择">
              {document.floors.map((floor) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={floor.id === selectedFloor.id}
                  className={floor.id === selectedFloor.id ? 'is-active' : undefined}
                  key={floor.id}
                  onClick={() => {
                    setSelectedFloorId(floor.id);
                    setSelectedSpawnId(undefined);
                  }}
                >
                  {floor.name.zhCN}
                </button>
              ))}
            </div>
            <DungeonMap
              floor={selectedFloor}
              spawns={floorSpawns}
              selectedSpawnIds={
                selectedSpawnId ? [selectedSpawnId] : (selectedPull?.spawnIds ?? [])
              }
              asset={assetProvider.getFloorMap(selectedFloor.mapAssetKey ?? '')}
              onSpawnSelect={setSelectedSpawnId}
            />
            {selectedSpawn && (
              <div className="dungeon-map-selection">
                <strong>{selectedSpawn.id}</strong>
                <span>
                  {selectedSpawn.position[0].toFixed(2)}, {selectedSpawn.position[1].toFixed(2)} ·{' '}
                  {document.enemies.find((enemy) => enemy.id === selectedSpawn.enemyId)?.name.zhCN}
                </span>
              </div>
            )}
          </section>
        )}

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
                    <StepRow
                      document={document}
                      step={step}
                      key={step.id}
                      selected={step.id === selectedStepId}
                      onSelect={() => {
                        setSelectedStepId(step.id);
                        setSelectedSpawnId(undefined);
                      }}
                    />
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
              {document.spatialStatus === 'pending'
                ? `空间数据待接入 · ${document.version.build}`
                : `Normalized coordinate space · ${document.version.build}`}
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
                {document.spawns.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      {document.spatialStatus === 'pending'
                        ? '位置 / spawn 快照待核验；学习内容不依赖地图加载。'
                        : '暂无位置数据。'}
                    </td>
                  </tr>
                ) : (
                  document.spawns.map((spawn) => {
                    const enemy = document.enemies.find(
                      (candidate) => candidate.id === spawn.enemyId,
                    );
                    const floor = document.floors.find(
                      (candidate) => candidate.id === spawn.floorId,
                    );
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">BOSS REFERENCE</span>
              <h2>Boss 机制索引</h2>
            </div>
            <span className="dungeon-panel__hint">先看核心机制，再进入完整学习</span>
          </div>
          <div className="dungeon-boss-list">
            {document.bosses.map((boss) => (
              <article className="dungeon-boss" key={boss.id}>
                <div>
                  <span className="dungeon-boss__eyebrow">{boss.id}</span>
                  <h3>{boss.title.zhCN}</h3>
                  <p>{boss.summary.zhCN}</p>
                </div>
                <div className="dungeon-chip-row">
                  {boss.focusAbilityIds.map((abilityId) => (
                    <span className="dungeon-chip" key={abilityId}>
                      {document.abilities.find((ability) => ability.id === abilityId)?.name.zhCN ??
                        abilityId}
                    </span>
                  ))}
                </div>
              </article>
            ))}
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
        <section className="dungeon-panel dungeon-coverage-panel" aria-labelledby="coverage-title">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SEASON COVERAGE</span>
              <h2 id="coverage-title">S2 八本覆盖路线</h2>
            </div>
            <span className="dungeon-panel__hint">只有已审校/已发布条目可以进入正式学习</span>
          </div>
          <p className="dungeon-coverage-intro">
            坐标和位置关系先作为只读空间参考接入；技能、波次和学习路线必须经过内容审校后才会开放。
            这样列表不会用空壳页面制造“已经有攻略”的错觉。
          </p>
          <div className="dungeon-grid dungeon-grid--cards">
            {season2DungeonCatalog.map((entry) => (
              <DungeonCoverageCard entry={entry} key={entry.id} />
            ))}
          </div>
        </section>

        <section className="dungeon-panel dungeon-fixture-panel" aria-labelledby="fixture-title">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">INTERNAL PREVIEWS</span>
              <h2 id="fixture-title">内部学习原型</h2>
            </div>
            <span className="dungeon-panel__hint">
              草稿用于验证内容闭环；fixture 只用于回归数据合同，均不代表正式攻略
            </span>
          </div>
          <div className="dungeon-grid dungeon-grid--cards">
            {dungeonDocuments.map((item) => (
              <DungeonCard document={item} key={`${item.id}-${item.dataStatus}`} />
            ))}
            {dungeonPreviewDocuments
              .filter((item) => item.dataStatus === 'fixture')
              .map((item) => (
                <DungeonCard document={item} key={`${item.id}-${item.dataStatus}`} />
              ))}
          </div>
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
