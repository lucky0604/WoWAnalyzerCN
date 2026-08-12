import runtimeReleaseArtifactJson from '../data/releases/current.json';

import type { DungeonDocument } from '../schema/types';
import { validateDungeonDocument } from '../schema/validate';

export interface RuntimeReleaseDocument {
  dungeonId: string;
  revision: number;
  document: DungeonDocument;
}

export interface RuntimeReleaseArtifact {
  version: 1;
  documents: RuntimeReleaseDocument[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const artifactKeys = new Set(['version', 'documents']);
const entryKeys = new Set(['dungeonId', 'revision', 'document']);

const hasDocumentShape = (value: unknown): value is DungeonDocument =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  isRecord(value.version) &&
  Array.isArray(value.enemies) &&
  Array.isArray(value.abilities) &&
  Array.isArray(value.situations) &&
  Array.isArray(value.routes) &&
  Array.isArray(value.bosses);

/**
 * Validate the generated artifact before it is allowed to replace a static
 * preview document. This is deliberately defensive because the JSON file is
 * a build input, not a type-safe runtime object.
 */
export function validateRuntimeReleaseArtifact(value: unknown): string[] {
  const errors: string[] = [];
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.documents) ||
    Object.keys(value).some((key) => !artifactKeys.has(key))
  ) {
    return ['DUNGEON_RUNTIME_RELEASE_INVALID_SHAPE'];
  }
  const dungeonIds = new Set<string>();
  value.documents.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY #${index}`);
      return;
    }
    if (Object.keys(entry).some((key) => !entryKeys.has(key))) {
      errors.push(`DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY #${index}`);
      return;
    }
    const dungeonId = entry.dungeonId;
    const revision = entry.revision;
    const document = entry.document;
    if (
      typeof dungeonId !== 'string' ||
      !dungeonId.trim() ||
      dungeonIds.has(dungeonId) ||
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      !hasDocumentShape(document) ||
      document.id !== dungeonId ||
      document.dataStatus !== 'published' ||
      document.version.status !== 'published' ||
      document.version.revision !== revision
    ) {
      errors.push(`DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY ${dungeonId || `#${index}`}`);
      return;
    }
    dungeonIds.add(dungeonId);
    try {
      const validation = validateDungeonDocument(document);
      validation.errors.forEach((diagnostic) => {
        errors.push(`DUNGEON_RUNTIME_RELEASE_DOCUMENT_INVALID ${dungeonId}: ${diagnostic.code}`);
      });
    } catch (error) {
      errors.push(
        `DUNGEON_RUNTIME_RELEASE_DOCUMENT_INVALID ${dungeonId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });
  return errors;
}

export const runtimeReleaseArtifact =
  runtimeReleaseArtifactJson as unknown as RuntimeReleaseArtifact;
export const runtimeReleaseArtifactErrors = validateRuntimeReleaseArtifact(runtimeReleaseArtifact);

/** Only validated published documents are allowed into the runtime registry. */
export function getRuntimeReleaseDocuments(
  value: unknown = runtimeReleaseArtifact,
): DungeonDocument[] {
  if (validateRuntimeReleaseArtifact(value).length > 0 || !isRecord(value)) return [];
  return (value.documents as RuntimeReleaseDocument[]).map((entry) => entry.document);
}

export const runtimeReleaseDocuments = getRuntimeReleaseDocuments();
