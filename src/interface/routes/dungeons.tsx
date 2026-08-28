import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';

import {
  buildLearningPlan,
  createAssetProviderFromEnv,
  DungeonMap,
  dungeonCoverageStatusLabel,
  dungeonDocuments,
  dungeonPreviewDocuments,
  getDungeonContentReadiness,
  getDungeonCatalogEntry,
  getDungeonDocument,
  getDungeonLearningAccess,
  getDungeonScopedLearningAccess,
  getLearningProgressSummary,
  getAbilityReference,
  getEnemyReference,
  getPullStepForces,
  getSpawnBounds,
  makeDungeonAnalysisPath,
  legacyThreechestCoordinateInventory,
  readLearningProgress,
  searchDungeon,
  isLearningPublished,
  resolveRoute,
  season2DungeonCatalog,
  validateDungeonDocument,
} from '../../dungeon';
import type {
  DungeonCatalogEntry,
  DungeonDocument,
  DungeonCoverageStatus,
  DungeonSearchResult,
  LearningProgress,
  RouteStep,
} from '../../dungeon';
import {
  getEnemySpellIds,
  getMdtReferenceSummary,
  getSpellFact,
} from '../../dungeon/data/spellReference';

import { DungeonSpellIcon, NpcPortrait } from './dungeonReference';

import './dungeons.scss';

function statusLabel(status: DungeonDocument['dataStatus']): string {
  switch (status) {
    case 'fixture':
      return t({ id: 'dungeon.card.status.fixture', message: '开发 fixture' });
    case 'draft':
      return t({ id: 'dungeon.card.status.draft', message: '草稿' });
    case 'reviewed':
      return t({ id: 'dungeon.card.status.reviewed', message: '已审校' });
    default:
      return t({ id: 'dungeon.card.status.published', message: '已发布' });
  }
}

function StatusBadge({ status }: { status: DungeonDocument['dataStatus'] }) {
  return <span className={`dungeon-status dungeon-status-${status}`}>{statusLabel(status)}</span>;
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
  const catalogEntry = getDungeonCatalogEntry(document.id);
  const learningAccess = catalogEntry
    ? getDungeonScopedLearningAccess(catalogEntry, document)
    : getDungeonLearningAccess(document);
  return (
    <article className="dungeon-card">
      <div className="dungeon-card__eyebrow">
        <span>Midnight S2</span>
        <StatusBadge status={document.dataStatus} />
      </div>
      <h2>{document.name.zhCN}</h2>
      <p>
        {document.dataStatus === 'fixture'
          ? t({ id: 'dungeon.card.sampleLabel', message: '数据合同样本' })
          : t({ id: 'dungeon.card.draftLabel', message: '内容学习草稿' })}{' · '}
        {t({
          id: 'dungeon.card.situationCount',
          message: `${document.situations.length} 个 Situation`,
        })}
        {' · '}
        {t({
          id: 'dungeon.card.abilityCount',
          message: `${document.abilities.length} 个技能知识`,
        })}
      </p>
      {isSpatialPending && (
        <small className="dungeon-card__next-milestone">
          {t({
            id: 'dungeon.card.spatialPendingNote',
            message: '空间数据待核验：当前只用于验证学习闭环，不代表正式路线。',
          })}
        </small>
      )}
      <div className="dungeon-card__actions">
        {learningAccess.state === 'fixture' ? (
          <span className="dungeon-card__action dungeon-card__action--disabled">
            {t({ id: 'dungeon.card.contractOnly', message: '学习内容仅用于契约测试' })}
          </span>
        ) : learningAccess.canOpen ? (
          <Link className="dungeon-card__action" to={`/dungeons/${document.id}/learn`}>
            {learningAccess.state === 'preview'
              ? t({ id: 'dungeon.card.openPreview', message: '打开学习预览 →' })
              : t({ id: 'dungeon.card.startLearning', message: '开始学习 →' })}
          </Link>
        ) : (
          <span className="dungeon-card__action dungeon-card__action--disabled">
            {learningAccess.label}
          </span>
        )}
        <Link className="dungeon-card__reference" to={`/dungeons/${document.id}?view=inspector`}>
          {t({ id: 'dungeon.common.openInspector', message: '打开 Inspector' })}
        </Link>
      </div>
    </article>
  );
}

function DungeonCoverageCard({
  assetProvider,
  entry,
  progress,
}: {
  assetProvider: ReturnType<typeof createAssetProviderFromEnv>;
  entry: DungeonCatalogEntry;
  progress: LearningProgress;
}) {
  const document = getDungeonDocument(entry.id);
  const learningDocument = document?.dataStatus === 'fixture' ? undefined : document;
  const readiness = getDungeonContentReadiness(entry, learningDocument);
  const coordinateAvailable = readiness.gates.some(
    (readinessGate) => readinessGate.id === 'coordinates' && readinessGate.state === 'ready',
  );
  const learningAvailable = isLearningPublished(entry.status) && readiness.state === 'ready';
  const mdtReference = getMdtReferenceSummary(entry.sourceKey);
  const contentCoverage = learningDocument
    ? t({
        id: 'dungeon.card.contentCoverage',
        message: `${learningDocument.situations.length} Situation · ${learningDocument.abilities.length} 技能 · ${learningDocument.routes.length} 路线 · ${learningDocument.bosses.length} Boss`,
      })
    : mdtReference
      ? // 与清单 gate detail 同为 zh-first 数据层文案，避免新增 JSX 外 t() 的 lint 违规。
        `MDT 参考：${mdtReference.enemies} 敌人 · ${mdtReference.spells} 技能 · ${mdtReference.totalForces} forces`
      : t({ id: 'dungeon.card.contentMissing', message: '尚未登记学习内容文档' });
  const artwork = assetProvider.getDungeonArtwork(`${entry.mapAssetKey}:artwork`);
  const [coverFailed, setCoverFailed] = useState(false);
  const plan = useMemo(
    () => (learningDocument ? buildLearningPlan(learningDocument, 'full') : []),
    [learningDocument],
  );
  const summary = useMemo(
    () => (plan.length > 0 ? getLearningProgressSummary(plan, progress, entry.id) : undefined),
    [plan, progress, entry.id],
  );
  const hasRecords =
    summary !== undefined && summary.completedCount + summary.fuzzyCount + summary.unknownCount > 0;
  const masteredProgressLabel =
    summary !== undefined
      ? t({
          id: 'dungeon.card.masteredProgress',
          message: `已掌握 ${summary.masteredCount}/${plan.length} 个关键节点`,
        })
      : '';
  return (
    <article className="dungeon-card dungeon-card--coverage">
      {artwork.kind === 'remote' && !coverFailed && (
        <img
          alt={t({
            id: 'dungeon.card.coverAlt',
            message: `${entry.name.zhCN} 封面`,
          })}
          className="dungeon-card__cover"
          decoding="async"
          loading="lazy"
          onError={() => setCoverFailed(true)}
          src={artwork.url}
        />
      )}
      <div className="dungeon-card__eyebrow">
        <span>Midnight S2 · {entry.sourceKey}</span>
        <CoverageBadge status={entry.status} />
      </div>
      <h2>{entry.name.zhCN}</h2>
      <p>{entry.summary.zhCN}</p>
      {hasRecords && summary && (
        <div
          aria-label={masteredProgressLabel}
          className="dungeon-card__progress"
        >
          {masteredProgressLabel}
        </div>
      )}
      <div className="dungeon-coverage-meta">
        <span>{t({ id: 'dungeon.card.coordinateSnapshot', message: '坐标快照' })}</span>
        <code>
          {entry.coordinateSnapshotId ??
            t({ id: 'dungeon.card.positionPending', message: '位置参考待接入' })}
        </code>
        <span>{t({ id: 'dungeon.card.contentCoverageLabel', message: '内容覆盖' })}</span>
        <code>{contentCoverage}</code>
        <span>{t({ id: 'dungeon.card.learningReadiness', message: '学习就绪度' })}</span>
        <code>
          {readiness.readyGateCount}/{readiness.totalGateCount} ·{' '}
          {readiness.state === 'coordinate-only'
            ? t({ id: 'dungeon.card.readiness.coordinateOnly', message: '仅位置参考' })
            : readiness.state === 'catalog-only'
              ? t({
                  id: 'dungeon.card.readiness.catalogOnly',
                  message: '目录已登记，内容待接入',
                })
              : readiness.state === 'learning-preview'
                ? t({ id: 'dungeon.card.readiness.learningPreview', message: '本地学习预览' })
                : readiness.state === 'ready'
                  ? t({ id: 'dungeon.card.readiness.ready', message: '可进入正式学习' })
                  : t({ id: 'dungeon.card.readiness.blocked', message: '门禁阻断' })}
        </code>
        <span>{t({ id: 'dungeon.card.lastUpdated', message: '最后维护' })}</span>
        <code>{entry.updatedAt}</code>
      </div>
      <ul
        className="dungeon-readiness-list"
        aria-label={t({
          id: 'dungeon.card.readinessAriaLabel',
          message: `${entry.name.zhCN} 内容就绪度`,
        })}
      >
        {readiness.gates.map((readinessGate) => (
          <li className={`is-${readinessGate.state}`} key={readinessGate.id}>
            <span aria-hidden="true">
              {readinessGate.state === 'ready'
                ? '✓'
                : readinessGate.state === 'blocked'
                  ? '!'
                  : '·'}
            </span>
            <strong>{readinessGate.label}</strong>
            <small>{readinessGate.detail}</small>
          </li>
        ))}
      </ul>
      <div className="dungeon-card__actions">
        {document && (
          <Link className="dungeon-card__action" to={`/dungeons/${entry.id}?view=inspector`}>
            {t({ id: 'dungeon.common.openInspector', message: '打开 Inspector' })}
          </Link>
        )}
        {learningAvailable ? (
          <Link className="dungeon-card__action" to={`/dungeons/${entry.id}/learn`}>
            {t({ id: 'dungeon.card.startLearning', message: '开始学习 →' })}
          </Link>
        ) : (
          <span className="dungeon-card__action dungeon-card__action--disabled">
            {t({ id: 'dungeon.card.learningNotOpen', message: '攻略尚未开放' })}
          </span>
        )}
        {coordinateAvailable ? (
          <Link className="dungeon-card__reference" to={`/dungeons/${entry.id}/reference`}>
            {t({ id: 'dungeon.card.viewCoordinateReference', message: '查看位置参考 →' })}
          </Link>
        ) : (
          <span className="dungeon-card__reference dungeon-card__reference--disabled">
            {t({ id: 'dungeon.card.positionPending', message: '位置参考待接入' })}
          </span>
        )}
      </div>
      <small className="dungeon-card__next-milestone">
        {t({
          id: 'dungeon.card.nextMilestone',
          message: `下一步：${entry.nextMilestone.zhCN}`,
        })}
      </small>
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
                ? t({ id: 'dungeon.detail.spatialForcesPending', message: '位置 / forces 待接入' })
                : t({
                    id: 'dungeon.detail.pullSpawnForces',
                    message: `${step.spawnIds.length} spawns · ${forces} forces`,
                  })}
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
          <span>
            {step.type === 'transition'
              ? t({ id: 'dungeon.detail.transitionStep', message: '楼层/区域过渡' })
              : t({ id: 'dungeon.detail.eventStep', message: '事件步骤' })}
          </span>
          <p>{step.instruction.zhCN}</p>
        </div>
      </button>
    </li>
  );
}

function searchKindLabel(kind: DungeonSearchResult['kind']): string {
  switch (kind) {
    case 'enemy':
      return t({ id: 'dungeon.query.kind.enemy', message: '敌人' });
    case 'ability':
      return t({ id: 'dungeon.query.kind.ability', message: '技能' });
    case 'situation':
      return t({ id: 'dungeon.query.kind.situation', message: 'Situation' });
    default:
      return t({ id: 'dungeon.query.kind.route', message: '路线' });
  }
}

function KnowledgeQueryPanel({ document }: { document: DungeonDocument }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>();
  const results = useMemo(() => searchDungeon(document, query), [document, query]);
  const selected = results.find((result) => `${result.kind}:${result.id}` === selectedKey);
  const enemyReference =
    selected?.kind === 'enemy' ? getEnemyReference(document, selected.id) : undefined;
  const abilityReference =
    selected?.kind === 'ability' ? getAbilityReference(document, selected.id) : undefined;
  const situation =
    selected?.kind === 'situation'
      ? document.situations.find((candidate) => candidate.id === selected.id)
      : undefined;
  const route =
    selected?.kind === 'route'
      ? document.routes.find((candidate) => candidate.id === selected.id)
      : undefined;

  const routeStepsForSituation = situation
    ? document.routes.flatMap((candidate) =>
        candidate.steps.flatMap((step) =>
          step.type !== 'transition' &&
          step.situationRefs.some(({ situationId }) => situationId === situation.id)
            ? [{ route: candidate, step }]
            : [],
        ),
      )
    : [];

  return (
    <section className="dungeon-panel dungeon-query-panel">
      <div className="dungeon-panel__heading">
        <div>
          <span className="dungeon-kicker">KNOWLEDGE QUERY</span>
          <h2>{t({ id: 'dungeon.query.heading', message: '快速查找' })}</h2>
        </div>
        <span className="dungeon-panel__hint">
          {t({ id: 'dungeon.query.hint', message: '只读反查：对象 → 技能 → 场景 → 路线' })}
        </span>
      </div>
      <label className="dungeon-query-input">
        <span>{t({ id: 'dungeon.query.searchLabel', message: '搜索怪物、技能、Situation 或路线' })}</span>
        <input
          aria-label={t({ id: 'dungeon.query.searchLabel', message: '搜索怪物、技能、Situation 或路线' })}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedKey(undefined);
          }}
          placeholder={t({ id: 'dungeon.query.searchPlaceholder', message: '例如：冰霜护盾、梅莉杜莎、学习路线' })}
          type="search"
          value={query}
        />
      </label>
      {query.trim() && results.length === 0 && (
        <p className="dungeon-query-empty">
          {t({
            id: 'dungeon.query.empty',
            message: '没有匹配项；搜索不会把“第 7 波”当作稳定知识 ID。',
          })}
        </p>
      )}
      {results.length > 0 && (
        <div className="dungeon-query-results" role="listbox" aria-label={t({ id: 'dungeon.query.resultsLabel', message: '查询结果' })}>
          {results.map((result) => {
            const key = `${result.kind}:${result.id}`;
            return (
              <button
                aria-selected={selectedKey === key}
                className={selectedKey === key ? 'is-selected' : undefined}
                key={key}
                onClick={() => setSelectedKey(key)}
                role="option"
                type="button"
              >
                <span>{searchKindLabel(result.kind)}</span>
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </button>
            );
          })}
        </div>
      )}
      {enemyReference && (
        <div className="dungeon-query-detail">
          <div className="dungeon-query-detail__header">
            <span>{t({ id: 'dungeon.query.detailEnemy', message: '敌人反查' })}</span>
            <strong>{enemyReference.enemy.name.zhCN}</strong>
          </div>
          <p>
            {t({
              id: 'dungeon.detail.npcIdLine',
              message: `NPC ID：${
                enemyReference.enemy.npcId ??
                t({ id: 'dungeon.detail.pendingVerify', message: '待核验' })
              }`,
            })}
            {' · forces '}
            {enemyReference.enemy.forcesStatus === 'pending'
              ? t({ id: 'dungeon.detail.pendingVerify', message: '待核验' })
              : enemyReference.enemy.forcesPoints}
          </p>
          <div className="dungeon-chip-row">
            {enemyReference.abilities.map((ability) => (
              <span className="dungeon-chip" key={ability.id}>
                {ability.name.zhCN}
              </span>
            ))}
          </div>
          <small>
            {t({
              id: 'dungeon.detail.enemyContextCounts',
              message: `${enemyReference.spawns.length} 个出现位置 · ${enemyReference.situations.length} 个学习场景 · ${enemyReference.routeSteps.length} 个路线步骤`,
            })}
          </small>
        </div>
      )}
      {abilityReference && (
        <div className="dungeon-query-detail">
          <div className="dungeon-query-detail__header">
            <span>{t({ id: 'dungeon.query.detailAbility', message: '技能反查' })}</span>
            <strong>{abilityReference.ability.name.zhCN}</strong>
          </div>
          <p>{abilityReference.ability.action.zhCN}</p>
          <small>
            {t({ id: 'dungeon.detail.casterPrefix', message: '施法者：' })}
            {abilityReference.casters.map((enemy) => enemy.name.zhCN).join('、') ||
              t({ id: 'dungeon.detail.pendingVerify', message: '待核验' })}{' · '}
            {t({
              id: 'dungeon.detail.learningScenarioCount',
              message: `${abilityReference.situations.length} 个学习场景`,
            })}{' · '}
            {t({
              id: 'dungeon.detail.spawnAppearCount',
              message: `${abilityReference.spawns.length} 个出现位置`,
            })}
          </small>
        </div>
      )}
      {situation && (
        <div className="dungeon-query-detail">
          <div className="dungeon-query-detail__header">
            <span>{t({ id: 'dungeon.query.detailSituation', message: 'Situation 反查' })}</span>
            <strong>{situation.title.zhCN}</strong>
          </div>
          <p>{situation.summary.zhCN}</p>
          <small>
            {t({ id: 'dungeon.detail.focusSpellsPrefix', message: '关注技能：' })}
            {situation.focusAbilityIds
              .map(
                (abilityId) =>
                  document.abilities.find((ability) => ability.id === abilityId)?.name.zhCN ??
                  abilityId,
              )
              .join('、') || t({ id: 'dungeon.detail.none', message: '无' })}{' · '}
            {t({
              id: 'dungeon.detail.routeStepsForSituation',
              message: `路线步骤：${routeStepsForSituation.length}`,
            })}
          </small>
        </div>
      )}
      {route && (
        <div className="dungeon-query-detail">
          <div className="dungeon-query-detail__header">
            <span>{t({ id: 'dungeon.query.detailRoute', message: '路线反查' })}</span>
            <strong>{route.name.zhCN}</strong>
          </div>
          <p>
            {route.intent} ·{' '}
            {t({ id: 'dungeon.detail.keyRangeLabel', message: '适用层级' })}{' '}
            {route.keyRange
              ? `${route.keyRange.min}–${route.keyRange.max ?? '∞'}`
              : t({ id: 'dungeon.detail.keyRangeUnset', message: '未指定' })}
          </p>
          <small>
            {t({
              id: 'dungeon.detail.routeStepCount',
              message: `${route.steps.length} 个步骤`,
            })}{' · '}
            {t({
              id: 'dungeon.detail.routeReadOnly',
              message: '只读学习路线，不支持编辑或导入',
            })}
          </small>
        </div>
      )}
    </section>
  );
}

function DungeonDetail({ document }: { document: DungeonDocument }) {
  const validation = useMemo(() => validateDungeonDocument(document), [document]);
  const route = document.routes[0];
  const resolvedRoute = route ? resolveRoute(document, route) : undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStepId, setSelectedStepId] = useState(route?.steps[0]?.id);
  const [selectedFloorId, setSelectedFloorId] = useState(
    document.floors.find((floor) => floor.id === searchParams.get('floor'))?.id ??
      document.floors[0]?.id,
  );
  const [selectedSpawnId, setSelectedSpawnId] = useState<string>();
  const [mapFocus, setMapFocus] = useState<'floor' | 'pull'>('floor');
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
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const selectedStep = route?.steps.find((step) => step.id === selectedStepId);
  const selectedPull = selectedStep?.type === 'pull' ? selectedStep : undefined;
  const selectedFloor =
    document.floors.find((floor) => floor.id === selectedFloorId) ?? document.floors[0];
  // 这些派生数组喂给 DungeonMap。保持引用稳定，避免父组件每次渲染
  // 都把地图的 useMemo（resolvedSpawns / hull / patrol）全部打穿重建。
  const floorSpawns = useMemo(
    () => (selectedFloor ? document.spawns.filter((spawn) => spawn.floorId === selectedFloor.id) : []),
    [document, selectedFloor],
  );
  const selectedSpawn = selectedSpawnId
    ? document.spawns.find((spawn) => spawn.id === selectedSpawnId)
    : undefined;
  const selectedPullSpawns = useMemo(
    () =>
      selectedPull
        ? document.spawns.filter(
            (spawn) =>
              selectedPull.spawnIds.includes(spawn.id) &&
              (!selectedFloor || spawn.floorId === selectedFloor.id),
          )
        : [],
    [document, selectedFloor, selectedPull],
  );
  const mapViewBounds = useMemo(
    () =>
      mapFocus === 'pull' && selectedFloor
        ? getSpawnBounds(selectedPullSpawns, selectedFloor.bounds)
        : selectedFloor?.bounds,
    [mapFocus, selectedFloor, selectedPullSpawns],
  );
  const mapSelectedSpawnIds = useMemo(
    () => (selectedSpawnId ? [selectedSpawnId] : (selectedPull?.spawnIds ?? [])),
    [selectedPull, selectedSpawnId],
  );
  useEffect(() => {
    const requestedFloorId = searchParams.get('floor');
    if (requestedFloorId && document.floors.some((floor) => floor.id === requestedFloorId)) {
      setSelectedFloorId(requestedFloorId);
    } else if (requestedFloorId) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('floor');
          return next;
        },
        { replace: true },
      );
    }
  }, [document.floors, searchParams, setSearchParams]);
  const selectFloor = (floorId: string) => {
    setSelectedFloorId(floorId);
    setMapFocus('floor');
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('floor', floorId);
        return next;
      },
      { replace: true },
    );
  };
  const selectStep = (step: RouteStep) => {
    setSelectedStepId(step.id);
    setSelectedSpawnId(undefined);
    if (step.type === 'pull' || step.type === 'event') {
      selectFloor(step.floorId);
    } else {
      selectFloor(step.toFloorId);
    }
  };

  return (
    <>
      <DocumentTitle
        title={t({
          id: 'dungeon.detail.pageTitle',
          message: `${document.name.zhCN} · 大秘境学习`,
        })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
          <span>/</span>
          {document.name.zhCN}
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>READ-ONLY INSPECTOR</span>
              <StatusBadge status={document.dataStatus} />
            </div>
            <h1>{document.name.zhCN}</h1>
            <p>
              {t({
                id: 'dungeon.detail.heroDetail',
                message: '这里用于核对数据合同、内容引用和空间状态；学习入口会把危险动作与路线原因分开呈现。',
              })}
            </p>
            {(document.dataStatus === 'reviewed' || document.dataStatus === 'published') && (
              <Link className="dungeon-hero__link" to={makeDungeonAnalysisPath(document)}>
                {t({
                  id: 'dungeon.detail.analysisEntry',
                  message: '已有 WCL 日志？进入日志分析入口 →',
                })}
              </Link>
            )}
          </div>
          <div className="dungeon-hero__metric">
            <span>{t({ id: 'dungeon.detail.validationStatus', message: '验证状态' })}</span>
            <strong className={validation.ok ? 'is-ok' : 'is-error'}>
              {validation.ok
                ? t({ id: 'dungeon.detail.validationOk', message: '通过' })
                : t({
                    id: 'dungeon.detail.validationErrorCount',
                    message: `${validation.errors.length} 个错误`,
                  })}
            </strong>
            <small>
              {t({
                id: 'dungeon.detail.validationWarningCount',
                message: `${validation.warnings.length} 个 warning`,
              })}
            </small>
          </div>
        </header>

        <section
          className="dungeon-grid dungeon-grid--summary"
          aria-label={t({ id: 'dungeon.detail.summarySectionLabel', message: '数据摘要' })}
        >
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.detail.summaryFloors', message: '楼层' })}</span>
            <strong>{document.floors.length}</strong>
            <small>{document.floors.map((floor) => floor.name.zhCN).join('、')}</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.detail.summaryEnemies', message: '敌人 / Spawn' })}</span>
            <strong>
              {document.enemies.length} / {document.spawns.length}
            </strong>
            <small>
              {document.spatialStatus === 'pending'
                ? t({
                    id: 'dungeon.detail.summaryEnemiesPending',
                    message: '位置与 forces 待核验',
                  })
                : t({
                    id: 'dungeon.detail.summaryForcesTotal',
                    message: `forces 总量 ${document.totalEnemyForcesPoints}`,
                  })}
            </small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.detail.summaryKnowledge', message: '教学知识' })}</span>
            <strong>
              {document.situations.length} / {document.abilities.length}
            </strong>
            <small>{t({ id: 'dungeon.detail.summaryKnowledgeSmall', message: 'Situation / 技能知识' })}</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.detail.summaryRoutes', message: '学习路线' })}</span>
            <strong>{document.routes.length}</strong>
            <small>
              {document.spatialStatus === 'pending'
                ? t({
                    id: 'dungeon.detail.summaryRoutePending',
                    message: '路线空间上下文待接入',
                  })
                : t({
                    id: 'dungeon.detail.summaryRouteForces',
                    message: `${resolvedRoute?.totalForcesPoints ?? 0} forces 覆盖`,
                  })}
            </small>
          </article>
        </section>

        {selectedFloor && (
          <section
            className={`dungeon-panel dungeon-map-panel${mapCollapsed ? ' is-collapsed' : ''}${mapExpanded ? ' is-expanded' : ''}`}
          >
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">SPATIAL CONTEXT</span>
                <h2>{t({ id: 'dungeon.detail.mapHeading', message: '地图与路线位置' })}</h2>
              </div>
              <div className="dungeon-map-panel__heading-actions">
                <span className="dungeon-panel__hint">
                  {document.spatialStatus === 'pending'
                    ? t({
                        id: 'dungeon.detail.mapHintPending',
                        message: '位置数据待核验；当前仅展示学习章节上下文',
                      })
                    : t({
                        id: 'dungeon.detail.mapHintSelect',
                        message: '点击路线步骤或地图 spawn 查看上下文',
                      })}
                </span>
                <div className="dungeon-map-panel__actions" aria-label={t({ id: 'dungeon.detail.mapOptionsLabel', message: '地图显示选项' })}>
                  <button
                    aria-controls="dungeon-detail-map-content"
                    aria-expanded={!mapCollapsed}
                    className="dungeon-map-panel__toggle"
                    onClick={() => setMapCollapsed((current) => !current)}
                    type="button"
                  >
                    {mapCollapsed
                      ? t({ id: 'dungeon.detail.toggleExpand', message: '展开地图' })
                      : t({ id: 'dungeon.detail.toggleCollapse', message: '收起地图' })}
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
                    {mapExpanded
                      ? t({ id: 'dungeon.detail.toggleExitFocus', message: '退出聚焦' })
                      : t({ id: 'dungeon.detail.toggleFocus', message: '地图聚焦' })}
                  </button>
                </div>
              </div>
            </div>
            <div id="dungeon-detail-map-content" hidden={mapCollapsed}>
              <div className="dungeon-floor-tabs" role="tablist" aria-label={t({ id: 'dungeon.detail.floorTabsLabel', message: '楼层选择' })}>
                {document.floors.map((floor) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={floor.id === selectedFloor.id}
                    className={floor.id === selectedFloor.id ? 'is-active' : undefined}
                    key={floor.id}
                    onClick={() => {
                      selectFloor(floor.id);
                      setSelectedSpawnId(undefined);
                    }}
                  >
                    {floor.name.zhCN}
                  </button>
                ))}
              </div>
              <div className="dungeon-map-controls" aria-label={t({ id: 'dungeon.detail.mapScopeLabel', message: '地图范围' })}>
                <button
                  className={mapFocus === 'floor' ? 'is-active' : undefined}
                  onClick={() => setMapFocus('floor')}
                  type="button"
                >
                  {t({ id: 'dungeon.detail.mapFocusFloor', message: '全楼层 / 重置' })}
                </button>
                <button
                  className={mapFocus === 'pull' ? 'is-active' : undefined}
                  disabled={selectedPullSpawns.length === 0}
                  onClick={() => setMapFocus('pull')}
                  type="button"
                >
                  {t({ id: 'dungeon.detail.mapFocusPull', message: '当前 Pull' })}
                </button>
              </div>
              <DungeonMap
                floor={selectedFloor}
                spawns={floorSpawns}
                selectedSpawnIds={mapSelectedSpawnIds}
                asset={assetProvider.getFloorMap(selectedFloor.mapAssetKey ?? '')}
                abilities={document.abilities}
                enemies={document.enemies}
                hullSpawns={mapFocus === 'pull' ? selectedPullSpawns : floorSpawns}
                onSpawnSelect={setSelectedSpawnId}
                viewBounds={mapViewBounds}
              />
              {selectedSpawn && (
                <div className="dungeon-map-selection">
                  <strong>{selectedSpawn.id}</strong>
                  <span>
                    {selectedSpawn.position[0].toFixed(2)}, {selectedSpawn.position[1].toFixed(2)} ·{' '}
                    {
                      document.enemies.find((enemy) => enemy.id === selectedSpawn.enemyId)?.name
                        .zhCN
                    }
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="dungeon-grid dungeon-grid--main">
          <section className="dungeon-panel dungeon-panel--wide">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">LEARNING ANCHORS</span>
                <h2>{t({ id: 'dungeon.detail.situationsHeading', message: 'Situation 场景' })}</h2>
              </div>
              <span className="dungeon-panel__hint">
                {t({ id: 'dungeon.detail.situationsHint', message: '稳定知识身份，不绑定波次编号' })}
              </span>
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
                      {situation.focusAbilityIds.map((abilityId) => {
                        const ability = document.abilities.find(
                          (candidate) => candidate.id === abilityId,
                        );
                        return (
                          <span className="dungeon-chip dungeon-chip--spell" key={abilityId}>
                            <DungeonSpellIcon spellId={ability?.spellId} />
                            {ability?.name.zhCN ?? abilityId}
                          </span>
                        );
                      })}
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
                <h2>{t({ id: 'dungeon.detail.routeHeading', message: '只读路线' })}</h2>
              </div>
              {route && (
                <Link
                  className="dungeon-panel__hint dungeon-panel__hint--link"
                  to={`/dungeons/${document.id}/route/${route.id}`}
                >
                  {t({ id: 'dungeon.detail.routeDetailLink', message: '查看 Route 详情 →' })}
                </Link>
              )}
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
                      onSelect={() => selectStep(step)}
                    />
                  ))}
                </ol>
              </>
            ) : (
              <p>{t({ id: 'dungeon.detail.noRoute', message: '暂无路线。' })}</p>
            )}
          </section>
        </div>

        <KnowledgeQueryPanel document={document} />

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">REFERENCE</span>
              <h2>{t({ id: 'dungeon.detail.referenceHeading', message: '怪物、技能与坐标' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {document.spatialStatus === 'pending'
                ? t({
                    id: 'dungeon.detail.spatialPendingHint',
                    message: `空间数据待接入 · ${document.version.build}`,
                  })
                : t({
                    id: 'dungeon.detail.spatialReadyHint',
                    message: `Normalized coordinate space · ${document.version.build}`,
                  })}
            </span>
          </div>
          <div className="dungeon-table-wrap">
            <table className="dungeon-table">
              <thead>
                <tr>
                  <th>{t({ id: 'dungeon.detail.columnEnemy', message: '敌人' })}</th>
                  <th>{t({ id: 'dungeon.detail.columnAbility', message: '技能知识' })}</th>
                  <th>{t({ id: 'dungeon.detail.columnFloor', message: '楼层' })}</th>
                  <th>{t({ id: 'dungeon.detail.columnCoordinate', message: '坐标' })}</th>
                  <th>{t({ id: 'dungeon.detail.columnSourceId', message: '来源 ID' })}</th>
                </tr>
              </thead>
              <tbody>
                {document.spawns.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      {document.spatialStatus === 'pending'
                        ? t({
                            id: 'dungeon.detail.emptySpawnsPending',
                            message: '位置 / spawn 快照待核验；学习内容不依赖地图加载。',
                          })
                        : t({ id: 'dungeon.detail.emptySpawnsNone', message: '暂无位置数据。' })}
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
                          <div className="dungeon-enemy-cell">
                            <NpcPortrait npcId={enemy?.npcId} name={enemy?.name.zhCN} size={32} />
                            <div>
                              <strong>{enemy?.name.zhCN ?? spawn.enemyId}</strong>
                              <small>
                                {enemy?.npcId
                                  ? t({
                                      id: 'dungeon.detail.npcIdValue',
                                      message: `NPC ${enemy.npcId}`,
                                    })
                                  : t({
                                      id: 'dungeon.detail.npcIdPending',
                                      message: 'NPC ID 待核验',
                                    })}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {enemy?.abilityIds.length ? (
                            <div className="dungeon-chip-row">
                              {enemy.abilityIds.map((abilityId) => {
                                const ability = document.abilities.find(
                                  (candidate) => candidate.id === abilityId,
                                );
                                if (!ability) {
                                  return (
                                    <span className="dungeon-chip" key={abilityId}>
                                      {abilityId}
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className="dungeon-chip dungeon-chip--spell"
                                    key={abilityId}
                                    title={ability.action.zhCN}
                                  >
                                    <DungeonSpellIcon spellId={ability.spellId} />
                                    {ability.name.zhCN}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="dungeon-empty-text">
                              {t({ id: 'dungeon.detail.abilityKnowledgePending', message: '技能知识待核验' })}
                            </span>
                          )}
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
              <span className="dungeon-kicker">MONSTER SPELLBOOK</span>
              <h2>{t({ id: 'dungeon.detail.spellbookHeading', message: '怪物技能全览' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({ id: 'dungeon.detail.spellbookHint', message: 'mdt 事实参考层 · 只读' })}
            </span>
          </div>
          <p className="dungeon-coverage-intro">
            {t({
              id: 'dungeon.detail.spellbookIntro',
              message:
                '每只怪物的完整技能清单来自 mdt 事实参考层：悬停图标可看官方技能名与 Spell ID；已登记中文处理结论的技能会同时显示中文名。这是参考数据，不等同于已审校攻略。',
            })}
          </p>
          <div className="dungeon-spellbook-list">
            {document.enemies.map((enemy) => {
              const spellIds = getEnemySpellIds(enemy.npcId);
              if (spellIds.length === 0) {
                return (
                  <article className="dungeon-spellbook-row" key={enemy.id}>
                    <div className="dungeon-enemy-cell">
                      <NpcPortrait npcId={enemy.npcId} name={enemy.name.zhCN} size={36} />
                      <div>
                        <strong>{enemy.name.zhCN}</strong>
                        <small>
                          {enemy.isBoss
                            ? t({ id: 'dungeon.detail.enemyKindBoss', message: 'Boss' })
                            : t({ id: 'dungeon.detail.enemyKindMob', message: '怪物' })}{' · '}
                          {t({ id: 'dungeon.detail.spellSnapshotPending', message: '技能快照待接入' })}
                        </small>
                      </div>
                    </div>
                  </article>
                );
              }
              return (
                <article className="dungeon-spellbook-row" key={enemy.id}>
                  <div className="dungeon-enemy-cell dungeon-enemy-cell--book">
                    <NpcPortrait npcId={enemy.npcId} name={enemy.name.zhCN} size={36} />
                    <div>
                      <strong>{enemy.name.zhCN}</strong>
                      <small>
                        {enemy.isBoss
                          ? t({ id: 'dungeon.detail.enemyKindBoss', message: 'Boss' })
                          : t({ id: 'dungeon.detail.enemyKindMob', message: '怪物' })}
                        {t({
                          id: 'dungeon.detail.enemySpellCount',
                          message: ` · NPC ${enemy.npcId} · ${spellIds.length} 个技能`,
                        })}
                      </small>
                    </div>
                  </div>
                  <div className="dungeon-chip-row">
                    {spellIds.map((spellId) => {
                      const authored = document.abilities.find(
                        (ability) => ability.spellId === spellId,
                      );
                      const fact = getSpellFact(spellId);
                      return (
                        <span
                          className="dungeon-chip dungeon-chip--spell"
                          key={spellId}
                          title={
                            authored
                              ? `${fact?.name ?? `Spell ${spellId}`} · ${authored.action.zhCN}`
                              : `${fact?.name ?? `Spell ${spellId}`} (${spellId})`
                          }
                        >
                          <DungeonSpellIcon spellId={spellId} />
                          {authored ? authored.name.zhCN : fact?.name}
                        </span>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="dungeon-reference-footer">
            <span>
              {t({
                id: 'dungeon.detail.spellbookSourceNote',
                message:
                  '技能名与图标来自 grimoire DBC 快照（spellFacts/s2.json）；NPC 头像与地图瓦片来自 自建 OSS。换源只改 spellReference.ts 一处常量。',
              })}
            </span>
          </p>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-boss-list">
            {document.bosses.map((boss) => (
              <article className="dungeon-boss" key={boss.id}>
                <div>
                  <span className="dungeon-boss__eyebrow">{boss.id}</span>
                  <h3>
                    <Link to={`/dungeons/${document.id}/boss/${boss.id}`}>{boss.title.zhCN}</Link>
                  </h3>
                  <p>{boss.summary.zhCN}</p>
                </div>
                <div className="dungeon-chip-row">
                  {boss.focusAbilityIds.map((abilityId) => {
                    const ability = document.abilities.find(
                      (candidate) => candidate.id === abilityId,
                    );
                    return (
                      <span className="dungeon-chip dungeon-chip--spell" key={abilityId}>
                        <DungeonSpellIcon spellId={ability?.spellId} />
                        {ability?.name.zhCN ?? abilityId}
                      </span>
                    );
                  })}
                </div>
                <Link
                  className="dungeon-card__reference"
                  to={`/dungeons/${document.id}/boss/${boss.id}`}
                >
                  {t({ id: 'dungeon.detail.bossLearningLink', message: '查看 Boss 学习页 →' })}
                </Link>
              </article>
            ))}
          </div>
        </section>

        {!validation.ok && (
          <section className="dungeon-panel dungeon-panel--error">
            <h2>{t({ id: 'dungeon.detail.validationErrorsHeading', message: '校验错误' })}</h2>
            <ul>
              {validation.errors.map((error) => (
                <li key={`${error.code}-${error.path}`}>
                  <code>{error.code}</code> {error.path}：{error.message}
                </li>
              ))}
            </ul>
          </section>
        )}
        {validation.warnings.length > 0 && (
          <section className="dungeon-panel dungeon-panel--warning">
            <h2>{t({ id: 'dungeon.detail.warningsHeading', message: '待处理门禁' })}</h2>
            <p>
              {t({
                id: 'dungeon.detail.warningsIntro',
                message: '这些 warning 不影响本地预览，但在进入 reviewed/published 前必须逐条关闭。',
              })}
            </p>
            <ul>
              {validation.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.path}`}>
                  <code>{warning.code}</code> {warning.path}：{warning.message}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function DungeonNotFound() {
  return (
    <>
      <DocumentTitle title={t({ id: 'dungeon.home.notFoundTitle', message: '副本不存在' })} />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>{t({ id: 'dungeon.home.notFoundHeading', message: '找不到这个副本' })}</h1>
          <p>{t({ id: 'dungeon.home.notFoundDetail', message: '链接中的 dungeon ID 尚未注册。' })}</p>
          <Link to="/dungeons">
            {t({ id: 'dungeon.common.backToList', message: '返回副本列表' })}
          </Link>
        </section>
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId } = useParams();
  const [searchParams] = useSearchParams();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const progress = useMemo(() => readLearningProgress(), []);

  if (dungeonId && !document) {
    return <DungeonNotFound />;
  }

  if (document) {
    const entry = getDungeonCatalogEntry(document.id);
    const access = entry ? getDungeonScopedLearningAccess(entry, document) : undefined;
    if (access?.isFormal && searchParams.get('view') !== 'inspector') {
      return <Navigate replace to={`/dungeons/${document.id}/learn`} />;
    }
    return <DungeonDetail document={document} />;
  }

  return (
    <>
      <DocumentTitle title={t({ id: 'dungeon.common.home', message: '大秘境学习' })} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <span>{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</span>
      </NavigationBar>
      <main className="dungeon-shell">
        <header className="dungeon-hero dungeon-hero--index">
          <div>
            <span className="dungeon-kicker">DUNGEON LEARNING COMPANION</span>
            <h1>{t({ id: 'dungeon.home.heroTitle', message: '先学会处理，再进入副本' })}</h1>
            <p>
              {t({
                id: 'dungeon.home.heroDetail',
                message: '先从覆盖路线了解哪些副本已经有内容、坐标和审校证据，再进入对应的学习预览或只读检查页。',
              })}
            </p>
          </div>
          <div className="dungeon-hero__callout">
            <strong>{t({ id: 'dungeon.home.devStatus', message: '开发状态' })}</strong>
            <span>{t({ id: 'dungeon.home.devStatusDetail', message: '只读 · fixture · 可审计' })}</span>
          </div>
        </header>
        <section className="dungeon-panel dungeon-coverage-panel" aria-labelledby="coverage-title">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SEASON COVERAGE</span>
              <h2 id="coverage-title">{t({ id: 'dungeon.home.coverageHeading', message: 'S2 八本覆盖路线' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({ id: 'dungeon.home.coverageHint', message: '只有已审校/已发布条目可以进入正式学习' })}
            </span>
          </div>
          <p className="dungeon-coverage-intro">
            {t({
              id: 'dungeon.home.coverageIntro',
              message:
                '坐标和位置关系先作为只读空间参考接入；技能、波次和学习路线必须经过内容审校后才会开放。这样列表不会用空壳页面制造“已经有攻略”的错觉。',
            })}
          </p>
          <div className="dungeon-grid dungeon-grid--cards">
            {season2DungeonCatalog.map((entry) => (
              <DungeonCoverageCard
                assetProvider={assetProvider}
                entry={entry}
                key={entry.id}
                progress={progress}
              />
            ))}
          </div>
        </section>

        <section className="dungeon-panel dungeon-fixture-panel" aria-labelledby="fixture-title">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">INTERNAL PREVIEWS</span>
              <h2 id="fixture-title">{t({ id: 'dungeon.home.previewHeading', message: '内部学习原型' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.home.previewHint',
                message: '草稿用于验证内容闭环；fixture 只用于回归数据合同，均不代表正式攻略',
              })}
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

        {import.meta.env.DEV && (
          <section
            className="dungeon-panel dungeon-fixture-panel"
            aria-labelledby="legacy-qa-title"
          >
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">DEV ONLY · SOURCE QA</span>
                <h2 id="legacy-qa-title">
                  {t({ id: 'dungeon.home.legacyQaHeading', message: 'Threechest legacy 坐标 QA' })}
                </h2>
              </div>
              <span className="dungeon-panel__hint">
                {t({
                  id: 'dungeon.home.legacyQaHint',
                  message: '不属于 S2，不提供路线编辑或学习内容',
                })}
              </span>
            </div>
            <p className="dungeon-coverage-intro">
              {t({
                id: 'dungeon.home.legacyQaIntro',
                message: '仅用于本地验证 remote-dev 图片 manifest、坐标转换和 spawn 渲染；正式目录不会自动复用这些快照。',
              })}
            </p>
            <div className="dungeon-legacy-qa-list">
              {legacyThreechestCoordinateInventory.map((entry) => (
                <Link key={entry.sourceKey} to={`/dungeons/legacy/${entry.sourceKey}`}>
                  {entry.name.zhCN} · {entry.sourceKey}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
