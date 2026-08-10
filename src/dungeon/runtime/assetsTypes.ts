export interface DungeonRemoteImageAsset {
  kind: 'remote';
  assetKey: string;
  url: string;
  reason?: string;
}

export interface DungeonRemoteTilesAsset {
  kind: 'remote-tiles';
  assetKey: string;
  urlTemplate: string;
  tileSize: number;
  origin: readonly [x: number, y: number];
  reason?: string;
}

export interface DungeonPlaceholderAsset {
  kind: 'placeholder';
  assetKey: string;
  reason?: string;
}

export type DungeonAssetResult =
  | DungeonRemoteImageAsset
  | DungeonRemoteTilesAsset
  | DungeonPlaceholderAsset;

export interface DungeonAssetProvider {
  getFloorMap(assetKey: string): DungeonAssetResult;
  getDungeonArtwork(assetKey: string): DungeonAssetResult;
}
