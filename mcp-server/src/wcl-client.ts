// Thin wrapper: re-exports WCL API functions from the copied SPA source.
// tsconfig paths resolve common/*, parser/*, etc. to stubs for typechecking.
// At build time, esbuild aliases do the same resolution for bundling.
export {
  fetchFights,
  fetchEvents,
  fetchCombatants,
  fetchTable,
  toJson,
  ApiDownError,
  LogNotFoundError,
  CharacterNotFoundError,
  GuildNotFoundError,
  UnauthorizedError,
  JsonParseError,
  WclApiError,
  UnknownApiError,
  CorruptResponseError,
} from '../.copied/common/fetchWclApi';
