import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import { useMemo } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import { SpellLink } from 'interface';
import { EventType } from 'parser/core/Events';
import GuideSection from 'interface/guide/components/GuideSection';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import EventHistory from 'parser/shared/modules/EventHistory';
import {
  SpellSequence,
  type CastSequenceEntry,
  type CastInSequence,
} from 'interface/guide/components/CastSequence';
import DemonicTyrant, { TyrantCastData, TYRANT_WINDOW_MS } from '../features/DemonicTyrant';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { useAnalyzer, useInfo } from 'interface/guide';

const TYRANT_PRE_WINDOW = 7000;
const TYRANT_POST_BUFFER = 3000;

interface ScoreBreakdown {
  total: number;
  totalSpenderCasts: number;
  maxExpectedCasts: number;
  components: {
    label: string;
    score: number;
    max: number;
    displayScore?: number;
    displayMax?: number;
  }[];
}

// Computes a weighted 0–100 score for a single Tyrant window across spender casts, cooldown usage, and resource management.
function scoreTyrantWindow(cast: TyrantCastData, isDialobist: boolean): ScoreBreakdown {
  const totalSpenderCasts = cast.handOfGuldanCasts;

  // Pro-rate the max HoG cast expectation based on how much of the window actually occurred.
  const windowFraction = cast.actualWindowDurationMs / TYRANT_WINDOW_MS;
  const maxExpectedCasts = cast.fightEndedDuringWindow
    ? Math.max(1, Math.round(8 * windowFraction))
    : 8;

  let dreadstalkerScore: number;
  if (cast.dreadstalkersActive) {
    dreadstalkerScore = cast.dreadstalkersTooEarly ? 11 : 15;
  } else if (cast.dreadstalkersCastDuringWindow) {
    dreadstalkerScore = 7; // cast inside the window wastes a GCD
  } else {
    dreadstalkerScore = 0;
  }

  // If the fight ended early, leftover shards aren't the player's fault — full points.
  const missedCasts =
    cast.fightEndedDuringWindow || cast.shardsAtWindowEnd === null
      ? 0
      : Math.floor(cast.shardsAtWindowEnd / 3);
  let shardsEndScore: number;
  if (missedCasts === 0) shardsEndScore = 15;
  else if (missedCasts === 1) shardsEndScore = 8;
  else if (missedCasts === 2) shardsEndScore = 3;
  else shardsEndScore = 0;

  // If grimoire was on CD when Tyrant was cast but used during the window, it came off CD naturally — full points.
  const grimoireCameOffCdDuringWindow = cast.grimoireCastDuringWindow && !cast.grimoireAvailable;
  let grimoireScore: number | null;
  if (cast.grimoireAvailable === null) {
    grimoireScore = null; // not talented — excluded from scoring
  } else if (cast.grimoireAvailable && !cast.grimoireCast && !cast.grimoireCastDuringWindow) {
    grimoireScore = 0; // available but never cast
  } else if (cast.grimoireCastDuringWindow && !grimoireCameOffCdDuringWindow) {
    grimoireScore = 2; // was available before Tyrant but cast during window instead (wastes a GCD)
  } else {
    grimoireScore = 5; // cast before the window, or came off CD during the window (both ideal)
  }

  let doomguardScore: number | null;
  if (cast.doomguardAvailable === null) {
    doomguardScore = null; // not talented — excluded from scoring
  } else if (cast.doomguardAvailable && !cast.doomguardCast) {
    doomguardScore = 0; // available but skipped
  } else {
    doomguardScore = 5;
  }

  // Diabolist: 1 point per shard, capped at 5.
  // Non-Diabolist: Tyrant grants 3 shards on cast, so 2 is ideal — each shard above 2 is wasted (overcaps on cast), costing 2 points.
  let shardsOnCastScore: number;
  if (isDialobist) {
    shardsOnCastScore = Math.min(cast.shardsOnCast, 5);
  } else {
    const wastedShards = Math.max(0, cast.shardsOnCast - 2);
    shardsOnCastScore = Math.max(0, 5 - wastedShards * 2);
  }

  // Fixed weights per component. Each raw score is already in range 0..weight, so raw scores
  // are used directly as contributions. Absent talents are excluded and the sum normalizes to 100.
  const grimoireWeight = grimoireScore !== null ? 5 : 0;
  const doomguardWeight = doomguardScore !== null ? 5 : 0;
  const totalWeight = 50 + 15 + 15 + grimoireWeight + doomguardWeight + 5;

  const hogRatio = Math.min(totalSpenderCasts, maxExpectedCasts) / maxExpectedCasts;
  const rawScore =
    hogRatio * 50 +
    dreadstalkerScore +
    shardsEndScore +
    (grimoireScore ?? 0) +
    (doomguardScore ?? 0) +
    shardsOnCastScore;
  const total = Math.round((rawScore / totalWeight) * 100);

  const spenderLabel = (() => {
    const count = totalSpenderCasts;
    const max = maxExpectedCasts;
    return isDialobist
      ? t({
          id: 'warlock.demonology.demonicTyrant.score.hogRuinationCasts',
          message: `HoG / Ruination casts (${{ count }} / ${{ max }})`,
        })
      : t({
          id: 'warlock.demonology.demonicTyrant.score.handOfGuldanCasts',
          message: `Hand of Gul'dan casts (${{ count }} / ${{ max }})`,
        });
  })();

  const components: ScoreBreakdown['components'] = [
    { label: spenderLabel, score: Math.round(hogRatio * 50), max: 50 },
    {
      label: t({
        id: 'warlock.demonology.demonicTyrant.score.dreadstalkersTiming',
        message: 'Dreadstalkers timing',
      }),
      score: dreadstalkerScore,
      max: 15,
    },
    {
      label: t({
        id: 'warlock.demonology.demonicTyrant.score.shardsAtEnd',
        message: 'Shards at window end',
      }),
      score: shardsEndScore,
      max: 15,
    },
  ];
  if (grimoireScore !== null) {
    components.push({
      label: t({
        id: 'warlock.demonology.demonicTyrant.score.grimoireCast',
        message: 'Grimoire cast',
      }),
      score: grimoireScore,
      max: 5,
    });
  }
  if (doomguardScore !== null) {
    components.push({
      label: t({
        id: 'warlock.demonology.demonicTyrant.score.doomguardCast',
        message: 'Doomguard cast',
      }),
      score: doomguardScore,
      max: 5,
    });
  }
  components.push({
    label: t({
      id: 'warlock.demonology.demonicTyrant.score.soulShardsAtCast',
      message: 'Soul Shards at cast',
    }),
    score: shardsOnCastScore,
    max: 5,
  });

  return { total, totalSpenderCasts, maxExpectedCasts, components };
}

// Maps a numeric window score to a performance rating.
// Perfect requires ≥ maxExpectedCasts spender casts; Good requires ≥ 6.
function scoreToPerf(
  score: number,
  totalSpenderCasts?: number,
  maxExpectedCasts = 8,
): QualitativePerformance {
  const spenderRequirementMet =
    totalSpenderCasts === undefined || totalSpenderCasts >= maxExpectedCasts;
  const goodSpenderRequirementMet = totalSpenderCasts === undefined || totalSpenderCasts >= 6;
  if (score >= 95 && spenderRequirementMet) return QualitativePerformance.Perfect;
  if (score >= 80 && goodSpenderRequirementMet) return QualitativePerformance.Good;
  if (score >= 50) return QualitativePerformance.Ok;
  return QualitativePerformance.Fail;
}

function formatTimestampMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function getTyrantFeedback(
  cast: TyrantCastData,
  isDialobist: boolean,
  casts: CastInSequence[],
  isFirstWindow: boolean,
  perf: QualitativePerformance,
  maxExpectedCasts: number,
): JSX.Element {
  const {
    handOfGuldanCasts,
    maxDemonicPowerStacks,
    dreadstalkersActive,
    dreadstalkersTooEarly,
    dreadstalkersCastDuringWindow,
    grimoireAvailable,
    grimoireCast,
    grimoireCastDuringWindow,
    doomguardAvailable,
    doomguardCast,
    shardsOnCast,
    demonicCoresOnCast,
    shardsAtWindowEnd,
    fightEndedDuringWindow,
  } = cast;
  const feedback: string[] = [];
  const preTyrantCasts = casts.filter((c) => c.timestamp < cast.cast);
  const spenderLabel = isDialobist
    ? t({ id: 'warlock.demonology.demonicTyrant.label.hogRuination', message: 'HoG / Ruination' })
    : t({
        id: 'warlock.demonology.demonicTyrant.label.handOfGuldan',
        message: "Hand of Gul'dan",
      });
  const grimoireCameOffCdDuringWindow = grimoireCastDuringWindow && !grimoireAvailable;

  if (fightEndedDuringWindow) {
    feedback.push(
      (() => {
        const plural = maxExpectedCasts === 1 ? '' : 's';
        return t({
          id: 'warlock.demonology.demonicTyrant.feedback.fightEnded',
          message: `The fight ended during this Tyrant window — score is pro-rated to ${{ maxExpectedCasts }} expected ${{ spenderLabel }} cast${{ plural }}.`,
        });
      })(),
    );
  }

  if (handOfGuldanCasts >= maxExpectedCasts && perf === QualitativePerformance.Perfect) {
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.perfect',
        message: `Perfect Tyrant window. You maximized ${{ spenderLabel }} casts during the Tyrant duration.`,
      }),
    );
  } else if (handOfGuldanCasts >= maxExpectedCasts) {
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.goodCount',
        message: `Good ${{ spenderLabel }} count, but other issues prevented a perfect window — see below.`,
      }),
    );
  } else if (handOfGuldanCasts >= Math.round(maxExpectedCasts * 0.75)) {
    feedback.push(
      (() => {
        const count = handOfGuldanCasts;
        return t({
          id: 'warlock.demonology.demonicTyrant.feedback.goodWindow',
          message: `${{ count }} ${{ spenderLabel }} casts — good window. Aim for ${{ maxExpectedCasts }} for a perfect window.`,
        });
      })(),
    );
  } else if (handOfGuldanCasts >= Math.round(maxExpectedCasts * 0.6)) {
    feedback.push(
      (() => {
        const count = handOfGuldanCasts;
        const plural = handOfGuldanCasts === 1 ? '' : 's';
        return t({
          id: 'warlock.demonology.demonicTyrant.feedback.onlyCountLow',
          message: `Only ${{ count }} ${{ spenderLabel }} cast${{ plural }} during Tyrant. Aim for at least ${{ maxExpectedCasts }}.`,
        });
      })(),
    );
  } else {
    feedback.push(
      (() => {
        const count = handOfGuldanCasts;
        const plural = handOfGuldanCasts === 1 ? '' : 's';
        return t({
          id: 'warlock.demonology.demonicTyrant.feedback.underpowered',
          message: `Only ${{ count }} ${{ spenderLabel }} cast${{ plural }} during Tyrant — this window was significantly underpowered.`,
        });
      })(),
    );
  }

  const castedPowerSiphon = preTyrantCasts.some(
    (cast) => cast.spellId === TALENTS.POWER_SIPHON_TALENT.id,
  );

  if (!dreadstalkersActive && !dreadstalkersCastDuringWindow) {
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.noDreadstalkers',
        message:
          "Cast Call Dreadstalkers before Demonic Tyrant to ensure you can immediately begin Hand of Gul'dan casts without wasting GCDs.",
      }),
    );
  } else if (dreadstalkersCastDuringWindow && !dreadstalkersActive) {
    // Only flag if there was no pre-Tyrant cast — an in-window cast alongside a pre-cast is a legitimate re-cast on cooldown.
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.dreadstalkersInWindow',
        message:
          "Call Dreadstalkers was cast during the Tyrant window instead of before it, wasting GCDs you could have used on Hand of Gul'dan.",
      }),
    );
  } else if (dreadstalkersTooEarly) {
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.dreadstalkersTooEarly',
        message:
          'Call Dreadstalkers was cast too early before Tyrant. Try casting it closer to your Summon Demonic Tyrant window.',
      }),
    );
  }

  if (castedPowerSiphon)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.powerSiphonBeforeTyrant',
        message: 'Power Siphon before Tyrant sacrifices imps that could increase Tyrant damage.',
      }),
    );

  if (maxDemonicPowerStacks < 8)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.moreImpsForTyrant',
        message: 'Entering Tyrant with more imps already active will significantly increase its damage.',
      }),
    );

  if (grimoireAvailable && !grimoireCast && !grimoireCastDuringWindow)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.grimoireNotUsed',
        message:
          "Grimoire was available but wasn't used this window. If you're holding it for a burn phase that's fine, otherwise cast it before Tyrant to avoid wasting GCDs during the window.",
      }),
    );
  else if (grimoireAvailable && grimoireCastDuringWindow)
    // Only flag if Grimoire was available before Tyrant — if it came off CD during the window, the in-window cast is correct.
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.grimoireInWindow',
        message:
          'Your Grimoire cooldown was cast during the Tyrant window instead of before it, wasting a GCD.',
      }),
    );
  else if (grimoireCameOffCdDuringWindow)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.grimoireOffCd',
        message:
          'Your Grimoire cooldown became available during the Tyrant window and was cast — good use.',
      }),
    );

  if (doomguardAvailable && !doomguardCast)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.doomguardNotUsed',
        message: "Cast Summon Doomguard before Tyrant so you don't waste GCDs during the window.",
      }),
    );

  if (isDialobist) {
    if (shardsOnCast < 5)
      feedback.push(
        (() => {
          const plural = shardsOnCast === 1 ? '' : 's';
          return t({
            id: 'warlock.demonology.demonicTyrant.feedback.diabolistShards',
            message: `You entered the Tyrant window with ${{ shardsOnCast }} Soul Shard${{ plural }}. Try to pool at least 5 Soul Shards before casting Tyrant to fuel Hand of Gul'dan casts.`,
          });
        })(),
      );
  } else {
    // Tyrant grants 3 shards on cast — 2 is ideal, 0–1 is fine, 4+ is wasteful.
    if (shardsOnCast >= 4)
      feedback.push(
        (() => {
          const plural = shardsOnCast === 1 ? '' : 's';
          return t({
            id: 'warlock.demonology.demonicTyrant.feedback.tooManyShards',
            message: `You entered the Tyrant window with ${{ shardsOnCast }} Soul Shard${{ plural }}. Aim for around 2 — Tyrant grants 3 shards on cast, so higher counts cap your shards and waste resources.`,
          });
        })(),
      );
  }

  if (demonicCoresOnCast === 0 && !isFirstWindow)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.noDemonicCores',
        message:
          "You had no Demonic Core charges when casting Tyrant. Save Demonic Cores before your Tyrant window to fuel Hand of Gul'dan casts.",
      }),
    );
  else if (demonicCoresOnCast === 1 && !isFirstWindow)
    feedback.push(
      t({
        id: 'warlock.demonology.demonicTyrant.feedback.oneDemonicCore',
        message:
          'You had only 1 Demonic Core when casting Tyrant. Try to save more charges before the window.',
      }),
    );

  if (!fightEndedDuringWindow && shardsAtWindowEnd !== null && shardsAtWindowEnd >= 3) {
    const missedCasts = Math.floor(shardsAtWindowEnd / 3);
    feedback.push(
      (() => {
        const plural = missedCasts === 1 ? '' : 's';
        return t({
          id: 'warlock.demonology.demonicTyrant.feedback.missedHogCasts',
          message: `You ended the Tyrant window with ${{ shardsAtWindowEnd }} Soul Shards — that's ${{ missedCasts }} missed Hand of Gul'dan cast${{ plural }}.`,
        });
      })(),
    );
  }

  const [summary, ...details] = feedback;

  return (
    <div>
      <p>{summary}</p>
      {details.length > 0 && (
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {details.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DemonicTyrantGuide(): JSX.Element | null {
  const demonicTyrant = useAnalyzer(DemonicTyrant);
  const eventHistory = useAnalyzer(EventHistory);
  const info = useInfo();
  // Used to relabel spender casts and conditionally show the Demonic Cores stat.
  const isDialobist = info?.combatant.hasTalent(TALENTS.RUINATION_TALENT) ?? false;
  const hasPowerSiphon = info?.combatant.hasTalent(TALENTS.POWER_SIPHON_TALENT) ?? false;

  const tyrantSequenceEvents = useMemo((): CastSequenceEntry<TyrantCastData>[] => {
    if (!demonicTyrant || !eventHistory) return [];
    return demonicTyrant.tyrantData.map((cast) => {
      const windowStart = cast.cast - TYRANT_PRE_WINDOW;
      const windowEnd = cast.cast + TYRANT_WINDOW_MS + TYRANT_POST_BUFFER;

      const castEvents = eventHistory.getEvents([EventType.Cast], {
        searchBackwards: false,
        startTimestamp: windowStart,
        duration: windowEnd - windowStart,
      });

      const casts: CastInSequence[] = castEvents.map((event) => ({
        timestamp: event.timestamp,
        spellId: event.ability.guid,
        spellName: event.ability.name,
        icon: event.ability.abilityIcon.replace('.jpg', ''),
      }));

      return {
        data: cast,
        start: windowStart,
        end: windowEnd,
        casts,
      };
    });
  }, [demonicTyrant, eventHistory]);

  const perCastData: PerCastData[] = useMemo(() => {
    if (!demonicTyrant || !eventHistory) return [];
    const fightStart =
      eventHistory.getEvents([EventType.Cast], {
        searchBackwards: false,
        count: 1,
      })[0]?.timestamp ?? 0;

    return demonicTyrant.tyrantData.map((cast, index) => {
      const sequenceEntry = tyrantSequenceEvents[index];

      const scoreBreakdown = scoreTyrantWindow(cast, isDialobist);
      const score = scoreBreakdown.total;
      const perf = scoreToPerf(
        score,
        scoreBreakdown.totalSpenderCasts,
        scoreBreakdown.maxExpectedCasts,
      );
      let additionalContent;
      if (sequenceEntry) {
        const tyrantWindowEnd = cast.cast + TYRANT_WINDOW_MS;
        const inWindowCasts = sequenceEntry.casts.filter((c) => c.timestamp <= tyrantWindowEnd);
        const postWindowCasts = sequenceEntry.casts
          .filter((c) => c.timestamp > tyrantWindowEnd)
          .map((c) => ({
            ...c,
            ghosted: true as const,
            tooltip: (
              <div>
                <strong>{c.spellName}</strong>
                <p>
                  <em>
                    {t({
                      id: 'warlock.demonology.demonicTyrant.castAfterWindow',
                      message: 'Cast after the Tyrant window ended',
                    })}
                  </em>
                </p>
              </div>
            ),
          }));
        additionalContent = {
          title: t({
            id: 'warlock.demonology.demonicTyrant.castSequence',
            message: 'Cast Sequence',
          }),
          content: (
            <>
              <SpellSequence casts={inWindowCasts} iconSize={40} />
              {postWindowCasts.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginTop: 4,
                      marginBottom: 2,
                      fontStyle: 'italic',
                    }}
                  >
                    {t({
                      id: 'warlock.demonology.demonicTyrant.castAfterWindowLabel',
                      message: 'cast after the tyrant window ended',
                    })}
                  </div>
                  <SpellSequence casts={postWindowCasts} iconSize={40} />
                </>
              )}
            </>
          ),
        };
      }

      return {
        performance: perf,
        timestamp: `${formatTimestampMs(cast.cast - fightStart)} – ${formatTimestampMs(cast.cast + cast.actualWindowDurationMs - fightStart)}`,
        stats: [
          {
            label: isDialobist
              ? t({
                  id: 'warlock.demonology.demonicTyrant.stat.hogRuinationCasts',
                  message: 'HoG / Ruination Casts',
                })
              : t({
                  id: 'warlock.demonology.demonicTyrant.stat.handOfGuldanCasts',
                  message: "Hand of Gul'dan Casts",
                }),
            value: cast.handOfGuldanCasts,
            tooltip: isDialobist
              ? t({
                  id: 'warlock.demonology.demonicTyrant.stat.hogRuinationTooltip',
                  message:
                    "Number of Hand of Gul'dan and Ruination casts during the Tyrant window",
                })
              : t({
                  id: 'warlock.demonology.demonicTyrant.stat.handOfGuldanTooltip',
                  message: "Number of Hand of Gul'dan casts during the Tyrant window",
                }),
          },
          {
            label: t({
              id: 'warlock.demonology.demonicTyrant.stat.maxDemonicPower',
              message: 'Max Demonic Power Stacks',
            }),
            value: cast.maxDemonicPowerStacks,
            tooltip: t({
              id: 'warlock.demonology.demonicTyrant.stat.maxDemonicPowerTooltip',
              message:
                'Highest stacks of Demonic Power during the window. Each active demon (Wild Imps, Dreadstalkers, Felguard) grants one stack.',
            }),
          },
          {
            label: t({
              id: 'warlock.demonology.demonicTyrant.stat.soulShardsAtCast',
              message: 'Soul Shards at Cast',
            }),
            value: Math.round(cast.shardsOnCast),
            tooltip: t({
              id: 'warlock.demonology.demonicTyrant.stat.soulShardsAtCastTooltip',
              message:
                'Soul Shards available when Demonic Tyrant was cast. Aim for ~2 (Soul Harvester) — Tyrant grants 3 shards on cast, so 0–2 is fine while 4+ is wasteful. Diabolist should aim for 5.',
            }),
          },
          ...(index > 0 || hasPowerSiphon
            ? [
                {
                  label: t({
                    id: 'warlock.demonology.demonicTyrant.stat.demonicCoresAtCast',
                    message: 'Demonic Cores at Cast',
                  }),
                  value: cast.demonicCoresOnCast,
                  tooltip: t({
                    id: 'warlock.demonology.demonicTyrant.stat.demonicCoresTooltip',
                    message:
                      'Demonic Core stacks available when Demonic Tyrant was cast (max 4).',
                  }),
                },
              ]
            : []),
          ...(cast.shardsAtWindowEnd !== null
            ? [
                {
                  label: t({
                    id: 'warlock.demonology.demonicTyrant.stat.soulShardsAtEnd',
                    message: 'Soul Shards at Window End',
                  }),
                  value: cast.shardsAtWindowEnd,
                  tooltip: t({
                    id: 'warlock.demonology.demonicTyrant.stat.soulShardsAtEndTooltip',
                    message:
                      "Soul Shards remaining when the Tyrant window ended. Aim for fewer than 3 — leftover shards could have been another Hand of Gul'dan.",
                  }),
                },
              ]
            : []),
          {
            label: t({
              id: 'warlock.demonology.demonicTyrant.stat.score',
              message: 'Score',
            }),
            value: `${score} / 100`,
            performance: perf,
            tooltip: (
              <div>
                <div style={{ marginBottom: 4, fontWeight: 700 }}>
                  {t({
                    id: 'warlock.demonology.demonicTyrant.scoreBreakdown',
                    message: 'Score breakdown',
                  })}
                </div>
                {scoreBreakdown.components.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      opacity: c.score === 0 ? 0.5 : 1,
                    }}
                  >
                    <span>{c.label}</span>
                    <span>
                      {c.displayScore ?? c.score} / {c.displayMax ?? c.max}
                    </span>
                  </div>
                ))}
                {(cast.grimoireAvailable === null || cast.doomguardAvailable === null) && (
                  <div style={{ marginTop: 6, opacity: 0.6, fontStyle: 'italic' }}>
                    {t({
                      id: 'warlock.demonology.demonicTyrant.untalentedExcluded',
                      message: 'Untalented cooldowns excluded; total normalized to 100.',
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ],
        details: getTyrantFeedback(
          cast,
          isDialobist,
          sequenceEntry?.casts ?? [],
          index === 0,
          perf,
          scoreBreakdown.maxExpectedCasts,
        ),
        additionalContent,
      };
    });
  }, [demonicTyrant, eventHistory, tyrantSequenceEvents, isDialobist, hasPowerSiphon]);

  if (!demonicTyrant || !eventHistory) return null;

  const tyrant = <SpellLink spell={SPELLS.SUMMON_DEMONIC_TYRANT} />;

  const explanation = (
    <>
      <p>
        {t({
          id: 'warlock.demonology.demonicTyrant.explanation.intro',
          message:
            'Demonic Tyrant deals increased damage based on the number of active demons during its duration. To maximize its effectiveness, summon as many pets as possible before and during the Tyrant window.',
        })}
      </p>

      <p>
        {t({
          id: 'warlock.demonology.demonicTyrant.explanation.primaryDemons',
          message: 'The primary demons contributing to Tyrant damage are:',
        })}
      </p>

      <ul>
        <li>
          <SpellLink spell={SPELLS.CALL_DREADSTALKERS} /> —{' '}
          {t({
            id: 'warlock.demonology.demonicTyrant.explanation.dreadstalkers',
            message: 'summons two Dreadstalkers',
          })}
        </li>
        <li>
          {t({
            id: 'warlock.demonology.demonicTyrant.explanation.wildImps',
            message: 'Wild Imps summoned from',
          })}{' '}
          <SpellLink spell={SPELLS.HAND_OF_GULDAN_CAST} />
        </li>
        <li>
          {t({
            id: 'warlock.demonology.demonicTyrant.explanation.impGangBosses',
            message: 'Imp Gang Bosses summoned by',
          })}{' '}
          <SpellLink spell={SPELLS.IMPLOSION_CAST} /> {t({ id: 'warlock.demonology.demonicTyrant.explanation.or', message: 'or' })}{' '}
          <SpellLink spell={TALENTS.POWER_SIPHON_TALENT} />{' '}
          {t({
            id: 'warlock.demonology.demonicTyrant.explanation.withTalent',
            message: 'with the talent',
          })}{' '}
          <SpellLink spell={TALENTS.TO_HELL_AND_BACK_TALENT} />
        </li>
      </ul>

      <p>
        {t({
          id: 'warlock.demonology.demonicTyrant.explanation.duringWindow',
          message: "During the Tyrant window, aim to cast as many Hand of Gul'dan as possible to summon additional imps and increase Tyrant's damage.",
        })}
      </p>
    </>
  );

  return (
    <GuideSection spell={SPELLS.SUMMON_DEMONIC_TYRANT} explanation={explanation}>
      <CastDetail
        title={t({
          id: 'warlock.demonology.demonicTyrant.castDetailTitle',
          message: 'Demonic Tyrant Casts',
        })}
        casts={perCastData}
      />
    </GuideSection>
  );
}

export default DemonicTyrantGuide;
