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
      snapshotId: 'local-coordinate-fixture-2026-08-10',
      hash: 'fixture-only',
      allowedUses: ['local-research', 'commit-derived-data', 'redistribute'],
      approvedBy: 'project-owner',
      approvedAt: '2026-08-10',
      status: 'approved',
      evidenceRef: 'agent_flow/dungeon-learning/08-confirmed-development-source-decisions.md',
      fieldAllowlist: ['floorId', 'position', 'patrol', 'groupId', 'coordinateSpace'],
    },
  ],
};
