// Smoke test: synthetic event stream → Preservation Evoker extractor → formatter.
// Run with:  cd mcp-server && pnpm tsx src/__tests__/preservation-smoke.ts

import type {
  AnyEvent,
  CastEvent,
  HealEvent,
  ApplyBuffEvent,
  EmpowerEndEvent,
  DamageEvent,
} from 'parser/core/Events';
import { EventType } from 'parser/core/Events';
import { extractPreservationReport, PRES_SPELLS } from '../engine/extractors/preservation.js';
import { formatPreservationReport } from '../engine/format-report.js';

const PLAYER_ID = 42;
const fightStart = 0;
const fightEnd = 300_000; // 5 minutes

let timestamp = 0;
const tick = (n = 1500) => (timestamp += n);

const mkCast = (spellId: number, name: string): CastEvent => ({
  type: EventType.Cast,
  timestamp: tick(),
  sourceID: PLAYER_ID,
  sourceIsFriendly: true,
  targetID: 100,
  targetIsFriendly: true,
  ability: { guid: spellId, name, type: 0, abilityIcon: '' },
});

const mkEmpowerEnd = (spellId: number, name: string, level: number): EmpowerEndEvent => ({
  type: EventType.EmpowerEnd,
  timestamp: tick(2000),
  sourceID: PLAYER_ID,
  sourceIsFriendly: true,
  targetID: 100,
  targetIsFriendly: true,
  ability: { guid: spellId, name, type: 0, abilityIcon: '' },
  empowermentLevel: level,
});

const mkHeal = (
  spellId: number,
  name: string,
  amount: number,
  overheal = 0,
  targetID = 100,
  tickFlag = false,
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
    hitType: 1,
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

const mkDamage = (spellId: number, name: string, amount: number): DamageEvent =>
  ({
    type: EventType.Damage,
    timestamp: tick(50),
    sourceID: PLAYER_ID,
    sourceIsFriendly: true,
    targetID: 200,
    targetIsFriendly: false,
    ability: { guid: spellId, name, type: 0, abilityIcon: '' },
    amount,
    hitType: 1,
    spellPower: 1000,
  }) as unknown as DamageEvent;

const mkApplyBuff = (spellId: number, name: string): ApplyBuffEvent => ({
  type: EventType.ApplyBuff,
  timestamp: tick(10),
  sourceID: PLAYER_ID,
  sourceIsFriendly: true,
  targetID: 100,
  targetIsFriendly: true,
  ability: { guid: spellId, name, type: 0, abilityIcon: '' },
});

const events: AnyEvent[] = [];

// 5 Echo casts (each applies a buff + 2 reversion echo replays)
for (let i = 0; i < 5; i++) {
  events.push(mkCast(PRES_SPELLS.ECHO_CAST, 'Echo'));
  events.push(mkApplyBuff(PRES_SPELLS.ECHO_BUFF, 'Echo'));
}

// 10 Reversion casts
for (let i = 0; i < 10; i++) {
  events.push(mkCast(PRES_SPELLS.REVERSION_CAST, 'Reversion'));
  events.push(mkApplyBuff(PRES_SPELLS.REVERSION_CAST, 'Reversion'));
  // 5 ticks each
  for (let t = 0; t < 5; t++) {
    events.push(mkHeal(PRES_SPELLS.REVERSION_CAST, 'Reversion', 8000, 1000, 100 + i, true));
  }
  // 2 echo replay ticks
  for (let t = 0; t < 2; t++) {
    events.push(mkHeal(PRES_SPELLS.REVERSION_ECHO, 'Reversion (Echo)', 8000, 500, 100 + i, true));
  }
}

// 3 Dream Breath empowers (levels 1, 2, 3)
events.push(mkEmpowerEnd(PRES_SPELLS.DREAM_BREATH, 'Dream Breath', 1));
events.push(mkEmpowerEnd(PRES_SPELLS.DREAM_BREATH, 'Dream Breath', 2));
events.push(mkEmpowerEnd(PRES_SPELLS.DREAM_BREATH, 'Dream Breath', 3));
// HoT ticks (8 ticks per cast)
for (let c = 0; c < 3; c++) {
  for (let t = 0; t < 8; t++) {
    events.push(mkHeal(PRES_SPELLS.DREAM_BREATH, 'Dream Breath', 25000, 5000, 100 + c, true));
  }
}
// Echo replay heal
events.push(mkHeal(PRES_SPELLS.DREAM_BREATH_ECHO, 'Dream Breath (Echo)', 8000, 500, 101));

// 2 Spiritbloom empowers (levels 2, 4)
events.push(mkEmpowerEnd(PRES_SPELLS.SPIRITBLOOM_CAST, 'Spiritbloom', 2));
events.push(mkEmpowerEnd(PRES_SPELLS.SPIRITBLOOM_CAST, 'Spiritbloom', 4));
// Split heal projectiles
for (let c = 0; c < 5; c++) {
  events.push(mkHeal(PRES_SPELLS.SPIRITBLOOM_SPLIT, 'Spiritbloom (Split)', 15000, 2000, 100 + c));
}

// 1 Fire Breath (level 3)
events.push(mkEmpowerEnd(PRES_SPELLS.FIRE_BREATH_CAST, 'Fire Breath', 3));
// DoT ticks
for (let t = 0; t < 6; t++) {
  events.push(mkDamage(PRES_SPELLS.FIRE_BREATH_DOT, 'Fire Breath (DoT)', 5000));
}

// 8 Living Flame casts
for (let i = 0; i < 8; i++) {
  events.push(mkCast(PRES_SPELLS.LIVING_FLAME_CAST, 'Living Flame'));
  events.push(mkHeal(PRES_SPELLS.LIVING_FLAME_HEAL, 'Living Flame', 12000, 2000));
  events.push(mkDamage(PRES_SPELLS.LIVING_FLAME_DAMAGE, 'Living Flame (Damage)', 3000));
}

// 4 Emerald Blossom casts
for (let i = 0; i < 4; i++) {
  events.push(mkCast(PRES_SPELLS.EMERALD_BLOSSOM_CAST, 'Emerald Blossom'));
  events.push(mkHeal(PRES_SPELLS.EMERALD_BLOSSOM, 'Emerald Blossom', 20000, 3000, 100 + i));
  events.push(
    mkHeal(PRES_SPELLS.EMERALD_BLOSSOM_ECHO, 'Emerald Blossom (Echo)', 6000, 500, 100 + i),
  );
}

// Cooldowns
events.push(mkCast(PRES_SPELLS.REWIND, 'Rewind'));
events.push(mkCast(PRES_SPELLS.DREAM_FLIGHT_CAST, 'Dream Flight'));
events.push(mkCast(PRES_SPELLS.TIP_THE_SCALES, 'Tip the Scales'));
events.push(mkCast(PRES_SPELLS.ZEPHYR, 'Zephyr'));
events.push(mkCast(PRES_SPELLS.RENEWING_BLAZE_CAST, 'Renewing Blaze'));
events.push(mkCast(PRES_SPELLS.STASIS_CAST, 'Stasis'));
events.push(mkCast(PRES_SPELLS.VERDANT_EMBRACE_CAST, 'Verdant Embrace'));

// Chronowarden hero talent heal
events.push(mkHeal(PRES_SPELLS.CHRONO_FLAME_HEAL_1, 'Chrono Flame', 10000, 1000));

// Golden Hour proc
events.push(mkHeal(PRES_SPELLS.GOLDEN_HOUR_HEAL, 'Golden Hour', 5000, 500));

// Temporal Anomaly shield
events.push(mkHeal(PRES_SPELLS.TEMPORAL_ANOMALY_SHIELD, 'Temporal Anomaly', 3000, 0));

console.log(`[smoke] generated ${events.length} synthetic events over ${timestamp}ms`);

const report = extractPreservationReport({
  events,
  playerId: PLAYER_ID,
  playerName: '时空守护者',
  fightStart,
  fightEnd,
  warnings: [],
});

console.log('\n=== JSON 总览 ===');
console.log(JSON.stringify(report.totals, null, 2));
console.log('\n=== 恩护专项指标 ===');
console.log(JSON.stringify(report.specifics, null, 2));

const text = formatPreservationReport(report, {
  reportCode: 'PRES_SMOKE_TEST',
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

// Echo
assert(
  report.specifics.echo.casts === 5,
  `Echo casts: expected 5, got ${report.specifics.echo.casts}`,
);
assert(
  report.specifics.echo.buffApplies === 5,
  `Echo buff applies: expected 5, got ${report.specifics.echo.buffApplies}`,
);

// Reversion
assert(
  report.specifics.reversion.casts === 10,
  `Reversion casts: expected 10, got ${report.specifics.reversion.casts}`,
);
assert(
  report.specifics.reversion.hotApplies === 10,
  `Reversion applies: expected 10, got ${report.specifics.reversion.hotApplies}`,
);
assert(
  report.specifics.reversion.hotTicks === 50,
  `Reversion ticks: expected 50, got ${report.specifics.reversion.hotTicks}`,
);
assert(
  report.specifics.reversion.echoReplayTicks === 20,
  `Reversion echo ticks: expected 20, got ${report.specifics.reversion.echoReplayTicks}`,
);

// Dream Breath empower
assert(
  report.specifics.empower.dreamBreath.casts === 3,
  `DB casts: expected 3, got ${report.specifics.empower.dreamBreath.casts}`,
);
assert(
  report.specifics.empower.dreamBreath.castsByLevel[1] === 1,
  `DB L1: expected 1, got ${report.specifics.empower.dreamBreath.castsByLevel[1]}`,
);
assert(
  report.specifics.empower.dreamBreath.castsByLevel[2] === 1,
  `DB L2: expected 1, got ${report.specifics.empower.dreamBreath.castsByLevel[2]}`,
);
assert(
  report.specifics.empower.dreamBreath.castsByLevel[3] === 1,
  `DB L3: expected 1, got ${report.specifics.empower.dreamBreath.castsByLevel[3]}`,
);

// Spiritbloom
assert(
  report.specifics.empower.spiritbloom.casts === 2,
  `SB casts: expected 2, got ${report.specifics.empower.spiritbloom.casts}`,
);

// Fire Breath
assert(
  report.specifics.empower.fireBreath.casts === 1,
  `FB casts: expected 1, got ${report.specifics.empower.fireBreath.casts}`,
);
assert(report.specifics.empower.fireBreath.totalDamage > 0, 'FB should have damage');

// Living Flame
assert(
  report.specifics.livingFlame.casts === 8,
  `LF casts: expected 8, got ${report.specifics.livingFlame.casts}`,
);
assert(
  report.specifics.livingFlame.heals === 8,
  `LF heals: expected 8, got ${report.specifics.livingFlame.heals}`,
);

// Emerald Blossom
assert(
  report.specifics.emeraldBlossom.casts === 4,
  `EB casts: expected 4, got ${report.specifics.emeraldBlossom.casts}`,
);
assert(
  report.specifics.emeraldBlossom.echoHits === 4,
  `EB echo hits: expected 4, got ${report.specifics.emeraldBlossom.echoHits}`,
);

// Cooldowns
assert(
  report.specifics.cooldowns.rewindCasts === 1,
  `Rewind: expected 1, got ${report.specifics.cooldowns.rewindCasts}`,
);
assert(
  report.specifics.cooldowns.tipTheScalesCasts === 1,
  `TTS casts: expected 1, got ${report.specifics.cooldowns.tipTheScalesCasts}`,
);
assert(
  report.specifics.empower.tipTheScalesCasts === 1,
  `Empower TTS: expected 1, got ${report.specifics.empower.tipTheScalesCasts}`,
);

// Procs
assert(
  report.specifics.procs.goldenHourHits === 1,
  `GH hits: expected 1, got ${report.specifics.procs.goldenHourHits}`,
);
assert(
  report.specifics.procs.temporalAnomalyShields === 1,
  `TA shields: expected 1, got ${report.specifics.procs.temporalAnomalyShields}`,
);

// Hero talent detection
assert(
  report.detectedBuild === 'chronowarden',
  `Build: expected chronowarden, got ${report.detectedBuild}`,
);
assert(
  report.specifics.heroTalent.chronowarden.chronoFlameHealing > 0,
  'Chrono Flame should have healing',
);
assert(
  report.specifics.heroTalent.flameshaper.engulfHits === 0,
  'Flameshaper should have zero hits',
);
assert(
  report.specifics.heroTalent.flameshaper.engulfHealing === 0,
  'Flameshaper should have zero healing',
);

if (errors.length === 0) {
  console.log('\n[smoke] ✅ all assertions passed');
  process.exit(0);
} else {
  console.error('\n[smoke] ❌ assertion failures:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
