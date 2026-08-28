import { isLearningPublished, type DungeonCatalogEntry } from '../data/season2Catalog';
import { getDungeonContentCoverage } from '../schema/coverage';
import type { DungeonDocument, FactBindingIdentity, PullStep, Provenance } from '../schema/types';
import { getDungeonLearningAccess, type DungeonLearningAccess } from './access';
import { coordinateBindingMatchesEntry, getCoordinateReference } from './coordinates';
import { getMdtReferenceSummary } from '../data/spellReference';
import { factBindingIdentityMatchesDocument } from './factBinding';
import {
  getForcesSnapshotRegistryEntry,
  getFactBindingRegistryEntry,
  type ApprovedForcesSnapshot,
  type ApprovedFactBinding,
  validateFactBindingRegistry,
  validateForcesSnapshotRegistry,
} from './sourceRegistry';

export type ContentReadinessGateId =
  | 'coordinates'
  | 'enemy-facts'
  | 'ability-facts'
  | 'forces'
  | 'learning-surfaces'
  | 'review';

export type ContentReadinessGateState = 'ready' | 'pending' | 'blocked';
export type DungeonReadinessState =
  | 'catalog-only'
  | 'coordinate-only'
  | 'learning-preview'
  | 'ready'
  | 'blocked';

export interface ContentReadinessGate {
  id: ContentReadinessGateId;
  label: string;
  state: ContentReadinessGateState;
  detail: string;
}

export interface DungeonContentReadiness {
  dungeonId: string;
  state: DungeonReadinessState;
  gates: ContentReadinessGate[];
  readyGateCount: number;
  totalGateCount: number;
  documentPresent: boolean;
  counts: {
    enemies: number;
    abilities: number;
    situations: number;
    routes: number;
    bosses: number;
  };
}

const gateLabels: Record<ContentReadinessGateId, string> = {
  coordinates: '位置参考',
  'enemy-facts': '怪物事实',
  'ability-facts': '技能事实',
  forces: 'forces 与 Pull',
  'learning-surfaces': '学习表面',
  review: '作者与第二审校',
};

const emptyCounts: DungeonContentReadiness['counts'] = {
  enemies: 0,
  abilities: 0,
  situations: 0,
  routes: 0,
  bosses: 0,
};

const hasApprovedFactProvenance = (
  provenance: readonly Provenance[],
  gameBuild: string,
  snapshotId?: string,
  snapshotDigest?: string,
): boolean =>
  provenance.some(
    (source) =>
      source.licenseStatus === 'approved' &&
      source.gameBuild === gameBuild &&
      (source.type === 'official' || source.type === 'game-data' || source.type === 'wcl') &&
      (!snapshotId ||
        (snapshotDigest !== undefined
          ? source.snapshot === `${snapshotId}:${snapshotDigest}`
          : source.snapshot === snapshotId)),
  );

const gate = (
  id: ContentReadinessGateId,
  state: ContentReadinessGateState,
  detail: string,
): ContentReadinessGate => ({ id, label: gateLabels[id], state, detail });

export function forcesSnapshotMatchesRegistry(
  document: DungeonDocument,
  registryEntry: ApprovedForcesSnapshot | undefined,
): boolean {
  const snapshot = document.forcesSnapshot;
  return Boolean(
    snapshot &&
    registryEntry &&
    validateForcesSnapshotRegistry([registryEntry]).length === 0 &&
    registryEntry.status === 'approved' &&
    registryEntry.source !== 'manual-test' &&
    registryEntry.registryKey === snapshot.registryKey &&
    registryEntry.dungeonId === document.id &&
    registryEntry.snapshotId === snapshot.snapshot &&
    registryEntry.source === snapshot.source &&
    registryEntry.gameBuild === snapshot.gameBuild &&
    registryEntry.digest === snapshot.digest &&
    registryEntry.totalEnemyForcesPoints === document.totalEnemyForcesPoints &&
    Object.keys(registryEntry.enemyForces).length === document.enemies.length &&
    document.enemies.every((enemy) => registryEntry.enemyForces[enemy.id] === enemy.forcesPoints),
  );
}

export function factBindingMatchesRegistry(
  document: DungeonDocument,
  identity: FactBindingIdentity | undefined,
  registryEntry: ApprovedFactBinding | undefined,
): boolean {
  if (
    !identity ||
    !Array.isArray(identity.enemies) ||
    !Array.isArray(identity.abilities) ||
    !registryEntry ||
    !factBindingIdentityMatchesDocument(document, identity) ||
    validateFactBindingRegistry([registryEntry]).length > 0
  ) {
    return false;
  }
  if (registryEntry.status !== 'approved') return false;
  const sameIds = (left: readonly string[], right: readonly string[]) => {
    const rightSet = new Set(right);
    return left.length === rightSet.size && left.every((id) => rightSet.has(id));
  };
  return Boolean(
    registryEntry.registryKey === identity.registryKey &&
    registryEntry.dungeonId === document.id &&
    registryEntry.season === document.season &&
    registryEntry.gameBuild === document.version.build &&
    registryEntry.snapshotId === identity.snapshotId &&
    registryEntry.snapshotDigest === identity.snapshotDigest &&
    registryEntry.manifestDigest === identity.manifestDigest &&
    sameIds(
      identity.enemies.map((row) => row.documentEnemyId),
      registryEntry.enemyDocumentIds,
    ) &&
    sameIds(
      identity.enemies.map((row) => row.sourceKey),
      registryEntry.enemySourceKeys,
    ) &&
    sameIds(
      identity.abilities.map((row) => row.documentAbilityId),
      registryEntry.abilityDocumentIds,
    ) &&
    sameIds(
      identity.abilities.map((row) => row.sourceKey),
      registryEntry.abilitySourceKeys,
    ) &&
    identity.enemies.every(
      (row, index) =>
        row.sourceKey === registryEntry.enemySourceKeys[index] &&
        row.documentEnemyId === registryEntry.enemyDocumentIds[index],
    ) &&
    identity.abilities.every(
      (row, index) =>
        row.sourceKey === registryEntry.abilitySourceKeys[index] &&
        row.documentAbilityId === registryEntry.abilityDocumentIds[index],
    ) &&
    identity.enemies.every((row, index) => {
      const reviewed = registryEntry.enemyFacts[index];
      return Boolean(
        reviewed &&
        reviewed.sourceKey === row.sourceKey &&
        reviewed.documentEnemyId === row.documentEnemyId &&
        reviewed.npcId === row.npcId &&
        reviewed.isBoss === row.isBoss &&
        reviewed.forcesPoints === row.forcesPoints,
      );
    }) &&
    identity.abilities.every((row, index) => {
      const reviewed = registryEntry.abilityFacts[index];
      return Boolean(
        reviewed &&
        reviewed.sourceKey === row.sourceKey &&
        reviewed.documentAbilityId === row.documentAbilityId &&
        reviewed.spellId === row.spellId &&
        JSON.stringify(reviewed.casterEnemyKeys) === JSON.stringify(row.casterEnemyKeys),
      );
    }),
  );
}

/**
 * Builds the single readiness view shared by the catalog UI and CLI report.
 *
 * A coordinate snapshot is intentionally only one gate.  The other gates
 * require owned facts and learning documents, so a coordinate-only entry can
 * never be mistaken for a published guide.
 */
export function getDungeonContentReadiness(
  entry: DungeonCatalogEntry,
  document?: DungeonDocument,
  baseAccess?: DungeonLearningAccess,
): DungeonContentReadiness {
  // Registry fixtures are intentionally available to the Inspector and
  // contract tests, but must never count as S2 learning content.
  const contentDocument = document?.dataStatus === 'fixture' ? undefined : document;
  const coordinateReferenceReady = Boolean(
    entry.coordinateSnapshotId && getCoordinateReference(entry),
  );
  const coordinateReady = Boolean(
    coordinateReferenceReady &&
    (!contentDocument || coordinateBindingMatchesEntry(entry, contentDocument.coordinateBinding)),
  );
  const coordinates = coordinateReady
    ? gate('coordinates', 'ready', '来源快照、stable SpawnId 和 local-research 用途校验通过。')
    : gate(
        'coordinates',
        'pending',
        entry.coordinateSnapshotId
          ? '坐标快照尚未通过来源或 identity registry 门禁。'
          : '尚未登记可审计的坐标快照。',
      );

  if (!contentDocument) {
    const pending = (id: Exclude<ContentReadinessGateId, 'coordinates'>, detail: string) =>
      gate(id, 'pending', detail);
    // MDT 参考层已导入的副本，用真实数据统计替代笼统的"待接入"话术；
    // 门禁本身保持 fail-closed：未登记 DungeonDocument 前一律 pending。
    const mdt = getMdtReferenceSummary(entry.sourceKey);
    const gates = [
      coordinates,
      pending(
        'enemy-facts',
        mdt
          ? `MDT 事实快照已导入：${mdt.enemies} 敌人 · ${mdt.totalForces} forces（来源已批准）；待生成 DungeonDocument 并登记 factBinding。`
          : '尚未登记 DungeonDocument，NPC ID 与来源待接入。',
      ),
      pending(
        'ability-facts',
        mdt
          ? `MDT 技能参考已导入：${mdt.spells} 个技能 ID（含中文词典）；待登记 Spell ID 与中文动作/后果文案。`
          : '尚未登记 DungeonDocument，Spell ID 与技能动作待接入。',
      ),
      pending(
        'forces',
        mdt
          ? `MDT 参考合计 ${mdt.totalForces} forces；待登记核验过的 forces snapshot 与 Pull 绑定。`
          : '尚未登记 DungeonDocument，forces snapshot 与 Pull 绑定待接入。',
      ),
      pending('learning-surfaces', '尚未登记 Situation、Boss 或学习友好路线。'),
      pending('review', '尚未有作者自测、第二审校和目标 build 记录。'),
    ];
    return buildReadiness(entry.id, gates, false, { ...emptyCounts });
  }

  if (contentDocument.id !== entry.id || contentDocument.season !== entry.season) {
    const identityDetail = `DungeonDocument 身份不匹配：${contentDocument.id}/${contentDocument.season} 不能用于 ${entry.id}/${entry.season}。`;
    const gates = [
      coordinates,
      gate('enemy-facts', 'blocked', identityDetail),
      gate('ability-facts', 'blocked', identityDetail),
      gate('forces', 'blocked', identityDetail),
      gate('learning-surfaces', 'blocked', identityDetail),
      gate('review', 'blocked', identityDetail),
    ];
    return buildReadiness(entry.id, gates, false, { ...emptyCounts });
  }

  const counts = {
    enemies: contentDocument.enemies.length,
    abilities: contentDocument.abilities.length,
    situations: contentDocument.situations.length,
    routes: contentDocument.routes.length,
    bosses: contentDocument.bosses.length,
  };
  const factBindingRegistry = contentDocument.factBinding?.registryKey
    ? getFactBindingRegistryEntry(contentDocument.factBinding.registryKey)
    : undefined;
  const factArtifactReady = factBindingMatchesRegistry(
    contentDocument,
    contentDocument.factBinding,
    factBindingRegistry,
  );
  const factSnapshotId = contentDocument.factBinding?.snapshotId;
  const factSnapshotDigest = contentDocument.factBinding?.snapshotDigest;
  const enemiesWithFacts = contentDocument.enemies.filter(
    (enemy) =>
      factArtifactReady &&
      Number.isInteger(enemy.npcId) &&
      (enemy.npcId ?? 0) > 0 &&
      enemy.factBuild === contentDocument.version.build &&
      hasApprovedFactProvenance(
        enemy.provenance,
        contentDocument.version.build,
        factSnapshotId,
        factSnapshotDigest,
      ),
  ).length;
  const abilitiesWithFacts = contentDocument.abilities.filter(
    (ability) =>
      factArtifactReady &&
      Number.isInteger(ability.spellId) &&
      (ability.spellId ?? 0) > 0 &&
      typeof ability.action?.zhCN === 'string' &&
      ability.action.zhCN.trim().length > 0 &&
      typeof ability.consequence?.zhCN === 'string' &&
      ability.consequence.zhCN.trim().length > 0 &&
      ability.version.build === contentDocument.version.build &&
      ability.version.status === contentDocument.version.status &&
      hasApprovedFactProvenance(
        ability.provenance,
        contentDocument.version.build,
        factSnapshotId,
        factSnapshotDigest,
      ),
  ).length;
  const enemyFacts =
    contentDocument.enemies.length > 0 && enemiesWithFacts === contentDocument.enemies.length
      ? gate(
          'enemy-facts',
          'ready',
          `已核验 ${enemiesWithFacts}/${contentDocument.enemies.length} 个敌人，且事实绑定 identity 已通过。`,
        )
      : gate(
          'enemy-facts',
          'pending',
          factArtifactReady
            ? `当前仅 ${enemiesWithFacts}/${contentDocument.enemies.length} 个敌人具备当前 build 的绑定事实与批准来源。`
            : 'DungeonDocument 尚未绑定可审计的事实快照与 manifest；禁止把同 build ID 当作来源证据。',
        );
  const abilityFacts =
    contentDocument.abilities.length > 0 && abilitiesWithFacts === contentDocument.abilities.length
      ? gate(
          'ability-facts',
          'ready',
          `已核验 ${abilitiesWithFacts}/${contentDocument.abilities.length} 个技能，且事实绑定 identity 已通过。`,
        )
      : gate(
          'ability-facts',
          'pending',
          factArtifactReady
            ? `当前仅 ${abilitiesWithFacts}/${contentDocument.abilities.length} 个技能具备当前 build 的绑定事实与批准来源。`
            : 'DungeonDocument 尚未绑定可审计的事实快照与 manifest；禁止把同 build ID 当作来源证据。',
        );

  const forcesSnapshot = contentDocument.forcesSnapshot;
  const forcesRegistryEntry = forcesSnapshot?.registryKey
    ? getForcesSnapshotRegistryEntry(forcesSnapshot.registryKey)
    : undefined;
  const forcesPayloadMatchesRegistry = forcesSnapshotMatchesRegistry(
    contentDocument,
    forcesRegistryEntry,
  );
  const allForcesVerified =
    contentDocument.enemies.length > 0 &&
    contentDocument.totalEnemyForcesPoints > 0 &&
    forcesSnapshot?.gameBuild === contentDocument.version.build &&
    Boolean(forcesSnapshot?.snapshot) &&
    /^sha256:[a-f0-9]{64}$/.test(forcesSnapshot?.digest ?? '') &&
    forcesSnapshot.licenseStatus === 'approved' &&
    forcesPayloadMatchesRegistry &&
    contentDocument.enemies.every(
      (enemy) =>
        enemy.forcesStatus === 'verified' &&
        Number.isInteger(enemy.forcesPoints) &&
        enemy.forcesPoints >= 0,
    );
  const learningRoutes = contentDocument.routes.filter((route) => route.intent === 'learning');
  const routesHaveForces = learningRoutes.some((route) => {
    const pullSteps = route.steps.filter((step) => step.type === 'pull');
    const enemiesById = new Map(contentDocument.enemies.map((enemy) => [enemy.id, enemy]));
    const spawnsById = new Map(contentDocument.spawns.map((spawn) => [spawn.id, spawn]));
    const derivePullForces = (step: PullStep) =>
      step.spawnIds.reduce((total, spawnId) => {
        const spawn = spawnsById.get(spawnId);
        return total + (spawn ? (enemiesById.get(spawn.enemyId)?.forcesPoints ?? 0) : 0);
      }, 0);
    const pullForces = pullSteps.map(derivePullForces);
    const derivedTotal = pullForces.reduce((total, forces) => total + forces, 0);
    return (
      pullSteps.length > 0 &&
      pullSteps.every((step, index) => step.spawnIds.length > 0 && pullForces[index]! >= 0) &&
      pullForces.some((forces) => forces > 0) &&
      route.expectedEnemyForcesPoints > 0 &&
      route.expectedEnemyForcesPoints === derivedTotal
    );
  });
  const forces =
    allForcesVerified && routesHaveForces
      ? gate('forces', 'ready', '敌人 forces 已核验，且至少一条路线有可推导 Pull forces。')
      : gate('forces', 'pending', 'forces snapshot 或 Pull 绑定仍待核验；禁止把 0 当作事实。');

  const coverage = getDungeonContentCoverage(contentDocument, { routeIntent: 'learning' });
  const learningComplete =
    contentDocument.situations.length > 0 &&
    learningRoutes.length > 0 &&
    coverage.route.pullCount > 0 &&
    coverage.uncoveredSituationIds.length === 0 &&
    coverage.incompleteSituationIds.length === 0 &&
    coverage.uncoveredDecisionCriticalAbilityIds.length === 0 &&
    coverage.route.pullsWithoutSituation.length === 0 &&
    coverage.bosses.withoutFocusAbilityIds.length === 0;
  const learningSurfaces = learningComplete
    ? gate('learning-surfaces', 'ready', 'Situation、关键技能、Pull 和 Boss 均有完整学习引用。')
    : gate(
        'learning-surfaces',
        'pending',
        '仍有未覆盖或 partial 的 Situation、关键技能、Pull 或 Boss 学习引用。',
      );

  const access =
    baseAccess?.documentId === contentDocument.id
      ? baseAccess
      : getDungeonLearningAccess(contentDocument);
  const author = contentDocument.review?.author;
  const reviewer = contentDocument.review?.reviewer;
  const sameReviewers =
    typeof author === 'string' &&
    typeof reviewer === 'string' &&
    author.trim().length > 0 &&
    reviewer.trim().length > 0 &&
    author.trim() === reviewer.trim();
  const review =
    access.state === 'available' &&
    isLearningPublished(entry.status) &&
    access.validation.ok &&
    access.validation.errors.length === 0 &&
    access.validation.warnings.length === 0 &&
    !sameReviewers
      ? gate('review', 'ready', '内容已通过版本、来源、作者自测与第二审校门禁。')
      : access.state === 'blocked' || access.state === 'stale'
        ? gate('review', 'blocked', access.reason)
        : !isLearningPublished(entry.status) && access.isFormal
          ? gate('review', 'blocked', '文档已是正式状态，但目录尚未标记为 reviewed/published。')
          : sameReviewers
            ? gate('review', 'blocked', '作者与第二审校者必须是不同的人。')
            : gate(
                'review',
                'pending',
                '尚未达到 reviewed/published；作者自测与第二审校仍需完成。',
              );

  return buildReadiness(
    entry.id,
    [coordinates, enemyFacts, abilityFacts, forces, learningSurfaces, review],
    true,
    counts,
  );
}

function buildReadiness(
  dungeonId: string,
  gates: ContentReadinessGate[],
  documentPresent: boolean,
  counts: DungeonContentReadiness['counts'],
): DungeonContentReadiness {
  const readyGateCount = gates.filter(({ state }) => state === 'ready').length;
  const hasBlockedGate = gates.some(({ state }) => state === 'blocked');
  const allReady = readyGateCount === gates.length;
  const state: DungeonReadinessState = allReady
    ? 'ready'
    : hasBlockedGate
      ? 'blocked'
      : documentPresent
        ? 'learning-preview'
        : gates[0]?.state === 'ready'
          ? 'coordinate-only'
          : 'catalog-only';
  return {
    dungeonId,
    state,
    gates,
    readyGateCount,
    totalGateCount: gates.length,
    documentPresent,
    counts,
  };
}
