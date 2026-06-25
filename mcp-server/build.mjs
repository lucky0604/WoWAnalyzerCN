import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SPA_SRC = resolve(repoRoot, 'src');
const COPIED_DIR = resolve(__dirname, '.copied');

const filesToCopy = [
  'common/fetchWclApi.ts',
  'common/makeWclApiUrl.ts',
  'common/makeApiUrl.ts',
  'common/makeUrl.ts',
  'common/makeQueryString.ts',
  'common/WCL_TYPES.ts',
  'common/regions.ts',
  'common/format.ts',
  'parser/core/Module.ts',
  'parser/core/Analyzer.ts',
  'parser/core/EventSubscriber.ts',
  'parser/core/EventFilter.ts',
  'parser/core/Events.ts',
  'parser/core/EventsNormalizer.ts',
  'parser/core/ModuleError.ts',
  'parser/core/metric.ts',
  'parser/core/Fight.ts',
  'parser/core/Pet.ts',
  'parser/core/Player.ts',
  'parser/core/Report.ts',
  'parser/core/Unit.ts',
  'parser/core/Enemy.ts',
  'parser/core/Entity.ts',
  'parser/core/EventsItems.ts',
  'parser/core/PhaseConfig.ts',
  'parser/core/modules/EventEmitter.ts',
  'parser/core/modules/DebugAnnotations.ts',
];

if (!existsSync(COPIED_DIR)) {
  mkdirSync(COPIED_DIR, { recursive: true });
}

for (const file of filesToCopy) {
  const src = resolve(SPA_SRC, file);
  const dest = resolve(COPIED_DIR, file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`  [copy] ${file}`);
}

// Write redirect files into .copied/parser/core/ for relative imports inside copied files
// (e.g. Module.ts has `import CombatLogParser from './CombatLogParser'`)
// These re-export from the stub files (relative path from .copied/parser/core/ to src/stubs/parser/core/).
const stubRelFromCore = '../../../src/stubs/parser/core';
const redirects = [
  [
    'parser/core/Combatant.ts',
    `export { default, FullCombatant } from '${stubRelFromCore}/Combatant';\n`,
  ],
  [
    'parser/core/CombatLogParser.ts',
    `export { default } from '${stubRelFromCore}/CombatLogParser';\n`,
  ],
  [
    'parser/core/ISSUE_IMPORTANCE.ts',
    `export { default } from '${stubRelFromCore}/ISSUE_IMPORTANCE';\n`,
  ],
  [
    'parser/core/SPELL_CATEGORY.ts',
    `export { default } from '${stubRelFromCore}/SPELL_CATEGORY';\n`,
  ],
  [
    'parser/core/EventLinkNormalizer.ts',
    `export { default } from '${stubRelFromCore}/EventLinkNormalizer';\nexport type { EventLink } from '${stubRelFromCore}/EventLinkNormalizer';\n`,
  ],
  [
    'parser/core/modules/Ability.ts',
    `export { default } from '../${stubRelFromCore}/modules/Ability';\nexport type { SpellInfo, SpellbookAbility } from '../${stubRelFromCore}/modules/Ability';\n`,
  ],
];
for (const [path, content] of redirects) {
  const dest = resolve(COPIED_DIR, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  console.log(`  [redirect] ${path}`);
}

console.log('  [esbuild] bundling...');

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isDev = !isProd;
const mode = env.NODE_ENV || 'development';

const stubDir = resolve(__dirname, 'src', 'stubs');
const copiedDir = COPIED_DIR;

const aliases = {
  // common helpers — copied real files
  'common/fetchWclApi': resolve(copiedDir, 'common/fetchWclApi.ts'),
  'common/makeWclApiUrl': resolve(copiedDir, 'common/makeWclApiUrl.ts'),
  'common/makeApiUrl': resolve(copiedDir, 'common/makeApiUrl.ts'),
  'common/makeUrl': resolve(copiedDir, 'common/makeUrl.ts'),
  'common/makeQueryString': resolve(copiedDir, 'common/makeQueryString.ts'),
  'common/WCL_TYPES': resolve(copiedDir, 'common/WCL_TYPES.ts'),
  'common/regions': resolve(copiedDir, 'common/regions.ts'),
  'common/format': resolve(copiedDir, 'common/format.ts'),

  // common — stubs (mirrored paths)
  'common/errorLogger': resolve(stubDir, 'errorLogger.ts'),
  'common/SPELLS/Spell': resolve(stubDir, 'spell.ts'),
  'common/SPELLS': resolve(stubDir, 'common/SPELLS/index.ts'),
  'common/SPELLS/classic': resolve(stubDir, 'common/SPELLS/classic.ts'),
  'common/ITEMS/Item': resolve(stubDir, 'common/ITEMS/Item.ts'),
  'common/ITEMS': resolve(stubDir, 'common/ITEMS/index.ts'),
  'common/CN_MAPPING': resolve(stubDir, 'common/CN_MAPPING.ts'),
  'common/maybeGetTalentOrSpell': resolve(stubDir, 'common/maybeGetTalentOrSpell.ts'),
  'common/typeGuards': resolve(stubDir, 'common/typeGuards.ts'),
  'common/TALENTS/types': resolve(stubDir, 'common/TALENTS/types.ts'),
  'common/TALENTS/IGNORED': resolve(stubDir, 'common/TALENTS/IGNORED.ts'),
  'common/TALENTS/maybeGetTalent': resolve(stubDir, 'common/TALENTS/maybeGetTalent.ts'),

  // parser/core — copied real files
  'parser/core/Module': resolve(copiedDir, 'parser/core/Module.ts'),
  'parser/core/Analyzer': resolve(copiedDir, 'parser/core/Analyzer.ts'),
  'parser/core/EventSubscriber': resolve(copiedDir, 'parser/core/EventSubscriber.ts'),
  'parser/core/EventFilter': resolve(copiedDir, 'parser/core/EventFilter.ts'),
  'parser/core/Events': resolve(copiedDir, 'parser/core/Events.ts'),
  'parser/core/EventsNormalizer': resolve(copiedDir, 'parser/core/EventsNormalizer.ts'),
  'parser/core/ModuleError': resolve(copiedDir, 'parser/core/ModuleError.ts'),
  'parser/core/metric': resolve(copiedDir, 'parser/core/metric.ts'),
  'parser/core/Fight': resolve(copiedDir, 'parser/core/Fight.ts'),
  'parser/core/Pet': resolve(copiedDir, 'parser/core/Pet.ts'),
  'parser/core/Player': resolve(copiedDir, 'parser/core/Player.ts'),
  'parser/core/Report': resolve(copiedDir, 'parser/core/Report.ts'),
  'parser/core/Unit': resolve(copiedDir, 'parser/core/Unit.ts'),
  'parser/core/Enemy': resolve(copiedDir, 'parser/core/Enemy.ts'),
  'parser/core/Entity': resolve(copiedDir, 'parser/core/Entity.ts'),
  'parser/core/EventsItems': resolve(copiedDir, 'parser/core/EventsItems.ts'),
  'parser/core/PhaseConfig': resolve(copiedDir, 'parser/core/PhaseConfig.ts'),
  'parser/core/modules/EventEmitter': resolve(copiedDir, 'parser/core/modules/EventEmitter.ts'),
  'parser/core/modules/DebugAnnotations': resolve(
    copiedDir,
    'parser/core/modules/DebugAnnotations.ts',
  ),

  // parser/core — stubs (heavy/JSX/UI)
  'parser/core/CombatLogParser': resolve(stubDir, 'parser/core/CombatLogParser.ts'),
  'parser/core/Combatant': resolve(stubDir, 'parser/core/Combatant.ts'),
  'parser/core/EventLinkNormalizer': resolve(stubDir, 'parser/core/EventLinkNormalizer.ts'),
  'parser/core/ISSUE_IMPORTANCE': resolve(stubDir, 'parser/core/ISSUE_IMPORTANCE.ts'),
  'parser/core/SPELL_CATEGORY': resolve(stubDir, 'parser/core/SPELL_CATEGORY.ts'),
  'parser/core/modules/Ability': resolve(stubDir, 'parser/core/modules/Ability.ts'),
  'parser/core/modules/Abilities': resolve(stubDir, 'parser/core/modules/Abilities.ts'),
  'parser/core/modules/genAbilities': resolve(stubDir, 'parser/core/modules/genAbilities.ts'),

  // parser/shared — stubs
  'parser/shared/modules/Enemies': resolve(stubDir, 'parser/shared/modules/Enemies.ts'),
  'parser/shared/modules/AbilityTracker': resolve(
    stubDir,
    'parser/shared/modules/AbilityTracker.ts',
  ),
  'parser/shared/modules/StatTracker': resolve(stubDir, 'parser/shared/modules/StatTracker.ts'),
  'parser/shared/modules/Haste': resolve(stubDir, 'parser/shared/modules/Haste.ts'),
  'parser/shared/modules/SpellUsable': resolve(stubDir, 'parser/shared/modules/SpellUsable.ts'),
  'parser/shared/modules/features/STAT': resolve(stubDir, 'parser/shared/modules/features/STAT.ts'),

  // game/ — stubs
  'game/CLASSES': resolve(stubDir, 'game/CLASSES.ts'),
  'game/SPECS': resolve(stubDir, 'game/SPECS.ts'),
  'game/RACES': resolve(stubDir, 'game/RACES.ts'),
  'game/GEAR_SLOTS': resolve(stubDir, 'game/GEAR_SLOTS.ts'),
  'game/Faction': resolve(stubDir, 'game/Faction.ts'),
  'game/raids': resolve(stubDir, 'game/raids.ts'),
  'game/TIERS': resolve(stubDir, 'game/TIERS.ts'),
  'game/VERSIONS': resolve(stubDir, 'game/VERSIONS.ts'),
  'game/REALMS': resolve(stubDir, 'realms.ts'),
  'game/ROLES': resolve(stubDir, 'game/ROLES.ts'),
  'game/Expansion': resolve(stubDir, 'game/Expansion.ts'),
  'game/GameBranch': resolve(stubDir, 'game/GameBranch.ts'),

  // external — stubs
  '@sentry/react': resolve(stubDir, 'sentry.ts'),
  react: resolve(stubDir, 'react.ts'),
};

await esbuild.build({
  entryPoints: [resolve(__dirname, 'src', 'server.ts')],
  outfile: resolve(__dirname, 'dist', 'server.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  define: {
    'import.meta.env.VITE_WCL_API_BASE': 'process.env.WCL_API_BASE',
    'import.meta.env.VITE_WCL_DIRECT': '"false"',
    'import.meta.env.PROD': JSON.stringify(isProd),
    'import.meta.env.DEV': JSON.stringify(isDev),
    'import.meta.env.MODE': JSON.stringify(mode),
    'import.meta.env.VITE_SERVER_BASE': JSON.stringify('/'),
    'import.meta.env.VITE_API_BASE': JSON.stringify('i/'),
  },
  alias: aliases,
});

console.log('  [esbuild] done -> dist/server.js');

const { execSync } = await import('node:child_process');
try {
  const count = execSync(
    `grep -c 'process.env.WCL_API_BASE' "${resolve(__dirname, 'dist', 'server.js')}"`,
    { encoding: 'utf-8' },
  ).trim();
  console.log(`  [verify] import.meta.env → process.env: ${count} replacement(s) found`);
  if (parseInt(count, 10) < 1) {
    console.warn('  [verify] WARNING: No import.meta.env replacements found in output bundle!');
  }
} catch {
  console.warn('  [verify] WARNING: Could not verify import.meta.env transform (grep failed)');
}
