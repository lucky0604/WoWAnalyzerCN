export interface DungeonAssetResult {
  kind: 'remote' | 'placeholder';
  assetKey: string;
  url?: string;
  reason?: string;
}

export interface DungeonAssetProvider {
  getFloorMap(assetKey: string): DungeonAssetResult;
  getDungeonArtwork(assetKey: string): DungeonAssetResult;
}
