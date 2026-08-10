#!/usr/bin/env node
/**
 * Unified i18n fix script. Replaces 4 separate scripts:
 *   - convert-simple-trans-to-t.mjs
 *   - fix-define-message-imports.mjs
 *   - fix-t-expression-context.mjs
 *   - fix-trans-to-t-jsx.mjs
 *
 * Usage:
 *   node scripts/i18n-fix.mjs                 # Fix all i18n issues (imports, simple Trans→t, JSX cleanup)
 *   node scripts/i18n-fix.mjs --dry-run       # Preview fixes only
 *   node scripts/i18n-fix.mjs --check-trans   # Scan for problematic <Trans> with embedded components
 *   node scripts/i18n-fix.mjs --convert-trans # Auto-convert <Trans> with components to t() + JSX (AST-based)
 *
 * Recommended workflow after upstream merge:
 *   1. node scripts/i18n-fix.mjs --convert-trans   # Auto-convert ~95% of cases
 *   2. node scripts/i18n-fix.mjs --check-trans      # Flag remaining manual cases
 *   3. node scripts/i18n-fix.mjs                    # Fix imports & simple Trans→t
 *   4. pnpm typecheck                               # Verify compilation
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const CHECK_TRANS = process.argv.includes('--check-trans');
const CONVERT_TRANS = process.argv.includes('--convert-trans');
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

/**
 * Collect (id, message) pairs of <Trans> elements that appear at module scope
 * (i.e., NOT inside a function/component body or class/namespace).
 *
 * Pass 1 converts simple <Trans> → t() to reduce upstream-merge conflict surface,
 * but that conversion is only safe when the result lands inside a function body.
 * At module scope, t() calls i18n._() before i18n.activate() has run and crashes
 * with "Attempted to call a translation function without setting a locale".
 * Such <Trans> must stay as-is (see docs/i18n-guide.md, Rule 2). This mirrors the
 * guard already applied to CONFIG.tsx via scripts/upstream-i18n-core-files.txt.
 */
function getModuleScopeTransPairs(content, file) {
  const pairs = new Set();
  let sf;
  try {
    sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  } catch {
    return pairs;
  }
  const isScope = (n) =>
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isFunctionDeclaration(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessor(n) ||
    ts.isSetAccessor(n) ||
    ts.isClassDeclaration(n) ||
    ts.isModuleDeclaration(n) ||
    ts.isClassStaticBlockDeclaration(n);
  function walk(node, depth) {
    if (depth === 0 && ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'Trans') {
      const idAttr = getJsxAttribute(node.openingElement, 'id');
      const id = getStringValue(idAttr);
      if (id != null) {
        // Only guard the simple text-child Trans that Pass 1 would otherwise convert.
        const text = node.children
          .filter((c) => ts.isJsxText(c))
          .map((c) => c.getText(sf))
          .join('');
        if (!/[<{\n]/.test(text)) {
          pairs.add(`${id}|${text.trim()}`);
        }
      }
    }
    const cd = isScope(node) ? depth + 1 : depth;
    ts.forEachChild(node, (c) => walk(c, cd));
  }
  walk(sf, 0);
  return pairs;
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

// --- AST helper functions for --convert-trans mode ---
// Tags whose text children should be wrapped in t() calls
const WRAPPABLE_TAGS = new Set([
  'strong', 'b', 'a', 'em', 'i', 'u', 'code', 'kbd', 'span', 'small', 'mark', 'sub', 'sup',
]);

/** Collapse whitespace to single spaces, trim leading, optionally trim trailing */
function normalizeText(text, isLast) {
  let result = text.replace(/\s+/g, ' ');
  result = result.replace(/^\s+/, '');
  if (isLast) result = result.replace(/\s+$/, '');
  return result;
}

/** Escape text for single-quoted string inside t() macro */
function escapeForTMacro(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Get a JSX attribute by name from an opening element's attributes */
function getJsxAttribute(openingElement, name) {
  const attrs = openingElement.attributes.properties;
  for (const attr of attrs) {
    if (attr.name && attr.name.text === name) return attr;
  }
  return null;
}

/** Get the string value of a JSX attribute (handles id="x" and id={"x"}) */
function getStringValue(attr) {
  if (!attr || !attr.initializer) return null;
  if (attr.initializer.text !== undefined) return attr.initializer.text;
  if (attr.initializer.expression && attr.initializer.expression.text !== undefined) {
    return attr.initializer.expression.text;
  }
  return null;
}

// --- Convert mode: AST-based <Trans> with components → t() + explicit JSX ---
if (CONVERT_TRANS) {
  const convertStats = { files: 0, blocks: 0, skipped: 0 };

  for (const file of walk('src')) {
    if (!file.endsWith('.tsx')) continue;

    const originalContent = fs.readFileSync(file, 'utf8');

    // Quick pre-check: skip files without any <Trans> that has mixed children
    if (!/<Trans[\s>]/.test(originalContent)) continue;

    let sourceFile;
    try {
      sourceFile = ts.createSourceFile(
        file,
        originalContent,
        ts.ScriptTarget.Latest,
        true, // setParentNodes
        ts.ScriptKind.TSX,
      );
    } catch (e) {
      console.warn(`  [skip] ${path.relative(ROOT, file)}: parse error - ${e.message}`);
      continue;
    }

    /** @type {{pos: number, end: number, replacement: string}[]} */
    const replacements = [];

    function visit(node) {
      if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName;
        if (ts.isIdentifier(tagName) && tagName.text === 'Trans') {
          const children = node.children;

          // Only convert Trans blocks that have component children (mixed content)
          const hasComponents = children.some(
            (c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c),
          );
          if (!hasComponents) return; // Pure text — handled by existing passes

          // Extract id attribute
          const idAttr = getJsxAttribute(node.openingElement, 'id');
          if (!idAttr) {
            convertStats.skipped++;
            return;
          }
          const baseId = getStringValue(idAttr);
          if (!baseId) {
            convertStats.skipped++;
            return;
          }

          // Find the actual position of '<Trans' tag (node.pos may point to leading \n)
          const transTagStart = originalContent.indexOf('<Trans', node.pos);
          const lineStart = originalContent.lastIndexOf('\n', transTagStart) + 1;
          const indent = originalContent.substring(lineStart, transTagStart); // whitespace only

          // Process children: split text around components
          const parts = [];
          let textIdx = 1;
          const elemCounters = {};

          for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (ts.isJsxText(child)) {
              // Determine if this is the last text node in the block
              let hasTextAfter = false;
              for (let j = i + 1; j < children.length; j++) {
                if (ts.isJsxText(children[j]) && children[j].text.trim()) {
                  hasTextAfter = true;
                  break;
                }
              }

              const text = normalizeText(child.text, !hasTextAfter);
              if (text) {
                const id = `${baseId}.p${textIdx++}`;
                const escaped = escapeForTMacro(text);
                parts.push({ source: `{t({ id: '${id}', message: '${escaped}' })}` });
              }
            } else if (ts.isJsxSelfClosingElement(child)) {
              // Self-closing: <SpellLink ... />, <br /> — preserve as-is
              const source = originalContent.substring(child.pos, child.end);
              parts.push({ source });
            } else if (ts.isJsxElement(child)) {
              // Element with children: <strong>, <b>, <a>, etc.
              const childTag = child.openingElement.tagName.text;
              const hasTextChildren = child.children.some(
                (c) => ts.isJsxText(c) && c.text.trim(),
              );

              if (hasTextChildren && WRAPPABLE_TAGS.has(childTag)) {
                // Wrap inner text in t() call
                elemCounters[childTag] = (elemCounters[childTag] || 0) + 1;
                const count = elemCounters[childTag];
                const suffix = count > 1 ? String(count) : '';
                const innerId = `${baseId}.${childTag}${suffix}`;

                const innerText = child.children
                  .filter((c) => ts.isJsxText(c))
                  .map((c) => c.text)
                  .join('');
                const normalized = normalizeText(innerText, true);
                const escaped = escapeForTMacro(normalized);
                const tCall = `{t({ id: '${innerId}', message: '${escaped}' })}`;

                // Extract tag parts from original source
                const openTag = originalContent.substring(
                  child.pos,
                  child.openingElement.end,
                );
                const closeTag = originalContent.substring(
                  child.closingElement.pos,
                  child.end,
                );

                if (openTag.includes('\n')) {
                  // Multiline element (e.g. <a with many attributes>) — preserve structure
                  parts.push({
                    source: `${openTag}\n${indent}  ${tCall}\n${indent}${closeTag}`,
                  });
                } else {
                  // Inline element (<strong>, <b>) — single line
                  parts.push({ source: `${openTag}${tCall}${closeTag}` });
                }
              } else {
                // Element without text children or unwrappable type — preserve as-is
                const source = originalContent.substring(child.pos, child.end);
                parts.push({ source });
              }
            } else if (ts.isJsxExpression(child)) {
              // {' '} or other expressions — preserve as-is
              const source = originalContent.substring(child.pos, child.end);
              parts.push({ source });
            }
          }

          if (parts.length === 0) return;

          // Build replacement string
          const lines = [];
          if (parts.length === 1) {
            lines.push(`${indent}${parts[0].source}`);
          } else {
            lines.push(`${indent}<>${parts[0].source}`);
            for (let pi = 1; pi < parts.length; pi++) {
              lines.push(`${indent}  ${parts[pi].source}`);
            }
            lines.push(`${indent}</>`);
          }

          replacements.push({
            pos: lineStart, // Replace from start of the indented line (after \n)
            end: node.end,
            replacement: lines.join('\n'),
          });
          convertStats.blocks++;
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (replacements.length > 0) {
      // Apply replacements in reverse to preserve source positions
      let result = originalContent;
      for (let ri = replacements.length - 1; ri >= 0; ri--) {
        const { pos, end, replacement } = replacements[ri];
        result = result.substring(0, pos) + replacement + result.substring(end);
      }

      // Ensure t import exists since we added t() calls
      if (/\bt\(\{/.test(result)) {
        result = ensureTImport(result);
      }

      convertStats.files++;
      if (!DRY_RUN) {
        fs.writeFileSync(file, result);
      } else {
        const rel = path.relative(ROOT, file);
        console.log(`[dry-run] ${rel}: ${replacements.length} block(s)`);
      }
    }
  }

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}Converted ${convertStats.blocks} Trans block(s) in ${convertStats.files} file(s)`,
  );
  if (convertStats.skipped > 0) {
    console.log(
      `Skipped ${convertStats.skipped} Trans block(s) (missing id or complex pattern — re-run --check-trans to review)`,
    );
  }
  process.exit(0);
}

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
    // Skip module-scope <Trans>: converting them to t() would crash at module load
    // (i18n not yet activated). See getModuleScopeTransPairs().
    const moduleScopeTransPairs = getModuleScopeTransPairs(content, file);
    content = content.replace(
      /<Trans\s+id="([^"]+)"\s*>([^<{\n]+)<\/Trans>/g,
      (full, id, message, offset) => {
        if (moduleScopeTransPairs.has(`${id}|${message.trim()}`)) {
          return full; // keep as <Trans> — t() is unsafe at module scope
        }
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
