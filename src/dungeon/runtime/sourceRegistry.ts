import type { Provenance, ProvenanceLicenseStatus } from '../schema/types';

export type SourceAllowedUse =
  | 'local-research'
  | 'commit-derived-data'
  | 'redistribute'
  | 'production-asset';

export interface ApprovedSourceSnapshot {
  sourceId: string;
  snapshotId: string;
  hash: string;
  allowedUses: SourceAllowedUse[];
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
  status: 'approved' | 'revoked' | 'expired';
  evidenceRef: string;
  fieldAllowlist?: string[];
}

export interface SourceRegistry {
  version: 1;
  snapshots: ApprovedSourceSnapshot[];
}

export interface SourceUseCheck {
  ok: boolean;
  reason?: string;
  snapshot?: ApprovedSourceSnapshot;
}

export function checkSourceUse(
  registry: SourceRegistry,
  sourceId: string,
  snapshotId: string,
  use: SourceAllowedUse,
  now = new Date(),
): SourceUseCheck {
  const snapshot = registry.snapshots.find(
    (candidate) => candidate.sourceId === sourceId && candidate.snapshotId === snapshotId,
  );
  if (!snapshot) {
    return { ok: false, reason: `未找到来源 snapshot：${sourceId}/${snapshotId}` };
  }
  if (snapshot.status !== 'approved') {
    return { ok: false, reason: `来源 snapshot 状态为 ${snapshot.status}。`, snapshot };
  }
  if (snapshot.expiresAt && new Date(snapshot.expiresAt) <= now) {
    return { ok: false, reason: `来源 snapshot 已过期：${snapshot.expiresAt}`, snapshot };
  }
  if (!snapshot.allowedUses.includes(use)) {
    return { ok: false, reason: `来源 snapshot 未批准用途：${use}`, snapshot };
  }
  return { ok: true, snapshot };
}

export function provenanceFromSnapshot(
  snapshot: ApprovedSourceSnapshot,
  title: string,
  type: Provenance['type'] = 'threechest',
  licenseStatus: ProvenanceLicenseStatus = 'approved',
): Provenance {
  return {
    type,
    title,
    snapshot: snapshot.snapshotId,
    retrievedAt: snapshot.approvedAt,
    verifiedAt: snapshot.approvedAt,
    licenseStatus,
    notes: `source=${snapshot.sourceId}; hash=${snapshot.hash}; evidence=${snapshot.evidenceRef}`,
  };
}

export const dungeonSourceRegistry: SourceRegistry = {
  version: 1,
  snapshots: [
    {
      sourceId: 'threechest',
      snapshotId: 'threechest-coordinate-snapshot-2026-08-11-rlp-s2-ptr',
      // sha256 of the coordinate-source key and raw payload hash. The
      // normalized snapshot contains positions/group identity only; forces,
      // abilities, and route decisions remain WoWAnalyzerCN-owned fields.
      hash: 'sha256:65f33abb4bf1855746c6fff7ccb7731729004194ace0f412fb78c041fdf5b331',
      allowedUses: ['local-research', 'commit-derived-data', 'redistribute'],
      approvedBy: 'project-owner',
      approvedAt: '2026-08-11',
      status: 'approved',
      evidenceRef: 'agent_flow/dungeon-learning/15-rlp-s2-coordinate-import-review.md',
      fieldAllowlist: [
        'floorId',
        'position',
        'patrol',
        'groupId',
        'coordinateSpace',
        'sourceEnemyId',
        'sourceEnemyIndex',
      ],
    },
    {
      sourceId: 'threechest',
      snapshotId: 'threechest-coordinate-snapshot-2026-08-10',
      // sha256 of the sorted `sourceKey:rawSha256` lines for the eight
      // committed legacy coordinate snapshots. These snapshots are not the
      // current Midnight S2 rotation; recompute when the inventory changes.
      hash: 'sha256:dd24df43ea1426dd0dddd9bc770f9b3d7cbdbcd2300589a3c5b90a4f6ad8bc09',
      allowedUses: ['local-research', 'commit-derived-data', 'redistribute'],
      approvedBy: 'project-owner',
      approvedAt: '2026-08-10',
      status: 'approved',
      evidenceRef: 'agent_flow/dungeon-learning/08-confirmed-development-source-decisions.md',
      fieldAllowlist: [
        'floorId',
        'position',
        'patrol',
        'groupId',
        'coordinateSpace',
        'sourceEnemyId',
        'sourceEnemyIndex',
      ],
    },
  ],
};
