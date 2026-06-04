import type { JSX } from 'react';
import TALENTS from 'common/TALENTS/priest';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { getPrayerOfHealingEvents } from '../../normalizers/CastLinkNormalizer';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { defineMessage, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import styles from '../Styling.module.scss';

class PrayerOfHealing extends Analyzer {
  prayerOfHealingCasts = 0;
  prayerOfHealingHealing = 0;
  prayerOfHealingOverhealing = 0;
  prayerOfHealingTargetsHit = 0;

  spellUses: SpellUse[] = [];

  hasLightweaverTalent: boolean;
  hasSurgeTalent: boolean;
  hasSpiritwellTalent: boolean;
  hasDivinityTalent: boolean;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.PRAYER_OF_HEALING_TALENT);
    this.hasLightweaverTalent = this.selectedCombatant.hasTalent(TALENTS.LIGHTWEAVER_TALENT);
    this.hasSurgeTalent = this.selectedCombatant.hasTalent(TALENTS.SURGE_OF_LIGHT_TALENT);
    this.hasSpiritwellTalent = this.selectedCombatant.hasTalent(TALENTS.SPIRITWELL_TALENT);
    this.hasDivinityTalent = this.selectedCombatant.hasTalent(TALENTS.DIVINITY_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.PRAYER_OF_HEALING_TALENT),
      this.onPohCast,
    );
  }

  get overHealPercent() {
    return this.prayerOfHealingOverhealing / this.rawHealing;
  }

  get rawHealing() {
    return this.prayerOfHealingHealing + this.prayerOfHealingOverhealing;
  }

  get averageTargetsHit() {
    return this.prayerOfHealingTargetsHit / this.prayerOfHealingCasts;
  }

  onPohCast(event: CastEvent) {
    const healEvents = getPrayerOfHealingEvents(event);
    if (healEvents.length > 0) {
      this.prayerOfHealingCasts += 1;
    }

    const hasLightweaver = this.hasLightweaverTalent
      ? this.selectedCombatant.hasBuff(SPELLS.LIGHTWEAVER_TALENT_BUFF.id)
      : false;
    const surgeEnabled = this.hasSurgeTalent && this.hasSpiritwellTalent;
    const hasSurgeBuff = surgeEnabled
      ? this.selectedCombatant.hasBuff(SPELLS.SURGE_OF_LIGHT_BUFF.id)
      : false;
    const hasDivinityBuff = this.hasDivinityTalent
      ? this.selectedCombatant.hasBuff(SPELLS.DIVINITY_BUFF.id)
      : false;

    let overallPerformance: QualitativePerformance;
    const checklistItems: ChecklistUsageInfo[] = [];

    if (this.hasLightweaverTalent) {
      if (hasLightweaver) {
        if (hasSurgeBuff) {
          overallPerformance = QualitativePerformance.Perfect;
        } else {
          overallPerformance = QualitativePerformance.Good;
        }
      } else {
        const anyBuffActive = hasSurgeBuff || hasDivinityBuff;
        if (anyBuffActive) {
          overallPerformance = QualitativePerformance.Ok;
        } else {
          overallPerformance = QualitativePerformance.Fail;
        }
      }

      const lightweaverItem = this.getLightweaverChecklistItem(event, hasLightweaver, hasSurgeBuff);
      checklistItems.push(lightweaverItem);

      if (surgeEnabled) {
        const surgeItem = this.getSurgeChecklistItem(event, hasLightweaver, hasSurgeBuff);
        checklistItems.push(surgeItem);
      }

      if (hasDivinityBuff) {
        const divinityItem = this.getDivinityChecklistItem(
          event,
          hasDivinityBuff,
          overallPerformance === QualitativePerformance.Perfect,
        );
        checklistItems.push(divinityItem);
      }
    } else {
      if (surgeEnabled || this.hasDivinityTalent) {
        const anyBuffActive = hasSurgeBuff || hasDivinityBuff;
        if (anyBuffActive) {
          overallPerformance =
            hasSurgeBuff && hasDivinityBuff
              ? QualitativePerformance.Good
              : QualitativePerformance.Ok;
        } else {
          overallPerformance = QualitativePerformance.Fail;
        }

        if (surgeEnabled) {
          const surgeItem = this.getSurgeOnlyChecklistItem(event, hasSurgeBuff);
          checklistItems.push(surgeItem);
        }
      } else {
        overallPerformance = QualitativePerformance.Ok;
      }
    }

    const spellUse: SpellUse = {
      event,
      performance: overallPerformance,
      checklistItems,
      performanceExplanation:
        overallPerformance === QualitativePerformance.Fail
          ? defineMessage({ id: 'priest.holy.prayerOfHealing.badUsage', message: 'Bad Usage' })
          : `${overallPerformance} ` +
            defineMessage({ id: 'priest.holy.usageSuffix', message: 'Usage' }),
    };

    this.spellUses.push(spellUse);
  }

  private getLightweaverChecklistItem(
    event: CastEvent,
    hasLightweaver: boolean,
    hasSurgeBuff: boolean,
  ): ChecklistUsageInfo {
    const summary = (
      <div>
        <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} /> buff applied
      </div>
    );

    let performance: QualitativePerformance;
    let details: JSX.Element;

    if (hasLightweaver) {
      if (hasSurgeBuff) {
        performance = QualitativePerformance.Perfect;
        details = (
          <div>
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} /> buff was applied.
          </div>
        );
      } else {
        performance = QualitativePerformance.Good;
        details = (
          <div>
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} /> buff was applied.
          </div>
        );
      }
    } else {
      performance = QualitativePerformance.Fail;
      details = (
        <div>
          <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} /> buff wasn't applied. Try to always have
          Lightweaver before casting.
        </div>
      );
    }

    return {
      check: 'lightweaver-active',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  private getSurgeChecklistItem(
    event: CastEvent,
    hasLightweaver: boolean,
    hasSurgeBuff: boolean,
  ): ChecklistUsageInfo {
    const summary = (
      <div>
        <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
        {t({ id: 'priest.holy.prayerOfHealing.surgeBuffApplied', message: 'buff applied' })}
      </div>
    );

    let performance: QualitativePerformance;
    let details: JSX.Element;

    if (hasSurgeBuff) {
      if (hasLightweaver) {
        performance = QualitativePerformance.Perfect;
        details = (
          <div>
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
            {t({ id: 'priest.holy.prayerOfHealing.surgeWasApplied', message: 'buff was applied.' })}
          </div>
        );
      } else {
        performance = QualitativePerformance.Ok;
        details = (
          <div>
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
            {t({ id: 'priest.holy.prayerOfHealing.surgeWasApplied', message: 'buff was applied.' })}
          </div>
        );
      }
    } else {
      if (hasLightweaver) {
        performance = QualitativePerformance.Ok;
        details = (
          <div>
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
            {t({
              id: 'priest.holy.prayerOfHealing.surgeNotApplied',
              message: "buff wasn't applied. Consider using it for free casts.",
            })}
          </div>
        );
      } else {
        performance = QualitativePerformance.Fail;
        details = (
          <div>
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
            {t({
              id: 'priest.holy.prayerOfHealing.surgeNotApplied',
              message: "buff wasn't applied. Consider using it for free casts.",
            })}
          </div>
        );
      }
    }

    return {
      check: 'surge-of-light-active',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  private getSurgeOnlyChecklistItem(event: CastEvent, hasSurgeBuff: boolean): ChecklistUsageInfo {
    const summary = (
      <div>
        <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
        {t({ id: 'priest.holy.prayerOfHealing.surgeBuffApplied', message: 'buff applied' })}
      </div>
    );

    const performance = hasSurgeBuff ? QualitativePerformance.Good : QualitativePerformance.Fail;
    const details = hasSurgeBuff ? (
      <div>
        <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
        {t({ id: 'priest.holy.prayerOfHealing.surgeWasApplied', message: 'buff was applied.' })}
      </div>
    ) : (
      <div>
        <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />{' '}
        {t({
          id: 'priest.holy.prayerOfHealing.surgeNotApplied',
          message: "buff wasn't applied. Consider using it for free casts.",
        })}
      </div>
    );

    return {
      check: 'surge-of-light-active',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  private getDivinityChecklistItem(
    event: CastEvent,
    _hasDivinityBuff: boolean,
    isPerfectCast: boolean,
  ): ChecklistUsageInfo {
    const summary = (
      <div>
        <SpellLink spell={TALENTS.DIVINITY_TALENT} /> buff applied
      </div>
    );

    const performance = isPerfectCast
      ? QualitativePerformance.Perfect
      : QualitativePerformance.Good;
    const details = (
      <div>
        <SpellLink spell={TALENTS.DIVINITY_TALENT} /> buff was applied.
      </div>
    );

    return {
      check: 'divinity-active',
      timestamp: event.timestamp,
      performance,
      summary,
      details,
    };
  }

  get guideSubsection(): JSX.Element | null {
    if (!this.active || this.spellUses.length === 0) {
      return null;
    }

    const explanation = (
      <section>
        <strong>
          <SpellLink spell={TALENTS.PRAYER_OF_HEALING_TALENT} />
        </strong>{' '}
        <Trans id="priest.holy.prayerOfHealing.description">
          is your primary healing tool. It provides substantial burst healing on its own and is the
          most efficient way to reduce the cooldown of{' '}
          <SpellLink spell={TALENTS.HOLY_WORD_SANCTIFY_TALENT} />.
        </Trans>
        {this.hasLightweaverTalent && (
          <>
            {' '}
            <Trans id="priest.holy.prayerOfHealing.lightweaverTip">
              Try to cast it when you have stacks of{' '}
              <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} /> to reduce cast time and mana cost.
            </Trans>
          </>
        )}
        {this.hasSurgeTalent && this.hasSpiritwellTalent && (
          <p>
            <Trans id="priest.holy.prayerOfHealing.surgeTip">
              If talented into <SpellLink spell={TALENTS.SPIRITWELL_TALENT} />, you can cast{' '}
              <SpellLink spell={TALENTS.PRAYER_OF_HEALING_TALENT} /> when you have stacks of{' '}
              <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />.
            </Trans>
          </p>
        )}
      </section>
    );

    const surgeRelevant = this.hasSurgeTalent && this.hasSpiritwellTalent;
    const hasLightweaver = this.hasLightweaverTalent;
    const hasSurge = surgeRelevant;
    const hasDivinity = this.hasDivinityTalent;

    let castBreakdownSmallText: JSX.Element | undefined;

    let scenario:
      | 'lightweaver-both'
      | 'lightweaver-only'
      | 'lightweaver-surge'
      | 'lightweaver-divinity'
      | 'surge-divinity'
      | 'surge-only'
      | 'divinity-only'
      | 'none';
    if (hasLightweaver && hasSurge && hasDivinity) scenario = 'lightweaver-both';
    else if (hasLightweaver && hasSurge) scenario = 'lightweaver-surge';
    else if (hasLightweaver && hasDivinity) scenario = 'lightweaver-divinity';
    else if (hasSurge && hasDivinity) scenario = 'surge-divinity';
    else if (hasSurge) scenario = 'surge-only';
    else if (hasDivinity) scenario = 'divinity-only';
    else if (hasLightweaver) scenario = 'lightweaver-only';
    else scenario = 'none';

    switch (scenario) {
      case 'lightweaver-both':
        castBreakdownSmallText = (
          <Trans id="priest.holy.prayerOfHealing.castLegendPerfect">
            {' '}
            - <span className={styles.perfectCast}>蓝色</span>表示完美施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />和
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />
            均激活）。 <span className={styles.goodCast}>绿色</span>表示良好施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            激活）。 <span className={styles.okCast}>黄色</span>表示一般施放（
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />或
            <SpellLink spell={TALENTS.DIVINITY_TALENT} />
            激活，但无
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            ）。 <span className={styles.badCast}>红色</span>表示无任何增益激活的不良施放。
          </Trans>
        );
        break;
      case 'lightweaver-surge':
        castBreakdownSmallText = (
          <Trans id="priest.holy.prayerOfHealing.castLegendPerfect">
            {' '}
            - <span className={styles.perfectCast}>蓝色</span>表示完美施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />和
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />
            均激活）。 <span className={styles.goodCast}>绿色</span>表示良好施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            激活）。 <span className={styles.okCast}>黄色</span>表示一般施放（
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />
            激活，但无
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            ）。 <span className={styles.badCast}>红色</span>表示无任何增益激活的不良施放。
          </Trans>
        );
        break;
      case 'lightweaver-divinity':
        castBreakdownSmallText = (
          <Trans id="priest.holy.prayerOfHealing.castLegendGood">
            {' '}
            <span className={styles.goodCast}>绿色</span>表示良好施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            激活）。 <span className={styles.okCast}>黄色</span>表示一般施放（
            <SpellLink spell={TALENTS.DIVINITY_TALENT} />
            激活，但无
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            ）。 <span className={styles.badCast}>红色</span>表示无任何增益激活的不良施放。
          </Trans>
        );
        break;
      case 'lightweaver-only':
        castBreakdownSmallText = (
          <Trans id="priest.holy.prayerOfHealing.castLegendSimple">
            {' '}
            - <span className={styles.goodCast}>绿色</span>表示良好施放（
            <SpellLink spell={TALENTS.LIGHTWEAVER_TALENT} />
            激活）。 <span className={styles.badCast}>红色</span>表示无增益的不良施放。
          </Trans>
        );
        break;
      case 'surge-divinity':
      case 'surge-only':
      case 'divinity-only':
        castBreakdownSmallText = (
          <Trans id="priest.holy.prayerOfHealing.castLegendBuff">
            {' '}
            - <span className={styles.goodCast}>绿色</span>表示良好施放（
            <SpellLink spell={TALENTS.SURGE_OF_LIGHT_TALENT} />或
            <SpellLink spell={TALENTS.DIVINITY_TALENT} />
            激活）。 <span className={styles.badCast}>红色</span>表示无增益的不良施放。
          </Trans>
        );
        break;
      default:
        castBreakdownSmallText = undefined;
        break;
    }

    return (
      <ContextualSpellUsageSubSection
        title={t({
          id: 'priest.holy.prayerOfHealing.title',
          message: 'Prayer of Healing',
        })}
        explanation={explanation}
        uses={this.spellUses}
        castBreakdownSmallText={castBreakdownSmallText}
        abovePerformanceDetails={<div style={{ marginBottom: 10 }}></div>}
      />
    );
  }
}

export default PrayerOfHealing;
