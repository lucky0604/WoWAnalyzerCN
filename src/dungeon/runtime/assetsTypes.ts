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
  /** 源以"屏幕 y 向下为正"定义瓦片(如 threechest 的 CRS.Simple),与 normalized 负 y 坐标相反时置 true。 */
  flipY?: boolean;
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
