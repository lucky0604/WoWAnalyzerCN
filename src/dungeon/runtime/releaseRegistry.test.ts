import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import { getRuntimeReleaseDocuments, validateRuntimeReleaseArtifact } from './releaseRegistry';

describe('runtime release registry', () => {
  it('accepts an empty generated artifact', () => {
    expect(validateRuntimeReleaseArtifact({ version: 1, documents: [] })).toEqual([]);
    expect(getRuntimeReleaseDocuments({ version: 1, documents: [] })).toEqual([]);
  });

  it('rejects malformed entries without throwing', () => {
    expect(() =>
      validateRuntimeReleaseArtifact({
        version: 1,
        documents: [null, { dungeonId: 'broken', revision: 1, document: { version: null } }],
      }),
    ).not.toThrow();
    expect(
      validateRuntimeReleaseArtifact({
        version: 1,
        documents: [null, { dungeonId: 'broken', revision: 1, document: { version: null } }],
      }),
    ).toEqual(
      expect.arrayContaining([
        'DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY #0',
        expect.stringContaining('DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY broken'),
      ]),
    );
  });

  it('does not load a draft document as a runtime release', () => {
    const draft = phase0FixtureDocuments.rubyLifePools;
    const artifact = {
      version: 1 as const,
      documents: [{ dungeonId: draft.id, revision: 1, document: draft }],
    };
    expect(validateRuntimeReleaseArtifact(artifact)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DUNGEON_RUNTIME_RELEASE_INVALID_ENTRY ruby-life-pools'),
      ]),
    );
    expect(getRuntimeReleaseDocuments(artifact)).toEqual([]);
  });
});
