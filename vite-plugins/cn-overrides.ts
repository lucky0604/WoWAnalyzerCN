import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const OVERRIDES_ROOT = path.resolve(SRC_ROOT, 'localization/overrides');
const OVERRIDES_SEGMENT = `${path.sep}localization${path.sep}overrides${path.sep}`;
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/** Override files live under localization/overrides/; resolve siblings from original src paths. */
function getImporterDir(importer: string): string {
  if (importer.includes(OVERRIDES_SEGMENT)) {
    const mapped = importer.replace(OVERRIDES_SEGMENT, path.sep);
    return path.dirname(mapped);
  }
  return path.dirname(importer);
}

function resolveSourceFile(importerDir: string, source: string): string | null {
  if (!source.startsWith('.')) {
    return null;
  }

  const base = path.resolve(importerDir, source);
  if (path.extname(base)) {
    return fs.existsSync(base) ? base : null;
  }

  for (const ext of EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const ext of EXTENSIONS) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function toOverridePath(sourceFile: string): string | null {
  if (!sourceFile.startsWith(SRC_ROOT)) {
    return null;
  }

  const relative = path.relative(SRC_ROOT, sourceFile);
  const overridePath = path.join(OVERRIDES_ROOT, relative);
  return fs.existsSync(overridePath) ? overridePath : null;
}

/**
 * Redirects imports to CN-localized copies under src/localization/overrides/
 * when an override file exists. Upstream source files stay unmodified for merges.
 */
export function cnOverridesPlugin(): Plugin {
  return {
    name: 'cn-overrides',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || source.includes('\0')) {
        return null;
      }

      const importerDir = getImporterDir(importer);
      const sourceFile = resolveSourceFile(importerDir, source);
      if (!sourceFile) {
        return null;
      }

      return toOverridePath(sourceFile);
    },
  };
}
