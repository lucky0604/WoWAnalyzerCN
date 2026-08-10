import type {
  AbilityKnowledge,
  BossKnowledge,
  DungeonDocument,
  Enemy,
  Floor,
  LocalizedText,
  Provenance,
  RouteKnowledge,
  SituationKnowledge,
  Spawn,
} from '../schema/types';

const text = (zhCN: string, enUS?: string): LocalizedText => ({ zhCN, enUS });

const version = {
  season: 'midnight-s2',
  build: 'phase-0-fixture',
  revision: 1,
  status: 'draft' as const,
};

const fixtureProvenance: Provenance = {
  type: 'manual-test',
  title: 'Dungeon Learning Phase 0 contract fixture',
  snapshot: 'fixture-2026-08-10',
  verifiedAt: '2026-08-10',
  licenseStatus: 'approved',
  notes: '仅用于 Schema、Resolver、Inspector 和测试；不是可发布的 S2 事实数据。',
};

const floor = (id: string, name: string, mapAssetKey: string): Floor => ({
  id,
  name: text(name),
  coordinateSpace: 'normalized-v1',
  bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
  mapAssetKey,
});

const buildDocument = (input: {
  id: string;
  slug: string;
  name: string;
  floors: Floor[];
  enemies: Enemy[];
  spawns: Spawn[];
  abilities: AbilityKnowledge[];
  situations: SituationKnowledge[];
  routes: RouteKnowledge[];
  bosses: BossKnowledge[];
  totalEnemyForcesPoints: number;
}): DungeonDocument => ({
  ...input,
  name: text(input.name),
  season: 'midnight-s2',
  dataStatus: 'fixture',
  version,
  provenance: [fixtureProvenance],
});

const rlpEnemies: Enemy[] = [
  {
    id: 'rlp-primalist-flamer',
    npcId: 900101,
    name: text('原始火焰使'),
    forcesPoints: 4,
    isBoss: false,
    spawnIds: ['rlp-spawn-flamer-1', 'rlp-spawn-flamer-2'],
    abilityIds: ['rlp-ability-burning-focus'],
    provenance: [fixtureProvenance],
  },
  {
    id: 'rlp-flashfrost-chillweaver',
    npcId: 900102,
    name: text('闪霜织寒者'),
    forcesPoints: 5,
    isBoss: false,
    spawnIds: ['rlp-spawn-chillweaver-1'],
    abilityIds: ['rlp-ability-ice-shield'],
    provenance: [fixtureProvenance],
  },
  {
    id: 'rlp-melidrussa',
    npcId: 900103,
    name: text('梅莉杜莎·寒妆'),
    forcesPoints: 0,
    isBoss: true,
    spawnIds: ['rlp-spawn-melidrussa'],
    abilityIds: ['rlp-ability-icy-devastation'],
    provenance: [fixtureProvenance],
  },
];

const rlpSpawns: Spawn[] = [
  {
    id: 'rlp-spawn-flamer-1',
    sourceId: 'threechest-fixture:rlp:flamer:1',
    enemyId: 'rlp-primalist-flamer',
    floorId: 'rlp-infusion-chambers',
    position: [28, 34],
    groupId: 'rlp-pack-1',
  },
  {
    id: 'rlp-spawn-flamer-2',
    sourceId: 'threechest-fixture:rlp:flamer:2',
    enemyId: 'rlp-primalist-flamer',
    floorId: 'rlp-infusion-chambers',
    position: [33, 39],
    groupId: 'rlp-pack-1',
  },
  {
    id: 'rlp-spawn-chillweaver-1',
    sourceId: 'threechest-fixture:rlp:chillweaver:1',
    enemyId: 'rlp-flashfrost-chillweaver',
    floorId: 'rlp-infusion-chambers',
    position: [38, 42],
    groupId: 'rlp-pack-1',
  },
  {
    id: 'rlp-spawn-melidrussa',
    sourceId: 'threechest-fixture:rlp:melidrussa:1',
    enemyId: 'rlp-melidrussa',
    floorId: 'rlp-infusion-chambers',
    position: [76, 70],
  },
];

const rlpAbilities: AbilityKnowledge[] = [
  {
    id: 'rlp-ability-burning-focus',
    spellId: 900201,
    name: text('燃烧专注'),
    casterEnemyIds: ['rlp-primalist-flamer'],
    decisionCritical: true,
    severity: 'critical',
    action: text('优先打断施法，并让队伍远离地面危险区。'),
    consequence: text('持续范围伤害叠加，治疗压力快速上升。'),
    capabilityAdvice: [
      { capability: 'interrupt', instruction: text('安排远程或近战轮流打断。'), priority: 1 },
    ],
    memoryCue: text('看到火焰读条，先断再输出。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'rlp-ability-ice-shield',
    spellId: 900202,
    name: text('冰霜护盾'),
    casterEnemyIds: ['rlp-flashfrost-chillweaver'],
    decisionCritical: true,
    severity: 'warning',
    action: text('及时打断或驱散护盾，再转火处理目标。'),
    consequence: text('护盾会延长战斗并放大其他技能造成的伤害。'),
    capabilityAdvice: [
      { capability: 'magic-dispel', instruction: text('有魔法驱散时优先处理。'), priority: 2 },
    ],
    memoryCue: text('冰盾出现时，不要继续无脑打主目标。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'rlp-ability-icy-devastation',
    spellId: 900203,
    name: text('寒冰毁灭'),
    casterEnemyIds: ['rlp-melidrussa'],
    decisionCritical: true,
    severity: 'critical',
    action: text('Boss 读条时分散并准备团队减伤。'),
    consequence: text('未处理会造成全队爆发伤害，随后留下持续区域。'),
    roleAdvice: {
      tank: text('把 Boss 固定在安全区域。'),
      healer: text('提前准备群体治疗。'),
      dps: text('保留打断或控制。'),
    },
    memoryCue: text('Boss 大读条前，站位和减伤先到位。'),
    version,
    provenance: [fixtureProvenance],
  },
];

const rlpSituations: SituationKnowledge[] = [
  {
    id: 'rlp-situation-infusion-first-pack',
    dungeonId: 'ruby-life-pools',
    kind: 'critical',
    title: text('注能大厅入口：双火焰使与织寒者'),
    floorIds: ['rlp-infusion-chambers'],
    anchorSpawnIds: ['rlp-spawn-flamer-1', 'rlp-spawn-chillweaver-1'],
    summary: text('这波的学习重点是先处理施法威胁，再决定是否为了路线效率同时拉入邻近目标。'),
    focusAbilityIds: ['rlp-ability-burning-focus', 'rlp-ability-ice-shield'],
    roleAdvice: {
      tank: text('把远程怪聚到可控位置，避免队伍被迫分散。'),
      healer: text('不要把打断失败当成纯治疗问题。'),
      dps: text('先确认自己的打断目标，再开始爆发。'),
    },
    memoryCue: text('先断火，再看冰盾。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'rlp-situation-melidrussa-entrance',
    dungeonId: 'ruby-life-pools',
    kind: 'boss',
    title: text('一号 Boss 前安全区'),
    floorIds: ['rlp-infusion-chambers'],
    anchorSpawnIds: ['rlp-spawn-melidrussa'],
    summary: text('进入 Boss 前先统一站位和减伤预案，避免把小怪阶段养成的分散习惯带进 Boss。'),
    focusAbilityIds: ['rlp-ability-icy-devastation'],
    version,
    provenance: [fixtureProvenance],
  },
];

const rlpRoute: RouteKnowledge = {
  id: 'rlp-learning-route',
  dungeonId: 'ruby-life-pools',
  name: text('学习路线：先建立打断优先级'),
  intent: 'learning',
  keyRange: { min: 2, max: 10 },
  steps: [
    {
      type: 'pull',
      id: 'rlp-route-step-1',
      order: 1,
      title: text('入口第一波'),
      floorId: 'rlp-infusion-chambers',
      spawnIds: ['rlp-spawn-flamer-1', 'rlp-spawn-flamer-2', 'rlp-spawn-chillweaver-1'],
      situationRefs: [{ situationId: 'rlp-situation-infusion-first-pack', coverage: 'full' }],
      rationale: text('用一波可控组合练习打断优先级，再进入更复杂区域。'),
      focusAbilityIds: ['rlp-ability-burning-focus', 'rlp-ability-ice-shield'],
    },
    {
      type: 'transition',
      id: 'rlp-route-transition-1',
      order: 2,
      title: text('前往一号 Boss'),
      fromFloorId: 'rlp-infusion-chambers',
      toFloorId: 'rlp-infusion-chambers',
      instruction: text('确认技能冷却和站位，再进入 Boss 区域。'),
    },
    {
      type: 'pull',
      id: 'rlp-route-step-2',
      order: 3,
      title: text('一号 Boss'),
      floorId: 'rlp-infusion-chambers',
      spawnIds: ['rlp-spawn-melidrussa'],
      situationRefs: [{ situationId: 'rlp-situation-melidrussa-entrance', coverage: 'full' }],
      rationale: text('把刚才的技能识别迁移到 Boss 读条和团队减伤。'),
      focusAbilityIds: ['rlp-ability-icy-devastation'],
    },
  ],
  expectedEnemyForcesPoints: 13,
  version,
  provenance: [fixtureProvenance],
};

const altarEnemies: Enemy[] = [
  {
    id: 'altar-venom-chanter',
    npcId: 900301,
    name: text('毒咒歌者'),
    forcesPoints: 5,
    isBoss: false,
    spawnIds: ['altar-spawn-chanter-1'],
    abilityIds: ['altar-ability-venomous-chant'],
    provenance: [fixtureProvenance],
  },
  {
    id: 'altar-fang-stalker',
    npcId: 900302,
    name: text('獠牙潜猎者'),
    forcesPoints: 4,
    isBoss: false,
    spawnIds: ['altar-spawn-stalker-1'],
    abilityIds: ['altar-ability-hidden-lunge'],
    provenance: [fixtureProvenance],
  },
  {
    id: 'altar-ravi',
    npcId: 900303,
    name: text("Rav'i"),
    forcesPoints: 0,
    isBoss: true,
    spawnIds: ['altar-spawn-ravi'],
    abilityIds: ['altar-ability-ravi-surge'],
    provenance: [fixtureProvenance],
  },
];

const altarSpawns: Spawn[] = [
  {
    id: 'altar-spawn-chanter-1',
    sourceId: 'threechest-fixture:altar:chanter:1',
    enemyId: 'altar-venom-chanter',
    floorId: 'altar-coiled-approach',
    position: [24, 28],
    groupId: 'altar-pack-1',
  },
  {
    id: 'altar-spawn-stalker-1',
    sourceId: 'threechest-fixture:altar:stalker:1',
    enemyId: 'altar-fang-stalker',
    floorId: 'altar-coiled-approach',
    position: [31, 35],
    groupId: 'altar-pack-1',
  },
  {
    id: 'altar-spawn-ravi',
    sourceId: 'threechest-fixture:altar:ravi:1',
    enemyId: 'altar-ravi',
    floorId: 'altar-coiled-approach',
    position: [78, 74],
  },
];

const altarAbilities: AbilityKnowledge[] = [
  {
    id: 'altar-ability-venomous-chant',
    spellId: 900401,
    name: text('剧毒咏唱'),
    casterEnemyIds: ['altar-venom-chanter'],
    decisionCritical: true,
    severity: 'critical',
    action: text('立即打断，无法打断时安排驱散或团队减伤。'),
    consequence: text('全队获得可叠加的中毒效果。'),
    capabilityAdvice: [
      { capability: 'interrupt', instruction: text('指定固定打断顺序。'), priority: 1 },
      {
        capability: 'poison-dispel',
        instruction: text('中毒扩散时优先驱散高层数目标。'),
        priority: 2,
      },
    ],
    memoryCue: text('咏唱不停，毒层就会继续涨。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'altar-ability-hidden-lunge',
    spellId: 900402,
    name: text('潜影突袭'),
    casterEnemyIds: ['altar-fang-stalker'],
    decisionCritical: true,
    severity: 'warning',
    action: text('保持队伍视野，突袭出现时立刻使用个人减伤。'),
    consequence: text('随机目标会被短时间控制并承受高额伤害。'),
    memoryCue: text('看不见不等于没有威胁。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'altar-ability-ravi-surge',
    spellId: 900403,
    name: text('蛇潮奔涌'),
    casterEnemyIds: ['altar-ravi'],
    decisionCritical: true,
    severity: 'critical',
    action: text('沿预先约定方向移动，保留位移和团队减伤。'),
    consequence: text('路径上的玩家会被连续击退并受到爆发伤害。'),
    memoryCue: text('先看方向，再决定往哪躲。'),
    version,
    provenance: [fixtureProvenance],
  },
];

const altarSituations: SituationKnowledge[] = [
  {
    id: 'altar-situation-coiled-approach',
    dungeonId: 'altar-of-fangs',
    kind: 'critical',
    title: text('盘蛇入口：毒咒与潜猎者组合'),
    floorIds: ['altar-coiled-approach'],
    anchorSpawnIds: ['altar-spawn-chanter-1', 'altar-spawn-stalker-1'],
    summary: text('这是新玩家第一次需要同时管理打断、毒层和不可见突袭的组合。'),
    focusAbilityIds: ['altar-ability-venomous-chant', 'altar-ability-hidden-lunge'],
    memoryCue: text('先断咏唱，保持视野，毒层再处理。'),
    version,
    provenance: [fixtureProvenance],
  },
  {
    id: 'altar-situation-ravi-arena',
    dungeonId: 'altar-of-fangs',
    kind: 'boss',
    title: text("Rav'i：蛇潮方向判断"),
    floorIds: ['altar-coiled-approach'],
    anchorSpawnIds: ['altar-spawn-ravi'],
    summary: text('Boss 学习重点是把视觉方向提示转成团队移动决策。'),
    focusAbilityIds: ['altar-ability-ravi-surge'],
    memoryCue: text('方向先于反应。'),
    version,
    provenance: [fixtureProvenance],
  },
];

const altarRoute: RouteKnowledge = {
  id: 'altar-learning-route',
  dungeonId: 'altar-of-fangs',
  name: text('学习路线：先练毒与视野'),
  intent: 'learning',
  keyRange: { min: 2, max: 10 },
  steps: [
    {
      type: 'pull',
      id: 'altar-route-step-1',
      order: 1,
      title: text('盘蛇入口第一波'),
      floorId: 'altar-coiled-approach',
      spawnIds: ['altar-spawn-chanter-1', 'altar-spawn-stalker-1'],
      situationRefs: [{ situationId: 'altar-situation-coiled-approach', coverage: 'full' }],
      rationale: text('先建立毒层和视野的共同语言，再进入 Boss。'),
      focusAbilityIds: ['altar-ability-venomous-chant', 'altar-ability-hidden-lunge'],
    },
    {
      type: 'pull',
      id: 'altar-route-step-2',
      order: 2,
      title: text("Rav'i"),
      floorId: 'altar-coiled-approach',
      spawnIds: ['altar-spawn-ravi'],
      situationRefs: [{ situationId: 'altar-situation-ravi-arena', coverage: 'full' }],
      rationale: text('把小怪阶段的方向沟通迁移到 Boss 蛇潮。'),
      focusAbilityIds: ['altar-ability-ravi-surge'],
    },
  ],
  expectedEnemyForcesPoints: 9,
  version,
  provenance: [fixtureProvenance],
};

export const rubyLifePoolsFixture = buildDocument({
  id: 'ruby-life-pools',
  slug: 'ruby-life-pools',
  name: '红玉新生法池',
  floors: [
    floor(
      'rlp-infusion-chambers',
      '注能大厅（Phase 0 fixture）',
      'ruby-life-pools-infusion-chambers',
    ),
  ],
  enemies: rlpEnemies,
  spawns: rlpSpawns,
  abilities: rlpAbilities,
  situations: rlpSituations,
  routes: [rlpRoute],
  bosses: [
    {
      id: 'rlp-boss-melidrussa',
      enemyId: 'rlp-melidrussa',
      title: text('梅莉杜莎·寒妆'),
      summary: text('先处理寒冰毁灭的站位与团队减伤。'),
      focusAbilityIds: ['rlp-ability-icy-devastation'],
      version,
      provenance: [fixtureProvenance],
    },
  ],
  totalEnemyForcesPoints: 18,
});

export const altarOfFangsFixture = buildDocument({
  id: 'altar-of-fangs',
  slug: 'altar-of-fangs',
  name: '獠牙祭坛',
  floors: [
    floor('altar-coiled-approach', '盘蛇入口（Phase 0 fixture）', 'altar-of-fangs-coiled-approach'),
  ],
  enemies: altarEnemies,
  spawns: altarSpawns,
  abilities: altarAbilities,
  situations: altarSituations,
  routes: [altarRoute],
  bosses: [
    {
      id: 'altar-boss-ravi',
      enemyId: 'altar-ravi',
      title: text("Rav'i"),
      summary: text('练习蛇潮方向判断和团队移动。'),
      focusAbilityIds: ['altar-ability-ravi-surge'],
      version,
      provenance: [fixtureProvenance],
    },
  ],
  totalEnemyForcesPoints: 9,
});

export const dungeonFixtures = [rubyLifePoolsFixture, altarOfFangsFixture] as const;
