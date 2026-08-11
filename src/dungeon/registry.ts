import type { DungeonDocument } from './schema/types';
import { altarOfFangsFixture, rubyLifePoolsFixture } from './data/fixtures';
import { rubyLifePoolsSpatialPreview } from './data/rlpSpatialPreview';

/**
 * Documents registered for the local learning preview. The phase-0 fixtures
 * remain available through `phase0FixtureDocuments` but are never treated as
 * current content by the registry.
 */
export const dungeonDocuments: readonly DungeonDocument[] = [rubyLifePoolsSpatialPreview];

/** Internal contract fixtures used by schema/runtime tests and the dev-only inspector. */
export const phase0FixtureDocuments = {
  rubyLifePools: rubyLifePoolsFixture,
  altarOfFangs: altarOfFangsFixture,
};

/** Everything that may be opened by the Vite development preview. */
export const dungeonPreviewDocuments: readonly DungeonDocument[] = [
  rubyLifePoolsSpatialPreview,
  altarOfFangsFixture,
];

export const dungeonDocumentsById = new Map(
  dungeonPreviewDocuments.map((document) => [document.id, document]),
);

export function getDungeonDocument(id: string): DungeonDocument | undefined {
  return dungeonDocumentsById.get(id);
}
