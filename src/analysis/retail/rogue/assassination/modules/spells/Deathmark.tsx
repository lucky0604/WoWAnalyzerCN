import type { JSX, ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import { SpellLink } from 'interface';
import { SpellUse, ChecklistUsageInfo } from 'parser/core/SpellUsage/core';
import { createChecklistItem } from 'parser/core/MajorCooldowns/MajorCooldown';
import {
  QualitativePerformance,
  getPerformanceExplanation,
} from 'parser/ui/QualitativePerformance';
import { HideGoodCastsSpellUsageSubSection } from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import Enemies from 'parser/shared/modules/Enemies';
import { getMatchingDeathmarkOrKingsbaneCast } from 'analysis/retail/rogue/assassination/normalizers/KingsbaneLinkNormalizer';
import {
  getMatchingImprovedGarroteApply,
  getMatchingImprovedGarroteRemove,
} from 'analysis/retail/rogue/assassination/normalizers/DeathmarkImprovedGarroteLinkNormalizer';

export default class Deathmark extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
    enemies: Enemies,
  };

  private cooldownUses: SpellUse[] = [];
  private spellUsable!: SpellUsable;
  private enemies!: Enemies;

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.DEATHMARK_TALENT),
      this.onCast,
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <div>
        <p>
          <>
            <strong>
              <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
            </strong>{' '}
            {t({
              id: 'rogue.assassination.deathmark.explanation.p1',
              message: 'is your major burst cooldown. It should be aligned with ',
            })}
            <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
            {t({
              id: 'rogue.assassination.deathmark.explanation.p2',
              message: ' and, if possible, used while having an ',
            })}
            <SpellLink spell={SPELLS.IMPROVED_GARROTE_BUFF} />
            {t({
              id: 'rogue.assassination.deathmark.explanation.p3',
              message: ' active on your target.',
            })}
          </>
        </p>
        <p>
          <>
            <SpellLink spell={SPELLS.VANISH} />
            {t({
              id: 'rogue.assassination.deathmark.vanishSync.p1',
              message: ' can be used in sync with ',
            })}
            <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
            {t({
              id: 'rogue.assassination.deathmark.vanishSync.p2',
              message: ' to apply ',
            })}
            <SpellLink spell={SPELLS.IMPROVED_GARROTE_BUFF} />
            {t({
              id: 'rogue.assassination.deathmark.vanishSync.p3',
              message: ' and create a bigger damage window.',
            })}
          </>
        </p>
      </div>
    );

    const goodCasts = this.cooldownUses.filter(
      (it) =>
        it.performance === QualitativePerformance.Good ||
        it.performance === QualitativePerformance.Perfect,
    ).length;
    const totalCasts = this.cooldownUses.length;

    return (
      <HideGoodCastsSpellUsageSubSection
        hideGoodCasts={false}
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={
          <Trans id="rogue.assassination.deathmark.castBreakdownLegend">
            {' '}
            - Red indicates a wasted or poorly timed Deathmark.
          </Trans>
        }
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            <CastPerformanceSummary
              spell={TALENTS.DEATHMARK_TALENT}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: t({
            id: 'rogue.assassination.deathmark.noCasts',
            message: 'No Deathmark casts detected! This is a major mistake.',
          }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    const checklistItems: ChecklistUsageInfo[] = [
      this.kingsbaneAlignment(event),
      this.garroteAndVanishCheck(event),
    ].filter((it): it is ChecklistUsageInfo => it !== undefined);

    const performances = checklistItems.map((item) => item.performance);
    const actualPerformance = performances.some((p) => p === QualitativePerformance.Fail)
      ? QualitativePerformance.Fail
      : performances.some((p) => p === QualitativePerformance.Perfect)
        ? QualitativePerformance.Perfect
        : performances.some((p) => p === QualitativePerformance.Good)
          ? QualitativePerformance.Good
          : QualitativePerformance.Ok;

    this.cooldownUses.push({
      event,
      performance: actualPerformance,
      checklistItems,
      performanceExplanation: getPerformanceExplanation(actualPerformance),
    });
  }

  private kingsbaneAlignment(event: CastEvent): ChecklistUsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.KINGSBANE_TALENT)) {
      return undefined;
    }

    const matchingKingsbane = getMatchingDeathmarkOrKingsbaneCast(event);
    const performance = matchingKingsbane
      ? QualitativePerformance.Good
      : QualitativePerformance.Fail;

    return createChecklistItem(
      'deathmark_kingsbane_alignment',
      { event },
      {
        performance,
        summary: (
          <div>
            {t({
              id: 'rogue.assassination.deathmark.kingsbaneAlignment',
              message: 'Kingsbane Alignment',
            })}
          </div>
        ),
        details: (
          <div>
            {matchingKingsbane ? (
              <>
                <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
                {t({
                  id: 'rogue.assassination.deathmark.kingsbaneAligned.text',
                  message: ' was cast during your ',
                })}
                <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
                {t({
                  id: 'rogue.assassination.deathmark.kingsbaneAligned.suffix',
                  message: ' window. Good job!',
                })}
              </>
            ) : (
              <>
                {t({
                  id: 'rogue.assassination.deathmark.KingsbaneNotAligned.p1',
                  message: 'You cast ',
                })}
                <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
                {t({
                  id: 'rogue.assassination.deathmark.KingsbaneNotAligned.p2',
                  message: ' but ',
                })}
                <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
                {t({
                  id: 'rogue.assassination.deathmark.KingsbaneNotAligned.p3',
                  message: ' was not cast. Try to align them together!',
                })}
              </>
            )}
          </div>
        ),
      },
    );
  }

  private garroteAndVanishCheck(event: CastEvent): ChecklistUsageInfo | undefined {
    const linkedGarroteRemove = getMatchingImprovedGarroteRemove(event);
    const linkedGarroteApply = getMatchingImprovedGarroteApply(event);
    // Needs to check if buff was consumed before Deathmark, active at cast, or applied during Deathmark window
    const hadImprovedGarroteActive =
      linkedGarroteRemove !== undefined || linkedGarroteApply !== undefined;

    const isVanishAvailable = this.spellUsable.isAvailable(SPELLS.VANISH.id);

    let performance = QualitativePerformance.Perfect;
    let details: ReactNode;

    if (hadImprovedGarroteActive) {
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.deathmark.garroteActive.p1',
              message: 'You had ',
            })}
            <SpellLink spell={SPELLS.IMPROVED_GARROTE_BUFF} />
            {t({
              id: 'rogue.assassination.deathmark.garroteActive.p2',
              message: ' active. Good job!',
            })}
          </>
        </div>
      );
    } else if (isVanishAvailable) {
      performance = QualitativePerformance.Ok;
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.deathmark.vanishAvailable.p1',
              message: 'You did not have ',
            })}
            <SpellLink spell={SPELLS.IMPROVED_GARROTE_BUFF} />
            {t({
              id: 'rogue.assassination.deathmark.vanishAvailable.p2',
              message: ' active, but ',
            })}
            <SpellLink spell={SPELLS.VANISH} />
            {t({
              id: 'rogue.assassination.deathmark.vanishAvailable.p3',
              message: ' was available. Try to use ',
            })}
            <SpellLink spell={SPELLS.VANISH} />
            {t({
              id: 'rogue.assassination.deathmark.vanishAvailable.p4',
              message: ' to apply an Improved Garrote before ',
            })}
            <SpellLink spell={TALENTS.DEATHMARK_TALENT} />!
          </>
        </div>
      );
    } else {
      performance = QualitativePerformance.Good;
      details = (
        <div>
          <>
            {t({
              id: 'rogue.assassination.deathmark.vanishNotAvailable.p1',
              message: 'You did not have ',
            })}
            <SpellLink spell={SPELLS.IMPROVED_GARROTE_BUFF} />
            {t({
              id: 'rogue.assassination.deathmark.vanishNotAvailable.p2',
              message: ' active and ',
            })}
            <SpellLink spell={SPELLS.VANISH} />
            {t({
              id: 'rogue.assassination.deathmark.vanishNotAvailable.p3',
              message: ' was not available!',
            })}
          </>
        </div>
      );
    }

    return createChecklistItem(
      'deathmark_garrote_vanish',
      { event },
      {
        performance,
        summary: (
          <div>
            {t({
              id: 'rogue.assassination.deathmark.garroteVanishAvailability',
              message: 'Improved Garrote & Vanish availability',
            })}
          </div>
        ),
        details,
      },
    );
  }
}
