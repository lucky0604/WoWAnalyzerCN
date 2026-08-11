import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve(
  process.argv.find((value) => value.startsWith('--dist='))?.slice('--dist='.length) ?? 'dist',
);
// Provider guard identifiers may legitimately remain in the shared runtime
// chunk. The release invariant is that concrete Threechest/source URLs or
// injected source values must not be embedded in production output.
const forbiddenMarkers = ['threechest.io', 'DUNGEON_THREECHEST_SOURCE_URL'];

async function collectFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(child)));
    } else if (/\.(?:css|html|js|json|map|txt)$/.test(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

try {
  const files = await collectFiles(distRoot);
  const violations: string[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    forbiddenMarkers.forEach((marker) => {
      if (content.includes(marker)) {
        violations.push(`${file}: ${marker}`);
      }
    });
  }

  if (violations.length > 0) {
    console.error(`Dungeon dist guard failed with ${violations.length} violation(s).`);
    violations.forEach((violation) => console.error(`- ${violation}`));
    process.exitCode = 1;
  } else {
    console.log(`Dungeon dist guard passed: ${files.length} asset(s) scanned.`);
  }
} catch (error) {
  const missingDist = error instanceof Error && 'code' in error && error.code === 'ENOENT';
  if (missingDist) {
    console.error(`Dungeon dist guard failed: 未找到构建目录 ${distRoot}。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
