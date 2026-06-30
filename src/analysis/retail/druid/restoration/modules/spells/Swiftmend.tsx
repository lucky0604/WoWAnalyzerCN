import SPELLS from 'common/SPELLS';
import { i18n } from '@lingui/core';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, HealEvent } from 'parser/core/Events';
import Combatants from 'parser/shared/modules/Combatants';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

import {
  getDirectHeal,
  isFromHardcast,
} from 'analysis/retail/druid/restoration/normalizers/CastLinkNormalizer';
import { getRemovedHot } from 'analysis/retail/druid/restoration/normalizers/SwiftmendNormalizer';
import HotTrackerRestoDruid from 'analysis/retail/druid/restoration/modules/core/hottracking/HotTrackerRestoDruid';
import { TALENTS_DRUID } from 'common/TALENTS';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { calculateHealTargetHealthPercent } from 'parser/core/EventCalculateLib';
import { Fragment, type JSX } from 'react';
import { formatPercentage } from 'common/format';
import { abilityToSpell } from 'common/abilityToSpell';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';
import CastEfficiencyPanel from 'interface/guide/components/CastEfficiencyPanel';

const TRIAGE_THRESHOLD = 0.5;
/** Duration threshold below which consuming a Rejuvenation is considered acceptable */
const LOW_REJUV_THRESHOLD = 6000;
const HIGH_VALUE_HOTS = [
  SPELLS.REJUVENATION.id,
  SPELLS.REJUVENATION_GERMINATION.id,
  SPELLS.WILD_GROWTH.id,
  SPELLS.LIFEBLOOM_HOT_HEAL.id,
];

/**
 * Tracks things related to casting Swiftmend
 */
class Swiftmend extends Analyzer {
  static dependencies = {
    hotTracker: HotTrackerRestoDruid,
    combatants: Combatants,
  };

  hotTracker!: HotTrackerRestoDruid;
  combatants!: Combatants;

  /** Hardcast healing only so we can get mana effic without Convoke messing with us */
  hardcastSwiftmendHealing = 0;
  /** If player has Verdant Infusion, so we know if HoTs are being extended or removed. */
  hasVi: boolean;
  /** If player has Soul of the Forest, so we can track justification of casts */
  hasSotf: boolean;
  /** If player has Grove Guardians, so we can describe Swiftmend proc value in guide text */
  hasGroveGuardians: boolean;
  /** If player has Reforestation, so we can track justification of casts */
  hasReforestation: boolean;
  /** Number of procs player has from Swiftmend (between VI, SotF, and Reforestation) */
  numProcs: number;
  /** Box row entry for each Swiftmend cast */
  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);

    this.hasVi = this.selectedCombatant.hasTalent(TALENTS_DRUID.VERDANT_INFUSION_TALENT);
    this.hasSotf = this.selectedCombatant.hasTalent(
      TALENTS_DRUID.SOUL_OF_THE_FOREST_RESTORATION_TALENT,
    );
    this.hasGroveGuardians = this.selectedCombatant.hasTalent(TALENTS_DRUID.GROVE_GUARDIANS_TALENT);
    this.hasReforestation = this.selectedCombatant.hasTalent(TALENTS_DRUID.REFORESTATION_TALENT);
    this.numProcs = (this.hasVi ? 1 : 0) + (this.hasSotf ? 1 : 0) + (this.hasReforestation ? 1 : 0);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SWIFTMEND),
      this.onSwiftmendCast,
    );
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(SPELLS.SWIFTMEND),
      this.onSwiftmendHeal,
    );
  }

  onSwiftmendHeal(event: HealEvent) {
    if (isFromHardcast(event)) {
      this.hardcastSwiftmendHealing += event.amount + (event.absorbed || 0);
    }
  }

  onSwiftmendCast(event: CastEvent) {
    const directHeal = getDirectHeal(event);
    const targetHealthPercent = directHeal
      ? calculateHealTargetHealthPercent(directHeal, true)
      : undefined;
    const target = this.combatants.getEntity(event);
    if (!target) {
      console.warn("Couldn't find target for Swiftmend cast", event);
      return; // can't do further handling without target
    }
    const wasTriage = targetHealthPercent && targetHealthPercent <= TRIAGE_THRESHOLD;
    const targetHealthPercentText = targetHealthPercent
      ? formatPercentage(targetHealthPercent, 0)
      : i18n._(defineMessage({ id: 'restoration.swiftmend.unknown', message: 'unknown' }));

    /*
     * Build value and tooltip text depending on if player had VI
     */

    let hotChangeText: React.ReactNode = '';
    let value: QualitativePerformance;
    if (this.hasVi) {
      const extendedHotIds: number[] = [];
      if (this.hotTracker.hots[target.id]) {
        Object.values(this.hotTracker.hots[target.id]).forEach((tracker) =>
          extendedHotIds.push(tracker.spellId),
        );
      }
      const extendedHighValue =
        extendedHotIds.filter((id) => HIGH_VALUE_HOTS.includes(id)).length >= 2;
      if (extendedHighValue) {
        value = QualitativePerformance.Perfect;
      } else if (wasTriage) {
        value = QualitativePerformance.Good;
      } else {
        value = QualitativePerformance.Ok;
      }

      if (extendedHotIds.length === 0) {
        hotChangeText = t({
          id: 'restoration.swiftmend.extended_nothing',
          message: 'extended Nothing!',
        });
      } else {
        hotChangeText = (
          <>
            {t({ id: 'restoration.swiftmend.extended', message: 'extended' })}{' '}
            <strong>
              {extendedHotIds.map((id, index) => (
                <Fragment key={id}>
                  <SpellLink key={id} spell={id} />{' '}
                </Fragment>
              ))}
            </strong>
          </>
        );
      }
    } else {
      const removedHotHeal = getRemovedHot(event);
      const removedSpellId = removedHotHeal?.ability.guid;
      let rejuvRemainingMs: number | undefined;

      if (!removedHotHeal) {
        console.log(
          'Swiftmend cast had no linked HoT removal',
          event,
          'HoTs on target:',
          this.hotTracker.hots[target.id],
        );
      }

      if (wasTriage) {
        // Triage cast is always good regardless of consumed HoT
        value = QualitativePerformance.Good;
      } else if (removedSpellId === SPELLS.WILD_GROWTH.id) {
        value = QualitativePerformance.Good;
      } else if (
        removedSpellId === SPELLS.REJUVENATION.id ||
        removedSpellId === SPELLS.REJUVENATION_GERMINATION.id
      ) {
        const hotOnTarget = this.hotTracker.hots[target.id]?.[removedSpellId];
        rejuvRemainingMs = hotOnTarget ? hotOnTarget.end - event.timestamp : 0;
        if (rejuvRemainingMs < LOW_REJUV_THRESHOLD) {
          value = QualitativePerformance.Good;
        } else {
          value = QualitativePerformance.Fail;
        }
      } else if (removedSpellId === SPELLS.REGROWTH.id) {
        value = QualitativePerformance.Ok;
      } else {
        // Unknown or other HoT (e.g., Renewing Bloom)
        value = QualitativePerformance.Ok;
      }

      hotChangeText = (
        <>
          {t({ id: 'restoration.swiftmend.removed', message: 'removed' })}{' '}
          <strong>
            {removedHotHeal ? (
              <SpellLink spell={abilityToSpell(removedHotHeal.ability)} />
            ) : (
              t({ id: 'restoration.swiftmend.unknown_hot', message: 'unknown HoT' })
            )}
          </strong>
          {rejuvRemainingMs !== undefined && (
            <>
              {' '}
              {t({ id: 'restoration.swiftmend.with', message: 'w/' })}{' '}
              <strong>{(rejuvRemainingMs / 1000).toFixed(1)}s</strong>{' '}
              {t({ id: 'restoration.swiftmend.remaining', message: 'remaining' })}
            </>
          )}
        </>
      );
    }

    const tooltip = (
      <>
        @ <strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
        <br />
        {t({ id: 'restoration.swiftmend.targetting', message: 'targetting' })}{' '}
        <strong>{target.name}</strong>{' '}
        {t({ id: 'restoration.swiftmend.with_health', message: 'w/' })}{' '}
        <strong>{targetHealthPercentText}%</strong>{' '}
        {t({ id: 'restoration.swiftmend.health', message: 'health' })}
        <br />
        {hotChangeText}
      </>
    );

    this.castEntries.push({ value, tooltip });
  }

  /** Guide subsectopm describing the proper usage of Swiftmend */
  get guideSubsection(): JSX.Element {
    const hasProcEffects = this.hasSotf || this.hasGroveGuardians;
    const procEffectSpells = [];
    if (this.hasSotf) {
      procEffectSpells.push(TALENTS_DRUID.SOUL_OF_THE_FOREST_RESTORATION_TALENT);
    }
    if (this.hasGroveGuardians) {
      procEffectSpells.push(TALENTS_DRUID.GROVE_GUARDIANS_TALENT);
    }

    const baseText = this.hasVi ? (
      <>
        {t({
          id: 'restoration.swiftmend.base_text_vi.part1',
          message: 'is our spot heal that extends all HoTs on its target due to',
        })}{' '}
        <SpellLink spell={TALENTS_DRUID.VERDANT_INFUSION_TALENT} />.{' '}
        {t({ id: 'restoration.swiftmend.base_text_vi.part2', message: 'Try to cast on your' })}{' '}
        <SpellLink spell={SPELLS.LIFEBLOOM_HOT_HEAL} />{' '}
        {t({
          id: 'restoration.swiftmend.base_text_vi.part3',
          message: 'target to reduce manual Lifebloom re-applications.',
        })}
      </>
    ) : (
      <Trans id="restoration.swiftmend.base_text_no_vi">
        is our spot heal that removes a HoT on its target, slightly hurting overall throughput. Aim
        to consume a Wild Growth or low duration Rejuvenation. Regrowth is acceptable, but avoid
        consuming high duration Rejuvenations.
      </Trans>
    );

    const cooldownText = this.hasVi
      ? t({
          id: 'restoration.swiftmend.cooldown_text_vi',
          message:
            ' Aim to cast Swiftmend on cooldown, even on targets who do not urgently need healing due to the multiple powerful effects tied to casting it: ',
        })
      : t({
          id: 'restoration.swiftmend.cooldown_text_no_vi',
          message:
            ' You should still aim to cast Swiftmend on cooldown, even on targets who do not urgently need healing due to the multiple powerful effects tied to casting it: ',
        });

    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={SPELLS.SWIFTMEND} />
          </b>{' '}
          {baseText}
          {hasProcEffects && (
            <>
              {cooldownText}
              {procEffectSpells.map((spell, index) => (
                <Fragment key={spell.id}>
                  <SpellLink spell={spell} />
                  {index < procEffectSpells.length - 1 ? ', ' : '.'}
                </Fragment>
              ))}
            </>
          )}
          {this.numProcs === 0 &&
            t({
              id: 'restoration.swiftmend.use_only_urgent',
              message: 'Use only on targets who need urgent healing.',
            })}
        </p>
      </>
    );

    // Build up color descriptions of chart, which vary based on talents
    let perfectExtraExplanation = undefined;
    let goodExtraExplanation = undefined;
    let okExtraExplanation = undefined;
    let badExtraExplanation = undefined;
    if (this.hasVi) {
      // has VI
      perfectExtraExplanation = t({
        id: 'restoration.swiftmend.perf_vi_perfect',
        message: 'extended high value HoTs',
      });
    }
    if (!this.hasVi) {
      goodExtraExplanation = t({
        id: 'restoration.swiftmend.perf_no_vi_good',
        message: 'consumed a Wild Growth/low duration Rejuvenation, or was a triage cast',
      });
      okExtraExplanation = t({
        id: 'restoration.swiftmend.perf_no_vi_ok',
        message: 'consumed a Regrowth',
      });
      badExtraExplanation = t({
        id: 'restoration.swiftmend.perf_no_vi_bad',
        message: 'consumed a high duration Rejuvenation',
      });
    }

    const data = (
      <div>
        <CastSummaryAndBreakdown
          spell={SPELLS.SWIFTMEND}
          castEntries={this.castEntries}
          perfectExtraExplanation={perfectExtraExplanation}
          goodExtraExplanation={goodExtraExplanation}
          okExtraExplanation={okExtraExplanation}
          badExtraExplanation={badExtraExplanation}
        />
        {this.numProcs > 0 && <CastEfficiencyPanel spell={SPELLS.SWIFTMEND} useThresholds />}
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }
}

export default Swiftmend;
