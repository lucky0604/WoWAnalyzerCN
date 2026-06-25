// @ts-expect-error - dev-only shim for SPA-borrowed import.meta.env reference
(globalThis as any).__importMetaEnvShim = true;
const ime: any = import.meta as any;
if (!ime.env) ime.env = { MODE: process.env.NODE_ENV ?? 'production' };

import { analyzeFight } from '../src/tools/analyze-fight.ts';
import * as fs from 'node:fs';

async function main() {
  const out = await analyzeFight({
    reportUrlOrCode: 'https://cn.warcraftlogs.com/reports/9hTqzGHt46W73jYB',
    fightId: 5,
    playerId: 2,
    format: 'both',
  });
  fs.writeFileSync('/tmp/mw3.json', JSON.stringify(out.json, null, 2));
  fs.writeFileSync('/tmp/mw3-text.out', out.text ?? '');
  console.log('wrote /tmp/mw3.json and /tmp/mw3-text.out');
  console.log('warnings:', out.warnings.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
