// Stub: replaces game/REALMS for Node.js MCP server
// REALMS is only used by makeCharacterApiUrl/makeGuildApiUrl, not needed for M1

interface RealmEntry {
  name: string;
  slug: string;
}

export const REALMS: Record<string, RealmEntry[]> = {
  EU: [],
  US: [],
  KR: [],
  TW: [],
};
