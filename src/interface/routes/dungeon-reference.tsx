import { t } from '@lingui/core/macro';
import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

import {
  createAssetProviderFromEnv,
  dungeonCoverageStatusLabel,
  DungeonMap,
  getCoordinateReference,
  getDungeonCatalogEntry,
} from '../../dungeon';

import './dungeons.scss';

function ReferenceNotFound({ pending = false }: { pending?: boolean }) {
  return (
    <>
      <DocumentTitle
        title={t({ id: 'dungeon.reference.notFoundTitle', message: '位置参考不存在' })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>
            {pending
              ? t({ id: 'dungeon.reference.notFoundHeadingPending', message: '位置参考还在建设中' })
              : t({ id: 'dungeon.reference.notFoundHeading', message: '找不到这个位置参考' })}
          </h1>
          <p>
            {pending
              ? t({
                  id: 'dungeon.reference.notFoundDetailPending',
                  message:
                    '这个 S2 副本已经登记，但可靠的地图/坐标来源尚未接入；当前不会用旧副本数据代替。',
                })
              : t({
                  id: 'dungeon.reference.notFoundDetail',
                  message: '链接中的副本还没有进入 S2 目录。',
                })}
          </p>
          <Link to="/dungeons">
            {t({ id: 'dungeon.reference.backToCoverage', message: '返回副本覆盖路线' })}
          </Link>
        </section>
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId } = useParams();
  const entry = dungeonId ? getDungeonCatalogEntry(dungeonId) : undefined;
  const reference = entry ? getCoordinateReference(entry) : undefined;
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const [selectedSpawnId, setSelectedSpawnId] = useState<string>();

  if (!entry || !reference) {
    return <ReferenceNotFound pending={Boolean(entry)} />;
  }

  const selectedSpawn = reference.spawns.find((spawn) => spawn.id === selectedSpawnId);
  const pageTitle = t({
    id: 'dungeon.reference.pageTitle',
    message: `${entry.name.zhCN} · 位置参考`,
  });

  return (
    <>
      <DocumentTitle title={pageTitle} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
          <span>/</span>
          {pageTitle}
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>READ-ONLY COORDINATE REFERENCE</span>
              <span className={`dungeon-status dungeon-status-${entry.status}`}>
                {dungeonCoverageStatusLabel[entry.status]}
              </span>
            </div>
            <h1>{entry.name.zhCN}</h1>
            <p>
              {t({
                id: 'dungeon.reference.heroHint',
                message:
                  '这里仅帮助你理解怪物出现位置、组别和巡逻关系。它不是 MDT 编辑器，也不代表技能、forces 或默认路线已经审校。',
              })}
            </p>
          </div>
          <div className="dungeon-hero__metric">
            <span>
              {t({ id: 'dungeon.common.positionCount', message: '位置数量' })}
            </span>
            <strong>{reference.spawns.length}</strong>
            <small>
              {t({
                id: 'dungeon.reference.coordinateMeta',
                message: `normalized-v1 · ${reference.snapshot.snapshotId}`,
              })}
            </small>
          </div>
        </header>

        <section className="dungeon-panel dungeon-map-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SPATIAL CONTEXT</span>
              <h2>
                {t({ id: 'dungeon.reference.coordinateHeading', message: '坐标与组别' })}
              </h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.reference.mapHint',
                message: '地图背景失败时，坐标层仍可用',
              })}
            </span>
          </div>
          <DungeonMap
            floor={reference.floor}
            spawns={reference.spawns}
            selectedSpawnIds={selectedSpawnId ? [selectedSpawnId] : []}
            asset={assetProvider.getFloorMap(entry.mapAssetKey)}
            onSpawnSelect={setSelectedSpawnId}
          />
          {selectedSpawn && (
            <div className="dungeon-map-selection">
              <strong>{selectedSpawn.id}</strong>
              <span>
                {selectedSpawn.position[0].toFixed(2)}, {selectedSpawn.position[1].toFixed(2)}
                {selectedSpawn.groupId ? ` · ${selectedSpawn.groupId}` : ''}
              </span>
            </div>
          )}
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SOURCE SNAPSHOT</span>
              <h2>
                {t({ id: 'dungeon.reference.auditHeading', message: '快照审计信息' })}
              </h2>
            </div>
          </div>
          <div className="dungeon-grid dungeon-grid--summary">
            <article className="dungeon-summary-card">
              <span>{t({ id: 'dungeon.common.summarySource', message: '来源' })}</span>
              <strong>Threechest</strong>
              <small>
                {t({ id: 'dungeon.common.summaryFields', message: '仅位置字段' })}
              </small>
            </article>
            <article className="dungeon-summary-card">
              <span>
                {t({
                  id: 'dungeon.reference.summaryCoordinateSpace',
                  message: '原始坐标空间',
                })}
              </span>
              <strong>threechest-yx</strong>
              <small>
                {t({
                  id: 'dungeon.reference.summaryImportDetail',
                  message: '导入后转换为 normalized-v1',
                })}
              </small>
            </article>
            <article className="dungeon-summary-card">
              <span>
                {t({ id: 'dungeon.reference.summaryTransformVersion', message: '转换版本' })}
              </span>
              <strong>v1</strong>
              <small>{reference.snapshot.rawSha256.slice(0, 16)}…</small>
            </article>
            <article className="dungeon-summary-card">
              <span>
                {t({ id: 'dungeon.reference.summaryUpdated', message: '更新时间' })}
              </span>
              <strong>{reference.snapshot.retrievedAt}</strong>
              <small>
                {t({
                  id: 'dungeon.reference.summaryUpdatedDetail',
                  message: '后续按快照手动维护',
                })}
              </small>
            </article>
          </div>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SPAWN INDEX</span>
              <h2>
                {t({ id: 'dungeon.common.spawnIndexHeading', message: '位置索引' })}
              </h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.reference.spawnIndexHint',
                message: '源 enemy ID 仅用于定位，非技能攻略',
              })}
            </span>
          </div>
          <div className="dungeon-table-wrap">
            <table className="dungeon-table">
              <thead>
                <tr>
                  <th>{t({ id: 'dungeon.common.columnSourceId', message: '源位置 ID' })}</th>
                  <th>{t({ id: 'dungeon.common.columnEnemy', message: '源 enemy' })}</th>
                  <th>{t({ id: 'dungeon.common.columnGroup', message: '组别' })}</th>
                  <th>{t({ id: 'dungeon.reference.columnPatrol', message: '巡逻' })}</th>
                  <th>{t({ id: 'dungeon.common.columnCoordinate', message: '坐标' })}</th>
                </tr>
              </thead>
              <tbody>
                {reference.spawns.map((spawn) => (
                  <tr key={spawn.id}>
                    <td>
                      <button
                        className="dungeon-reference-select"
                        type="button"
                        onClick={() => setSelectedSpawnId(spawn.id)}
                      >
                        {spawn.sourceId}
                      </button>
                    </td>
                    <td>{spawn.enemyId.replace(`${entry.id}:source-enemy:`, '')}</td>
                    <td>{spawn.groupId ?? '—'}</td>
                    <td>
                      {spawn.patrol
                        ? t({
                            id: 'dungeon.reference.patrolPointCount',
                            message: `${spawn.patrol.points.length} 点`,
                          })
                        : '—'}
                    </td>
                    <td className="dungeon-coordinate">
                      {spawn.position[0].toFixed(2)}, {spawn.position[1].toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="dungeon-reference-footer">
          <Link to="/dungeons">
            {t({ id: 'dungeon.reference.footerBack', message: '← 返回八本覆盖路线' })}
          </Link>
          <Link to="/">
            {t({
              id: 'dungeon.reference.footerWcl',
              message: '已有 WCL 日志？进入日志分析 →',
            })}
          </Link>
          <span>
            {t({
              id: 'dungeon.reference.footerNote',
              message: '正式攻略会在内容审校完成后单独开放。',
            })}
          </span>
        </div>
      </main>
    </>
  );
}
