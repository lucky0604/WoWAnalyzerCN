import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import SPELLS from 'common/SPELLS/demonhunter';
import { ThresholdStyle } from 'parser/core/ParseResults';
import { formatDuration, formatPercentage } from 'common/format';
import Statistic from 'parser/ui/Statistic';
import UptimeIcon from 'interface/icons/Uptime';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import TalentSpellText from 'parser/ui/TalentSpellText';
import { JSX } from 'react';
import SpellLink from 'interface/SpellLink';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  FightEndEvent,
  RefreshBuffEvent,
} from 'parser/core/Events';
import { ChecklistUsageInfo, SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import {
  combineQualitativePerformances,
  qualitativePerformanceToNumber,
} from 'common/combineQualitativePerformances';
import { getFuriousGazeBuffApplication } from '../../normalizers/FuriousGazeNormalizer';

const WINDOW_TRIGGER_LOOKBACK_MS = 1500;
const WINDOW_TRIGGER_LOOKAHEAD_MS = 250;
const QUICK_BURST_START_MS = 1800;

const BURST_WINDOW_SPELLS = new Set([
  TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT.id,
  TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT.id,
  TALENTS_DEMON_HUNTER.FELBLADE_TALENT.id,
  TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT.id,
  TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT.id,
  TALENTS_DEMON_HUNTER.SIGIL_OF_SPITE_TALENT.id,
  SPELLS.METAMORPHOSIS_HAVOC.id,
  SPELLS.DEATH_SWEEP.id,
  SPELLS.ANNIHILATION.id,
  SPELLS.CHAOS_STRIKE.id,
  SPELLS.BLADE_DANCE.id,
]);

type InertiaSource = 'vengeful-retreat' | 'the-hunt' | 'unknown';

interface InertiaWindow {
  event: CastEvent | ApplyBuffEvent | RefreshBuffEvent;
  start: number;
  end: number;
  source: InertiaSource;
  casts: CastEvent[];
  deathSweepCasts: CastEvent[];
  annihilationCasts: CastEvent[];
  fillerCasts: CastEvent[];
  burstGlobalCount: number;
  startedEyeBeamDuringWindow: boolean;
  fullyChanneledEyeBeamDuringWindow: boolean;
  startedAbyssalGazeDuringWindow: boolean;
  fullyChanneledAbyssalGazeDuringWindow: boolean;
  triggeredFuriousGaze: boolean;
  quickBurstStart: boolean;
}

export default class Inertia extends Analyzer {
  private castEvents: CastEvent[] = [];
  private buffStartEvents: Array<ApplyBuffEvent | RefreshBuffEvent> = [];
  private uses: SpellUse[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.INERTIA_TALENT);

    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this.onCast);
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.INERTIA_BUFF),
      this.onApplyBuff,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.INERTIA_BUFF),
      this.onRefreshBuff,
    );
    this.addEventListener(Events.fightend, this.finalize);
  }

  get buffUptime() {
    return this.selectedCombatant.getBuffUptime(SPELLS.INERTIA_BUFF.id) / this.owner.fightDuration;
  }

  get buffDuration() {
    return this.selectedCombatant.getBuffUptime(SPELLS.INERTIA_BUFF.id);
  }

  get buffHistory() {
    return this.selectedCombatant.getBuffHistory(SPELLS.INERTIA_BUFF.id);
  }

  get suggestionThresholds() {
    return {
      actual: this.buffUptime,
      isLessThan: {
        minor: 0.1,
        average: 0.18,
        major: 0.22,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  statistic() {
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={`The Inertia buff total uptime was ${formatDuration(this.buffDuration)}.`}
      >
        <TalentSpellText talent={TALENTS_DEMON_HUNTER.INERTIA_TALENT}>
          <UptimeIcon /> {formatPercentage(this.buffUptime)}% <small>uptime</small>
        </TalentSpellText>
      </Statistic>
    );
  }

  guideSubsection(): JSX.Element | null {
    if (!this.active) {
      return null;
    }

    const explanation = (
      <>
        <p>
          <strong><SpellLink spell={TALENTS_DEMON_HUNTER.INERTIA_TALENT} /></strong>
          {t({ id: 'demonhunter.havoc.inertia.description.p1', message: ' creates a short burst window tied to your movement tools. After using ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT} />
          {t({ id: 'demonhunter.havoc.inertia.description.p2', message: ' or ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
          {t({ id: 'demonhunter.havoc.inertia.description.p3', message: ', your next ' })}
          <SpellLink spell={SPELLS.FEL_RUSH_CAST} />
          {t({ id: 'demonhunter.havoc.inertia.description.p4', message: ' or ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.FELBLADE_TALENT} />
          {t({ id: 'demonhunter.havoc.inertia.description.p5', message: ' triggers ' })}
          <SpellLink spell={SPELLS.INERTIA_BUFF} />
          {t({ id: 'demonhunter.havoc.inertia.description.p6', message: ' for 5 seconds.' })}
        </p>
        <p>
          <Trans id="demonhunter.havoc.inertia.description2">
            During that window, try to fit in as many of your highest-value abilities as possible
            instead of spending globals on filler.
          </Trans>
        </p>
      </>
    );

    const goodWindows = this.uses.filter(
      (use) =>
        qualitativePerformanceToNumber(use.performance) >=
        qualitativePerformanceToNumber(QualitativePerformance.Good),
    ).length;

    return (
      <ContextualSpellUsageSubSection
        title="Inertia"
        explanation={explanation}
        uses={this.uses}
        castBreakdownSmallText={
          <>
            {' '}
            {t({
              id: 'demonhunter.havoc.inertia.castBreakdown',
              message:
                '- Each box represents one Inertia window, graded by how much burst you fit into it.',
            })}
          </>
        }
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          this.uses.length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              <CastPerformanceSummary
                spell={TALENTS_DEMON_HUNTER.INERTIA_TALENT}
                casts={goodWindows}
                performance={QualitativePerformance.Good}
                totalCasts={this.uses.length}
              />
            </div>
          ) : undefined
        }
        noCastsTexts={{
          noCastsOverride: t({
            id: 'demonhunter.havoc.inertia.noCasts',
            message: 'No Inertia windows were found in this log.',
          }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    this.castEvents.push(event);
  }

  private onApplyBuff(event: ApplyBuffEvent) {
    this.buffStartEvents.push(event);
  }

  private onRefreshBuff(event: RefreshBuffEvent) {
    this.buffStartEvents.push(event);
  }

  private finalize(_event: FightEndEvent) {
    this.uses = this.buffHistory.map((window) =>
      this.windowToSpellUse(
        this.buildWindow(window.start, window.end ?? this.owner.fight.end_time),
      ),
    );
  }

  private buildWindow(start: number, end: number): InertiaWindow {
    const event =
      this.buffStartEvents.find((buffEvent) => buffEvent.timestamp === start) ??
      this.castEvents.find((cast) => cast.timestamp >= start && cast.timestamp <= end);

    if (!event) {
      throw new Error('Inertia window could not be matched to an event');
    }

    const source = this.getSource(start);
    const casts = this.castEvents.filter(
      (cast) => cast.timestamp >= start && cast.timestamp <= end,
    );
    const eyeBeamCast = casts.find(
      (cast) => cast.ability.guid === TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT.id,
    );
    const abyssalGazeCast = casts.find((cast) => cast.ability.guid === SPELLS.ABYSSAL_GAZE.id);
    const deathSweepCasts = casts.filter((cast) => cast.ability.guid === SPELLS.DEATH_SWEEP.id);
    const annihilationCasts = casts.filter((cast) => cast.ability.guid === SPELLS.ANNIHILATION.id);
    const fillerCasts = casts.filter((cast) => !BURST_WINDOW_SPELLS.has(cast.ability.guid));
    const burstGlobalCount = casts.filter(
      (cast) =>
        cast.ability.guid !== TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT.id &&
        cast.ability.guid !== TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT.id,
    ).length;
    const firstBurstCast = casts.find(
      (cast) =>
        cast.ability.guid !== TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT.id &&
        cast.ability.guid !== TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT.id,
    );
    const quickBurstStart =
      firstBurstCast !== undefined && firstBurstCast.timestamp - start <= QUICK_BURST_START_MS;

    return {
      event,
      start,
      end,
      source,
      casts,
      deathSweepCasts,
      annihilationCasts,
      fillerCasts,
      burstGlobalCount,
      startedEyeBeamDuringWindow: Boolean(eyeBeamCast),
      fullyChanneledEyeBeamDuringWindow: Boolean(
        eyeBeamCast && eyeBeamCast.channel?.timestamp && eyeBeamCast.channel.timestamp <= end,
      ),
      startedAbyssalGazeDuringWindow: Boolean(abyssalGazeCast),
      fullyChanneledAbyssalGazeDuringWindow: Boolean(
        abyssalGazeCast &&
        abyssalGazeCast.channel?.timestamp &&
        abyssalGazeCast.channel.timestamp <= end,
      ),
      triggeredFuriousGaze: eyeBeamCast
        ? getFuriousGazeBuffApplication(eyeBeamCast) !== undefined
        : false,
      quickBurstStart,
    };
  }

  private getSource(windowStart: number): InertiaSource {
    const sourceEvent = this.castEvents
      .filter(
        (cast) =>
          (cast.ability.guid === TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT.id ||
            cast.ability.guid === TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT.id) &&
          cast.timestamp >= windowStart - WINDOW_TRIGGER_LOOKBACK_MS &&
          cast.timestamp <= windowStart + WINDOW_TRIGGER_LOOKAHEAD_MS,
      )
      .at(-1);

    if (sourceEvent?.ability.guid === TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT.id) {
      return 'vengeful-retreat';
    }
    if (sourceEvent?.ability.guid === TALENTS_DEMON_HUNTER.THE_HUNT_HAVOC_TALENT.id) {
      return 'the-hunt';
    }
    return 'unknown';
  }

  private windowToSpellUse(window: InertiaWindow): SpellUse {
    const checklistItems: ChecklistUsageInfo[] = [
      {
        check: 'setup',
        timestamp: window.start,
        ...this.setupPerformance(window),
      },
      {
        check: 'eye-beam',
        timestamp: window.start,
        ...this.eyeBeamPerformance(window),
      },
      {
        check: 'payload',
        timestamp: window.start,
        ...this.payloadPerformance(window),
      },
      {
        check: 'spender',
        timestamp: window.start,
        ...this.spenderPerformance(window),
      },
    ];

    const actualPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );

    return {
      event: window.event,
      checklistItems,
      performance: actualPerformance,
      performanceExplanation:
        actualPerformance !== QualitativePerformance.Fail
          ? `${actualPerformance} Window`
          : 'Bad Window',
    };
  }

  private setupPerformance(window: InertiaWindow): UsageInfo {
    const summary = (
      <div>
        {t({
          id: 'demonhunter.havoc.inertia.setup.title',
          message: 'Converted trigger into burst quickly',
        })}
      </div>
    );

    if (window.quickBurstStart) {
      return {
        performance: QualitativePerformance.Perfect,
        summary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.inertia.setup.perfect',
              message:
                'You converted the trigger into burst quickly and got started on the window right away.',
            })}
          </div>
        ),
      };
    }

    if (window.startedEyeBeamDuringWindow || window.burstGlobalCount >= 3) {
      return {
        performance: QualitativePerformance.Good,
        summary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.inertia.setup.good',
              message:
                'You started spending the window, but not quickly enough to fully capitalize on the setup.',
            })}
          </div>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary,
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.setup.fail.p1', message: 'You triggered ' })}
          <SpellLink spell={SPELLS.INERTIA_BUFF} />
          {t({ id: 'demonhunter.havoc.inertia.setup.fail.p2', message: ' but did not turn it into an immediate burst sequence. Try entering the window with an instant setup into ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
          {t({ id: 'demonhunter.havoc.inertia.setup.fail.p3', message: '.' })}
        </div>
      ),
    };
  }

  private eyeBeamPerformance(window: InertiaWindow): UsageInfo {
    if (window.fullyChanneledEyeBeamDuringWindow || window.fullyChanneledAbyssalGazeDuringWindow) {
      return {
        performance: QualitativePerformance.Perfect,
        summary: (
          <div>
            {t({
              id: 'demonhunter.havoc.inertia.eyeBeam.perfect',
              message: 'Fully channeled Eye Beam during Inertia',
            })}
          </div>
        ),
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.inertia.eyeBeam.perfectDetails.p1', message: 'You fully fit ' })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
            {t({ id: 'demonhunter.havoc.inertia.eyeBeam.perfectDetails.p2', message: ' inside ' })}
            <SpellLink spell={SPELLS.INERTIA_BUFF} />
            {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.FURIOUS_GAZE_TALENT) &&
            window.triggeredFuriousGaze ? (
              <>
                {' '}
                {t({ id: 'demonhunter.havoc.inertia.eyeBeam.perfectDetailsFuriousGaze.p1', message: 'and gained ' })}
                <SpellLink spell={SPELLS.FURIOUS_GAZE} />
              </>
            ) : null}
            .
          </div>
        ),
      };
    }

    if (window.startedEyeBeamDuringWindow || window.startedAbyssalGazeDuringWindow) {
      return {
        performance: QualitativePerformance.Ok,
        summary: (
          <div>
            {t({
              id: 'demonhunter.havoc.inertia.eyeBeam.ok',
              message: 'Started Eye Beam during Inertia',
            })}
          </div>
        ),
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.inertia.eyeBeam.okDetails.p1', message: 'You started ' })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
            {t({ id: 'demonhunter.havoc.inertia.eyeBeam.okDetails.p2', message: ' inside the Inertia window, but part of the channel fell outside the buff' })}
            {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.FURIOUS_GAZE_TALENT) &&
            !window.triggeredFuriousGaze ? (
              <>
                {t({ id: 'demonhunter.havoc.inertia.eyeBeam.okDetailsMissedFG.p1', message: ', so you also missed ' })}
                <SpellLink spell={SPELLS.FURIOUS_GAZE} />
              </>
            ) : null}
            .
          </div>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary: (
        <div>
          {t({
            id: 'demonhunter.havoc.inertia.eyeBeam.fail',
            message: 'Cast Eye Beam during the window',
          })}
        </div>
      ),
      details: (
      <div>
        {t({ id: 'demonhunter.havoc.inertia.eyeBeam.failDetails.p1', message: 'This window did not include ' })}
        <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
        {t({ id: 'demonhunter.havoc.inertia.eyeBeam.failDetails.p2', message: '.' })}
      </div>
      ),
    };
  }

  private payloadPerformance(window: InertiaWindow): UsageInfo {
    const summary = (
      <div>
        {t({ id: 'demonhunter.havoc.inertia.payload.title.p1', message: 'Landed ' })}
        <SpellLink spell={SPELLS.DEATH_SWEEP} />
        {t({ id: 'demonhunter.havoc.inertia.payload.title.p2', message: ' inside the window' })}
      </div>
    );

    if (window.deathSweepCasts.length >= 2) {
      return {
        performance: QualitativePerformance.Perfect,
        summary,
        details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.payload.perfect.p1', message: `You landed ${window.deathSweepCasts.length} ` })}
          <SpellLink spell={SPELLS.DEATH_SWEEP} />
          {t({ id: 'demonhunter.havoc.inertia.payload.perfect.p2', message: ' casts during the window.' })}
        </div>
        ),
      };
    }

    if (window.deathSweepCasts.length === 1) {
      return {
        performance: QualitativePerformance.Good,
        summary,
        details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.payload.good.p1', message: 'You landed one ' })}
          <SpellLink spell={SPELLS.DEATH_SWEEP} />
          {t({ id: 'demonhunter.havoc.inertia.payload.good.p2', message: ' during the window, but the ideal burst aims for two when the sequence and haste line up.' })}
        </div>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary,
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.payload.fail.p1', message: 'You did not land ' })}
          <SpellLink spell={SPELLS.DEATH_SWEEP} />
          {t({ id: 'demonhunter.havoc.inertia.payload.fail.p2', message: ' during this Inertia window.' })}
        </div>
      ),
    };
  }

  private spenderPerformance(window: InertiaWindow): UsageInfo {
    if (window.annihilationCasts.length >= 1) {
      return {
        performance: QualitativePerformance.Good,
        summary: (
          <div>
            {t({
              id: 'demonhunter.havoc.inertia.spender.title',
              message: 'Spent with Annihilation',
            })}
          </div>
        ),
        details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.spender.good.p1', message: `You followed the window with ${window.annihilationCasts.length} ` })}
          <SpellLink spell={SPELLS.ANNIHILATION} />
          {t({ id: 'demonhunter.havoc.inertia.spender.good.p2', message: ' cast(s).' })}
        </div>
        ),
      };
    }

    return {
      performance: QualitativePerformance.Fail,
      summary: (
        <div>
          {t({
            id: 'demonhunter.havoc.inertia.spender.title',
            message: 'Spent with Annihilation',
          })}
        </div>
      ),
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.inertia.spender.fail.p1', message: 'Try to fit at least one ' })}
          <SpellLink spell={SPELLS.ANNIHILATION} />
          {t({ id: 'demonhunter.havoc.inertia.spender.fail.p2', message: ' into the window after your ' })}
          <SpellLink spell={SPELLS.DEATH_SWEEP} />
          {t({ id: 'demonhunter.havoc.inertia.spender.fail.p3', message: ' casts.' })}
        </div>
      ),
    };
  }
}
