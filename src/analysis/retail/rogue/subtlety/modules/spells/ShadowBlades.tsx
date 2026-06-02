import type { JSX } from 'react';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, GetRelatedEvents } from 'parser/core/Events';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import { SpellLink } from 'interface';
import { SpellUse, ChecklistUsageInfo } from 'parser/core/SpellUsage/core';
import { createChecklistItem, createSpellUse } from 'parser/core/MajorCooldowns/MajorCooldown';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import SpellUsageSubSection, {
  logSpellUseEvent,
} from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import ComboPointTracker from 'analysis/retail/rogue/shared/ComboPointTracker';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import { CustomType } from 'analysis/retail/rogue/subtlety/normalizers/CustomType';
import { Trans } from '@lingui/react/macro';

export default class ShadowBlades extends Analyzer {
  static dependencies = {
    comboPointTracker: ComboPointTracker,
    spellUsable: SpellUsable,
  };

  private cooldownUses: SpellUse[] = [];
  private comboPointTracker!: ComboPointTracker;
  private spellUsable!: SpellUsable;

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.SHADOW_BLADES_TALENT),
      this.onCast,
    );
  }

  get guideSubsection(): JSX.Element {
    const shadowDance = <SpellLink spell={SPELLS.SHADOW_DANCE} />;
    const secretTechniques = <SpellLink spell={SPELLS.SECRET_TECHNIQUE} />;
    const shadowBlades = <SpellLink spell={TALENTS.SHADOW_BLADES_TALENT} />;

    const explanation = (
      <>
        <p>
          <Trans id="rogue.subtlety.shadowBlades.explanation.main">
            <strong>{shadowBlades}</strong> is the most important Subtlety Rogue cooldown. It should
            be used strategically with {secretTechniques} and {shadowDance}.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.subtlety.shadowBlades.explanation.danceCasts">
            You should aim to fit 2 {shadowDance} casts during {shadowBlades} buff duration. For
            this reason, the second {shadowDance} will be without {secretTechniques} available.
          </Trans>
        </p>
      </>
    );

    const goodCasts = this.cooldownUses.filter(
      (it) =>
        it.performance === QualitativePerformance.Ok ||
        it.performance === QualitativePerformance.Perfect,
    ).length;
    const totalCasts = this.cooldownUses.length;

    return (
      <SpellUsageSubSection
        explanation={explanation}
        wideExplanation={true}
        uses={this.cooldownUses}
        castBreakdownSmallText={
          <>
            {' '}
            -{' '}
            <Trans id="rogue.subtlety.shadowBlades.redIndicator">
              Red indicates a wasted Shadow Blades.
            </Trans>
          </>
        }
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            <CastPerformanceSummary
              spell={TALENTS.SHADOW_BLADES_TALENT}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: '',
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    const hasShadowDanceBuff = this.selectedCombatant.hasBuff(SPELLS.SHADOW_DANCE_BUFF.id);
    const hasSecTecAvailable = this.spellUsable.isAvailable(SPELLS.SECRET_TECHNIQUE.id);
    const hasShadowDanceAvailable = this.spellUsable.isAvailable(SPELLS.SHADOW_DANCE.id);

    const shadowDanceCasts = GetRelatedEvents(event, CustomType.SHADOW_DANCE_CASTS);
    const numberOfCasts = shadowDanceCasts.reduce((sum, cast) => sum + 1, 0);
    this.cooldownUses.push(
      createSpellUse({ event }, [
        this.shadowDanceCheck(event, hasShadowDanceBuff, hasShadowDanceAvailable),
        this.secTecCheck(event, hasSecTecAvailable),
        this.shadowDanceCastsCheck(event, numberOfCasts),
      ]),
    );
  }

  private shadowDanceCastsCheck(
    event: CastEvent,
    shadowDanceCasts: number,
  ): ChecklistUsageInfo | undefined {
    const performance =
      shadowDanceCasts === 2 ? QualitativePerformance.Perfect : QualitativePerformance.Fail;

    return createChecklistItem(
      'shadow_dance_casts',
      { event },
      {
        performance,
        summary: (
          <div>
            <Trans id="rogue.subtlety.shadowBlades.check.shadowDanceCasts">
              Shadow Dance Casts
            </Trans>
          </div>
        ),
        details: (
          <div>
            {shadowDanceCasts === 2 ? (
              <Trans id="rogue.subtlety.shadowBlades.check.danceUsedTwice">
                <SpellLink spell={SPELLS.SHADOW_DANCE} /> was used twice.
              </Trans>
            ) : (
              <Trans id="rogue.subtlety.shadowBlades.check.danceNotUsedTwice">
                <SpellLink spell={SPELLS.SHADOW_DANCE} /> was not used twice.
              </Trans>
            )}
          </div>
        ),
      },
    );
  }

  private secTecCheck(
    event: CastEvent,
    hasSecTecAvailable: boolean,
  ): ChecklistUsageInfo | undefined {
    const performance = hasSecTecAvailable
      ? QualitativePerformance.Perfect
      : QualitativePerformance.Fail;

    return createChecklistItem(
      'sec_tec_alignment',
      { event },
      {
        performance,
        summary: (
          <div>
            <Trans id="rogue.subtlety.shadowBlades.check.secTecAlignment">
              Secret Technique Alignment
            </Trans>
          </div>
        ),
        details: (
          <div>
            {hasSecTecAvailable ? (
              <Trans id="rogue.subtlety.shadowBlades.check.secTecAvailable">
                <SpellLink spell={SPELLS.SECRET_TECHNIQUE} /> was available.
              </Trans>
            ) : (
              <Trans id="rogue.subtlety.shadowBlades.check.secTecNotAvailable">
                <SpellLink spell={SPELLS.SECRET_TECHNIQUE} /> was not available.
              </Trans>
            )}
          </div>
        ),
      },
    );
  }

  private shadowDanceCheck(
    event: CastEvent,
    hasShadowDanceBuff: boolean,
    hasShadowDanceAvailable: boolean,
  ): ChecklistUsageInfo | undefined {
    const performance =
      hasShadowDanceBuff || hasShadowDanceAvailable
        ? QualitativePerformance.Perfect
        : QualitativePerformance.Fail;

    return createChecklistItem(
      'shadow_dance_alignment',
      { event },
      {
        performance,
        summary: (
          <div>
            <Trans id="rogue.subtlety.shadowBlades.check.shadowDanceAlignment">
              Shadow Dance Alignment
            </Trans>
          </div>
        ),
        details: (
          <div>
            {hasShadowDanceBuff || hasShadowDanceAvailable ? (
              <Trans id="rogue.subtlety.shadowBlades.check.dancePresent">
                <SpellLink spell={SPELLS.SHADOW_DANCE} /> buff was present or available.
              </Trans>
            ) : (
              <Trans id="rogue.subtlety.shadowBlades.check.danceNotPresent">
                <SpellLink spell={SPELLS.SHADOW_DANCE} /> buff was not present and not available.
              </Trans>
            )}
          </div>
        ),
      },
    );
  }
}
