import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

import { getDungeonDocument, getDungeonLearningAccess, getLessonSharePath } from '../../dungeon';
import type { AbilityKnowledge, BossKnowledge, DungeonDocument, Role } from '../../dungeon';

import './dungeons.scss';

const roleLabels: Record<Role, string> = {
  tank: '坦克',
  healer: '治疗',
  dps: '输出',
};

const situationKindLabels: Record<string, string> = {
  boss: 'Boss 场景',
  critical: '关键机制',
  transition: '转场 / 过渡',
  routine: '常规场景',
  event: '事件场景',
};

function BossNotFound() {
  return (
    <>
      <DocumentTitle title="Boss 不存在" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>找不到这个 Boss</h1>
          <p>Boss 链接尚未注册，或者当前副本文档已经换了 revision。</p>
          <Link to="/dungeons">返回副本列表</Link>
        </section>
      </main>
    </>
  );
}

function BossUnavailable({ dungeonId, label }: { dungeonId: string; label: string }) {
  return (
    <>
      <DocumentTitle title="Boss 学习待开放" />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>Boss 学习待开放</h1>
          <p>{label}。正式学习内容必须通过来源、空间数据和第二审校门禁。</p>
          <Link to={`/dungeons/${dungeonId}`}>打开 Inspector</Link>
        </section>
      </main>
    </>
  );
}

function getLinkedSituations(document: DungeonDocument, boss: BossKnowledge) {
  const abilityIds = new Set(boss.focusAbilityIds);
  const bossSpawnIds = new Set(
    document.spawns.filter((spawn) => spawn.enemyId === boss.enemyId).map((spawn) => spawn.id),
  );
  return document.situations
    .filter(
      (situation) =>
        situation.focusAbilityIds.some((abilityId) => abilityIds.has(abilityId)) ||
        situation.anchorSpawnIds.some((spawnId) => bossSpawnIds.has(spawnId)),
    )
    .sort((a, b) => {
      if (a.kind === 'boss' && b.kind !== 'boss') return -1;
      if (a.kind !== 'boss' && b.kind === 'boss') return 1;
      return a.id.localeCompare(b.id);
    });
}

function getRoleAdvice(
  role: Role,
  ability: AbilityKnowledge,
  linkedSituations: ReturnType<typeof getLinkedSituations>,
): string | undefined {
  return (
    ability.roleAdvice?.[role]?.zhCN ??
    linkedSituations.find((situation) => situation.focusAbilityIds.includes(ability.id))
      ?.roleAdvice?.[role]?.zhCN
  );
}

function MechanismCard({
  ability,
  role,
  linkedSituations,
}: {
  ability: AbilityKnowledge;
  role: Role;
  linkedSituations: ReturnType<typeof getLinkedSituations>;
}) {
  const roleAdvice = getRoleAdvice(role, ability, linkedSituations);
  return (
    <article className="dungeon-boss-mechanism">
      <div className="dungeon-boss-mechanism__heading">
        <div>
          <span className="dungeon-boss__eyebrow">
            {ability.decisionCritical ? 'DECISION CRITICAL' : 'MECHANIC'}
          </span>
          <h3>{ability.name.zhCN}</h3>
        </div>
        <span className={`dungeon-severity dungeon-severity-${ability.severity}`}>
          {ability.severity === 'critical'
            ? '致命'
            : ability.severity === 'warning'
              ? '高风险'
              : '提示'}
        </span>
      </div>
      <div className="dungeon-boss-mechanism__grid">
        <div>
          <span className="dungeon-boss-label">你要做什么</span>
          <p>{ability.action.zhCN}</p>
        </div>
        <div>
          <span className="dungeon-boss-label">做错会怎样</span>
          <p>{ability.consequence.zhCN}</p>
        </div>
        <div>
          <span className="dungeon-boss-label">{roleLabels[role]}提示</span>
          <p>{roleAdvice ?? '该角色建议待内容审校补充，不根据技能名猜测职责。'}</p>
        </div>
      </div>
      {ability.memoryCue && (
        <p className="dungeon-boss-memory">
          <strong>记忆句：</strong>
          {ability.memoryCue.zhCN}
        </p>
      )}
      <small className="dungeon-boss-source">
        来源线索：{ability.provenance.map((source) => source.title).join(' · ') || '待登记'}
      </small>
    </article>
  );
}

function BossDetail({ document, boss }: { document: DungeonDocument; boss: BossKnowledge }) {
  const [role, setRole] = useState<Role>('tank');
  const enemy = document.enemies.find((candidate) => candidate.id === boss.enemyId);
  const abilities = boss.focusAbilityIds.flatMap((abilityId) => {
    const ability = document.abilities.find((candidate) => candidate.id === abilityId);
    return ability ? [ability] : [];
  });
  const linkedSituations = useMemo(() => getLinkedSituations(document, boss), [document, boss]);
  const bossSituations = linkedSituations.filter((situation) => situation.kind === 'boss');
  const primarySituation = bossSituations[0] ?? linkedSituations[0];
  const bossSpawns = enemy ? document.spawns.filter((spawn) => spawn.enemyId === enemy.id) : [];
  const floorNames = [
    ...new Set(
      bossSpawns.map(
        (spawn) => document.floors.find((floor) => floor.id === spawn.floorId)?.name.zhCN,
      ),
    ),
  ].filter((name): name is string => Boolean(name));

  return (
    <>
      <DocumentTitle title={`${boss.title.zhCN} · Boss 学习`} />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">大秘境学习</Link>
        <span className="learning-nav-separator">/</span>
        <Link to={`/dungeons/${document.id}`}>{document.name.zhCN}</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to={`/dungeons/${document.id}`}>Inspector</Link>
          <span>/</span>
          Boss 学习
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>BOSS LEARNING CARD</span>
              <span className="dungeon-status dungeon-status-draft">只读</span>
            </div>
            <h1>{boss.title.zhCN}</h1>
            <p>{boss.summary.zhCN}</p>
          </div>
          <div className="dungeon-hero__metric">
            <span>核心机制</span>
            <strong>{abilities.length}</strong>
            <small>{enemy?.name.zhCN ?? boss.enemyId}</small>
          </div>
        </header>

        <section className="dungeon-grid dungeon-grid--summary" aria-label="Boss 学习摘要">
          <article className="dungeon-panel dungeon-summary-card">
            <span>学习目标</span>
            <strong>
              {bossSituations.length ? `${bossSituations.length} 个场景` : '待补阶段'}
            </strong>
            <small>用可观察的动作串起机制，而不是背波次编号</small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>空间线索</span>
            <strong>
              {document.spatialStatus === 'verified' && floorNames.length
                ? floorNames.length
                : '待核验'}
            </strong>
            <small>
              {floorNames.length ? floorNames.join('、') : 'spawn / floor 尚未形成正式快照'}
            </small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>来源 revision</span>
            <strong>{boss.version.revision}</strong>
            <small>{boss.version.build}</small>
          </article>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">MECHANIC FLOW</span>
              <h2>阶段与学习场景</h2>
            </div>
            <span className="dungeon-panel__hint">
              当前模型以 Situation 承载阶段，不把未验证内容写成时间轴
            </span>
          </div>
          {linkedSituations.length ? (
            <div className="dungeon-boss-situation-list">
              {linkedSituations.map((situation) => (
                <article className="dungeon-boss-situation" key={situation.id}>
                  <div>
                    <span className="dungeon-boss__eyebrow">
                      {situationKindLabels[situation.kind] ?? situation.kind}
                    </span>
                    <h3>{situation.title.zhCN}</h3>
                    <p>{situation.summary.zhCN}</p>
                  </div>
                  <Link
                    className="dungeon-card__reference"
                    to={getLessonSharePath(document.id, 'full', situation.id)}
                  >
                    打开完整学习 →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="dungeon-empty-state">
              独立阶段 / Situation 尚未录入，待内容作者补充并审校。
            </p>
          )}
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">CORE MECHANICS</span>
              <h2>核心机制：看懂、行动、后果</h2>
            </div>
            <div className="dungeon-role-tabs" aria-label="角色建议">
              {(Object.keys(roleLabels) as Role[]).map((candidate) => (
                <button
                  aria-pressed={role === candidate}
                  className={role === candidate ? 'is-active' : undefined}
                  key={candidate}
                  onClick={() => setRole(candidate)}
                  type="button"
                >
                  {roleLabels[candidate]}
                </button>
              ))}
            </div>
          </div>
          {abilities.length ? (
            <div className="dungeon-boss-mechanism-list">
              {abilities.map((ability) => (
                <MechanismCard
                  ability={ability}
                  key={ability.id}
                  linkedSituations={linkedSituations}
                  role={role}
                />
              ))}
            </div>
          ) : (
            <p className="dungeon-empty-state">核心机制尚未绑定技能知识。</p>
          )}
        </section>

        <div className="dungeon-grid dungeon-grid--main">
          <section className="dungeon-panel dungeon-panel--warning">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">FAILURE EVIDENCE</span>
                <h2>常见失败</h2>
              </div>
              <span className="dungeon-panel__hint">不凭经验猜测</span>
            </div>
            <p>
              当前没有通过 WCL 或实测样本归因的失败数据，因此页面不会生成“最常见失败”排名。
              后续接入样本时，需要保留查询条件、版本和匿名化证据，再把结论写回内容层。
            </p>
          </section>
          <section className="dungeon-panel">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">SPATIAL CONTEXT</span>
                <h2>位置参考</h2>
              </div>
              <span className="dungeon-panel__hint">
                {document.spatialStatus === 'verified' ? '已核验空间数据' : '位置数据待核验'}
              </span>
            </div>
            {bossSpawns.length > 0 && document.spatialStatus === 'verified' ? (
              <ul className="dungeon-boss-location-list">
                {bossSpawns.map((spawn) => (
                  <li key={spawn.id}>
                    <strong>
                      {document.floors.find((floor) => floor.id === spawn.floorId)?.name.zhCN}
                    </strong>
                    <span>
                      {spawn.position[0].toFixed(2)}, {spawn.position[1].toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dungeon-empty-state">
                位置 / spawn 快照待接入；不会用 Threechest 坐标直接宣称正式位置。
              </p>
            )}
          </section>
        </div>

        <section className="dungeon-panel dungeon-boss-footer-note">
          <strong>学习入口</strong>
          <span>
            先按角色看核心机制，再进入完整 Situation 复习；本页不提供编辑、导入或保存操作。
          </span>
          {primarySituation ? (
            <Link to={getLessonSharePath(document.id, 'full', primarySituation.id)}>
              进入完整学习 →
            </Link>
          ) : (
            <Link to={`/dungeons/${document.id}`}>返回 Inspector →</Link>
          )}
        </section>
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId, bossId } = useParams();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const boss = document?.bosses.find((candidate) => candidate.id === bossId);

  if (!document || !boss) return <BossNotFound />;

  const access = getDungeonLearningAccess(document);
  if (!access.canOpen) return <BossUnavailable dungeonId={document.id} label={access.label} />;

  return <BossDetail boss={boss} document={document} />;
}
