// The dungeon-learning section is feature-gated: local previews are always
// available in DEV, but production/preview only opts in after a published data
// registry and route QA are part of that deploy. Routes and navigation share
// this module so a link can never point at a route that is not registered.
export const dungeonRoutesEnabled =
  import.meta.env.DEV || import.meta.env.VITE_DUNGEON_ROUTES === 'true';
export const dungeonLegacyRoutesEnabled = import.meta.env.DEV;
