import DocumentTitle from 'interface/DocumentTitle';
import NavigationBar from 'interface/NavigationBar';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';

import {
  getDungeonCatalogEntry,
  getDungeonDocument,
  getDungeonScopedLearningAccess,
  getLessonSharePath,
} from '../../dungeon';
import type { AbilityKnowledge, BossKnowledge, DungeonDocument, Role } from '../../dungeon';
import {
  getEnemySpellIds,
  getSpellFact,
} from '../../dungeon/data/spellReference';

import { DungeonSpellIcon, NpcPortrait } from './dungeonReference';

import './dungeons.scss';

function roleLabel(role: Role): string {
  switch (role) {
    case 'tank':
      return t({ id: 'dungeon.boss.role.tank', message: '坦克' });
    case 'healer':
      return t({ id: 'dungeon.boss.role.healer', message: '治疗' });
    default:
      return t({ id: 'dungeon.boss.role.dps', message: '输出' });
  }
}

function situationKindLabel(kind: string): string {
  switch (kind) {
    case 'boss':
      return t({ id: 'dungeon.boss.kind.boss', message: 'Boss 场景' });
    case 'critical':
      return t({ id: 'dungeon.boss.kind.critical', message: '关键机制' });
    case 'transition':
      return t({ id: 'dungeon.boss.kind.transition', message: '转场 / 过渡' });
    case 'routine':
      return t({ id: 'dungeon.boss.kind.routine', message: '常规场景' });
    case 'event':
      return t({ id: 'dungeon.boss.kind.event', message: '事件场景' });
    default:
      return kind;
  }
}

function BossNotFound() {
  return (
    <>
      <DocumentTitle title={t({ id: 'dungeon.boss.notFoundTitle', message: 'Boss 不存在' })} />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>{t({ id: 'dungeon.boss.notFoundHeading', message: '找不到这个 Boss' })}</h1>
          <p>
            {t({
              id: 'dungeon.boss.notFoundDetail',
              message: 'Boss 链接尚未注册，或者当前副本文档已经换了 revision。',
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

function BossUnavailable({ dungeonId, label }: { dungeonId: string; label: string }) {
  return (
    <>
      <DocumentTitle
        title={t({ id: 'dungeon.boss.unavailableTitle', message: 'Boss 学习待开放' })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }} />
      <main className="dungeon-shell">
        <section className="dungeon-panel dungeon-panel--error">
          <h1>{t({ id: 'dungeon.boss.unavailableTitle', message: 'Boss 学习待开放' })}</h1>
          <p>
            {t({
              id: 'dungeon.boss.unavailableDetail',
              message: `${label}。正式学习内容必须通过来源、空间数据和第二审校门禁。`,
            })}
          </p>
          <Link to={`/dungeons/${dungeonId}?view=inspector`}>
            {t({ id: 'dungeon.common.openInspector', message: '打开 Inspector' })}
          </Link>
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
        <div className="dungeon-boss-mechanism__title">
          <DungeonSpellIcon spellId={ability.spellId} />
          <div>
            <span className="dungeon-boss__eyebrow">
              {ability.decisionCritical ? 'DECISION CRITICAL' : 'MECHANIC'}
            </span>
            <h3>{ability.name.zhCN}</h3>
          </div>
        </div>
        <span className={`dungeon-severity dungeon-severity-${ability.severity}`}>
          {ability.severity === 'critical'
            ? t({ id: 'dungeon.boss.severity.critical', message: '致命' })
            : ability.severity === 'warning'
              ? t({ id: 'dungeon.boss.severity.warning', message: '高风险' })
              : t({ id: 'dungeon.boss.severity.info', message: '提示' })}
        </span>
      </div>
      <div className="dungeon-boss-mechanism__grid">
        <div>
          <span className="dungeon-boss-label">
            {t({ id: 'dungeon.boss.labelAction', message: '你要做什么' })}
          </span>
          <p>{ability.action.zhCN}</p>
        </div>
        <div>
          <span className="dungeon-boss-label">
            {t({ id: 'dungeon.boss.labelConsequence', message: '做错会怎样' })}
          </span>
          <p>{ability.consequence.zhCN}</p>
        </div>
        <div>
          <span className="dungeon-boss-label">
            {t({
              id: 'dungeon.boss.rolePrompt',
              message: `${roleLabel(role)}提示`,
            })}
          </span>
          <p>
            {roleAdvice ??
              t({
                id: 'dungeon.boss.roleAdviceMissing',
                message: '该角色建议待内容审校补充，不根据技能名猜测职责。',
              })}
          </p>
        </div>
      </div>
      {ability.memoryCue && (
        <p className="dungeon-boss-memory">
          <strong>{t({ id: 'dungeon.boss.memoryCuePrefix', message: '记忆句：' })}</strong>
          {ability.memoryCue.zhCN}
        </p>
      )}
      <small className="dungeon-boss-source">
        {t({
          id: 'dungeon.boss.sourcePrefix',
          message: `来源线索：${ability.provenance.map((source) => source.title).join(' · ') || t({ id: 'dungeon.boss.sourcePending', message: '待登记' })}`,
        })}
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
  const bossSpellIds = getEnemySpellIds(enemy?.npcId);
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
      <DocumentTitle
        title={t({
          id: 'dungeon.boss.pageTitle',
          message: `${boss.title.zhCN} · Boss 学习`,
        })}
      />
      <NavigationBar style={{ margin: 0, position: 'static' }}>
        <Link to="/dungeons">{t({ id: 'dungeon.common.home', message: '大秘境学习' })}</Link>
        <span className="learning-nav-separator">/</span>
        <Link to={`/dungeons/${document.id}?view=inspector`}>{document.name.zhCN}</Link>
      </NavigationBar>
      <main className="dungeon-shell">
        <div className="dungeon-breadcrumb">
          <Link to={`/dungeons/${document.id}?view=inspector`}>Inspector</Link>
          <span>/</span>
          {t({ id: 'dungeon.boss.breadcrumbTitle', message: 'Boss 学习' })}
        </div>
        <header className="dungeon-hero">
          <div>
            <div className="dungeon-card__eyebrow">
              <span>BOSS LEARNING CARD</span>
              <span className="dungeon-status dungeon-status-draft">
                {t({ id: 'dungeon.boss.statusReadOnly', message: '只读' })}
              </span>
            </div>
            <div className="dungeon-boss-hero-title">
              <NpcPortrait npcId={enemy?.npcId} name={boss.title.zhCN} size={56} />
              <div>
                <h1>{boss.title.zhCN}</h1>
                <p>{boss.summary.zhCN}</p>
              </div>
            </div>
          </div>
          <div className="dungeon-hero__metric">
            <span>{t({ id: 'dungeon.boss.metricCoreMechanics', message: '核心机制' })}</span>
            <strong>{abilities.length}</strong>
            <small>{enemy?.name.zhCN ?? boss.enemyId}</small>
          </div>
        </header>

        <section
          className="dungeon-grid dungeon-grid--summary"
          aria-label={t({ id: 'dungeon.boss.summarySectionLabel', message: 'Boss 学习摘要' })}
        >
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.boss.summaryObjective', message: '学习目标' })}</span>
            <strong>
              {bossSituations.length
                ? t({
                    id: 'dungeon.boss.scenarioCount',
                    message: `${bossSituations.length} 个场景`,
                  })
                : t({ id: 'dungeon.boss.summaryObjectivePending', message: '待补阶段' })}
            </strong>
            <small>
              {t({
                id: 'dungeon.boss.summaryObjectiveSmall',
                message: '用可观察的动作串起机制，而不是背波次编号',
              })}
            </small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.boss.summarySpatial', message: '空间线索' })}</span>
            <strong>
              {document.spatialStatus === 'verified' && floorNames.length
                ? floorNames.length
                : t({ id: 'dungeon.boss.pendingVerify', message: '待核验' })}
            </strong>
            <small>
              {floorNames.length
                ? floorNames.join('、')
                : t({
                    id: 'dungeon.boss.summarySpatialPending',
                    message: 'spawn / floor 尚未形成正式快照',
                  })}
            </small>
          </article>
          <article className="dungeon-panel dungeon-summary-card">
            <span>{t({ id: 'dungeon.boss.summaryRevision', message: '来源 revision' })}</span>
            <strong>{boss.version.revision}</strong>
            <small>{boss.version.build}</small>
          </article>
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">MECHANIC FLOW</span>
              <h2>{t({ id: 'dungeon.boss.phasesHeading', message: '阶段与学习场景' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({
                id: 'dungeon.boss.phasesHint',
                message: '当前模型以 Situation 承载阶段，不把未验证内容写成时间轴',
              })}
            </span>
          </div>
          {linkedSituations.length ? (
            <div className="dungeon-boss-situation-list">
              {linkedSituations.map((situation) => (
                <article className="dungeon-boss-situation" key={situation.id}>
                  <div>
                    <span className="dungeon-boss__eyebrow">
                      {situationKindLabel(situation.kind)}
                    </span>
                    <h3>{situation.title.zhCN}</h3>
                    <p>{situation.summary.zhCN}</p>
                  </div>
                  <Link
                    className="dungeon-card__reference"
                    to={getLessonSharePath(document.id, 'full', situation.id)}
                  >
                    {t({ id: 'dungeon.boss.openLearning', message: '打开完整学习 →' })}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="dungeon-empty-state">
              {t({
                id: 'dungeon.boss.emptySituations',
                message: '独立阶段 / Situation 尚未录入，待内容作者补充并审校。',
              })}
            </p>
          )}
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">CORE MECHANICS</span>
              <h2>{t({ id: 'dungeon.boss.mechanicsHeading', message: '核心机制：看懂、行动、后果' })}</h2>
            </div>
            <div
              className="dungeon-role-tabs"
              aria-label={t({ id: 'dungeon.boss.roleTabsLabel', message: '角色建议' })}
            >
              {(['tank', 'healer', 'dps'] as Role[]).map((candidate) => (
                <button
                  aria-pressed={role === candidate}
                  className={role === candidate ? 'is-active' : undefined}
                  key={candidate}
                  onClick={() => setRole(candidate)}
                  type="button"
                >
                  {roleLabel(candidate)}
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
            <p className="dungeon-empty-state">
              {t({
                id: 'dungeon.boss.emptyMechanics',
                message: '核心机制尚未绑定技能知识。',
              })}
            </p>
          )}
        </section>

        <section className="dungeon-panel">
          <div className="dungeon-panel__heading">
            <div>
              <span className="dungeon-kicker">FULL SPELLBOOK</span>
              <h2>{t({ id: 'dungeon.boss.spellbookHeading', message: '完整技能表' })}</h2>
            </div>
            <span className="dungeon-panel__hint">
              {t({ id: 'dungeon.boss.spellbookHint', message: 'threechest 游戏数据快照 · 只读参考' })}
            </span>
          </div>
          <p className="dungeon-coverage-intro">
            {t({
              id: 'dungeon.boss.spellbookIntro',
              message:
                '这是 Boss 的完整战斗技能清单（悬停可看官方技能名与 Spell ID），比核心机制索引更全；已登记中文处理结论的技能会额外显示中文名，处理策略仍以核心机制卡片为准。',
            })}
          </p>
          {bossSpellIds.length ? (
            <div className="dungeon-chip-row">
              {bossSpellIds.map((spellId) => {
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
          ) : (
            <p className="dungeon-empty-state">
              {t({
                id: 'dungeon.boss.emptySpellbook',
                message: '该 Boss 的技能快照尚未接入。',
              })}
            </p>
          )}
        </section>

        <div className="dungeon-grid dungeon-grid--main">
          <section className="dungeon-panel dungeon-panel--warning">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">FAILURE EVIDENCE</span>
                <h2>{t({ id: 'dungeon.boss.failureHeading', message: '常见失败' })}</h2>
              </div>
              <span className="dungeon-panel__hint">
                {t({ id: 'dungeon.boss.failureHint', message: '不凭经验猜测' })}
              </span>
            </div>
            <p>
              {t({
                id: 'dungeon.boss.failureDetail',
                message:
                  '当前没有通过 WCL 或实测样本归因的失败数据，因此页面不会生成“最常见失败”排名。后续接入样本时，需要保留查询条件、版本和匿名化证据，再把结论写回内容层。',
              })}
            </p>
          </section>
          <section className="dungeon-panel">
            <div className="dungeon-panel__heading">
              <div>
                <span className="dungeon-kicker">SPATIAL CONTEXT</span>
                <h2>{t({ id: 'dungeon.boss.spatialHeading', message: '位置参考' })}</h2>
              </div>
              <span className="dungeon-panel__hint">
                {document.spatialStatus === 'verified'
                  ? t({ id: 'dungeon.boss.spatialHintVerified', message: '已核验空间数据' })
                  : t({ id: 'dungeon.boss.spatialHintPending', message: '位置数据待核验' })}
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
                {t({
                  id: 'dungeon.boss.emptySpatial',
                  message: '位置 / spawn 快照待接入；不会用 Threechest 坐标直接宣称正式位置。',
                })}
              </p>
            )}
          </section>
        </div>

        <section className="dungeon-panel dungeon-boss-footer-note">
          <strong>{t({ id: 'dungeon.boss.footerLearningEntry', message: '学习入口' })}</strong>
          <span>
            {t({
              id: 'dungeon.boss.footerDetail',
              message: '先按角色看核心机制，再进入完整 Situation 复习；本页不提供编辑、导入或保存操作。',
            })}
          </span>
          {primarySituation ? (
            <Link to={getLessonSharePath(document.id, 'full', primarySituation.id)}>
              {t({ id: 'dungeon.boss.enterLearning', message: '进入完整学习 →' })}
            </Link>
          ) : (
            <Link to={`/dungeons/${document.id}?view=inspector`}>
              {t({ id: 'dungeon.boss.backToInspector', message: '返回 Inspector →' })}
            </Link>
          )}
        </section>
      </main>
    </>
  );
}

export function Component() {
  const { dungeonId, bossId } = useParams();
  const document = dungeonId ? getDungeonDocument(dungeonId) : undefined;
  const entry = dungeonId ? getDungeonCatalogEntry(dungeonId) : undefined;
  const boss = document?.bosses.find((candidate) => candidate.id === bossId);

  if (!dungeonId || !bossId) return <BossNotFound />;
  if (!document) {
    return entry ? (
      <BossUnavailable
        dungeonId={dungeonId}
        label={t({
          id: 'dungeon.boss.unavailableNoDocument',
          message: '该副本已有目录或位置参考，但攻略尚未接入',
        })}
      />
    ) : (
      <BossNotFound />
    );
  }
  if (!boss) return <BossNotFound />;

  const access = entry ? getDungeonScopedLearningAccess(entry, document) : undefined;
  if (!access) {
    return (
      <BossUnavailable
        dungeonId={document.id}
        label={t({ id: 'dungeon.boss.unavailableNotOpen', message: '攻略尚未开放' })}
      />
    );
  }
  if (!access.canOpen) return <BossUnavailable dungeonId={document.id} label={access.label} />;

  return <BossDetail boss={boss} document={document} />;
}
