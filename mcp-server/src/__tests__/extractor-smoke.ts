// Smoke test: synthetic event stream → extractor → formatter.
// Run with:  cd mcp-server && pnpm tsx src/__tests__/extractor-smoke.ts
//
// Verifies the M2.3c + M2.4 pipeline produces sensible output without needing
// a real WCL report. NOT a unit test — just a sanity check the user can eyeball.

import type { AnyEvent, CastEvent, HealEvent, ApplyBuffEvent } from 'parser/core/Events';
import { EventType } from 'parser/core/Events';
import { extractMistweaverReport, MW_SPELLS } from '../engine/extractors/mistweaver.js';
import { formatMistweaverReport } from '../engine/format-report.js';

const PLAYER_ID = 42;
const fightStart = 0;
const fightEnd = 300_000; // 5 minutes

let timestamp = 0;
const tick = (n = 1500) => (timestamp += n);

const mkCast = (spellId: number, name: string, manaCost = 0): CastEvent => ({
  type: EventType.Cast,
  timestamp: tick(),
  sourceID: PLAYER_ID,
  sourceIsFriendly: true,
  targetID: 100,
  targetIsFriendly: true,
  ability: { guid: spellId, name, type: 0, abilityIcon: '' },
  resourceCost: manaCost > 0 ? { 0: manaCost } : undefined,
});

const mkHeal = (
  spellId: number,
  name: string,
  amount: number,
  overheal = 0,
  targetID = 100,
  tickFlag = false,
  crit = false,
): HealEvent =>
  ({
    type: EventType.Heal,
    timestamp: tick(50),
    sourceID: PLAYER_ID,
    sourceIsFriendly: true,
    targetID,
    targetIsFriendly: true,
    ability: { guid: spellId, name, type: 0, abilityIcon: '' },
    amount,
    overheal,
    tick: tickFlag,
    hitType: crit ? 2 : 1,
    hitPoints: 1_000_000,
    maxHitPoints: 1_500_000,
    attackPower: 0,
    spellPower: 1000,
    armor: 0,
    absorb: 0,
    x: 0,
    y: 0,
    facing: 0,
    mapID: 0,
    itemLevel: 600,
    resourceActor: 1,
    classResources: [],
  }) as unknown as HealEvent;

const mkApplyBuff = (spellId: number, name: string, targetID = 100): ApplyBuffEvent => ({
  type: EventType.ApplyBuff,
  timestamp: tick(10),
  sourceID: PLAYER_ID,
  sourceIsFriendly: true,
  targetID,
  targetIsFriendly: true,
  ability: { guid: spellId, name, type: 0, abilityIcon: '' },
});

const events: AnyEvent[] = [];

// Simulate 10 REM applications across 10 unique targets, each ticking 4 times
for (let t = 0; t < 10; t++) {
  events.push(mkCast(MW_SPELLS.RENEWING_MIST_CAST, 'Renewing Mist', 4500));
  events.push(mkApplyBuff(MW_SPELLS.RENEWING_MIST_HEAL, 'Renewing Mist', 100 + t));
  for (let k = 0; k < 4; k++) {
    const over = k === 3 ? 2000 : 0;
    events.push(
      mkHeal(MW_SPELLS.RENEWING_MIST_HEAL, 'Renewing Mist', 15000, over, 100 + t, true, k === 1),
    );
  }
}

// 8 Vivify casts each cleaving to 3 targets (1 direct + 2 cleave via REM)
for (let v = 0; v < 8; v++) {
  events.push(mkCast(MW_SPELLS.VIVIFY, 'Vivify', 6000));
  events.push(mkHeal(MW_SPELLS.VIVIFY, 'Vivify', 25000, 0, 100, false, false));
  events.push(mkHeal(MW_SPELLS.VIVIFY, 'Vivify', 12000, 1000, 101, false, false));
  events.push(mkHeal(MW_SPELLS.VIVIFY, 'Vivify', 12000, 2000, 102, false, true));
}

// 5 Enveloping Mist
for (let e = 0; e < 5; e++) {
  events.push(mkCast(MW_SPELLS.ENVELOPING_MIST, 'Enveloping Mist', 7500));
  events.push(mkApplyBuff(MW_SPELLS.ENVELOPING_MIST, 'Enveloping Mist', 100 + e));
  for (let k = 0; k < 6; k++) {
    events.push(mkHeal(MW_SPELLS.ENVELOPING_MIST, 'Enveloping Mist', 18000, 500, 100 + e, true));
  }
}

// 2 Revival
for (let r = 0; r < 2; r++) {
  events.push(mkCast(MW_SPELLS.REVIVAL, 'Revival', 8000));
  for (let tgt = 100; tgt < 120; tgt++) {
    events.push(mkHeal(MW_SPELLS.REVIVAL, 'Revival', 35000, 5000, tgt));
  }
}

// 3 Rising Sun Kick + 12 Soothing Mist ticks + 1 Thunder Focus Tea + 1 Life Cocoon
for (let i = 0; i < 3; i++) events.push(mkCast(MW_SPELLS.RISING_SUN_KICK, 'Rising Sun Kick'));
events.push(mkCast(MW_SPELLS.SOOTHING_MIST, 'Soothing Mist'));
for (let i = 0; i < 12; i++) {
  events.push(mkHeal(MW_SPELLS.SOOTHING_MIST, 'Soothing Mist', 8000, 200, 100, true));
}
events.push(mkCast(MW_SPELLS.THUNDER_FOCUS_TEA, 'Thunder Focus Tea'));
events.push(mkCast(MW_SPELLS.LIFE_COCOON, 'Life Cocoon'));

console.log(`[smoke] generated ${events.length} synthetic events over ${timestamp}ms`);

const report = extractMistweaverReport({
  events,
  playerId: PLAYER_ID,
  playerName: '云海雾僧',
  fightStart,
  fightEnd,
  warnings: [],
});

console.log('\n=== JSON 总览 ===');
console.log(JSON.stringify(report.totals, null, 2));
console.log('\n=== 织雾专项指标 ===');
console.log(JSON.stringify(report.specifics, null, 2));

const text = formatMistweaverReport(report, {
  reportCode: 'SMOKE_TEST_REPORT',
  fightName: 'Synthetic Encounter',
  fightKill: true,
  fightDifficulty: 4,
});

console.log('\n=== 中文报告 ===');
console.log(text);

// Sanity assertions
const errors: string[] = [];
const assert = (cond: boolean, msg: string) => {
  if (!cond) errors.push(msg);
};
assert(report.totals.casts > 0, 'totals.casts should be > 0');
assert(report.totals.healing > 0, 'totals.healing should be > 0');
assert(
  report.specifics.renewingMist.casts === 10,
  `REM casts: expected 10, got ${report.specifics.renewingMist.casts}`,
);
assert(
  report.specifics.renewingMist.hotApplies === 10,
  `REM applies: expected 10, got ${report.specifics.renewingMist.hotApplies}`,
);
assert(
  report.specifics.renewingMist.hotTicks === 40,
  `REM ticks: expected 40, got ${report.specifics.renewingMist.hotTicks}`,
);
assert(
  report.specifics.vivify.casts === 8,
  `Vivify casts: expected 8, got ${report.specifics.vivify.casts}`,
);
assert(
  report.specifics.envelopingMist.casts === 5,
  `EvM casts: expected 5, got ${report.specifics.envelopingMist.casts}`,
);
assert(
  report.specifics.revivalRestoral.casts === 2,
  `Revival casts: expected 2, got ${report.specifics.revivalRestoral.casts}`,
);
assert(
  report.specifics.revivalRestoral.uniqueTargetsHealed === 20,
  `Revival unique targets: expected 20, got ${report.specifics.revivalRestoral.uniqueTargetsHealed}`,
);
assert(
  report.specifics.risingSunKick.casts === 3,
  `RSK casts: expected 3, got ${report.specifics.risingSunKick.casts}`,
);
assert(
  report.totals.manaSpent === 10 * 4500 + 8 * 6000 + 5 * 7500 + 2 * 8000,
  `total mana wrong: got ${report.totals.manaSpent}`,
);

if (errors.length === 0) {
  console.log('\n[smoke] ✅ all assertions passed');
  process.exit(0);
} else {
  console.error('\n[smoke] ❌ assertion failures:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
