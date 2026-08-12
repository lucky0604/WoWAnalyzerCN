import rlpCoordinateSnapshot from './coordinates/rlp.json';
import rlpBindingManifest from './coordinates/rlp.bindings.json';
import rlpIdentityRegistry from './coordinates/rlp.identity.json';
import { rubyLifePoolsPhase1Draft } from './phase1Prototypes';
import type {
  DungeonDocument,
  Enemy,
  Floor,
  LocalizedText,
  Provenance,
  Spawn,
} from '../schema/types';
import { getCoordinateBindingIdentity } from '../runtime/coordinates';

interface RlpCoordinateSnapshot {
  snapshotId: string;
  retrievedAt: string;
  rawSha256: string;
  spawns: Array<{
    sourceId: string;
    sourceEnemyId: number;
    position: [number, number];
    groupId?: string;
    patrol?: Array<[number, number]>;
  }>;
}

interface RlpIdentityRegistry {
  entries: Array<{
    stableId: string;
    sourceId: string;
    enemyId: string;
    floorId: string;
  }>;
}

interface RlpBindingManifest {
  version: number;
  dungeonId: string;
  snapshotId: string;
  sourceFloorId: string;
  previewFloorId: string;
  enemyBindings: Array<{
    sourceEnemyId: number;
    enemyId: string;
  }>;
  situationAnchors: Array<{
    situationId: string;
    sourceEnemyIds: number[];
    maxSpawns: number;
  }>;
}

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;
const snapshot = isObject(rlpCoordinateSnapshot)
  ? (rlpCoordinateSnapshot as unknown as RlpCoordinateSnapshot)
  : ({} as RlpCoordinateSnapshot);
const bindingManifest = isObject(rlpBindingManifest)
  ? (rlpBindingManifest as unknown as RlpBindingManifest)
  : ({} as RlpBindingManifest);
const identityRegistry = isObject(rlpIdentityRegistry)
  ? (rlpIdentityRegistry as unknown as RlpIdentityRegistry)
  : ({} as RlpIdentityRegistry);
const sourcePlaneFloorId = 'rlp-source-plane';
const sourceFloorId = 'default';
const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate));
const isCoordinateSpawn = (value: unknown): value is RlpCoordinateSnapshot['spawns'][number] => {
  if (!isObject(value)) return false;
  const candidate = value as Partial<RlpCoordinateSnapshot['spawns'][number]>;
  const patrolIsValid =
    candidate.patrol === undefined ||
    (Array.isArray(candidate.patrol) && candidate.patrol.every((point) => isCoordinate(point)));
  return (
    typeof candidate.sourceId === 'string' &&
    typeof candidate.sourceEnemyId === 'number' &&
    Number.isInteger(candidate.sourceEnemyId) &&
    candidate.sourceEnemyId > 0 &&
    isCoordinate(candidate.position) &&
    (candidate.groupId === undefined || typeof candidate.groupId === 'string') &&
    patrolIsValid
  );
};
const snapshotSpawns = Array.isArray(snapshot.spawns)
  ? snapshot.spawns.filter(isCoordinateSpawn)
  : ([] as RlpCoordinateSnapshot['spawns']);
const identityEntries = Array.isArray(identityRegistry.entries)
  ? identityRegistry.entries.filter(isObject)
  : [];
const enemyBindings = Array.isArray(bindingManifest.enemyBindings)
  ? bindingManifest.enemyBindings.filter(isObject)
  : [];
const situationAnchors = Array.isArray(bindingManifest.situationAnchors)
  ? bindingManifest.situationAnchors.filter(isObject)
  : [];

const text = (zhCN: string, enUS?: string): LocalizedText => ({ zhCN, enUS });

/**
 * This is intentionally a reference-only provenance record.  It authorizes
 * the coordinate snapshot to explain spatial context, not to supply forces,
 * encounter facts, skill facts, or route decisions.
 */
const coordinateProvenance: Provenance = {
  type: 'threechest',
  title: 'Threechest RLP S2 PTR coordinate snapshot',
  snapshot: snapshot.snapshotId,
  retrievedAt: snapshot.retrievedAt,
  licenseStatus: 'reference-only',
  notes: '仅用于位置参考；区域语义、forces、技能与路线仍需独立核验。',
};

/**
 * Every source NPC in the MDT-derived snapshot now has an authored enemy
 * concept in the RLP learning draft, bound through the enemyBindings sidecar.
 * The binding guard in this module still fails closed if a future snapshot
 * introduces an unbound NPC, and that NPC then falls back to a source-owned
 * placeholder until its facts are reviewed.
 */
const sourceEnemyId = (npcId: number): string => `rlp-source-enemy-${npcId}`;

const identityBySource = new Map(identityEntries.map((entry) => [entry.sourceId, entry]));
const ownedEnemyIdByNpc = new Map(
  enemyBindings.map((binding) => [binding.sourceEnemyId, binding.enemyId]),
);
const anchorBindingsBySituation = new Map(
  situationAnchors.map((binding) => [binding.situationId, binding]),
);
const identityShapeIsValid =
  snapshotSpawns.length === 0 ||
  identityBySource.size !== snapshotSpawns.length ||
  new Set(identityEntries.map((entry) => entry.stableId)).size !== identityEntries.length;
const bindingManifestIsValid = (() => {
  const sourceEnemyIds = new Set(snapshotSpawns.map((spawn) => spawn.sourceEnemyId));
  const authoredEnemyIds = new Set(rubyLifePoolsPhase1Draft.enemies.map((enemy) => enemy.id));
  const authoredNpcEnemyIds = new Set(
    rubyLifePoolsPhase1Draft.enemies
      .filter((enemy) => enemy.npcId !== undefined)
      .map((enemy) => enemy.id),
  );
  const identityFloorIsValid = identityEntries.every(
    (entry) => entry.floorId === `rlp:${sourceFloorId}`,
  );
  const enemyBindingsAreValid =
    enemyBindings.length > 0 &&
    new Set(enemyBindings.map((binding) => binding.sourceEnemyId)).size === enemyBindings.length &&
    enemyBindings.every(
      (binding) =>
        sourceEnemyIds.has(binding.sourceEnemyId) && authoredEnemyIds.has(binding.enemyId),
    ) &&
    [...authoredNpcEnemyIds].every((enemyId) =>
      enemyBindings.some((binding) => binding.enemyId === enemyId),
    );
  const situationIds = new Set(
    rubyLifePoolsPhase1Draft.situations.map((situation) => situation.id),
  );
  const situationAnchorsAreValid =
    situationAnchors.length === situationIds.size &&
    new Set(situationAnchors.map((binding) => binding.situationId)).size ===
      situationAnchors.length &&
    situationAnchors.every(
      (binding) =>
        situationIds.has(binding.situationId) &&
        Number.isInteger(binding.maxSpawns) &&
        binding.maxSpawns > 0 &&
        Array.isArray(binding.sourceEnemyIds) &&
        binding.sourceEnemyIds.length > 0 &&
        binding.sourceEnemyIds.every((sourceEnemyId) => sourceEnemyIds.has(sourceEnemyId)),
    );
  return (
    bindingManifest.version === 1 &&
    bindingManifest.dungeonId === rubyLifePoolsPhase1Draft.id &&
    bindingManifest.snapshotId === snapshot.snapshotId &&
    bindingManifest.sourceFloorId === sourceFloorId &&
    bindingManifest.previewFloorId === sourcePlaneFloorId &&
    snapshotSpawns.length > 0 &&
    identityFloorIsValid &&
    enemyBindingsAreValid &&
    situationAnchorsAreValid
  );
})();

function getBounds(spawns: RlpCoordinateSnapshot['spawns']): Floor['bounds'] {
  const xValues = spawns.map((spawn) => spawn.position[0]);
  const yValues = spawns.map((spawn) => spawn.position[1]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  return {
    xMin,
    xMax: xMax === xMin ? xMax + 1 : xMax,
    yMin,
    yMax: yMax === yMin ? yMax + 1 : yMax,
  };
}

const sourceFloor: Floor = {
  id: sourcePlaneFloorId,
  name: text('位置参考平面（区域语义待核验）', 'Coordinate reference plane (area mapping pending)'),
  coordinateSpace: 'normalized-v1',
  bounds: getBounds(snapshotSpawns),
  mapAssetKey: 'midnight-s2:ruby-life-pools',
};

function buildSpawns(): Spawn[] | undefined {
  if (identityShapeIsValid || !bindingManifestIsValid) return undefined;
  const spawns: Spawn[] = [];
  for (const sourceSpawn of snapshotSpawns) {
    const identity = identityBySource.get(sourceSpawn.sourceId);
    if (!identity || identity.enemyId !== `rlp:source-enemy:${sourceSpawn.sourceEnemyId}`) {
      return undefined;
    }
    spawns.push({
      id: identity.stableId,
      enemyId:
        ownedEnemyIdByNpc.get(sourceSpawn.sourceEnemyId) ??
        sourceEnemyId(sourceSpawn.sourceEnemyId),
      floorId: sourcePlaneFloorId,
      position: sourceSpawn.position,
      sourceId: sourceSpawn.sourceId,
      ...(sourceSpawn.groupId ? { groupId: sourceSpawn.groupId } : {}),
      ...(sourceSpawn.patrol ? { patrol: { points: sourceSpawn.patrol } } : {}),
    });
  }
  return spawns;
}

function spawnIdsForNpc(spawns: Spawn[], npcIds: number[], limit = 6): string[] {
  return spawns
    .filter((spawn) => {
      const sourceId = identityBySource.get(spawn.sourceId)?.enemyId;
      return (
        sourceId !== undefined && npcIds.some((npcId) => sourceId === `rlp:source-enemy:${npcId}`)
      );
    })
    .slice(0, limit)
    .map((spawn) => spawn.id);
}

function withSpatialAnchors(document: DungeonDocument): DungeonDocument {
  const spatialSpawns = buildSpawns();
  if (!spatialSpawns) return document;

  return {
    ...document,
    coordinateBinding: getCoordinateBindingIdentity('rlp'),
    floors: [sourceFloor, ...document.floors],
    spawns: spatialSpawns,
    enemies: document.enemies
      .map((enemy) => ({
        ...enemy,
        spawnIds: spatialSpawns
          .filter((spawn) => spawn.enemyId === enemy.id)
          .map((spawn) => spawn.id),
      }))
      .concat(
        [...new Set(spatialSpawns.map((spawn) => spawn.enemyId))]
          .filter((enemyId) => !document.enemies.some((enemy) => enemy.id === enemyId))
          .map<Enemy>((enemyId) => {
            const npcId = Number(enemyId.replace('rlp-source-enemy-', ''));
            return {
              id: enemyId,
              npcId,
              name: text(`未绑定的源 NPC ${npcId}`, `Unbound source NPC ${npcId}`),
              forcesPoints: 0,
              forcesStatus: 'pending',
              isBoss: false,
              spawnIds: spatialSpawns
                .filter((spawn) => spawn.enemyId === enemyId)
                .map((spawn) => spawn.id),
              abilityIds: [],
              provenance: [coordinateProvenance],
            };
          }),
      ),
    situations: document.situations.map((situation) => ({
      ...situation,
      floorIds: [...new Set([...situation.floorIds, sourcePlaneFloorId])],
      anchorSpawnIds: anchorBindingsBySituation.has(situation.id)
        ? spawnIdsForNpc(
            spatialSpawns,
            anchorBindingsBySituation.get(situation.id)!.sourceEnemyIds,
            anchorBindingsBySituation.get(situation.id)!.maxSpawns,
          )
        : situation.anchorSpawnIds,
    })),
    routes: document.routes.map((route) => ({
      ...route,
      steps: route.steps.map((step) => {
        if (step.type === 'pull' || step.type === 'event') {
          return { ...step, floorId: sourcePlaneFloorId };
        }
        return {
          ...step,
          fromFloorId: sourcePlaneFloorId,
          toFloorId: sourcePlaneFloorId,
        };
      }),
    })),
    provenance: [...document.provenance, coordinateProvenance],
  };
}

/**
 * Local learning preview with an explicit source-plane overlay.  It remains a
 * draft and spatially pending: the overlay makes positions inspectable while
 * refusing to imply that the source plane is an authored floor or route.
 */
export const rubyLifePoolsSpatialPreview = withSpatialAnchors(rubyLifePoolsPhase1Draft);
