import rlpCoordinateSnapshot from './coordinates/rlp.json';
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

const snapshot = rlpCoordinateSnapshot as unknown as RlpCoordinateSnapshot;
const identityRegistry = rlpIdentityRegistry as unknown as RlpIdentityRegistry;
const sourcePlaneFloorId = 'rlp-source-plane';

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
 * These are the only source NPCs that already have an authored enemy concept
 * in the RLP learning draft.  The remaining IDs stay explicitly source-owned
 * placeholders until current-build facts are reviewed.
 */
const ownedEnemyIdByNpc: Record<number, string> = {
  188244: 'rlp-primal-juggernaut',
  188067: 'rlp-flashfrost-chillweaver',
  188252: 'rlp-melidrussa',
  189232: 'rlp-kokia',
  190484: 'rlp-kyrakka-erkhart',
  190485: 'rlp-kyrakka-erkhart',
};

const sourceEnemyId = (npcId: number): string => `rlp-source-enemy-${npcId}`;

const identityBySource = new Map(identityRegistry.entries.map((entry) => [entry.sourceId, entry]));
const identityShapeIsValid =
  identityBySource.size !== snapshot.spawns.length ||
  new Set(identityRegistry.entries.map((entry) => entry.stableId)).size !==
    identityRegistry.entries.length;

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
  bounds: getBounds(snapshot.spawns),
  mapAssetKey: 'midnight-s2:ruby-life-pools',
};

function buildSpawns(): Spawn[] | undefined {
  if (identityShapeIsValid) return undefined;
  const spawns: Spawn[] = [];
  for (const sourceSpawn of snapshot.spawns) {
    const identity = identityBySource.get(sourceSpawn.sourceId);
    if (!identity || identity.enemyId !== `rlp:source-enemy:${sourceSpawn.sourceEnemyId}`) {
      return undefined;
    }
    spawns.push({
      id: identity.stableId,
      enemyId:
        ownedEnemyIdByNpc[sourceSpawn.sourceEnemyId] ?? sourceEnemyId(sourceSpawn.sourceEnemyId),
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

  const anchorNpcIds: Record<string, number[]> = {
    'rlp-situation-first-caster-pack': [188244, 188067],
    'rlp-situation-hatchery-transition': [187894],
    'rlp-situation-melidrussa-intermission': [187894, 188067],
    'rlp-situation-kokia-ritual': [189232],
    'rlp-situation-melidrussa-boss': [188252],
    'rlp-situation-kokia-boss': [189232],
    'rlp-situation-kyrakka-erkhart-boss': [190484, 190485],
  };
  return {
    ...document,
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
      anchorSpawnIds: anchorNpcIds[situation.id]
        ? spawnIdsForNpc(spatialSpawns, anchorNpcIds[situation.id]!)
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
