import type {
  Diagnostic,
  DungeonDataStatus,
  DungeonDocument,
  ValidationResult,
} from '../schema/types';
import { validateDungeonDocument } from '../schema/validate';
import {
  getStaleEntriesForDocument,
  getValidatedStaleKnowledgeLedger,
  registeredKnowledgeIds,
  type StaleKnowledgeLedger,
  validateStaleLedger,
} from './staleLedger';

/**
 * The learning route has two intentional entry levels:
 *
 * - `preview` is a local draft used to validate the learning interaction.
 * - `available` is reviewed/published content that passed the release gates.
 *
 * Keeping this decision in one runtime helper prevents a card, a deep link and
 * the WCL adapter from each inventing a slightly different definition of
 * "available".
 */
export type DungeonLearningAccessState = 'available' | 'preview' | 'fixture' | 'stale' | 'blocked';

export interface DungeonLearningAccess {
  documentId: string;
  state: DungeonLearningAccessState;
  canOpen: boolean;
  isFormal: boolean;
  label: string;
  reason: string;
  validation: ValidationResult;
}

const statusLabel: Record<DungeonDataStatus, string> = {
  fixture: '开发 fixture',
  draft: '本地学习预览',
  reviewed: '已审校',
  published: '已发布',
};

const firstBlockingDiagnostic = (validation: ValidationResult): Diagnostic | undefined =>
  validation.errors[0];

export function getDungeonLearningAccess(
  document: DungeonDocument,
  staleLedger?: StaleKnowledgeLedger | null,
): DungeonLearningAccess {
  const validation = validateDungeonDocument(document);
  const resolvedStaleLedger =
    staleLedger === undefined ? getValidatedStaleKnowledgeLedger() : staleLedger;

  if (document.dataStatus === 'fixture') {
    return {
      documentId: document.id,
      state: 'fixture',
      canOpen: false,
      isFormal: false,
      label: statusLabel.fixture,
      reason: 'fixture 只用于数据合同回归，不能作为攻略学习内容。',
      validation,
    };
  }

  if (
    !resolvedStaleLedger ||
    (staleLedger !== undefined &&
      !validateStaleLedger(resolvedStaleLedger, registeredKnowledgeIds).ok)
  ) {
    return {
      documentId: document.id,
      state: 'blocked',
      canOpen: false,
      isFormal: false,
      label: 'stale 清单损坏',
      reason: 'stale 清单无法通过结构校验，已阻断学习入口；请运行 dungeon:check 修复。',
      validation,
    };
  }

  const staleEntries = getStaleEntriesForDocument(document, resolvedStaleLedger);
  if (staleEntries.length > 0) {
    const ids = staleEntries.map((entry) => entry.knowledgeId).join('、');
    return {
      documentId: document.id,
      state: 'stale',
      canOpen: false,
      isFormal: false,
      label: '内容已过期',
      reason: `stale 清单标记了 ${ids}：${staleEntries[0]?.reason}`,
      validation,
    };
  }

  if (document.version.status === 'stale') {
    return {
      documentId: document.id,
      state: 'stale',
      canOpen: false,
      isFormal: false,
      label: '内容已过期',
      reason: '来源快照或游戏版本发生变化；完成定向复核并生成新 revision 后才能重新开放。',
      validation,
    };
  }

  if (document.dataStatus === 'draft') {
    if (document.version.status !== 'draft' || !validation.ok) {
      const diagnostic = firstBlockingDiagnostic(validation);
      return {
        documentId: document.id,
        state: 'blocked',
        canOpen: false,
        isFormal: false,
        label: '草稿被校验阻断',
        reason: diagnostic?.message ?? '草稿仍有未解决的校验错误。',
        validation,
      };
    }
    return {
      documentId: document.id,
      state: 'preview',
      canOpen: true,
      isFormal: false,
      label: statusLabel.draft,
      reason: '内容仍在建设中，只用于本地学习闭环预览。',
      validation,
    };
  }

  if (
    (document.dataStatus === 'reviewed' || document.dataStatus === 'published') &&
    document.version.status === document.dataStatus &&
    validation.ok
  ) {
    return {
      documentId: document.id,
      state: 'available',
      canOpen: true,
      isFormal: true,
      label: statusLabel[document.dataStatus],
      reason: '内容通过当前版本、空间、来源和引用校验。',
      validation,
    };
  }

  const diagnostic = firstBlockingDiagnostic(validation);
  return {
    documentId: document.id,
    state: 'blocked',
    canOpen: false,
    isFormal: false,
    label: '发布门禁未通过',
    reason: diagnostic?.message ?? '内容状态与版本或校验结果不一致。',
    validation,
  };
}
