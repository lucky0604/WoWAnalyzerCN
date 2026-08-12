import { getDungeonContentCoverage } from './coverage';
import {
  getFactBindingRegistryEntry,
  validateFactBindingRegistry,
} from '../runtime/sourceRegistry';
import { getDungeonCatalogEntry } from '../data/season2Catalog';
import { coordinateBindingMatchesEntry } from '../runtime/coordinates';
import type {
  CoordinateBindingIdentity,
  Diagnostic,
  DungeonDocument,
  FactBindingIdentity,
  PullStep,
  RouteStep,
  ValidationResult,
} from './types';

const diagnostic = (
  severity: Diagnostic['severity'],
  code: string,
  path: string,
  message: string,
  entityId?: string,
  candidates?: string[],
): Diagnostic => ({ severity, code, path, message, entityId, candidates });

const isFiniteNumber = (value: number) => Number.isFinite(value);
const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;

function hasCompleteFactBindingIdentity(
  document: DungeonDocument,
  identity: FactBindingIdentity | undefined,
): boolean {
  if (
    !identity ||
    identity.version !== 1 ||
    typeof identity.registryKey !== 'string' ||
    !identity.registryKey.trim() ||
    typeof identity.snapshotId !== 'string' ||
    !identity.snapshotId.trim() ||
    typeof identity.snapshotDigest !== 'string' ||
    !sha256DigestPattern.test(identity.snapshotDigest) ||
    typeof identity.manifestDigest !== 'string' ||
    !sha256DigestPattern.test(identity.manifestDigest) ||
    typeof identity.dungeonId !== 'string' ||
    typeof identity.season !== 'string' ||
    typeof identity.gameBuild !== 'string' ||
    identity.dungeonId !== document.id ||
    identity.season !== document.season ||
    identity.gameBuild !== document.version.build ||
    !Array.isArray(identity.enemies) ||
    !Array.isArray(identity.abilities) ||
    identity.enemies.length !== document.enemies.length ||
    identity.abilities.length !== document.abilities.length
  ) {
    return false;
  }
  const enemyIds = new Set(document.enemies.map((enemy) => enemy.id));
  const abilityIds = new Set(document.abilities.map((ability) => ability.id));
  const enemySources = identity.enemies
    .filter((row) => Boolean(row && typeof row === 'object' && typeof row.sourceKey === 'string'))
    .map((row) => row.sourceKey);
  const abilitySources = identity.abilities
    .filter((row) => Boolean(row && typeof row === 'object' && typeof row.sourceKey === 'string'))
    .map((row) => row.sourceKey);
  const enemyTargets = identity.enemies
    .filter((row) =>
      Boolean(row && typeof row === 'object' && typeof row.documentEnemyId === 'string'),
    )
    .map((row) => row.documentEnemyId);
  const abilityTargets = identity.abilities
    .filter((row) =>
      Boolean(row && typeof row === 'object' && typeof row.documentAbilityId === 'string'),
    )
    .map((row) => row.documentAbilityId);
  const sameIds = (left: readonly string[], right: readonly string[]) => {
    const rightSet = new Set(right);
    return left.length === rightSet.size && left.every((id) => rightSet.has(id));
  };
  return (
    identity.enemies.every(
      (row) =>
        typeof row?.sourceKey === 'string' &&
        row.sourceKey.trim().length > 0 &&
        typeof row.documentEnemyId === 'string' &&
        enemyIds.has(row.documentEnemyId),
    ) &&
    identity.abilities.every(
      (row) =>
        typeof row?.sourceKey === 'string' &&
        row.sourceKey.trim().length > 0 &&
        typeof row.documentAbilityId === 'string' &&
        abilityIds.has(row.documentAbilityId),
    ) &&
    new Set(enemyTargets).size === enemyTargets.length &&
    new Set(abilityTargets).size === abilityTargets.length &&
    new Set(enemySources).size === enemySources.length &&
    new Set(abilitySources).size === abilitySources.length &&
    identity.enemies.every((row) => {
      const enemy = document.enemies.find((candidate) => candidate.id === row.documentEnemyId);
      return Boolean(
        enemy &&
        row.npcId === enemy.npcId &&
        row.isBoss === enemy.isBoss &&
        row.forcesPoints === enemy.forcesPoints,
      );
    }) &&
    identity.abilities.every((row) => {
      const ability = document.abilities.find(
        (candidate) => candidate.id === row.documentAbilityId,
      );
      return Boolean(
        ability &&
        row.spellId === ability.spellId &&
        Array.isArray(row.casterEnemyKeys) &&
        row.casterEnemyKeys.length > 0 &&
        new Set(row.casterEnemyKeys).size === row.casterEnemyKeys.length &&
        row.casterEnemyKeys.every((sourceKey) =>
          identity.enemies.some((enemy) => enemy.sourceKey === sourceKey),
        ) &&
        sameIds(
          row.casterEnemyKeys.map(
            (sourceKey) =>
              identity.enemies.find((enemy) => enemy.sourceKey === sourceKey)?.documentEnemyId ??
              '',
          ),
          ability.casterEnemyIds,
        ),
      );
    })
  );
}

function hasCompleteCoordinateBindingIdentity(
  identity: CoordinateBindingIdentity | undefined,
): boolean {
  return Boolean(
    identity &&
    identity.sourceId === 'threechest' &&
    typeof identity.snapshotId === 'string' &&
    identity.snapshotId.trim() &&
    typeof identity.rawSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(identity.rawSha256) &&
    (identity.identityHash === undefined || sha256DigestPattern.test(identity.identityHash)),
  );
}

function matchesApprovedFactBindingRegistry(document: DungeonDocument): boolean {
  const identity = document.factBinding;
  if (!identity) return false;
  const registryEntry = getFactBindingRegistryEntry(identity.registryKey);
  if (
    !registryEntry ||
    registryEntry.status !== 'approved' ||
    validateFactBindingRegistry([registryEntry]).length > 0
  )
    return false;
  const sameIds = (left: readonly string[], right: readonly string[]) => {
    const rightSet = new Set(right);
    return left.length === rightSet.size && left.every((id) => rightSet.has(id));
  };
  return (
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
    })
  );
}

function matchesApprovedCoordinateBinding(document: DungeonDocument): boolean {
  const entry = getDungeonCatalogEntry(document.id);
  return Boolean(entry && coordinateBindingMatchesEntry(entry, document.coordinateBinding));
}

function checkUnique(values: string[], path: string, label: string, errors: Diagnostic[]): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_DUPLICATE_ID',
          `${path}[${index}]`,
          `${label} ID 重复：${value}`,
          value,
        ),
      );
    }
    seen.add(value);
  });
}

const hasId = (ids: Set<string>, id: string) => ids.has(id);

function checkRouteStepReferences(
  step: RouteStep,
  document: DungeonDocument,
  floorIds: Set<string>,
  spawnIds: Set<string>,
  situationIds: Set<string>,
  abilityIds: Set<string>,
  errors: Diagnostic[],
  warnings: Diagnostic[],
): void {
  const pendingSpatialDraft =
    document.dataStatus === 'draft' && document.spatialStatus === 'pending';
  if (step.type === 'pull') {
    if (!hasId(floorIds, step.floorId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_FLOOR',
          `routes.${step.id}.floorId`,
          `路线步骤引用了未知楼层：${step.floorId}`,
          step.id,
        ),
      );
    }
    step.spawnIds.forEach((spawnId) => {
      if (!hasId(spawnIds, spawnId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SPAWN',
            `routes.${step.id}.spawnIds`,
            `路线步骤引用了未知 spawn：${spawnId}`,
            step.id,
          ),
        );
      }
    });
    step.situationRefs.forEach(({ situationId }) => {
      if (!hasId(situationIds, situationId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SITUATION',
            `routes.${step.id}.situationRefs`,
            `路线步骤引用了未知 Situation：${situationId}`,
            step.id,
          ),
        );
      }
    });
    step.focusAbilityIds.forEach((abilityId) => {
      if (!hasId(abilityIds, abilityId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_ABILITY',
            `routes.${step.id}.focusAbilityIds`,
            `路线步骤引用了未知技能知识：${abilityId}`,
            step.id,
          ),
        );
      }
    });

    const derivedForces = step.spawnIds.reduce((total, spawnId) => {
      const spawn = document.spawns.find((candidate) => candidate.id === spawnId);
      const enemy = spawn && document.enemies.find((candidate) => candidate.id === spawn.enemyId);
      return total + (enemy?.forcesPoints ?? 0);
    }, 0);
    if (step.spawnIds.length === 0) {
      (pendingSpatialDraft ? warnings : errors).push(
        diagnostic(
          pendingSpatialDraft ? 'warning' : 'error',
          pendingSpatialDraft ? 'DUNGEON_PULL_SPAWN_PENDING' : 'DUNGEON_EMPTY_PULL',
          `routes.${step.id}.spawnIds`,
          pendingSpatialDraft
            ? '学习草稿的 Pull 尚未绑定经过核验的 spawn；接入空间数据后必须补齐。'
            : 'Pull 至少需要一个 spawn。',
          step.id,
        ),
      );
    }
    if (!Number.isInteger(derivedForces)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_NON_INTEGER_FORCES',
          `routes.${step.id}.spawnIds`,
          'Pull 推导出的 forces 必须是整数。',
          step.id,
        ),
      );
    }
  } else if (step.type === 'transition') {
    if (!hasId(floorIds, step.fromFloorId) || !hasId(floorIds, step.toFloorId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_TRANSITION_FLOOR',
          `routes.${step.id}`,
          'TransitionStep 必须引用已注册的起止楼层。',
          step.id,
        ),
      );
    }
  } else {
    if (!hasId(floorIds, step.floorId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_EVENT_FLOOR',
          `routes.${step.id}.floorId`,
          `事件步骤引用了未知楼层：${step.floorId}`,
          step.id,
        ),
      );
    }
    step.situationRefs.forEach(({ situationId }) => {
      if (!hasId(situationIds, situationId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SITUATION',
            `routes.${step.id}.situationRefs`,
            `事件步骤引用了未知 Situation：${situationId}`,
            step.id,
          ),
        );
      }
    });
  }
}

export function validateDungeonDocument(document: DungeonDocument): ValidationResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const pendingSpatialDraft =
    document.dataStatus === 'draft' && document.spatialStatus === 'pending';

  if (!document.id || !document.slug || !document.season) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_MISSING_METADATA',
        'document',
        '副本必须包含 id、slug 和 season。',
        document.id,
      ),
    );
  }
  if (
    !Number.isInteger(document.totalEnemyForcesPoints) ||
    document.totalEnemyForcesPoints < 0 ||
    (!pendingSpatialDraft && document.totalEnemyForcesPoints === 0)
  ) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_INVALID_TOTAL_FORCES',
        'totalEnemyForcesPoints',
        '副本总 forces 必须是正整数。',
        document.id,
      ),
    );
  }
  if (pendingSpatialDraft) {
    warnings.push(
      diagnostic(
        'warning',
        'DUNGEON_SPATIAL_DATA_PENDING',
        'spatialStatus',
        '学习草稿尚未接入经过核验的 floor、spawn 和 forces；不得作为正式路线发布。',
        document.id,
      ),
    );
  }
  if (document.dataStatus === 'fixture') {
    warnings.push(
      diagnostic(
        'warning',
        'DUNGEON_FIXTURE_DATA',
        'dataStatus',
        '这是开发 fixture，不得作为 production published 内容。',
        document.id,
      ),
    );
  }
  const releaseStatus = document.dataStatus === 'reviewed' || document.dataStatus === 'published';
  const review = document.review;
  const reviewMetadataComplete = Boolean(
    typeof review?.author === 'string' &&
    review.author.trim() &&
    typeof review.reviewer === 'string' &&
    review.reviewer.trim() &&
    typeof review.reviewedAt === 'string' &&
    review.reviewedAt.trim() &&
    typeof review.gameBuild === 'string' &&
    review.gameBuild.trim(),
  );
  if (!reviewMetadataComplete) {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        releaseStatus ? 'error' : 'warning',
        'DUNGEON_REVIEW_METADATA_PENDING',
        'review',
        releaseStatus
          ? 'reviewed/published 内容必须记录作者、第二审校者、审校时间和目标 build。'
          : '尚未记录完整的作者/第二审校者/build 审校信息；当前只能作为 draft。',
        document.id,
      ),
    );
  } else if (review) {
    const reviewedAt = Date.parse(review.reviewedAt);
    if (!Number.isFinite(reviewedAt)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_REVIEW_DATE_INVALID',
          'review.reviewedAt',
          '审校时间必须是可解析的 ISO 日期。',
          document.id,
        ),
      );
    }
    if (review.gameBuild !== document.version.build) {
      (releaseStatus ? errors : warnings).push(
        diagnostic(
          releaseStatus ? 'error' : 'warning',
          'DUNGEON_REVIEW_BUILD_MISMATCH',
          'review.gameBuild',
          `审校 build ${review.gameBuild} 与文档 build ${document.version.build} 不一致。`,
          document.id,
        ),
      );
    }
  }
  const selfTest = review?.selfTest;
  if (!selfTest) {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        releaseStatus ? 'error' : 'warning',
        'DUNGEON_REVIEW_SELF_TEST_PENDING',
        'review.selfTest',
        releaseStatus
          ? '正式内容必须记录作者自测完成时间、学习模式以及覆盖的 Situation/Route。'
          : '尚未记录作者自测；进入 reviewed/published 前必须走完学习模式和内容覆盖检查。',
        document.id,
      ),
    );
  } else {
    if (
      typeof selfTest.completedAt !== 'string' ||
      !Number.isFinite(Date.parse(selfTest.completedAt))
    ) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_REVIEW_SELF_TEST_DATE_INVALID',
          'review.selfTest.completedAt',
          '作者自测完成时间必须是可解析的 ISO 日期。',
          document.id,
        ),
      );
    }
    const validModes = new Set(['quick', 'overview', 'full']);
    if (
      !Array.isArray(selfTest.modes) ||
      selfTest.modes.length === 0 ||
      selfTest.modes.some((mode) => !validModes.has(mode))
    ) {
      (releaseStatus ? errors : warnings).push(
        diagnostic(
          releaseStatus ? 'error' : 'warning',
          'DUNGEON_REVIEW_SELF_TEST_MODES_INVALID',
          'review.selfTest.modes',
          releaseStatus
            ? '作者自测必须至少记录一个有效学习模式：quick、overview 或 full。'
            : '作者自测的学习模式为空或无效。',
          document.id,
        ),
      );
    }
    const selfTestSituationIds = Array.isArray(selfTest.situationIds) ? selfTest.situationIds : [];
    const selfTestRouteIds = Array.isArray(selfTest.routeIds) ? selfTest.routeIds : [];
    const testedSituationIds = new Set(selfTestSituationIds);
    const testedRouteIds = new Set(selfTestRouteIds);
    const missingSituationIds = document.situations
      .map((situation) => situation.id)
      .filter((id) => !testedSituationIds.has(id));
    const missingRouteIds = document.routes
      .map((route) => route.id)
      .filter((id) => !testedRouteIds.has(id));
    const unknownSituationIds = selfTestSituationIds.filter(
      (id) => !document.situations.some((situation) => situation.id === id),
    );
    const unknownRouteIds = selfTestRouteIds.filter(
      (id) => !document.routes.some((route) => route.id === id),
    );
    if (missingSituationIds.length > 0 || missingRouteIds.length > 0) {
      (releaseStatus ? errors : warnings).push(
        diagnostic(
          releaseStatus ? 'error' : 'warning',
          'DUNGEON_REVIEW_SELF_TEST_INCOMPLETE',
          'review.selfTest',
          `作者自测尚未覆盖全部内容：Situation=${missingSituationIds.join(', ') || 'none'}；Route=${missingRouteIds.join(', ') || 'none'}。`,
          document.id,
          [...missingSituationIds, ...missingRouteIds],
        ),
      );
    }
    if (unknownSituationIds.length > 0 || unknownRouteIds.length > 0) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_REVIEW_SELF_TEST_UNKNOWN_ID',
          'review.selfTest',
          `作者自测引用了未知实体：Situation=${unknownSituationIds.join(', ') || 'none'}；Route=${unknownRouteIds.join(', ') || 'none'}。`,
          document.id,
          [...unknownSituationIds, ...unknownRouteIds],
        ),
      );
    }
  }
  const authoringEffort = review?.authoringEffort;
  if (!authoringEffort) {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        releaseStatus ? 'error' : 'warning',
        'DUNGEON_REVIEW_EFFORT_PENDING',
        'review.authoringEffort',
        releaseStatus
          ? '正式内容必须记录整本副本总工时和每个 Routine/Critical Situation 的工时。'
          : '尚未记录作者工时；进入 reviewed/published 前必须补齐整本副本与关键 Situation 的工时。',
        document.id,
      ),
    );
  } else {
    const totalMinutes = authoringEffort.totalMinutes;
    if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) {
      (releaseStatus ? errors : warnings).push(
        diagnostic(
          releaseStatus ? 'error' : 'warning',
          'DUNGEON_REVIEW_EFFORT_TOTAL_INVALID',
          'review.authoringEffort.totalMinutes',
          releaseStatus
            ? '整本副本总工时必须是正整数分钟。'
            : '整本副本总工时必须填写为正整数分钟。',
          document.id,
        ),
      );
    }
    const situationMinutes = authoringEffort.situationMinutes;
    const minutesRecord =
      situationMinutes && typeof situationMinutes === 'object' && !Array.isArray(situationMinutes)
        ? situationMinutes
        : undefined;
    if (!minutesRecord) {
      (releaseStatus ? errors : warnings).push(
        diagnostic(
          releaseStatus ? 'error' : 'warning',
          'DUNGEON_REVIEW_EFFORT_SITUATIONS_INVALID',
          'review.authoringEffort.situationMinutes',
          releaseStatus
            ? '每个 Situation 的工时必须使用对象记录。'
            : 'Situation 工时记录不是有效对象。',
          document.id,
        ),
      );
    } else {
      const measuredSituationIds = Object.keys(minutesRecord);
      const unknownSituationIds = measuredSituationIds.filter(
        (id) => !document.situations.some((situation) => situation.id === id),
      );
      if (unknownSituationIds.length > 0) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_REVIEW_EFFORT_UNKNOWN_SITUATION',
            'review.authoringEffort.situationMinutes',
            `作者工时引用了未知 Situation：${unknownSituationIds.join(', ')}。`,
            document.id,
            unknownSituationIds,
          ),
        );
      }
      const measuredValuesInvalid = measuredSituationIds.some((id) => {
        const minutes = minutesRecord[id];
        return typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0;
      });
      if (measuredValuesInvalid) {
        (releaseStatus ? errors : warnings).push(
          diagnostic(
            releaseStatus ? 'error' : 'warning',
            'DUNGEON_REVIEW_EFFORT_SITUATION_VALUE_INVALID',
            'review.authoringEffort.situationMinutes',
            releaseStatus
              ? '每个已记录 Situation 的工时必须是正整数分钟。'
              : '已记录 Situation 的工时必须是正整数分钟。',
            document.id,
          ),
        );
      }
      const requiredSituationIds = document.situations
        .filter((situation) => situation.kind === 'routine' || situation.kind === 'critical')
        .map((situation) => situation.id);
      const missingSituationIds = requiredSituationIds.filter(
        (id) => !Object.prototype.hasOwnProperty.call(minutesRecord, id),
      );
      if (missingSituationIds.length > 0) {
        (releaseStatus ? errors : warnings).push(
          diagnostic(
            releaseStatus ? 'error' : 'warning',
            'DUNGEON_REVIEW_EFFORT_SITUATIONS_INCOMPLETE',
            'review.authoringEffort.situationMinutes',
            releaseStatus
              ? `作者工时尚未覆盖所有 Routine/Critical Situation：${missingSituationIds.join(', ')}。`
              : `作者工时尚未覆盖所有 Routine/Critical Situation：${missingSituationIds.join(', ')}。`,
            document.id,
            missingSituationIds,
          ),
        );
      }
    }
  }
  const documentSourceMissing = document.provenance.length === 0;
  const documentSourceUnapproved = document.provenance.some(
    (source) => source.licenseStatus !== 'approved',
  );
  if (releaseStatus && (documentSourceMissing || documentSourceUnapproved)) {
    errors.push(
      diagnostic(
        'error',
        documentSourceMissing
          ? 'DUNGEON_RELEASE_SOURCE_MISSING'
          : document.dataStatus === 'published'
            ? 'DUNGEON_PUBLISHED_SOURCE_NOT_APPROVED'
            : 'DUNGEON_REVIEWED_SOURCE_NOT_APPROVED',
        'provenance',
        documentSourceMissing
          ? '正式内容必须登记至少一条来源。'
          : `${document.dataStatus} 内容不能包含未批准的来源。`,
        document.id,
      ),
    );
  }
  if (!releaseStatus && documentSourceMissing) {
    warnings.push(
      diagnostic(
        'warning',
        'DUNGEON_RELEASE_SOURCE_MISSING',
        'provenance',
        '草稿尚未登记来源；进入 reviewed/published 前必须补齐。',
        document.id,
      ),
    );
  }
  const nestedProvenance = [
    ...document.enemies.map((item) => ({ collection: 'enemies', item })),
    ...document.abilities.map((item) => ({ collection: 'abilities', item })),
    ...document.situations.map((item) => ({ collection: 'situations', item })),
    ...document.routes.map((item) => ({ collection: 'routes', item })),
    ...document.bosses.map((item) => ({ collection: 'bosses', item })),
  ];
  nestedProvenance.forEach(({ collection, item }) => {
    if (item.provenance.length === 0) {
      const severity = releaseStatus ? 'error' : 'warning';
      (severity === 'error' ? errors : warnings).push(
        diagnostic(
          severity,
          'DUNGEON_NESTED_SOURCE_MISSING',
          `${collection}.${item.id}.provenance`,
          releaseStatus
            ? '正式知识实体必须登记至少一条来源。'
            : '知识实体尚未登记来源；进入 reviewed/published 前必须补齐。',
          item.id,
        ),
      );
      return;
    }
    item.provenance.forEach((source, sourceIndex) => {
      if (source.licenseStatus === 'approved') return;
      const severity = releaseStatus ? 'error' : 'warning';
      (severity === 'error' ? errors : warnings).push(
        diagnostic(
          severity,
          'DUNGEON_NESTED_SOURCE_NOT_APPROVED',
          `${collection}.${item.id}.provenance[${sourceIndex}]`,
          releaseStatus
            ? '正式内容的嵌套知识来源必须全部经过批准。'
            : '嵌套知识包含未批准来源；进入 reviewed/published 前必须替换或完成授权审查。',
          item.id,
        ),
      );
    });
  });
  if (releaseStatus && document.spatialStatus !== 'verified') {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_RELEASE_SPATIAL_DATA_PENDING',
        'spatialStatus',
        'reviewed/published 内容必须明确标记空间数据已核验。',
        document.id,
      ),
    );
  }
  if (
    releaseStatus &&
    (!hasCompleteFactBindingIdentity(document, document.factBinding) ||
      !matchesApprovedFactBindingRegistry(document))
  ) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_RELEASE_FACT_BINDING_INVALID',
        'factBinding',
        'reviewed/published 内容必须绑定完整的事实快照、manifest digest 和 Enemy/Ability 映射。',
        document.id,
      ),
    );
  }
  if (
    releaseStatus &&
    (!hasCompleteCoordinateBindingIdentity(document.coordinateBinding) ||
      !matchesApprovedCoordinateBinding(document))
  ) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_RELEASE_COORDINATE_BINDING_INVALID',
        'coordinateBinding',
        'reviewed/published 内容必须绑定经过批准的坐标快照与 stable SpawnId sidecar。',
        document.id,
      ),
    );
  }
  if (releaseStatus && document.version.status !== document.dataStatus) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_RELEASE_VERSION_STATUS_MISMATCH',
        'version.status',
        `reviewed/published 文档的 version.status 必须与 dataStatus 一致：${document.dataStatus}。`,
        document.id,
      ),
    );
  }
  if (releaseStatus) {
    const requiredCollections: Array<[keyof DungeonDocument, string, string]> = [
      ['abilities', 'DUNGEON_RELEASE_EMPTY_ABILITIES', '至少需要一条已审校技能知识。'],
      ['situations', 'DUNGEON_RELEASE_EMPTY_SITUATIONS', '至少需要一个稳定 Situation。'],
      ['routes', 'DUNGEON_RELEASE_EMPTY_ROUTES', '至少需要一条学习路线。'],
      ['bosses', 'DUNGEON_RELEASE_EMPTY_BOSSES', '至少需要一个 BossKnowledge。'],
    ];
    requiredCollections.forEach(([field, code, message]) => {
      const value = document[field];
      if (Array.isArray(value) && value.length === 0) {
        errors.push(diagnostic('error', code, field, message, document.id));
      }
    });
  }

  checkUnique(
    document.floors.map((item) => item.id),
    'floors',
    '楼层',
    errors,
  );
  checkUnique(
    document.spawns.map((item) => item.id),
    'spawns',
    'spawn',
    errors,
  );
  checkUnique(
    document.enemies.map((item) => item.id),
    'enemies',
    '敌人',
    errors,
  );
  checkUnique(
    document.abilities.map((item) => item.id),
    'abilities',
    '技能知识',
    errors,
  );
  checkUnique(
    document.situations.map((item) => item.id),
    'situations',
    'Situation',
    errors,
  );
  checkUnique(
    document.routes.map((item) => item.id),
    'routes',
    '路线',
    errors,
  );

  const floorIds = new Set(document.floors.map((item) => item.id));
  const spawnIds = new Set(document.spawns.map((item) => item.id));
  const enemyIds = new Set(document.enemies.map((item) => item.id));
  const abilityIds = new Set(document.abilities.map((item) => item.id));
  const situationIds = new Set(document.situations.map((item) => item.id));

  document.floors.forEach((floor) => {
    const { bounds } = floor;
    if (
      ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(isFiniteNumber) ||
      bounds.xMin >= bounds.xMax ||
      bounds.yMin >= bounds.yMax
    ) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_BOUNDS',
          `floors.${floor.id}.bounds`,
          '楼层 bounds 必须是有限数值，且 min 小于 max。',
          floor.id,
        ),
      );
    }
  });

  document.spawns.forEach((spawn) => {
    if (!hasId(floorIds, spawn.floorId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_SPAWN_FLOOR',
          `spawns.${spawn.id}.floorId`,
          `spawn 引用了未知楼层：${spawn.floorId}`,
          spawn.id,
        ),
      );
    }
    if (!hasId(enemyIds, spawn.enemyId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_SPAWN_ENEMY',
          `spawns.${spawn.id}.enemyId`,
          `spawn 引用了未知敌人：${spawn.enemyId}`,
          spawn.id,
        ),
      );
    }
    if (!spawn.position.every(isFiniteNumber)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_COORDINATE',
          `spawns.${spawn.id}.position`,
          'spawn 坐标必须是有限数值。',
          spawn.id,
        ),
      );
    }
    const floor = document.floors.find((candidate) => candidate.id === spawn.floorId);
    if (
      floor &&
      (spawn.position[0] < floor.bounds.xMin ||
        spawn.position[0] > floor.bounds.xMax ||
        spawn.position[1] < floor.bounds.yMin ||
        spawn.position[1] > floor.bounds.yMax)
    ) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_COORDINATE_OUT_OF_BOUNDS',
          `spawns.${spawn.id}.position`,
          `spawn 坐标超出楼层 bounds：${spawn.floorId}。`,
          spawn.id,
        ),
      );
    }
    spawn.patrol?.points.forEach((point, index) => {
      if (!point.every(isFiniteNumber)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_INVALID_PATROL_COORDINATE',
            `spawns.${spawn.id}.patrol.points[${index}]`,
            '巡逻路径坐标必须是有限数值。',
            spawn.id,
          ),
        );
      }
    });
  });

  document.enemies.forEach((enemy) => {
    if (enemy.npcId === undefined) {
      const status = document.dataStatus === 'reviewed' || document.dataStatus === 'published';
      (status ? errors : warnings).push(
        diagnostic(
          status ? 'error' : 'warning',
          'DUNGEON_NPC_ID_PENDING',
          `enemies.${enemy.id}.npcId`,
          status
            ? '正式内容必须绑定经过核验的 NPC ID。'
            : 'NPC ID 尚未核验；当前敌人只能用于 authoring 草稿。',
          enemy.id,
        ),
      );
    } else if (!Number.isInteger(enemy.npcId) || enemy.npcId <= 0) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_NPC_ID',
          `enemies.${enemy.id}.npcId`,
          'NPC ID 必须是正整数。',
          enemy.id,
        ),
      );
    }
    if (!Number.isInteger(enemy.forcesPoints) || enemy.forcesPoints < 0) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_ENEMY_FORCES',
          `enemies.${enemy.id}.forcesPoints`,
          '敌人 forces 必须是非负整数。',
          enemy.id,
        ),
      );
    }
    if (enemy.forcesStatus === 'pending') {
      const status = document.dataStatus === 'reviewed' || document.dataStatus === 'published';
      (status ? errors : warnings).push(
        diagnostic(
          status ? 'error' : 'warning',
          'DUNGEON_FORCES_SNAPSHOT_PENDING',
          `enemies.${enemy.id}.forcesPoints`,
          status
            ? '正式内容不能包含尚未核验的 forces。'
            : '该敌人的 forces 尚未核验；当前数值不能用于正式路线。',
          enemy.id,
        ),
      );
    }
    enemy.spawnIds.forEach((spawnId) => {
      if (!hasId(spawnIds, spawnId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_ENEMY_SPAWN',
            `enemies.${enemy.id}.spawnIds`,
            `敌人引用了未知 spawn：${spawnId}`,
            enemy.id,
          ),
        );
      }
      const spawn = document.spawns.find((candidate) => candidate.id === spawnId);
      if (spawn && spawn.enemyId !== enemy.id) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_SPAWN_ENEMY_MISMATCH',
            `enemies.${enemy.id}.spawnIds`,
            `spawn ${spawnId} 反向引用了 ${spawn.enemyId}，而不是 ${enemy.id}。`,
            enemy.id,
          ),
        );
      }
    });
    enemy.abilityIds.forEach((abilityId) => {
      if (!hasId(abilityIds, abilityId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_ENEMY_ABILITY',
            `enemies.${enemy.id}.abilityIds`,
            `敌人引用了未知技能知识：${abilityId}`,
            enemy.id,
          ),
        );
      }
    });
  });

  document.abilities.forEach((ability) => {
    ability.casterEnemyIds.forEach((enemyId) => {
      if (!hasId(enemyIds, enemyId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_ABILITY_CASTER',
            `abilities.${ability.id}.casterEnemyIds`,
            `技能引用了未知施法者：${enemyId}`,
            ability.id,
          ),
        );
      }
    });
    if (ability.decisionCritical && !ability.memoryCue) {
      warnings.push(
        diagnostic(
          'warning',
          'DUNGEON_MISSING_MEMORY_CUE',
          `abilities.${ability.id}.memoryCue`,
          'decision-critical 技能建议提供一句话记忆锚点。',
          ability.id,
        ),
      );
    }
    if (ability.spellId === undefined) {
      const status = document.dataStatus === 'reviewed' || document.dataStatus === 'published';
      (status ? errors : warnings).push(
        diagnostic(
          status ? 'error' : 'warning',
          'DUNGEON_SPELL_ID_PENDING',
          `abilities.${ability.id}.spellId`,
          status
            ? '正式内容必须绑定经过核验的 Spell ID。'
            : 'Spell ID 尚未核验；tooltip 和版本比对暂不可用。',
          ability.id,
        ),
      );
    }
  });

  document.situations.forEach((situation) => {
    situation.floorIds.forEach((floorId) => {
      if (!hasId(floorIds, floorId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SITUATION_FLOOR',
            `situations.${situation.id}.floorIds`,
            `Situation 引用了未知楼层：${floorId}`,
            situation.id,
          ),
        );
      }
    });
    situation.anchorSpawnIds.forEach((spawnId) => {
      if (!hasId(spawnIds, spawnId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SITUATION_SPAWN',
            `situations.${situation.id}.anchorSpawnIds`,
            `Situation 引用了未知 anchor spawn：${spawnId}`,
            situation.id,
          ),
        );
      }
    });
    situation.focusAbilityIds.forEach((abilityId) => {
      if (!hasId(abilityIds, abilityId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_SITUATION_ABILITY',
            `situations.${situation.id}.focusAbilityIds`,
            `Situation 引用了未知技能知识：${abilityId}`,
            situation.id,
          ),
        );
      }
    });
  });

  document.routes.forEach((route) => {
    const orders = route.steps.map((step) => step.order);
    if (
      orders.some((order) => !Number.isInteger(order)) ||
      new Set(orders).size !== orders.length
    ) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_ROUTE_ORDER',
          `routes.${route.id}.steps`,
          '路线步骤 order 必须唯一且为整数。',
          route.id,
        ),
      );
    }
    route.steps.forEach((step) =>
      checkRouteStepReferences(
        step,
        document,
        floorIds,
        spawnIds,
        situationIds,
        abilityIds,
        errors,
        warnings,
      ),
    );
    const derivedForces = route.steps
      .filter((step): step is PullStep => step.type === 'pull')
      .reduce((total, step) => total + getPullStepForces(document, step), 0);
    if (route.expectedEnemyForcesPoints !== derivedForces) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_ROUTE_FORCES_MISMATCH',
          `routes.${route.id}.expectedEnemyForcesPoints`,
          `路线 forces 与 spawn 推导不一致：填写 ${route.expectedEnemyForcesPoints}，推导 ${derivedForces}。`,
          route.id,
        ),
      );
    }
    if (!Number.isInteger(route.expectedEnemyForcesPoints) || route.expectedEnemyForcesPoints < 0) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_INVALID_ROUTE_FORCES',
          `routes.${route.id}.expectedEnemyForcesPoints`,
          '路线预期 forces 必须是非负整数。',
          route.id,
        ),
      );
    }
  });

  document.bosses.forEach((boss) => {
    if (!hasId(enemyIds, boss.enemyId)) {
      errors.push(
        diagnostic(
          'error',
          'DUNGEON_UNKNOWN_BOSS_ENEMY',
          `bosses.${boss.id}.enemyId`,
          `Boss 引用了未知敌人：${boss.enemyId}`,
          boss.id,
        ),
      );
    }
    boss.focusAbilityIds.forEach((abilityId) => {
      if (!hasId(abilityIds, abilityId)) {
        errors.push(
          diagnostic(
            'error',
            'DUNGEON_UNKNOWN_BOSS_ABILITY',
            `bosses.${boss.id}.focusAbilityIds`,
            `Boss 引用了未知技能知识：${abilityId}`,
            boss.id,
          ),
        );
      }
    });
  });

  const coverage = getDungeonContentCoverage(
    document,
    releaseStatus ? { routeIntent: 'learning' } : undefined,
  );
  const coverageSeverity = releaseStatus ? 'error' : 'warning';
  coverage.uncoveredSituationIds.forEach((situationId) => {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        coverageSeverity,
        'DUNGEON_SITUATION_UNCOVERED',
        `situations.${situationId}`,
        releaseStatus
          ? '正式内容中的非 Boss Situation 必须被路线步骤引用，并至少有一个 full 学习上下文。'
          : '该 Situation 尚未挂到路线步骤；正式内容必须提供可达的学习上下文。',
        situationId,
      ),
    );
  });
  coverage.incompleteSituationIds.forEach((situationId) => {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        coverageSeverity,
        'DUNGEON_SITUATION_PARTIAL_COVERAGE',
        `situations.${situationId}`,
        releaseStatus
          ? '正式内容中的 Situation 必须至少在一个路线步骤中得到完整解释。'
          : '该 Situation 目前只有 partial 路线引用；正式内容需要至少一个 full 学习上下文。',
        situationId,
      ),
    );
  });
  coverage.uncoveredDecisionCriticalAbilityIds.forEach((abilityId) => {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        coverageSeverity,
        'DUNGEON_CRITICAL_ABILITY_UNCOVERED',
        `abilities.${abilityId}`,
        releaseStatus
          ? 'decision-critical 技能必须出现在 Situation、路线或 Boss 学习表面。'
          : '该 decision-critical 技能目前只挂在敌人事实层，尚未进入学习表面。',
        abilityId,
      ),
    );
  });
  coverage.route.pullsWithoutSituation.forEach((step) => {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        coverageSeverity,
        'DUNGEON_PULL_WITHOUT_SITUATION',
        `routes.${step.id}.situationRefs`,
        releaseStatus
          ? '正式路线的 Pull 必须引用至少一个 Situation，说明这一波为什么这样处理。'
          : '该 Pull 尚未引用 Situation；当前只能作为路线骨架。',
        step.id,
      ),
    );
  });
  if (releaseStatus && coverage.route.pullCount === 0) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_LEARNING_ROUTE_EMPTY',
        'routes',
        '正式内容至少需要一条包含 Pull 的 learning 路线；pug-safe、push 或 custom-reference 路线不能替代学习路线。',
        document.id,
      ),
    );
  }
  coverage.bosses.withoutFocusAbilityIds.forEach((bossId) => {
    (releaseStatus ? errors : warnings).push(
      diagnostic(
        coverageSeverity,
        'DUNGEON_BOSS_KNOWLEDGE_EMPTY',
        `bosses.${bossId}.focusAbilityIds`,
        releaseStatus
          ? '正式 Boss 学习卡必须至少绑定一个核心技能。'
          : 'Boss 学习卡尚未绑定核心技能。',
        bossId,
      ),
    );
  });

  return { errors, warnings, ok: errors.length === 0 };
}

export function getPullStepForces(document: DungeonDocument, step: PullStep): number {
  const enemiesById = new Map(document.enemies.map((enemy) => [enemy.id, enemy]));
  const spawnsById = new Map(document.spawns.map((spawn) => [spawn.id, spawn]));
  return step.spawnIds.reduce((total, spawnId) => {
    const spawn = spawnsById.get(spawnId);
    return total + (spawn ? (enemiesById.get(spawn.enemyId)?.forcesPoints ?? 0) : 0);
  }, 0);
}
