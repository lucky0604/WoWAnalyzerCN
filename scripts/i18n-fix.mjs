#!/usr/bin/env node
/**
 * Unified i18n fix script. Replaces 5 separate scripts:
 *   - convert-simple-trans-to-t.mjs
 *   - cn-defineMessage-to-t.mjs
 *   - fix-define-message-imports.mjs
 *   - fix-t-expression-context.mjs
 *   - fix-trans-to-t-jsx.mjs
 *
 * Usage: node scripts/i18n-fix.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const OVERRIDES_PREFIX = `${path.sep}localization${path.sep}overrides${path.sep}`;

const coreFiles = new Set(
  fs.existsSync('scripts/upstream-i18n-core-files.txt')
    ? fs
        .readFileSync('scripts/upstream-i18n-core-files.txt', 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.[jt]sx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function isCoreFile(file) {
  const rel = file.replace(/\\/g, '/');
  return coreFiles.has(rel) || rel.includes('localization/overrides/');
}

function ensureTImport(content) {
  if (/import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*'@lingui\/core\/macro'/.test(content)) {
    return content;
  }
  if (content.includes("from '@lingui/core/macro'")) {
    return content.replace(/import\s*\{([^}]+)\}\s*from\s*'@lingui\/core\/macro'/, (_, imports) => {
      const parts = imports
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes('t')) parts.unshift('t');
      return `import { ${parts.join(', ')} } from '@lingui/core/macro'`;
    });
  }
  const transImport = content.match(/import\s*\{[^}]*\}\s*from\s*'@lingui\/react\/macro'/);
  if (transImport) {
    return content.replace(
      transImport[0],
      `${transImport[0]}\nimport { t } from '@lingui/core/macro'`,
    );
  }
  return `import { t } from '@lingui/core/macro';\n${content}`;
}

function ensureDefineMessageImport(content) {
  if (/import\s*\{[^}]*defineMessage/.test(content)) return content;
  if (content.includes("from '@lingui/core/macro'")) {
    return content.replace(/import\s*\{([^}]+)\}\s*from\s*'@lingui\/core\/macro'/, (_, imports) => {
      const parts = imports
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes('defineMessage')) parts.unshift('defineMessage');
      return `import { ${parts.join(', ')} } from '@lingui/core/macro'`;
    });
  }
  return `import { defineMessage } from '@lingui/core/macro';\n${content}`;
}

function removeDefineMessageFromImport(content) {
  return content.replace(/import\s*\{([^}]+)\}\s*from\s*'@lingui\/core\/macro'/, (_, imports) => {
    let parts = imports
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    parts = parts.filter((p) => p !== 'defineMessage');
    if (!parts.includes('t')) parts.unshift('t');
    return `import { ${parts.join(', ')} } from '@lingui/core/macro'`;
  });
}

const stats = { transToT: 0, defineMessageToT: 0, importFixed: 0, jsxFixed: 0, files: 0 };

for (const file of walk('src')) {
  if (file.includes(OVERRIDES_PREFIX)) continue;

  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  const rel = path.relative(ROOT, file);
  const isCore = isCoreFile(file);

  // --- Pass 1: Simple <Trans id="x">plain text</Trans> → t() (non-core files only) ---
  if (!isCore && file.endsWith('.tsx')) {
    content = content.replace(
      /<Trans\s+id="([^"]+)"\s*>([^<{\n]+)<\/Trans>/g,
      (full, id, message, offset) => {
        stats.transToT++;
        const before = content.slice(Math.max(0, offset - 10), offset);
        const inExpression = /[=,(]\s*$/.test(before) || /return\s+$/.test(before);
        const inJsxAttr = /=\{\s*$/.test(before);
        const escaped = message.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const replacement = `t({ id: '${id}', message: '${escaped}' })`;
        return inExpression || inJsxAttr ? replacement : `{${replacement}}`;
      },
    );
  }

  // --- Pass 2: defineMessage() → t() in CN files (only inside functions/classes) ---
  // t() executes immediately, so it must NOT be called at module top level
  // (before i18n.activate). defineMessage() is safe at top level because it only
  // creates a descriptor. We track brace depth to skip top-level occurrences.
  if (!isCore && content.includes('defineMessage(')) {
    const lines = content.split('\n');
    let depth = 0;
    let inImport = false;
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*import\s/.test(line)) {
        inImport = !line.includes(' from ');
        continue;
      }
      if (inImport) {
        if (/\bfrom\s+['"]/.test(line)) inImport = false;
        continue;
      }
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth > 0 && line.includes('defineMessage(')) {
        lines[i] = line.replaceAll('defineMessage(', 't(');
        changed = true;
      }
    }
    if (changed) {
      stats.defineMessageToT++;
      content = removeDefineMessageFromImport(lines.join('\n'));
    }
  }

  // --- Pass 3: Fix missing defineMessage import (core files only) ---
  if (
    isCore &&
    content.includes('defineMessage(') &&
    !/import\s*\{[^}]*defineMessage/.test(content)
  ) {
    content = ensureDefineMessageImport(content);
    stats.importFixed++;
  }

  // --- Pass 4: Ensure t import if t() is used ---
  if (content.includes('t({') && !/import\s*\{[^}]*\bt\b/.test(content)) {
    content = ensureTImport(content);
    stats.importFixed++;
  }

  // --- Pass 5: Fix JSX syntax issues from conversion ---
  // 5a: Object property value  label: {t({  →  label: t({
  content = content.replace(/(:\s*)\{t\(\{/g, '$1t({');
  // 5b: Object property trailing  }) },  →  }),
  content = content.replace(/message: '([^']*)' \}\)\},/g, "message: '$1' }),");
  // 5c: JSX prop value  ={ {t({  →  ={t({
  content = content.replace(/(=\{\s*)\n\s*\{t\(\{/g, '$1t({');
  // 5d: return {t({...})}  →  return t({...})
  content = content.replace(/return \{(t\(\{[^}]+\}\))\}/g, 'return $1');

  if (content !== original) {
    stats.files++;
    if (!DRY_RUN) fs.writeFileSync(file, content);
    else console.log(`[dry-run] ${rel}`);
  }
}

console.log(
  `${DRY_RUN ? '[DRY RUN] ' : ''}Fixed ${stats.files} files: ` +
    `${stats.transToT} Trans→t, ${stats.defineMessageToT} defineMessage→t, ` +
    `${stats.importFixed} imports, JSX fixes applied`,
);
