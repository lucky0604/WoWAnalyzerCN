export type DungeonId = string;
export type FloorId = string;
export type EnemyId = string;
export type SpawnId = string;
export type AbilityId = string;
export type SituationId = string;
export type RouteId = string;
export type KnowledgeId = string;

export type Coordinate = readonly [x: number, y: number];

export type ContentStatus = 'draft' | 'reviewed' | 'published' | 'stale';
export type DungeonDataStatus = 'fixture' | 'draft' | 'reviewed' | 'published';
export type SpatialStatus = 'pending' | 'verified';
export type ForcesStatus = 'pending' | 'verified';
export type Severity = 'info' | 'warning' | 'critical';
export type Role = 'tank' | 'healer' | 'dps';
export type SituationKind = 'routine' | 'critical' | 'transition' | 'event' | 'boss';
export type Coverage = 'full' | 'partial';

export interface LocalizedText {
  zhCN: string;
  enUS?: string;
}

export type ContentSelfTestMode = 'quick' | 'overview' | 'full';

export interface ContentSelfTest {
  completedAt: string;
  modes: ContentSelfTestMode[];
  situationIds: SituationId[];
  routeIds: RouteId[];
  evidence?: string;
}

/**
 * Small, auditable effort record used to calibrate the cost of expanding a
 * season pack.  Per-Situation values intentionally cover only routine and
 * critical learning units; transition/boss work remains part of the dungeon
 * total and can be explained in `evidence`.
 */
export interface ContentAuthoringEffort {
  totalMinutes: number;
  situationMinutes: Partial<Record<SituationId, number>>;
  evidence?: string;
}

export interface ContentVersion {
  season: string;
  build: string;
  revision: number;
  status: ContentStatus;
}

/** Evidence that a content document was reviewed against a specific game build. */
export interface ContentReview {
  author: string;
  reviewer: string;
  reviewedAt: string;
  gameBuild: string;
  evidence?: string;
  selfTest?: ContentSelfTest;
  authoringEffort?: ContentAuthoringEffort;
}

export type ProvenanceType =
  | 'threechest'
  | 'official'
  | 'game-data'
  | 'wcl'
  | 'manual-test'
  | 'external-reference';
export type ProvenanceLicenseStatus = 'approved' | 'reference-only' | 'needs-review';

export interface Provenance {
  type: ProvenanceType;
  title: string;
  url?: string;
  snapshot?: string;
  /** Machine-checkable game/data build for facts derived from a live snapshot. */
  gameBuild?: string;
  retrievedAt?: string;
  verifiedAt?: string;
  licenseStatus: ProvenanceLicenseStatus;
  notes?: string;
}

/** Independent evidence record for enemy forces values. */
export interface ForcesSnapshot {
  /** Key into the committed forces snapshot registry. */
  registryKey: string;
  source: Extract<ProvenanceType, 'official' | 'game-data' | 'wcl' | 'manual-test'>;
  title: string;
  snapshot: string;
  gameBuild: string;
  digest: string;
  licenseStatus: ProvenanceLicenseStatus;
  verifiedAt?: string;
  notes?: string;
}

export interface CoordinateBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Floor {
  id: FloorId;
  name: LocalizedText;
  coordinateSpace: 'normalized-v1';
  bounds: CoordinateBounds;
  mapAssetKey?: string;
}

export interface PatrolPath {
  points: Coordinate[];
}

export interface Spawn {
  id: SpawnId;
  enemyId: EnemyId;
  floorId: FloorId;
  position: Coordinate;
  groupId?: string;
  patrol?: PatrolPath;
  sourceId: string;
}

export interface Enemy {
  id: EnemyId;
  /** NPC ID can remain unset until the game-data snapshot is reconciled. */
  npcId?: number;
  /** Build binding for the current NPC fact snapshot. */
  factBuild?: string;
  name: LocalizedText;
  forcesPoints: number;
  /**
   * Forces are deliberately independent from the NPC identity. A draft may
   * know the enemy but not yet have an approved forces snapshot.
   */
  forcesStatus?: ForcesStatus;
  isBoss: boolean;
  spawnIds: SpawnId[];
  abilityIds: AbilityId[];
  provenance: Provenance[];
}

export type PlayerCapability =
  | 'interrupt'
  | 'offensive-dispel'
  | 'enrage-dispel'
  | 'curse-dispel'
  | 'poison-dispel'
  | 'disease-dispel'
  | 'magic-dispel'
  | 'hard-cc'
  | 'knockback'
  | 'group-defensive'
  | 'combat-drop';

export interface CapabilityAdvice {
  capability: PlayerCapability;
  instruction: LocalizedText;
  priority: 1 | 2 | 3;
}

export interface AbilityKnowledge {
  id: AbilityId;
  /** Spell ID can remain unset while a draft is being reconciled with game data. */
  spellId?: number;
  name: LocalizedText;
  casterEnemyIds: EnemyId[];
  decisionCritical: boolean;
  severity: Severity;
  action: LocalizedText;
  consequence: LocalizedText;
  roleAdvice?: Partial<Record<Role, LocalizedText>>;
  capabilityAdvice?: CapabilityAdvice[];
  memoryCue?: LocalizedText;
  version: ContentVersion;
  provenance: Provenance[];
}

export interface SituationKnowledge {
  id: SituationId;
  dungeonId: DungeonId;
  kind: SituationKind;
  title: LocalizedText;
  floorIds: FloorId[];
  anchorSpawnIds: SpawnId[];
  summary: LocalizedText;
  focusAbilityIds: AbilityId[];
  roleAdvice?: Partial<Record<Role, LocalizedText>>;
  capabilityAdvice?: CapabilityAdvice[];
  memoryCue?: LocalizedText;
  version: ContentVersion;
  provenance: Provenance[];
}

export interface PullStep {
  type: 'pull';
  id: string;
  order: number;
  title: LocalizedText;
  floorId: FloorId;
  spawnIds: SpawnId[];
  situationRefs: Array<{ situationId: SituationId; coverage: Coverage }>;
  rationale: LocalizedText;
  focusAbilityIds: AbilityId[];
}

export interface TransitionStep {
  type: 'transition';
  id: string;
  order: number;
  title: LocalizedText;
  fromFloorId: FloorId;
  toFloorId: FloorId;
  instruction: LocalizedText;
}

export interface EventStep {
  type: 'event';
  id: string;
  order: number;
  title: LocalizedText;
  floorId: FloorId;
  situationRefs: Array<{ situationId: SituationId; coverage: Coverage }>;
  instruction: LocalizedText;
}

export type RouteStep = PullStep | TransitionStep | EventStep;

export interface RouteKnowledge {
  id: RouteId;
  dungeonId: DungeonId;
  name: LocalizedText;
  intent: 'learning' | 'pug-safe' | 'push' | 'custom-reference';
  keyRange?: { min: number; max?: number };
  steps: RouteStep[];
  expectedEnemyForcesPoints: number;
  version: ContentVersion;
  provenance: Provenance[];
}

export interface BossKnowledge {
  id: KnowledgeId;
  enemyId: EnemyId;
  title: LocalizedText;
  summary: LocalizedText;
  focusAbilityIds: AbilityId[];
  version: ContentVersion;
  provenance: Provenance[];
}

export interface DungeonDocument {
  id: DungeonId;
  slug: string;
  name: LocalizedText;
  season: string;
  dataStatus: DungeonDataStatus;
  /** `pending` means learning content may exist before map/spawn data is verified. */
  spatialStatus?: SpatialStatus;
  /** Deliberately absent on drafts until an author and second reviewer are known. */
  review?: ContentReview;
  version: ContentVersion;
  totalEnemyForcesPoints: number;
  /** Forces numbers are not releasable without an independent snapshot record. */
  forcesSnapshot?: ForcesSnapshot;
  floors: Floor[];
  spawns: Spawn[];
  enemies: Enemy[];
  abilities: AbilityKnowledge[];
  situations: SituationKnowledge[];
  routes: RouteKnowledge[];
  bosses: BossKnowledge[];
  provenance: Provenance[];
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
  entityId?: string;
  candidates?: string[];
}

export interface ValidationResult {
  errors: Diagnostic[];
  warnings: Diagnostic[];
  ok: boolean;
}
