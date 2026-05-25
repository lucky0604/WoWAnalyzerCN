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
import { defineMessage, t } from '@lingui/core/macro';
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
          : QualitativePerformance.Fail;
    const summary = (
      <div>
        <Trans id="guide.augmentation.sandsOfTime.extended">
          Extended with <SpellLink spell={spell} />
        </Trans>
      </div>
    );
    const details =
      extendedDuplicate && extendedEbonMight ? (
        <div>
          <Trans id="guide.augmentation.sandsOfTime.extendedBoth">
            You extended your <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> and{' '}
            <SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} /> by casting{' '}
            <SpellLink spell={spell} />. Great job!
          </Trans>
        </div>
      ) : extendedEbonMight ? (
        <div>
          <Trans id="guide.augmentation.sandsOfTime.extendedEbon">
            You extended your <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> buff by casting{' '}
            <SpellLink spell={spell} />. Good job!
          </Trans>
        </div>
      ) : (
        <div>
          <Trans id="guide.augmentation.sandsOfTime.missed">
            <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> wasn't active. You should always try and
            cast <SpellLink spell={spell} /> inside of your{' '}
            <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> window.
          </Trans>
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
          ? defineMessage({ id: 'guide.augmentation.sandsOfTime.goodUsage', message: 'Good Usage' })
          : defineMessage({ id: 'guide.augmentation.sandsOfTime.badUsage', message: 'Bad Usage' }),
    };
  }

  guideSubsection(): JSX.Element | null {
    if (!this.active) {
      return null;
    }
    const explanation = (
      <section>
        <p>
          <Trans id="guide.augmentation.sandsOfTime.explanation1">
            <strong>
              <SpellLink spell={SPELLS.SANDS_OF_TIME} />
            </strong>{' '}
            extends the duration of your <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{' '}
            {this.selectedCombatant.hasTalent(TALENTS.DUPLICATE_2_AUGMENTATION_TALENT) && (
              <>
                and <SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} />
              </>
            )}{' '}
            when casting <SpellLink spell={SPELLS.FIRE_BREATH} />,{' '}
            <SpellLink spell={SPELLS.UPHEAVAL} />, <SpellLink spell={TALENTS.ERUPTION_TALENT} /> or{' '}
            <SpellLink spell={TALENTS.BREATH_OF_EONS_TALENT} />.
          </Trans>
        </p>
        <p>
          <Trans id="guide.augmentation.sandsOfTime.explanation2">
            You should never cast these spells outside your{' '}
            <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} /> windows.
          </Trans>
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
              <Trans id="guide.augmentation.sandsOfTime.goodCastLabel">Green</Trans>
            </span>{' '}
            <Trans id="guide.augmentation.sandsOfTime.goodCastText">
              is a good cast where you extended your <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{' '}
              window,{' '}
            </Trans>
            <span className="badCast">
              <Trans id="guide.augmentation.sandsOfTime.badCastLabel">red</Trans>
            </span>{' '}
            <Trans id="guide.augmentation.sandsOfTime.badCastText">
              is a bad cast where you didn't extend.
            </Trans>
            {this.selectedCombatant.hasTalent(TALENTS.DUPLICATE_2_AUGMENTATION_TALENT) && (
              <>
                {' '}
                <span className="perfectCast">
                  <Trans id="guide.augmentation.sandsOfTime.perfectCastLabel">Blue</Trans>
                </span>{' '}
                <Trans id="guide.augmentation.sandsOfTime.perfectCastText">
                  is a cast where you extended both <SpellLink spell={TALENTS.EBON_MIGHT_TALENT} />{' '}
                  and <SpellLink spell={TALENTS.DUPLICATE_1_AUGMENTATION_TALENT} />.
                </Trans>
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
