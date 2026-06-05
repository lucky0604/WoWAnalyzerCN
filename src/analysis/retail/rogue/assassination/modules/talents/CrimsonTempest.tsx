import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Events, { CastEvent, ResourceChangeEvent } from 'parser/core/Events';
import {
  QualitativePerformance,
  getPerformanceExplanation,
} from 'parser/ui/QualitativePerformance';
import { SpellUse, ChecklistUsageInfo } from 'parser/core/SpellUsage/core';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import Enemies from 'parser/shared/modules/Enemies';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { JSX, ReactNode } from 'react';
import { SpellLink } from 'interface';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';

export default class CrimsonTempestUsage extends Analyzer {
  static dependencies = {
    ...Analyzer.dependencies,
    enemies: Enemies,
  };

  protected enemies!: Enemies;
  cooldownUses: SpellUse[] = [];
  private lastCastEvent: CastEvent | undefined;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.CRIMSON_TEMPEST_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.CRIMSON_TEMPEST_TALENT),
      this.onCrimsonTempestCast,
    );
    this.addEventListener(
      Events.resourcechange.by(SELECTED_PLAYER).spell(TALENTS.CRIMSON_TEMPEST_TALENT),
      this.onCrimsonTempestResourceChange,
    );
  }

  private onCrimsonTempestCast(event: CastEvent) {
    this.lastCastEvent = event;
  }

  private onCrimsonTempestResourceChange(event: ResourceChangeEvent) {
    const spreadPerformance = this.determineSpreadPerformance(event);
    const cpPerformance = this.determineResourcePerformance(event);
    const checklistItems = [spreadPerformance, cpPerformance];

    const finalPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );

    this.cooldownUses.push({
      event,
      performance: finalPerformance,
      checklistItems,
      performanceExplanation: getPerformanceExplanation(finalPerformance),
    });
  }

  private determineSpreadPerformance(event: ResourceChangeEvent): ChecklistUsageInfo {
    const allEnemies = Object.values(this.enemies.enemies);
    const hasAnythingToSpread = allEnemies.some(
      (enemy) =>
        enemy.hasBuff(SPELLS.GARROTE, event.timestamp) &&
        enemy.hasBuff(SPELLS.RUPTURE, event.timestamp),
    );

    const performance = hasAnythingToSpread
      ? QualitativePerformance.Good
      : QualitativePerformance.Fail;
    const summary = (
      <div>
        {t({
          id: 'rogue.assassination.crimsontempest.spreadRuptureGarrote',
          message: 'Spread Rupture and Garrote',
        })}
      </div>
    );
    let details: ReactNode;

    if (hasAnythingToSpread) {
      details = (
        <div>
          <Trans id="rogue.assassination.crimsontempest.spreadSuccess">
            You successfully spread <SpellLink spell={SPELLS.GARROTE} /> and{' '}
            <SpellLink spell={SPELLS.RUPTURE} /> to nearby targets.
          </Trans>
        </div>
      );
    } else {
      details = (
        <div>
          <Trans id="rogue.assassination.crimsontempest.spreadFail">
            You cast <SpellLink spell={TALENTS.CRIMSON_TEMPEST_TALENT} /> but no targets had both{' '}
            <SpellLink spell={SPELLS.GARROTE} /> and <SpellLink spell={SPELLS.RUPTURE} /> to spread.
          </Trans>
        </div>
      );
      if (this.lastCastEvent) {
        addInefficientCastReason(this.lastCastEvent, details);
      }
    }

    return {
      check: 'spread',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  private determineResourcePerformance(event: ResourceChangeEvent): ChecklistUsageInfo {
    const totalWasted = event.resourceChange - event.waste === 0;
    const performance = totalWasted ? QualitativePerformance.Fail : QualitativePerformance.Good;
    const summary = (
      <div>
        {t({
          id: 'rogue.assassination.crimsontempest.notWasteComboPoints',
          message: 'Did not waste combo points',
        })}
      </div>
    );
    let details: ReactNode;

    if (totalWasted) {
      details = (
        <div>
          <Trans id="rogue.assassination.crimsontempest.wastedComboPointsDetail">
            This cast generated <strong>0 Combo Points</strong> because you were already capped. Try
            to use <SpellLink spell={TALENTS.CRIMSON_TEMPEST_TALENT} /> only when you have room for
            Combo Points.
          </Trans>
        </div>
      );
      if (this.lastCastEvent) {
        addInefficientCastReason(this.lastCastEvent, details);
      }
    } else {
      details = (
        <div>
          {t({
            id: 'rogue.assassination.crimsontempest.generatedComboPoints',
            message: 'You generated Combo Points with this cast.',
          })}
        </div>
      );
    }

    return {
      check: 'resources',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <div>
        <p>
          <Trans id="rogue.assassination.crimsontempest.explanation">
            <strong>
              <SpellLink spell={TALENTS.CRIMSON_TEMPEST_TALENT} />
            </strong>{' '}
            is now a <strong>builder</strong>. It should spread your{' '}
            <SpellLink spell={SPELLS.GARROTE} /> and <SpellLink spell={SPELLS.RUPTURE} />.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.assassination.crimsontempest.envenomNote">
            Even if you still have targets without <SpellLink spell={SPELLS.GARROTE} /> or{' '}
            <SpellLink spell={SPELLS.RUPTURE} />, you should keep using{' '}
            <SpellLink spell={SPELLS.ENVENOM} /> at 5+ CP.
          </Trans>
        </p>
      </div>
    );

    return (
      <ContextualSpellUsageSubSection
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={
          <Trans id="rogue.assassination.crimsontempest.castBreakdownLegend">
            {' '}
            - These boxes represent each cast, colored by how good the usage was.
          </Trans>
        }
      />
    );
  }
}
