import type { Diagnostic, DungeonDocument, PullStep, RouteStep, ValidationResult } from './types';

const diagnostic = (
  severity: Diagnostic['severity'],
  code: string,
  path: string,
  message: string,
  entityId?: string,
  candidates?: string[],
): Diagnostic => ({ severity, code, path, message, entityId, candidates });

const isFiniteNumber = (value: number) => Number.isFinite(value);

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
  if (
    document.dataStatus === 'published' &&
    document.provenance.some((source) => source.licenseStatus !== 'approved')
  ) {
    errors.push(
      diagnostic(
        'error',
        'DUNGEON_PUBLISHED_SOURCE_NOT_APPROVED',
        'provenance',
        'published 内容不能包含未批准的来源。',
        document.id,
      ),
    );
  }
  const releaseStatus = document.dataStatus === 'reviewed' || document.dataStatus === 'published';
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
    if (!Number.isInteger(enemy.npcId) || enemy.npcId <= 0) {
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
