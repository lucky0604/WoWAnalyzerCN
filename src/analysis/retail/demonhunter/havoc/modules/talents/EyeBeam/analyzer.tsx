import { t } from '@lingui/core/macro';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import SPELLS from 'common/SPELLS/demonhunter';
import TALENTS from 'common/TALENTS/demonhunter';
import Events, { CastEvent } from 'parser/core/Events';
import { ChecklistUsageInfo, SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import MajorCooldown, { CooldownTrigger } from 'parser/core/MajorCooldowns/MajorCooldown';
import { SpellLink } from 'interface';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';

import DemonicExplanation from './DemonicExplanation';
import { getFuriousGazeBuffApplication } from '../../../normalizers/FuriousGazeNormalizer';
import FuriousGazeExplanation from '../../../modules/talents/EyeBeam/FuriousGazeExplanation';

interface EyeBeamCooldownCast extends CooldownTrigger<CastEvent> {
  triggeredFuriousGaze: boolean;
  startedDuringInertia: boolean;
  fullyDuringInertia: boolean;
}

export default class EyeBeam extends MajorCooldown<EyeBeamCooldownCast> {
  static dependencies = {
    ...MajorCooldown.dependencies,
  };

  constructor(options: Options) {
    super({ spell: TALENTS.EYE_BEAM_TALENT }, options);

    const hasRelevantTalents =
      this.selectedCombatant.hasTalent(TALENTS.FURIOUS_GAZE_TALENT) ||
      this.selectedCombatant.hasTalent(TALENTS.INERTIA_TALENT);

    this.active = hasRelevantTalents;

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.EYE_BEAM_TALENT),
      this.onCast,
    );
  }

  description() {
    return (
      <>
        <section style={{ marginBottom: 20 }}>
          <strong><SpellLink spell={TALENTS.EYE_BEAM_TALENT} /></strong> {' '} {t({ id: 'demonhunter.havoc.eyeBeam.description.p1', message: ' is a channeled ability that deals heavy chaos damage to all enemies in front of you.' })}
          {this.selectedCombatant.hasTalent(TALENTS.INERTIA_TALENT) && (
            <>
              {' '}
              {t({ id: 'demonhunter.havoc.eyeBeam.inertia.description.p1', message: 'For optimal usage with ' })} <SpellLink spell={TALENTS.INERTIA_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.inertia.description.p2', message: ', the full channel should fit inside the ' })} <SpellLink spell={SPELLS.INERTIA_BUFF} /> {t({ id: 'demonhunter.havoc.eyeBeam.inertia.description.p3', message: ' buff window.' })}
            </>
          )}
        </section>
        <section>
          <DemonicExplanation />
          <FuriousGazeExplanation />
        </section>
      </>
    );
  }

  explainPerformance(cast: EyeBeamCooldownCast): SpellUse {
    const furiousGazePerformance = this.furiousGazePerformance(cast);
    const inertiaPerformance = this.inertiaPerformance(cast);
    const checklistItems: ChecklistUsageInfo[] = [];
    if (furiousGazePerformance) {
      checklistItems.push({
        check: 'furious-gaze',
        timestamp: cast.event.timestamp,
        ...furiousGazePerformance,
      });
    }
    if (inertiaPerformance) {
      checklistItems.push({
        check: 'inertia',
        timestamp: cast.event.timestamp,
        ...inertiaPerformance,
      });
    }
    const actualPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );
    return {
      event: cast.event,
      performance: actualPerformance,
      checklistItems,
      performanceExplanation:
        actualPerformance !== QualitativePerformance.Fail
          ? `${actualPerformance} Usage`
          : 'Bad Usage',
    };
  }

  private furiousGazePerformance(cast: EyeBeamCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.FURIOUS_GAZE_TALENT)) {
      return undefined;
    }

    const summary = (
      <div>
        {t({
          id: 'demonhunter.havoc.eyeBeam.triggerFuriousGaze',
          message: 'Trigger Furious Gaze',
        })}
      </div>
    );

    if (cast.triggeredFuriousGaze) {
      return {
        performance: QualitativePerformance.Good,
        summary,
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.eyeBeam.goodFuriousGaze.p1', message: 'You triggered ' })} <SpellLink spell={SPELLS.FURIOUS_GAZE} /> {t({ id: 'demonhunter.havoc.eyeBeam.goodFuriousGaze.p2', message: ' by fully channeling your' })} {' '} {t({ id: 'demonhunter.havoc.eyeBeam.goodFuriousGaze.p3', message: ' ' })} <SpellLink spell={TALENTS.EYE_BEAM_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.goodFuriousGaze.p4', message: ' cast. Good job!' })}
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary,
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.eyeBeam.badFuriousGaze.p1', message: 'You did not trigger ' })} <SpellLink spell={SPELLS.FURIOUS_GAZE} /> {t({ id: 'demonhunter.havoc.eyeBeam.badFuriousGaze.p2', message: ' due to not fully channeling your ' })} <SpellLink spell={TALENTS.EYE_BEAM_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.badFuriousGaze.p3', message: ' cast. Always try to fully channel so that you get the Haste buff.' })}
        </div>
      ),
    };
  }

  private inertiaPerformance(cast: EyeBeamCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.INERTIA_TALENT)) {
      return undefined;
    }
    if (cast.fullyDuringInertia) {
      return {
        performance: QualitativePerformance.Good,
        summary: (
          <div>
            {t({
              id: 'demonhunter.havoc.eyeBeam.fullyDuringInertia',
              message: 'Fully channeled during Inertia',
            })}
          </div>
        ),
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.eyeBeam.goodInertia.p1', message: 'You fully channeled ' })} <SpellLink spell={TALENTS.EYE_BEAM_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.goodInertia.p2', message: ' during' })} {' '} {t({ id: 'demonhunter.havoc.eyeBeam.goodInertia.p3', message: ' ' })} <SpellLink spell={SPELLS.INERTIA_BUFF} /> {t({ id: 'demonhunter.havoc.eyeBeam.goodInertia.p4', message: '. Good job!' })}
          </div>
        ),
      };
    }
    if (cast.startedDuringInertia) {
      return {
        performance: QualitativePerformance.Ok,
        summary: (
          <div>
            {t({
              id: 'demonhunter.havoc.eyeBeam.startedDuringInertia',
              message: 'Started during Inertia',
            })}
          </div>
        ),
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.eyeBeam.okInertia.p1', message: 'You started ' })} <SpellLink spell={TALENTS.EYE_BEAM_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.okInertia.p2', message: ' during' })} {' '} {t({ id: 'demonhunter.havoc.eyeBeam.okInertia.p3', message: ' ' })} <SpellLink spell={SPELLS.INERTIA_BUFF} /> {t({ id: 'demonhunter.havoc.eyeBeam.okInertia.p4', message: ', but the full channel did not fit inside the buff window.' })}
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary: (
        <div>
          {t({
            id: 'demonhunter.havoc.eyeBeam.outsideInertia',
            message: 'Cast outside Inertia',
          })}
        </div>
      ),
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.eyeBeam.badInertia.p1', message: 'You cast ' })} <SpellLink spell={TALENTS.EYE_BEAM_TALENT} /> {t({ id: 'demonhunter.havoc.eyeBeam.badInertia.p2', message: ' without' })} {' '} {t({ id: 'demonhunter.havoc.eyeBeam.badInertia.p3', message: ' ' })} <SpellLink spell={SPELLS.INERTIA_BUFF} /> {t({ id: 'demonhunter.havoc.eyeBeam.badInertia.p4', message: ' covering the full channel. Try to line up the entire channel inside the buff window.' })}
        </div>
      ),
    };
  }

  private getInertiaWindow(event: CastEvent) {
    const activeInertiaBuff = this.selectedCombatant.getBuff(
      SPELLS.INERTIA_BUFF.id,
      event.timestamp,
    );
    if (!activeInertiaBuff) {
      return {
        startedDuringInertia: false,
        fullyDuringInertia: false,
      };
    }
    const channelEnd = event.channel?.timestamp;
    if (!channelEnd) {
      return {
        startedDuringInertia: true,
        fullyDuringInertia: false,
      };
    }
    const inertiaEnd = activeInertiaBuff.end ?? Number.POSITIVE_INFINITY;
    return {
      startedDuringInertia: true,
      fullyDuringInertia: inertiaEnd >= channelEnd,
    };
  }

  private onCast(event: CastEvent) {
    const inertiaWindow = this.getInertiaWindow(event);

    this.recordCooldown({
      event,
      triggeredFuriousGaze: getFuriousGazeBuffApplication(event) !== undefined,
      startedDuringInertia: inertiaWindow.startedDuringInertia,
      fullyDuringInertia: inertiaWindow.fullyDuringInertia,
    });
  }
}
