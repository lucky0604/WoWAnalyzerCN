import { describe, expect, it } from 'vitest';

import { findForbiddenMarkers } from './check-dist';

describe('Dungeon production dist guard', () => {
  it('allows provider guard identifiers without concrete source URLs', () => {
    expect(
      findForbiddenMarkers(
        'dist/assets/dungeon.js',
        'provider=`remote-dev`; VITE_DUNGEON_DEV_ASSET_MANIFEST; DUNGEON_REMOTE_DEV_ASSETS_FORBIDDEN',
      ),
    ).toEqual([]);
  });

  it('blocks concrete Threechest and source URL markers', () => {
    expect(
      findForbiddenMarkers(
        'dist/assets/dungeon.js',
        'https://threechest.io/maps/aa/0_0.jpg DUNGEON_THREECHEST_SOURCE_URL',
      ),
    ).toEqual([
      'dist/assets/dungeon.js: threechest.io',
      'dist/assets/dungeon.js: DUNGEON_THREECHEST_SOURCE_URL',
    ]);
  });
});
