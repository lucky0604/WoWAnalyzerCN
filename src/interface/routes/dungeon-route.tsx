import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import {
  createAssetProviderFromEnv,
  DungeonMap,
  getDungeonCatalogEntry,
  getDungeonDocument,
  getDungeonScopedLearningAccess,
  getPullStepForces,
  getRouteStepAnchorSpawnIds,
  resolveRoute,
} from '../../dungeon';
import type { DungeonDocument, RouteStep } from '../../dungeon';

import './dungeons.scss';

const intentLabel: Record<NonNullable<DungeonDocument['routes'][number]>['intent'], string> = {
  learning: '学习路线',
  'pug-safe': '集合石稳妥路线',
  push: '冲层路线',
  'custom-reference': '自定义参考',
};

function RouteNotFound() {
  return (
    <>
      <DocumentTitle title="路线不存在" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>找不到这条路线</h1>
          <p>路线链接尚未注册，或者路线 revision 已经被替换。</p>
          <Link to="/dungeons">返回副本列表</Link>
        </section>
      </main>
    </>
  );
}

function RouteUnavailable({ dungeonId }: { dungeonId: string }) {
  return (
    <>
      <DocumentTitle title="路线待审校" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>路线待审校</h1>
          <p>当前副本没有可以公开学习的正式路线；草稿只在副本 Inspector 中审阅。</p>
          <Link to={`/dungeons/${dungeonId}?view=inspector`}>打开 Inspector</Link>
        </section>
      </main>
    </>
  );
}

function stepFloorId(step: RouteStep): string {
  return step.type === 'transition' ? step.toFloorId : step.floorId;
}

function RouteStepCard({
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
  const isPull = step.type === 'pull';
  const forces = isPull ? getPullStepForces(document, step) : undefined;
  return (
    <li>
      <button
        className={`dungeon-route-step ${selected ? 'is-selected' : ''}`}
        onClick={onSelect}
        aria-pressed={selected}
        type="button"
      >
        <span className="dungeon-step__index">{String(step.order).padStart(2, '0')}</span>
        <span className="dungeon-route-step__body">
          <strong>{step.title.zhCN}</strong>
          <small>
            {isPull
              ? document.spatialStatus === 'pending'
                ? '位置参考锚点 · 完整 Pull 待核验'
                : `${step.spawnIds.length} spawns · ${forces} forces`
              : step.type === 'transition'
                ? '楼层 / 区域过渡'
                : '事件步骤'}
          </small>
          <span>{isPull ? step.rationale.zhCN : step.instruction.zhCN}</span>
        </span>
      </button>
    </li>
  );
}

function RouteDetail({ document, routeId }: { document: DungeonDocument; routeId: string }) {
  const route = document.routes.find((candidate) => candidate.id === routeId);
  const resolved = route ? resolveRoute(document, route) : undefined;
  const firstStepId = route?.steps[0]?.id;
  const [selectedStepId, setSelectedStepId] = useState(firstStepId);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  useEffect(() => {
    if (!mapExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMapExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapExpanded]);
  useEffect(() => {
    setSelectedStepId(firstStepId);
  }, [firstStepId, route?.id]);
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const selectedStep = route?.steps.find((step) => step.id === selectedStepId);
  const selectedFloor = selectedStep
    ? document.floors.find((floor) => floor.id === stepFloorId(selectedStep))
    : document.floors[0];
  const floorSpawns = selectedFloor
    ? document.spawns.filter((spawn) => spawn.floorId === selectedFloor.id)
    : [];
  const selectedPull = selectedStep?.type === 'pull' ? selectedStep : undefined;
  const selectedAnchorSpawnIds = selectedPull
    ? getRouteStepAnchorSpawnIds(document, selectedPull)
    : [];
  const selectedMapSpawnIds = selectedPull
    ? [...new Set([...selectedPull.spawnIds, ...selectedAnchorSpawnIds])]
    : [];
  const selectedPullSpawns = selectedPull
    ? floorSpawns.filter((spawn) => selectedPull.spawnIds.includes(spawn.id))
    : [];
  const selectedHullSpawns = selectedPull
    ? floorSpawns.filter((spawn) => selectedMapSpawnIds.includes(spawn.id))
    : [];

  if (!route || !resolved) return <RouteNotFound />;

  return (
    <>
      <DocumentTitle title={`${route.name.zhCN} · 路线参考`} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">大秘境学习</Link>
        <span className="learning-nav-separator">/</span>
        <Link to={`/dungeons/${document.id}?view=inspector`}>{document.name.zhCN}</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to={`/dungeons/${document.id}?view=inspector`}>Inspector</Link>
          <span>/</span>
          {route.name.zhCN}
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>READ-ONLY ROUTE</span>
              <span className="dungeon-status dungeon-status-draft">
                {intentLabel[route.intent]}
              </span>
            </div>
            <h1>{route.name.zhCN}</h1>
            <p>
              这条路线用于解释“为什么这样组织 Pull”，不是 MDT 编辑器；它不会导入、保存或修改路线。
            </p>
          </div>
          <div className="dungeon-hero__metric">
            <span>路线 forces</span>
            <strong>
              {document.spatialStatus === 'pending' ? '待核验' : resolved.totalForcesPoints}
            </strong>
            <small>
              适用层级{' '}
              {route.keyRange ? `${route.keyRange.min}–${route.keyRange.max ?? '∞'}` : '未指定'}
            </small>
          </div>
        </header>

        <section className="dungeon-grid dungeon-grid--summary" aria-label="路线摘要">
          <article className="dungeon-panel dungeon-summary-card">
            <span>路线意图</span>
            <strong>{intentLabel[route.intent]}</strong>
            <small>{route.keyRange ? '有明确层级假设' : '未指定层级假设'}</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>Pull 数量</span>
            <strong>{resolved.pulls.length}</strong>
            <small>Transition / Event 不计入 forces</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>声明 forces</span>
            <strong>
              {document.spatialStatus === 'pending' ? '待核验' : route.expectedEnemyForcesPoints}
            </strong>
            <small>
              {document.spatialStatus === 'pending' ? '位置快照待接入' : '由 spawn 推导复核'}
            </small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>来源 revision</span>
            <strong>{route.version.revision}</strong>
            <small>{route.version.build}</small>
          </article>
        </section>

        <div className="dungeon-grid dungeon-route-layout">
          <section
            className={`dungeon-panel dungeon-map-panel${mapCollapsed ? ' is-collapsed' : ''}${mapExpanded ? ' is-expanded' : ''}`}
          >
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">SPATIAL CONTEXT</span>
                <h2>路线位置</h2>
              </div>
              <div className="dungeon-map-panel__heading-actions">
                <span className="dungeon-panel__hint">
                  {document.spatialStatus === 'pending'
                    ? '位置数据待核验'
                    : '点击步骤切换地图上下文'}
                </span>
                <div className="dungeon-map-panel__actions" aria-label="地图显示选项">
                  <button
                    aria-controls="dungeon-route-map-content"
                    aria-expanded={!mapCollapsed}
                    className="dungeon-map-panel__toggle"
                    onClick={() => setMapCollapsed((current) => !current)}
                    type="button"
                  >
                    {mapCollapsed ? '展开地图' : '收起地图'}
                  </button>
                  <button
                    aria-pressed={mapExpanded}
                    className="dungeon-map-panel__toggle"
                    onClick={() => {
                      setMapExpanded((current) => !current);
                      setMapCollapsed(false);
                    }}
                    type="button"
                  >
                    {mapExpanded ? '退出聚焦' : '地图聚焦'}
                  </button>
                </div>
              </div>
            </div>
            <div id="dungeon-route-map-content" hidden={mapCollapsed}>
              {selectedFloor ? (
                <DungeonMap
                  asset={assetProvider.getFloorMap(selectedFloor.mapAssetKey ?? '')}
                  floor={selectedFloor}
                  hullSpawns={
                    selectedHullSpawns.length > 0 ? selectedHullSpawns : selectedPullSpawns
                  }
                  selectedSpawnIds={selectedMapSpawnIds}
                  spawns={floorSpawns}
                />
              ) : (
                <p>路线尚未绑定楼层。</p>
              )}
            </div>
          </section>
          <section className="dungeon-panel dungeon-panel--wide">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">PULL SEQUENCE</span>
                <h2>只读步骤</h2>
              </div>
              <span className="dungeon-panel__hint">键盘选择步骤，地图同步高亮</span>
            </div>
            <ol className="dungeon-route-step-list">
              {route.steps.map((step) => (
                <RouteStepCard
                  document={document}
                  key={step.id}
                  onSelect={() => setSelectedStepId(step.id)}
                  selected={step.id === selectedStepId}
                  step={step}
                />
              ))}
            </ol>
          </section>
        </div>

        {selectedPull && (
          <section className="dungeon-panel">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">LEARNING CONTEXT</span>
                <h2>{selectedPull.title.zhCN}</h2>
              </div>
              <span className="dungeon-panel__hint">先理解动作，再优化空间</span>
            </div>
            <p className="dungeon-route-rationale">{selectedPull.rationale.zhCN}</p>
            <div className="dungeon-chip-row">
              {selectedPull.situationRefs.map((reference) => {
                const situation = document.situations.find(
                  (candidate) => candidate.id === reference.situationId,
                );
                return situation ? (
                  <Link
                    className="dungeon-chip dungeon-chip--link"
                    key={reference.situationId}
                    to={`/dungeons/${document.id}/learn?mode=full&situation=${encodeURIComponent(reference.situationId)}`}
                  >
                    {situation.title.zhCN} · {reference.coverage}
                  </Link>
                ) : null;
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId, routeId } = useParams();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const entry = dungeonId ? getDungeonCatalogEntry(dungeonId) : undefined;
  const access = entry && document ? getDungeonScopedLearningAccess(entry, document) : undefined;
  if (!dungeonId || !routeId) return <RouteNotFound />;
  if (!document) return entry ? <RouteUnavailable dungeonId={dungeonId} /> : <RouteNotFound />;
  if (!entry || !access?.canOpen) return <RouteUnavailable dungeonId={document.id} />;
  return <RouteDetail document={document} routeId={routeId} />;
}
