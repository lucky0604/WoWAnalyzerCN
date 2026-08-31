import type { JSX } from 'react';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';

import SPELLS from 'common/SPELLS/evoker';
import TALENTS from 'common/TALENTS/evoker';

import Events, { CastEvent, EmpowerEndEvent } from 'parser/core/Events';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { SpellLink } from 'interface';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  failedEbonMightExtension,
  failedDuplicateExtension,
} from '../normalizers/CastLinkNormalizer';
import '../Styling.scss';
import { BREATH_OF_EONS_SPELLS } from '../../constants';

/**
 * Sands of time is an innate ability for Augmentation.
 * Whenever you cast Eruption, Empowers or Breath of Eons, you
 * extend the duration of your Ebon Mights by, 1s, 2s or 5s, respectively.
 * This effect can also crit increases the extended amount by 50%.
 * This modules will simply compare the casts aforementioned spells, and if the
 * casts were outside of your Ebon Might windows, they are considered bad casts.
 */

interface PossibleExtends {
  event: CastEvent | EmpowerEndEvent;
  extendedEbonMight: boolean;
  extendedDuplicate: boolean;
  allowFailedExtend: boolean;
}

class SandsOfTime extends Analyzer {
  private uses: SpellUse[] = [];
  private extendAttempts: PossibleExtends[] = [];

  ebonMightActive = false;
  trackedSpells = [
    TALENTS.ERUPTION_TALENT,
    ...BREATH_OF_EONS_SPELLS,
    SPELLS.BREATH_OF_EONS_SCALECOMMANDER,
  ];
  empowers = [SPELLS.FIRE_BREATH, SPELLS.FIRE_BREATH_FONT, SPELLS.UPHEAVAL, SPELLS.UPHEAVAL_FONT];
  canExtendDuplicate = this.selectedCombatant.hasTalent(TALENTS.DUPLICATE_2_AUGMENTATION_TALENT);
  duplicateActive = false;
  hasDoubleTime = this.selectedCombatant.hasTalent(TALENTS.DOUBLE_TIME_TALENT);
  constructor(options: Options) {
    super(options);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.EBON_MIGHT_BUFF_PERSONAL),
      () => {
        this.ebonMightActive = true;
      },
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.EBON_MIGHT_BUFF_PERSONAL),
      () => {
        this.ebonMightActive = false;
      },
    );
    if (this.canExtendDuplicate) {
      // Currently, Duplicate is bugged to always give the self buff, even if not talented.
      // If this is fixed, this check will need to be changed.
      this.addEventListener(
        Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.DUPLICATE_SELF_BUFF),
        () => {
          this.duplicateActive = true;
        },
      );
      this.addEventListener(
        Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.DUPLICATE_SELF_BUFF),
        () => {
          this.duplicateActive = false;
        },
      );
    }
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(this.trackedSpells), this.onCast);
    this.addEventListener(Events.empowerEnd.by(SELECTED_PLAYER).spell(this.empowers), this.onCast);

    this.addEventListener(Events.fightend, this.finalize);
  }

  private onCast(event: CastEvent | EmpowerEndEvent) {
    const extendAttempts: PossibleExtends = {
      event: event,
      extendedEbonMight: Boolean(this.ebonMightActive),
      extendedDuplicate: Boolean(this.duplicateActive && this.canExtendDuplicate),
      // For some reason, attempting to get Double Time info in finalize() throws an error, so this is done here instead.
      allowFailedExtend:
        event.ability.guid === TALENTS.BREATH_OF_EONS_TALENT.id && this.hasDoubleTime,
    };

    this.extendAttempts.push(extendAttempts);
  }

  private finalize() {
    // finalize performances
    this.uses = this.extendAttempts.map(this.sandOfTimeUsage);
  }

  private sandOfTimeUsage(possibleExtends: PossibleExtends): SpellUse {
    let extendedEbonMight = possibleExtends.extendedEbonMight;
    let extendedDuplicate = possibleExtends.extendedDuplicate;
    const allowFailedExtend = possibleExtends.allowFailedExtend;
    if (failedEbonMightExtension(possibleExtends.event)) {
      extendedEbonMight = false;
    }
    if (failedDuplicateExtension(possibleExtends.event)) {
      extendedDuplicate = false;
    }
    const spell = possibleExtends.event.ability.guid;
    const performance =
      extendedDuplicate && extendedEbonMight
        ? QualitativePerformance.Perfect
        : extendedEbonMight
          ? QualitativePerformance.Good
          : allowFailedExtend
            ? QualitativePerformance.Ok
            : QualitativePerformance.Fail;
    const summary = (
      <div>
        <>{t({id:'guide.augmentation.sandsOfTime.extended.p1',message:'Extended with '})}<SpellLink spell={spell} /></>
      </div>
    );
    const details =
      extendedDuplicate && extendedEbonMight ? (
        <div>
          <>{t({id:'guide.augmentation.sandsOfTime.extendedBoth.p1',message:'You extended your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.extendedBoth.p2',message:' and '})}<SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} />{t({id:'guide.augmentation.sandsOfTime.extendedBoth.p3',message:' by casting '})}<SpellLink spell={spell} />{t({id:'guide.augmentation.sandsOfTime.extendedBoth.p4',message:'. Great job!'})}</>
        </div>
      ) : extendedEbonMight ? (
        <div>
          <>{t({id:'guide.augmentation.sandsOfTime.extendedEbon.p1',message:'You extended your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.extendedEbon.p2',message:' buff by casting '})}<SpellLink spell={spell} />{t({id:'guide.augmentation.sandsOfTime.extendedEbon.p3',message:'. Good job!'})}</>
        </div>
      ) : allowFailedExtend ? (
        <div>
          <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> wasn't active, but this is acceptable when
          using <SpellLink spell={spell} /> to try and proc{' '}
          <SpellLink spell={TALENTS.DOUBLE_TIME_TALENT} />.
        </div>
      ) : (
        <div>
          <><SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.missed.p1',message:" wasn't active. You should always try and cast "})}<SpellLink spell={spell} />{t({id:'guide.augmentation.sandsOfTime.missed.p2',message:' inside of your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.missed.p3',message:' window.'})}</>
        </div>
      );

    const checklistItems: ChecklistUsageInfo[] = [
      {
        check: 'possible-extends',
        timestamp: possibleExtends.event.timestamp,
        performance,
        summary,
        details,
      },
    ];
    const actualPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );

    return {
      event: possibleExtends.event,
      performance: actualPerformance,
      checklistItems,
      performanceExplanation:
        actualPerformance !== QualitativePerformance.Fail
          ? t({ id: 'guide.augmentation.sandsOfTime.goodUsage', message: 'Good Usage' })
          : t({ id: 'guide.augmentation.sandsOfTime.badUsage', message: 'Bad Usage' }),
    };
  }

  guideSubsection(): JSX.Element | null {
    if (!this.active) {
      return null;
    }
    const explanation = (
      <section>
        <p>
          <><strong>
              <SpellLink spell={SPELLS.SANDS_OF_TIME} />
            </strong>{t({id:'guide.augmentation.sandsOfTime.explanation1.p1',message:' extends the duration of your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.explanation1.p2',message:' '})}{this.selectedCombatant.hasTalent(TALENTS.DUPLICATE_2_AUGMENTATION_TALENT) && (
              <>{t({id:'guide.augmentation.sandsOfTime.explanation1.and',message:'and '})}<SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} /></>
            )}{t({id:'guide.augmentation.sandsOfTime.explanation1.p3',message:' when casting '})}<SpellLink spell={SPELLS.FIRE_BREATH} />{t({id:'guide.augmentation.sandsOfTime.explanation1.p4',message:', '})}<SpellLink spell={SPELLS.UPHEAVAL} />{t({id:'guide.augmentation.sandsOfTime.explanation1.p5',message:', '})}<SpellLink spell={TALENTS.ERUPTION_TALENT} />{t({id:'guide.augmentation.sandsOfTime.explanation1.p6',message:' or '})}<SpellLink spell={TALENTS.BREATH_OF_EONS_TALENT} />{t({id:'guide.augmentation.sandsOfTime.explanation1.p7',message:'.'})}</>
        </p>
        <p>
          <>{t({id:'guide.augmentation.sandsOfTime.explanation2.p1',message:'You should never cast these spells outside your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.explanation2.p2',message:' windows.'})}</>
        </p>
      </section>
    );
    return (
      <ContextualSpellUsageSubSection
        title={t({ id: 'guide.augmentation.sandsOfTime.title', message: 'Sands of Time' })}
        explanation={explanation}
        uses={this.uses}
        castBreakdownSmallText={
          <>
            {' '}
            -{' '}
            <span className="goodCast">
              {t({ id: 'guide.augmentation.sandsOfTime.goodCastLabel', message: 'Green' })}
            </span>{' '}
            <>{t({id:'guide.augmentation.sandsOfTime.goodCastText.p1',message:'is a good cast where you extended your '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.goodCastText.p2',message:' window, '})}</>
            <span className="badCast">
              {t({ id: 'guide.augmentation.sandsOfTime.badCastLabel', message: 'red' })}
            </span>{' '}
            <Trans id="guide.augmentation.sandsOfTime.badCastText">
              is a bad cast where you didn't extend.
            </Trans>
            {this.selectedCombatant.hasTalent(TALENTS.DUPLICATE_2_AUGMENTATION_TALENT) && (
              <>
                {' '}
                <span className="perfectCast">
                  {t({ id: 'guide.augmentation.sandsOfTime.perfectCastLabel', message: 'Blue' })}
                </span>{' '}
                <>{t({id:'guide.augmentation.sandsOfTime.perfectCastText.p1',message:'is a cast where you extended both '})}<SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{t({id:'guide.augmentation.sandsOfTime.perfectCastText.p2',message:' and '})}<SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} />{t({id:'guide.augmentation.sandsOfTime.perfectCastText.p3',message:'.'})}</>
              </>
            )}
          </>
        }
        abovePerformanceDetails={<div style={{ marginBottom: 10 }}></div>}
      />
    );
  }
}

export default SandsOfTime;
