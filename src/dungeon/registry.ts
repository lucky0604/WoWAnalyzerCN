import type { DungeonDocument } from './schema/types';
import { altarOfFangsFixture, rubyLifePoolsFixture } from './data/fixtures';
import { altarOfFangsDocument } from './data/altarOfFangsDocument';
import { murderRowDocument } from './data/murderRowDocument';
import { rubyLifePoolsSpatialPreview } from './data/rlpSpatialPreview';
import { runtimeReleaseDocuments } from './runtime/releaseRegistry';

/**
 * Documents registered for the local learning preview. The phase-0 fixtures
 * remain available through `phase0FixtureDocuments` but are never treated as
 * current content by the registry.
 */
const authoredDocuments: readonly DungeonDocument[] = [
  rubyLifePoolsSpatialPreview,
  altarOfFangsDocument,
  murderRowDocument,
];

/**
 * A release-sync artifact is the only supported way for published content to
 * replace a static preview at runtime.  The map keeps the old draft behavior
 * when the artifact is empty, while making a synced published revision the
 * authoritative document for its dungeon ID.
 */
const runtimeDocumentsById = new Map(authoredDocuments.map((document) => [document.id, document]));
runtimeReleaseDocuments.forEach((document) => runtimeDocumentsById.set(document.id, document));

export const dungeonDocuments: readonly DungeonDocument[] = [...runtimeDocumentsById.values()];

/** Internal contract fixtures used by schema/runtime tests and the dev-only inspector. */
export const phase0FixtureDocuments = {
  rubyLifePools: rubyLifePoolsFixture,
  altarOfFangs: altarOfFangsFixture,
};

/**
 * Everything that may be opened by the Vite development preview.  Authored
 * documents are spread last so current content wins its dungeon ID over the
 * phase-0 contract fixtures.
 */
export const dungeonPreviewDocuments: readonly DungeonDocument[] = [
  altarOfFangsFixture,
  ...dungeonDocuments,
];

export const dungeonDocumentsById = new Map(
  dungeonPreviewDocuments.map((document) => [document.id, document]),
);

export function getDungeonDocument(id: string): DungeonDocument | undefined {
  return dungeonDocumentsById.get(id);
}
