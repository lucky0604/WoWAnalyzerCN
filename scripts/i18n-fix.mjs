#!/usr/bin/env node
/**
 * Unified i18n fix script. Replaces 4 separate scripts:
 *   - convert-simple-trans-to-t.mjs
 *   - fix-define-message-imports.mjs
 *   - fix-t-expression-context.mjs
 *   - fix-trans-to-t-jsx.mjs
 *
 * Usage:
 *   node scripts/i18n-fix.mjs              # Fix all i18n issues
 *   node scripts/i18n-fix.mjs --dry-run    # Preview fixes only
 *   node scripts/i18n-fix.mjs --check-trans # Scan for problematic <Trans> with <SpellLink>/<br>/<strong>/<b>
 */
import fs from 'node:fs';
import path from 'node:path';

const CHECK_TRANS = process.argv.includes('--check-trans');
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

const stats = { transToT: 0, defineMessageToT: 0, importFixed: 0, jsxFixed: 0, files: 0 };

// --- Check mode: scan for problematic <Trans> blocks, no modifications ---
if (CHECK_TRANS) {
  let problemFiles = [];
  const SUSPICIOUS_INSIDE = /<Trans[\s>][\s\S]*?(?:<SpellLink|<br[\s/>]|<strong[\s>]|<b[\s>])/;

  for (const file of walk('src')) {
    if (!file.endsWith('.tsx')) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (!SUSPICIOUS_INSIDE.test(content)) continue;

    // Find each problematic Trans block line
    const lines = content.split('\n');
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      if (/<Trans[\s>]/.test(lines[i])) {
        // Check following lines for suspicious elements inside the Trans block
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const line = lines[j];
          const closeTrans = line.includes('</Trans>');
          const hasSpellLink = /<SpellLink/.test(line);
          const hasBr = /<br[\s/>]/.test(line);
          const hasStrong = /<strong[\s>]/.test(line);
          const hasB = /<b[\s>]/.test(line);
          const elements = [];
          if (hasSpellLink) elements.push('<SpellLink>');
          if (hasBr) elements.push('<br>');
          if (hasStrong) elements.push('<strong>');
          if (hasB) elements.push('<b>');
          if (elements.length > 0) {
            matches.push({ line: j + 1, elements, content: line.trim() });
          }
          if (closeTrans) break;
        }
      }
    }

    if (matches.length > 0) {
      problemFiles.push({ file, matches });
    }
  }

  // Output results
  for (const { file, matches } of problemFiles) {
    const rel = path.relative(ROOT, file);
    console.log(`[WARN] ${rel}`);
    for (const m of matches) {
      console.log(`  Line ${m.line}: <Trans> contains ${m.elements.join(' & ')} — must be converted to t() + explicit JSX`);
    }
    console.log('');
  }

  const totalFiles = problemFiles.length;
  const totalBlocks = problemFiles.reduce((s, f) => s + f.matches.length, 0);
  if (totalFiles === 0) {
    console.log('No problematic <Trans> blocks found. All clear.');
  } else {
    console.log(`Found ${totalFiles} file(s) with ${totalBlocks} problematic <Trans> block(s).`);
    console.log('These must be manually converted to t() + explicit JSX (see docs/i18n-guide.md).');
  }
  process.exit(0);
}

for (const file of walk('src')) {
  const isOverride = file.includes(OVERRIDES_PREFIX);

  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  const rel = path.relative(ROOT, file);
  const isCore = isCoreFile(file);

  // --- Pass 1: Simple <Trans id="x">plain text</Trans> → t() (non-core files only) ---
  if (!isOverride && !isCore && file.endsWith('.tsx')) {
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

  // --- Pass 2: defineMessage() import fix only ---
  // NOTE: We no longer convert defineMessage() → t() because the lint rule
  // (lingui-t-macro-outside-jsx) enforces the opposite convention: t() is
  // only valid inside JSX. Outside JSX, defineMessage() is required.
  // Converting defineMessage → t() would be reverted by lint:fix on next
  // commit, creating a loop. Instead, just ensure the import exists.
  // (Pass 3 below handles that.)

  // --- Pass 3: Fix missing defineMessage import (any file that still uses it) ---
  if (content.includes('defineMessage(') && !/import\s*\{[^}]*defineMessage/.test(content)) {
    content = ensureDefineMessageImport(content);
    stats.importFixed++;
  }

  // --- Pass 4: Ensure t import if t() or t`...` is used ---
  const usesTMacro = /\bt\(\{/.test(content) || /\bt`/.test(content);
  if (usesTMacro && !/import\s*\{[^}]*\bt\b/.test(content)) {
    content = ensureTImport(content);
    stats.importFixed++;
  }

  // --- Pass 4b: Remove standalone unused t import ---
  if (/^import \{ t \} from '@lingui\/core\/macro';?\n/m.test(content) && !usesTMacro) {
    content = content.replace(/^import \{ t \} from '@lingui\/core\/macro';?\n/m, '');
    stats.importFixed++;
  }

  // --- Pass 5: Fix JSX syntax issues from conversion ---
  if (!isOverride) {
    // 5a: Object property value  label: {t({  →  label: t({
    content = content.replace(/(:\s*)\{t\(\{/g, '$1t({');
    // 5b: Object property trailing  }) },  →  }),
    content = content.replace(/message: '([^']*)' \}\)\},/g, "message: '$1' }),");
    // 5c: JSX prop value  ={ {t({  →  ={t({
    content = content.replace(/(=\{\s*)\n\s*\{t\(\{/g, '$1t({');
    // 5d: return {t({...})}  →  return t({...})
    content = content.replace(/return \{(t\(\{[^}]+\}\))\}/g, 'return $1');
  }

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
