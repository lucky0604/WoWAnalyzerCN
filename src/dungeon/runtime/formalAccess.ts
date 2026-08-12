import { isLearningPublished, type DungeonCatalogEntry } from '../data/season2Catalog';
import type { DungeonDocument } from '../schema/types';
import { getDungeonLearningAccess, type DungeonLearningAccessState } from './access';
import {
  getDungeonContentReadiness,
  type ContentReadinessGate,
  type DungeonContentReadiness,
} from './contentReadiness';

export interface DungeonScopedLearningAccess {
  state: DungeonLearningAccessState | 'missing';
  canOpen: boolean;
  isFormal: boolean;
  label: string;
  reason: string;
  readiness: DungeonContentReadiness;
}

const firstBlockingGate = (readiness: DungeonContentReadiness): ContentReadinessGate | undefined =>
  readiness.gates.find((gate) => gate.state === 'blocked') ??
  readiness.gates.find((gate) => gate.state !== 'ready');

/**
 * Guards every learning-shaped deep link. Draft previews remain available for
 * local content work; formal links require both catalog publication and all
 * content gates. Coordinate-only entries can never be opened as guides.
 */
export function getDungeonScopedLearningAccess(
  entry: DungeonCatalogEntry,
  document?: DungeonDocument,
): DungeonScopedLearningAccess {
  const baseAccess =
    document && document.dataStatus !== 'fixture' ? getDungeonLearningAccess(document) : undefined;
  const readiness = getDungeonContentReadiness(entry, document, baseAccess);
  if (!document || document.dataStatus === 'fixture') {
    return {
      state: document?.dataStatus === 'fixture' ? 'fixture' : 'missing',
      canOpen: false,
      isFormal: false,
      label: document?.dataStatus === 'fixture' ? '开发 fixture' : '攻略尚未开放',
      reason:
        document?.dataStatus === 'fixture'
          ? 'fixture 只用于数据合同回归，不能作为攻略学习内容。'
          : '该副本尚未登记 DungeonDocument，当前只有目录或位置参考。',
      readiness,
    };
  }

  if (!baseAccess) {
    return {
      state: 'missing',
      canOpen: false,
      isFormal: false,
      label: '学习入口不可用',
      reason: '未能建立副本内容门禁，已按 fail-closed 处理。',
      readiness,
    };
  }
  const access = baseAccess;
  const isPreview =
    access.state === 'preview' &&
    access.canOpen &&
    readiness.state === 'learning-preview' &&
    !isLearningPublished(entry.status) &&
    entry.status !== 'stale';
  const isFormal =
    access.isFormal && isLearningPublished(entry.status) && readiness.state === 'ready';
  const pendingGate = firstBlockingGate(readiness);
  const blockedByCatalog =
    !isLearningPublished(entry.status) &&
    (access.isFormal ||
      access.state === 'stale' ||
      document.dataStatus === 'reviewed' ||
      document.dataStatus === 'published');
  const canOpen = isPreview || isFormal;

  return {
    state: access.state,
    canOpen,
    isFormal,
    label: canOpen
      ? access.label
      : blockedByCatalog
        ? '目录发布门禁未通过'
        : (pendingGate?.label ?? access.label),
    reason: canOpen
      ? access.reason
      : blockedByCatalog
        ? 'DungeonDocument 已是正式状态，但目录仍未标记为 reviewed/published。'
        : (pendingGate?.detail ?? access.reason),
    readiness,
  };
}
