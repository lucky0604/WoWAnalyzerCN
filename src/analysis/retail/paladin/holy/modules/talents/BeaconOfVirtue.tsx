import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import Analyzer from 'parser/core/Analyzer';
import TALENTS from 'common/TALENTS/paladin';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import SpellLink from 'interface/SpellLink';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../guide/Guide';
import { getWordofGlorySpell } from 'analysis/retail/paladin/shared/constants';
import SPELLS from 'common/SPELLS';
import { LIGHTS_PROTECTION_DAMAGE_REDUCTION } from '../../constants';

class BeaconOfVirtue extends Analyzer {
  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <b>
            <SpellLink spell={TALENTS.BEACON_OF_VIRTUE_TALENT} />
          </b>
          {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p1', message: " is your best tool to handle burst AoE damage. It should be used nearly on cooldown, but due its high mana cost, it's best to save it until your group needs significant healing. During " })}
          <SpellLink spell={TALENTS.BEACON_OF_VIRTUE_TALENT} />
          {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p2', message: ', you should always prioritize ' })}
          <SpellLink spell={getWordofGlorySpell(this.selectedCombatant)} />
          {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p3', message: ' because it transfers more healing to Beacons than ' })}
          <SpellLink spell={SPELLS.LIGHT_OF_DAWN_HEAL} />
          {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p4', message: ' does and ensure your major cooldowns like ' })}
          <SpellLink spell={TALENTS.DIVINE_TOLL_TALENT} />
          {' '}
          {this.selectedCombatant.hasTalent(TALENTS.DIVINE_FAVOR_TALENT) && (
            <>
              {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p5', message: 'and ' })}
              <SpellLink spell={TALENTS.DIVINE_FAVOR_TALENT} />
              {' '}
            </>
          )}
          {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p6', message: 'are used in these windows. ' })}
          {this.selectedCombatant.hasTalent(TALENTS.AVENGING_CRUSADER_TALENT) &&
            this.selectedCombatant.hasTalent(TALENTS.HAMMER_AND_ANVIL_TALENT) &&
            this.selectedCombatant.hasTalent(TALENTS.AWAKENING_TALENT) && (
              <>
                {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p7', message: "As Lightsmith, when consuming an " })}
                <SpellLink spell={TALENTS.AWAKENING_TALENT} />
                {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p8', message: " proc, you'll want to cast " })}
                <SpellLink spell={TALENTS.BEACON_OF_VIRTUE_TALENT} />
                {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p9', message: ' prior to casting the ' })}
                <SpellLink spell={SPELLS.JUDGMENT_CAST_HOLY} />
                {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p10', message: ' to make sure you get the guaranteed ' })}
                <SpellLink spell={TALENTS.HAMMER_AND_ANVIL_TALENT} />
                {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p11', message: ' proc inside of it.' })}
              </>
            )}
          {this.selectedCombatant.hasTalent(TALENTS.LIGHTS_PROTECTION_TALENT) && (
            <>
              {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p12', message: ' Additionally, ' })}
              <SpellLink spell={TALENTS.LIGHTS_PROTECTION_TALENT} />
              {t({ id: 'paladin.holy.talents.beaconOfVirtue.guideExplanation.p13', message: ' provides a {pct}% damage reduction to your Beacon targets.', values: { pct: LIGHTS_PROTECTION_DAMAGE_REDUCTION * 100 }})}
            </>
          )}
        </p>
      </>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <>
              <SpellLink spell={TALENTS.BEACON_OF_VIRTUE_TALENT} />
              {t({ id: 'paladin.holy.talents.beaconOfVirtue.castEfficiency', message: ' cast efficiency' })}
            </>
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            {this.subStatistic()}
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  subStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS.BEACON_OF_VIRTUE_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        slimLines
        useThresholds
      />
    );
  }
}

export default BeaconOfVirtue;
