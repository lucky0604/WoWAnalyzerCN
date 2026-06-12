import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Events, { CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import { getVanishCast } from 'analysis/retail/rogue/assassination/normalizers/MutilateVanishLinkNormalizer';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import { createChecklistItem, createSpellUse } from 'parser/core/MajorCooldowns/MajorCooldown';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import SpellLink from 'interface/SpellLink';
import { HideGoodCastsSpellUsageSubSection } from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';

export default class Mutilate extends Analyzer {
  private cooldownUses: SpellUse[] = [];

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.MUTILATE), this.onCast);
  }

  get guideSubsection() {
    const explanation = (
      <p>
        <>
          {t({
            id: 'rogue.assassination.mutilate.explanation.p1',
            message: "Assassination's primary non-stealth single target builder is ",
          })}
          <strong>
            <SpellLink spell={SPELLS.MUTILATE} />
          </strong>
          {t({
            id: 'rogue.assassination.mutilate.explanation.p2',
            message: '. You should never use ',
          })}
          <SpellLink spell={SPELLS.MUTILATE} />
          {t({
            id: 'rogue.assassination.mutilate.explanation.p3',
            message: ' during ',
          })}
          <SpellLink spell={SPELLS.SUBTERFUGE_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.explanation.p4',
            message: ' or ',
          })}
          <SpellLink spell={SPELLS.VANISH_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.explanation.p5',
            message: ', and should be casting ',
          })}
          <SpellLink spell={SPELLS.AMBUSH} />
          {t({
            id: 'rogue.assassination.mutilate.explanation.p6',
            message: ' instead.',
          })}
        </>
      </p>
    );

    const goodCasts = this.cooldownUses.filter(
      (it) => it.performance === QualitativePerformance.Good,
    ).length;
    const totalCasts = this.cooldownUses.length;

    return (
      <HideGoodCastsSpellUsageSubSection
        hideGoodCasts
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={
          <Trans id="rogue.assassination.mutilate.castBreakdownLegend">
            {' '}
            - Red is a bad cast.
          </Trans>
        }
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            <CastPerformanceSummary
              spell={SPELLS.MUTILATE}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: t({
            id: 'rogue.assassination.mutilate.allGood',
            message: 'All of your casts of this spell were good!',
          }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    this.cooldownUses.push(
      createSpellUse({ event }, [this.subterfugePerformance(event), this.vanishPerformance(event)]),
    );
  }

  private subterfugePerformance(event: CastEvent): ChecklistUsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.SUBTERFUGE_TALENT)) {
      return undefined;
    }
    const isBuffActive = this.selectedCombatant.hasBuff(SPELLS.SUBTERFUGE_BUFF.id, event.timestamp);
    const summary = (
      <div>
        {t({
          id: 'rogue.assassination.mutilate.noSubterfuge',
          message: 'Do not have Subterfuge active',
        })}
      </div>
    );
    const details = isBuffActive ? (
      <div>
        <>
          {t({
            id: 'rogue.assassination.mutilate.subterfugeActiveDetail.p1',
            message: 'You cast ',
          })}
          <SpellLink spell={SPELLS.MUTILATE} />
          {t({
            id: 'rogue.assassination.mutilate.subterfugeActiveDetail.p2',
            message: ' when you should have cast a stealth spell due to having ',
          })}
          <SpellLink spell={SPELLS.SUBTERFUGE_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.subterfugeActiveDetail.p3',
            message: ' active.',
          })}
        </>
      </div>
    ) : (
      <div>
        <>
          {t({
            id: 'rogue.assassination.mutilate.subterfugeNotActiveDetail.p1',
            message: 'You did not have ',
          })}
          <SpellLink spell={SPELLS.SUBTERFUGE_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.subterfugeNotActiveDetail.p2',
            message: ' active. Good job!',
          })}
        </>
      </div>
    );
    return createChecklistItem(
      'subterfuge',
      { event },
      {
        performance: isBuffActive ? QualitativePerformance.Fail : QualitativePerformance.Good,
        summary,
        details,
      },
    );
  }

  private vanishPerformance(event: CastEvent): ChecklistUsageInfo | undefined {
    const isBuffActive = getVanishCast(event);
    const summary = (
      <div>
        {t({
          id: 'rogue.assassination.mutilate.noVanish',
          message: 'Do not have Vanish active',
        })}
      </div>
    );
    const details = isBuffActive ? (
      <div>
        <>
          {t({
            id: 'rogue.assassination.mutilate.vanishActiveDetail.p1',
            message: 'You cast ',
          })}
          <SpellLink spell={SPELLS.MUTILATE} />
          {t({
            id: 'rogue.assassination.mutilate.vanishActiveDetail.p2',
            message: ' when you should have cast a stealth spell due to having ',
          })}
          <SpellLink spell={SPELLS.VANISH_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.vanishActiveDetail.p3',
            message: ' active.',
          })}
        </>
      </div>
    ) : (
      <div>
        <>
          {t({
            id: 'rogue.assassination.mutilate.VanishNotActiveDetail.p1',
            message: 'You did not have ',
          })}
          <SpellLink spell={SPELLS.VANISH_BUFF} />
          {t({
            id: 'rogue.assassination.mutilate.VanishNotActiveDetail.p2',
            message: ' active. Good job!',
          })}
        </>
      </div>
    );
    return createChecklistItem(
      'vanish',
      { event },
      {
        performance: isBuffActive ? QualitativePerformance.Fail : QualitativePerformance.Good,
        summary,
        details,
      },
    );
  }
}
