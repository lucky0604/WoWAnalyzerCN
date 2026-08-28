#!/usr/bin/env node
/**
 * 重新应用副本学习模块的英文翻译金本。
 *
 * `pnpm extract`（lingui extract --overwrite --clean）会以 sourceLocale=en
 * 重新生成目录，但本仓库源字符串是中文（message = 中文原文），所以 extract 会把
 * 中文源文本写进 en 目录，覆盖全部人工审定的英文翻译。每次 extract 之后都必须
 * 用本脚本把金本（dungeon-i18n-en-catalog.json）重新写回 en 目录。
 *
 * 本脚本 / 金本与 src/localization 里各语言 messages.json 是英文翻译的权威来源；
 * zh 目录不需要金本——extract 会用源 message 正确再生 zh。
 *
 * 用法：
 *   node scripts/dungeons/reapply-dungeon-i18n-en.mjs            # 应用金本
 *   node scripts/dungeons/reapply-dungeon-i18n-en.mjs --check    # 只报漂移不写
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const catalogPath = join(repoRoot, 'src', 'localization', 'en', 'messages.json');
const golden = JSON.parse(
  readFileSync(join(here, 'dungeon-i18n-en-catalog.json'), 'utf8'),
);
const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));

const missing = Object.keys(golden).filter((id) => !(id in cat));
const drift = Object.keys(golden).filter((id) => id in cat && cat[id] !== golden[id]);

console.log(
  `golden=${Object.keys(golden).length} catalog=${Object.keys(cat).length} missing=${missing.length} drift=${drift.length}`,
);
for (const id of missing) console.log('  MISSING:', id);
for (const id of drift) console.log(`  DRIFT:   ${id}  (${JSON.stringify(cat[id])} != ${JSON.stringify(golden[id])})`);

if (process.argv.includes('--check')) {
  if (missing.length || drift.length) {
    console.error('en catalog is not in sync with the golden map');
    process.exit(1);
  }
  console.log('en catalog in sync');
  process.exit(0);
}

for (const [id, value] of Object.entries(golden)) cat[id] = value;
const sorted = {};
for (const k of Object.keys(cat).sort()) sorted[k] = cat[k];
writeFileSync(catalogPath, JSON.stringify(sorted, null, 2) + '\n');
console.log(`re-applied ${Object.keys(golden).length} dungeon en strings`);