import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS/classic/druid';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, HealEvent } from 'parser/core/Events';
import Combatants from 'parser/shared/modules/Combatants';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

import {
  getDirectHeal,
  isFromHardcast,
} from 'analysis/classic/druid/restoration/modules/normalizers/CastLinkNormalizer';
import { getRemovedHot } from 'analysis/classic/druid/restoration/modules/normalizers/SwiftmendNormalizer';
import HotTrackerRestoDruid from 'analysis/classic/druid/restoration/modules/core/HotTrackerRestoDruid';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { formatPercentage } from 'common/format';
import { abilityToSpell } from 'common/abilityToSpell';

const HIGH_VALUE_HOTS = [SPELLS.REJUVENATION.id, SPELLS.REGROWTH];

function calculateOverhealPercent(evt: HealEvent): number {
  const overheal = evt.overheal || 0;

  return overheal / (evt.amount + overheal);
}

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
  /** Box row entry for each Swiftmend cast */
  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);

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
    const overhealPercent = directHeal ? calculateOverhealPercent(directHeal) : 0;
    const target = this.combatants.getEntity(event);
    if (!target) {
      console.warn("Couldn't find target for Swiftmend cast", event);
      return; // can't do further handling without target
    }
    const overhealPercentText = formatPercentage(overhealPercent, 0);

    /*
     * Build value and tooltip text depending on if player had VI
     */

    let hotChangeText: React.ReactNode = '';
    let value: QualitativePerformance;

    const removedHotHeal = getRemovedHot(event);

    let unglyphed = false;
    if (removedHotHeal) {
      // Removed a HoT so can't have glyph
      unglyphed = true;
    }

    const removedHighValue =
      HIGH_VALUE_HOTS.find((id) => id === removedHotHeal?.ability.guid) !== undefined;
    if (overhealPercent === 0.0) {
      value = QualitativePerformance.Good;
    } else if (overhealPercent < 0.15 && !removedHighValue) {
      value = QualitativePerformance.Ok;
    } else {
      value = QualitativePerformance.Fail;
    }

    hotChangeText = (
      <>
        {t({
          id: 'classic.druid.restoration.swiftmend.removed',
          message: 'removed',
        })}{' '}
        <strong>
          {removedHotHeal ? (
            <SpellLink spell={abilityToSpell(removedHotHeal.ability)} />
          ) : (
            t({
              id: 'classic.druid.restoration.swiftmend.unknownHot',
              message: 'unknown HoT',
            })
          )}
        </strong>
      </>
    );

    const tooltip = (
      <>
        @ <strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {t({
          id: 'classic.druid.restoration.swiftmend.targetting',
          message: 'targetting',
        })}{' '}
        <strong>{target.name}</strong>{' '}
        {t({
          id: 'classic.druid.restoration.swiftmend.withOverheal',
          message: 'w/',
        })}{' '}
        <strong>{overhealPercentText}%</strong>{' '}
        {t({
          id: 'classic.druid.restoration.swiftmend.overheal',
          message: 'overheal',
        })}
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {unglyphed && hotChangeText}
      </>
    );

    this.castEntries.push({ value, tooltip });
  }

  /** Guide subsection describing the proper usage of Swiftmend */
  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          {t({
            id: 'classic.druid.restoration.swiftmend.explanation1',
            message:
              'Swiftmend is our emergency heal that removes a HoT on its target, hurting overall throughput. Use only on targets who need urgent healing.',
          })}
        </p>
        <p>
          {t({
            id: 'classic.druid.restoration.swiftmend.explanation2',
            message:
              'Note: If you are not using Glyph of Swiftmend, you should. The healing, casting time, and mana gains from not having your Rejuv or Regrowth consumed is invaluable.',
          })}
        </p>
      </>
    );

    // Build up description of chart, which varies based on talents
    const chartDescription = t({
      id: 'classic.druid.restoration.swiftmend.chartDescription',
      message:
        'Green is a fine cast, Yellow is a cast with <15% overheal, and Red is a non-triage (>15% overheal) cast that removes a Rejuv or Regrowth. Mouseover for more details.',
    });

    const data = (
      <div>
        <strong>
          {t({
            id: 'classic.druid.restoration.swiftmend.castsTitle',
            message: 'Swiftmend casts',
          })}
        </strong>
        <small> - {chartDescription}</small>
        <PerformanceBoxRow values={this.castEntries} />
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }
}

export default Swiftmend;
