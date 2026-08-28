import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';

import {
  createAssetProviderFromEnv,
  DungeonMap,
  getCoordinateReference,
  legacyThreechestCoordinateInventory,
} from '../../dungeon';

import './dungeons.scss';

function LegacyNotFound() {
  return (
    <>
      <DocumentTitle
        title={t({ id: 'dungeon.legacy.notFoundTitle', message: 'Legacy 坐标不存在' })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>{t({ id: 'dungeon.legacy.notFoundHeading', message: '找不到这个 legacy 坐标快照' })}</h1>
          <p>
            {t({
              id: 'dungeon.legacy.notFoundDetail',
              message: '该入口只接受已登记的 Threechest source key，不会从 S2 副本自动猜测映射。',
            })}
          </p>
          <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
        </section>
      </main>
    </>
  );
}

export function Component() {
  const { sourceKey } = useParams();
  const entry = legacyThreechestCoordinateInventory.find(
    (candidate) => candidate.sourceKey === sourceKey,
  );
  const reference = entry ? getCoordinateReference(entry) : undefined;
  const assetProvider = useMemo(() => createAssetProviderFromEnv(import.meta.env), []);
  const [selectedSpawnId, setSelectedSpawnId] = useState<string>();
  const pageTitle = t({
    id: 'dungeon.legacy.pageTitle',
    message: `${entry?.name.zhCN ?? ''} · legacy 坐标 QA`,
  });

  if (!entry || !reference) return <LegacyNotFound />;

  const selectedSpawn = reference.spawns.find((spawn) => spawn.id === selectedSpawnId);

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
              <span>DEV ONLY · LEGACY COORDINATE QA</span>
              <span className="dungeon-status dungeon-status-coordinate-ready">
                Threechest snapshot
              </span>
            </div>
            <h1>{entry.name.zhCN}</h1>
            <p>
              {t({
                id: 'dungeon.legacy.renderVerification',
                message:
                  '仅验证 Threechest 瓦片、坐标转换、组别和巡逻数据的渲染。它不属于 Midnight S2 目录，不提供学习内容、forces 结论或路线编辑功能。',
              })}
            </p>
          </div>
          <div className="dungeon-hero__metric">
            <span>{t({ id: 'dungeon.common.positionCount', message: '位置数量' })}</span>
            <strong>{reference.spawns.length}</strong>
            <small>{reference.snapshot.snapshotId}</small>
          </div>
        </header>

        <section className="dungeon-panel dungeon-map-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SPATIAL QA</span>
              <h2>{t({ id: 'dungeon.legacy.tilesHeading', message: '瓦片与坐标层' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.legacy.tilesHint',
                message: '背景失败时仍应保留坐标层',
              })}
            </span>
          </div>
          <DungeonMap
            asset={assetProvider.getFloorMap(entry.mapAssetKey)}
            floor={reference.floor}
            onSpawnSelect={setSelectedSpawnId}
            selectedSpawnIds={selectedSpawnId ? [selectedSpawnId] : []}
            spawns={reference.spawns}
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
              <h2>{t({ id: 'dungeon.legacy.coordinateAuditHeading', message: '转换审计' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({ id: 'dungeon.legacy.coordinateAuditHint', message: '只读 QA 数据' })}
            </span>
          </div>
          <div className="dungeon-grid dungeon-grid--summary">
            <article className="dungeon-summary-card">
              <span>{t({ id: 'dungeon.common.summarySource', message: '来源' })}</span>
              <strong>Threechest</strong>
              <small>{t({ id: 'dungeon.common.summaryFields', message: '仅位置字段' })}</small>
            </article>
            <article className="dungeon-summary-card">
              <span>{t({ id: 'dungeon.legacy.summaryTransform', message: '坐标转换' })}</span>
              <strong>normalized-v1</strong>
              <small>
                {t({
                  id: 'dungeon.legacy.summaryTransformDetail',
                  message: 'threechest-yx → normalized-v1',
                })}
              </small>
            </article>
            <article className="dungeon-summary-card">
              <span>{t({ id: 'dungeon.legacy.summaryHash', message: '原始 hash' })}</span>
              <strong>{reference.snapshot.rawSha256.slice(0, 12)}…</strong>
              <small>{reference.snapshot.retrievedAt}</small>
            </article>
            <article className="dungeon-summary-card">
              <span>{t({ id: 'dungeon.legacy.summaryMapAsset', message: '地图资源' })}</span>
              <strong>manifest</strong>
              <small>{entry.mapAssetKey}</small>
            </article>
          </div>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">SPAWN INDEX</span>
              <h2>{t({ id: 'dungeon.common.spawnIndexHeading', message: '位置索引' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.legacy.spawnIndexHint',
                message: 'source enemy 只用于坐标 QA',
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
                  <th>{t({ id: 'dungeon.common.columnCoordinate', message: '坐标' })}</th>
                </tr>
              </thead>
              <tbody>
                {reference.spawns.map((spawn) => (
                  <tr key={spawn.id}>
                    <td>
                      <button
                        className="dungeon-reference-select"
                        onClick={() => setSelectedSpawnId(spawn.id)}
                        type="button"
                      >
                        {spawn.sourceId}
                      </button>
                    </td>
                    <td>{spawn.enemyId.replace(`${entry.id}:source-enemy:`, '')}</td>
                    <td>{spawn.groupId ?? '—'}</td>
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
            {t({ id: 'dungeon.legacy.footerBack', message: '← 返回大秘境学习' })}
          </Link>
          <span>
            {t({
              id: 'dungeon.legacy.footerNote',
              message: '此页面不会把 legacy 数据映射到 Midnight S2。',
            })}
          </span>
        </div>
      </main>
    </>
  );
}
