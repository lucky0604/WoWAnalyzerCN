import type { DungeonDocument } from './schema/types';
import { altarOfFangsFixture, dungeonFixtures, rubyLifePoolsFixture } from './data/fixtures';

export const dungeonDocuments: readonly DungeonDocument[] = dungeonFixtures;

export const dungeonDocumentsById = new Map(
  dungeonDocuments.map((document) => [document.id, document]),
);

export const phase0FixtureDocuments = {
  rubyLifePools: rubyLifePoolsFixture,
  altarOfFangs: altarOfFangsFixture,
};

export function getDungeonDocument(id: string): DungeonDocument | undefined {
  return dungeonDocumentsById.get(id);
}
