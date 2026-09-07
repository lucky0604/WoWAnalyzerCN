import SPELLS from 'common/SPELLS';
import { i18n } from '@lingui/core';
import type { ApplyBuffEvent, CastEvent, RemoveBuffEvent } from 'parser/core/Events';
import { EventType } from 'parser/core/Events';
import {
  DEFAULT_CONFIG,
  DEFAULT_FIGHT,
  DEFAULT_PLAYER_INFO,
  DEFAULT_REPORT,
} from 'parser/core/tests/constants';
import TestCombatLogParser from 'parser/core/tests/TestCombatLogParser';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Lifebloom from './Lifebloom';

// recordGradedCast builds its note strings with t(); activate with no catalog so
// messages fall back to their English defaults (same approach as CHANGELOG.test.ts).
i18n.activate('en');

// Mirrors the constants in Lifebloom.tsx (not exported): pandemic window = 30% of duration.
const LIFEBLOOM_DURATION_MS = 15000;
const LIFEBLOOM_PANDEMIC_MS = LIFEBLOOM_DURATION_MS * 0.3;

const PLAYER_ID = 1;
const TARGET_A = 100;
const TARGET_B = 101;

const castEvent = (timestamp: number, targetID?: number): CastEvent =>
  ({
    timestamp,
    sourceID: PLAYER_ID,
    targetID,
    ability: { guid: SPELLS.LIFEBLOOM_HOT_HEAL.id },
    type: EventType.Cast,
  }) as CastEvent;

const applyEvent = (timestamp: number, targetID: number): ApplyBuffEvent =>
  ({
    timestamp,
    sourceID: PLAYER_ID,
    targetID,
    ability: { guid: SPELLS.LIFEBLOOM_BUFF.id },
    type: EventType.ApplyBuff,
  }) as ApplyBuffEvent;

const removeEvent = (timestamp: number, targetID: number): RemoveBuffEvent =>
  ({
    timestamp,
    sourceID: PLAYER_ID,
    targetID,
    ability: { guid: SPELLS.LIFEBLOOM_BUFF.id },
    type: EventType.RemoveBuff,
  }) as RemoveBuffEvent;

describe('Lifebloom graded casts', () => {
  let parser: TestCombatLogParser;
  let lifebloom: Lifebloom;
  // hotTracker.hots stub — tests inject Lifebloom buff state per target
  let hots: Record<number, Record<number, { end: number }>>;

  beforeEach(() => {
    parser = new TestCombatLogParser(
      DEFAULT_CONFIG,
      DEFAULT_REPORT,
      DEFAULT_PLAYER_INFO,
      DEFAULT_FIGHT,
    );
    hots = {};
    lifebloom = parser.loadModule(Lifebloom, {
      priority: 0,
      combatants: { players: {} },
      efflorescence: {},
      hotTracker: { hots },
    }) as unknown as Lifebloom;
  });

  const setHot = (targetId: number, timestamp: number, remainingMs: number) => {
    hots[targetId] = {
      [SPELLS.LIFEBLOOM_BUFF.id]: { end: timestamp + remainingMs },
    };
  };

  it('grades a fresh cast before any Lifebloom as Good', () => {
    parser.processEvents([castEvent(0, TARGET_A)]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Good);
  });

  it('grades reapplying after letting Lifebloom fade as Fail', () => {
    parser.processEvents([
      applyEvent(0, TARGET_A),
      removeEvent(15000, TARGET_A),
      castEvent(20000, TARGET_A),
    ]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Fail);
  });

  it('grades moving Lifebloom to a new target as Fail', () => {
    parser.processEvents([applyEvent(0, TARGET_A), castEvent(1000, TARGET_B)]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Fail);
  });

  it('grades a refresh inside the pandemic window as Good', () => {
    setHot(TARGET_A, 7000, 4000); // 4.0s remaining, inside the 4.5s window
    parser.processEvents([applyEvent(0, TARGET_A), castEvent(7000, TARGET_A)]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Good);
  });

  it('grades a refresh exactly at the pandemic boundary as Good', () => {
    setHot(TARGET_A, 7000, LIFEBLOOM_PANDEMIC_MS);
    parser.processEvents([applyEvent(0, TARGET_A), castEvent(7000, TARGET_A)]);

    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Good);
  });

  it('grades a refresh earlier than the pandemic window as Ok', () => {
    setHot(TARGET_A, 1000, 19000); // 19.0s remaining, well outside the window
    parser.processEvents([applyEvent(0, TARGET_A), castEvent(1000, TARGET_A)]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Ok);
  });

  it('grades a refresh right after the hot expired as pandemic, not a swap', () => {
    // Lifebloom is still the active target but HotTracker has already expired it:
    // remainingMs null is coerced to 0 (pandemic) when the target does not change.
    parser.processEvents([applyEvent(0, TARGET_A), castEvent(16000, TARGET_A)]);

    expect(lifebloom.castEntries).toHaveLength(1);
    expect(lifebloom.castEntries[0].value).toBe(QualitativePerformance.Good);
  });
});
