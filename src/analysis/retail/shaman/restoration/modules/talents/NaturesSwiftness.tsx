import type { JSX } from 'react';
import { TALENTS_SHAMAN } from 'common/TALENTS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Statistic from 'parser/ui/Statistic';
import Events, { CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import TalentSpellText from 'parser/ui/TalentSpellText';
import ItemManaGained from 'parser/ui/ItemManaGained';
import { formatNumber } from 'common/format';
import { SpellLink } from 'interface';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

import { t } from '@lingui/core/macro';
class NaturesSwiftness extends Analyzer {
  static AFFECTED_SPELLS = [
    SPELLS.LIGHTNING_BOLT,
    TALENTS_SHAMAN.CHAIN_HEAL_TALENT,
    TALENTS_SHAMAN.HEALING_RAIN_TALENT,
    SPELLS.HEALING_WAVE,
    TALENTS_SHAMAN.CHAIN_LIGHTNING_TALENT,
    TALENTS_SHAMAN.DOWNPOUR_TALENT,
  ];

  static GOOD_SPELLS = [TALENTS_SHAMAN.CHAIN_HEAL_TALENT.id];

  static OK_SPELLS = [SPELLS.HEALING_WAVE.id, TALENTS_SHAMAN.HEALING_RAIN_TALENT.id];

  manaSaved = 0;
  castCount = 0;

  // Guide vars
  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(NaturesSwiftness.AFFECTED_SPELLS),
      this.onRelevantCast,
    );
    this.addEventListener(
      Events.applybuff
        .by(SELECTED_PLAYER)
        .spell([SPELLS.NATURES_SWIFTNESS_BUFF, SPELLS.ANCESTRAL_SWIFTNESS_CAST]),
      this.onApplyBuff,
    );
  }

  onRelevantCast(event: CastEvent) {
    if (
      !(
        this.selectedCombatant.hasBuff(SPELLS.NATURES_SWIFTNESS_BUFF.id) ||
        this.selectedCombatant.hasBuff(SPELLS.ANCESTRAL_SWIFTNESS_CAST.id)
      )
    ) {
      return;
    }

    if (this.selectedCombatant.hasBuff(SPELLS.INNERVATE.id)) {
      return;
    }

    if (!event.resourceCost) {
      return;
    }

    this.rateCast(event.ability.guid);

    const baseCost = event.resourceCost[RESOURCE_TYPES.MANA.id];

    if (
      event.ability.guid === TALENTS_SHAMAN.CHAIN_HEAL_TALENT.id &&
      this.selectedCombatant.hasTalent(TALENTS_SHAMAN.COALESCING_WATER_TALENT)
    ) {
      // Coalescing Water reduces the mana cost of Chain Heal by 10%
      this.manaSaved += baseCost - baseCost * 0.1;
    } else {
      this.manaSaved += baseCost;
    }
  }

  onApplyBuff() {
    this.castCount += 1;
  }

  get avgManaSaved() {
    return this.manaSaved / this.castCount;
  }

  rateCast(spellId: number) {
    let value = null;
    let tooltip = null;

    if (NaturesSwiftness.GOOD_SPELLS.includes(spellId)) {
      value = QualitativePerformance.Good;
      tooltip = (
        <>
          {t({
            id: 'shaman.restoration.ns.good_cast',
            message: 'Correct cast: buffed',
          })}{' '}
          <SpellLink spell={spellId} />
        </>
      );
    } else if (NaturesSwiftness.OK_SPELLS.includes(spellId)) {
      value = QualitativePerformance.Ok;
      tooltip = (
        <>
          {t({
            id: 'shaman.restoration.ns.ok_cast',
            message: 'Ok cast: buffed',
          })}{' '}
          <SpellLink spell={spellId} />
        </>
      );
    } else {
      value = QualitativePerformance.Fail;
      tooltip = (
        <>
          {t({
            id: 'shaman.restoration.ns.fail_cast',
            message: 'Incorrect cast: buffed',
          })}{' '}
          <SpellLink spell={spellId} />
        </>
      );
    }

    this.castEntries.push({ value, tooltip });
  }

  statistic() {
    return (
      <Statistic size="flexible" category={STATISTIC_CATEGORY.TALENTS}>
        <TalentSpellText talent={TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT}>
          <div>
            <ItemManaGained amount={this.manaSaved} useAbbrev customLabel="mana" />
          </div>
          <div>
            {formatNumber(this.avgManaSaved)}{' '}
            <small>
              {t({ id: 'shaman.restoration.ns.mana_saved_label', message: 'mana saved per cast' })}
            </small>
          </div>
        </TalentSpellText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <b>
          <SpellLink spell={TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT} />
        </b>{' '}
        {t({
          id: 'shaman.restoration.ns.explanation',
          message:
            'is a very important spell as every cast gives you one',
        })}{' '}
        <SpellLink spell={SPELLS.STORMSTREAM_TOTEM} />
        {t({
          id: 'shaman.restoration.ns.explanation.mana',
          message:
            '. It can also save you a substantial amount of mana over the course of a fight. You should aim to use it on your most expensive spells, like',
        })}{' '}
        <SpellLink spell={TALENTS_SHAMAN.CHAIN_HEAL_TALENT} />
        {t({
          id: 'shaman.restoration.ns.explanation.healingWave',
          message: '. Using it with',
        })}{' '}
        <SpellLink spell={SPELLS.HEALING_WAVE} />
        {t({ id: 'shaman.restoration.ns.explanation.saveLife', message: ' could also save a life.' })}
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT} />
            {t({
              id: 'shaman.restoration.ns.cast_efficiency',
              message: ' cast efficiency',
            })}
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            <CastEfficiencyBar
              spell={TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT}
              useThresholds
              gapHighlightMode={GapHighlight.FullCooldown}
            />{' '}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <strong>{t({ id: 'shaman.restoration.ns.casts_title', message: 'Casts' })}</strong>
            <small>
              <>
                {t({ id: 'shaman.restoration.ns.casts_desc.p1', message: '- Green indicates a good use of the' })}{' '}
                <SpellLink spell={TALENTS_SHAMAN.NATURES_SWIFTNESS_TALENT} />
                {t({ id: 'shaman.restoration.ns.casts_desc.p2', message: ' buff, Yellow indicates an ok use, and Red is an incorrect use or the buff expired.' })}
              </>
            </small>
            <PerformanceBoxRow values={this.castEntries} />
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  get farseerGuideSubsection(): JSX.Element {
    const farseerExplanation = (
      <p>
        <b>
          <SpellLink spell={TALENTS_SHAMAN.ANCESTRAL_SWIFTNESS_TALENT} />
        </b>{' '}
        {t({
          id: 'shaman.restoration.as.explanation',
          message:
            'is a crucial spell for Farseer Shamans. You should aim to cast this on cooldown to maximize your Ancestor uptime through',
        })}{' '}
        <SpellLink spell={TALENTS_SHAMAN.CALL_OF_THE_ANCESTORS_TALENT} />
        {t({
          id: 'shaman.restoration.as.explanation.storm',
          message: 'and how many',
        })}{' '}
        <SpellLink spell={TALENTS_SHAMAN.STORMSTREAM_TOTEM_3_RESTORATION_TALENT} />
        {t({
          id: 'shaman.restoration.as.explanation.expensive',
          message:
            'you generate. You should aim to use it on your most expensive spells, like',
        })}{' '}
        <SpellLink spell={TALENTS_SHAMAN.CHAIN_HEAL_TALENT} />
        {t({
          id: 'shaman.restoration.as.explanation.avoid',
          message: '. Avoid using it with',
        })}{' '}
        <SpellLink spell={SPELLS.HEALING_WAVE} />
        {t({ id: 'shaman.restoration.as.explanation.dps', message: ' or DPS spells.' })}
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS_SHAMAN.ANCESTRAL_SWIFTNESS_TALENT} />
            {t({
              id: 'shaman.restoration.as.cast_efficiency',
              message: ' cast efficiency',
            })}
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            <CastEfficiencyBar
              spell={SPELLS.ANCESTRAL_SWIFTNESS_CAST}
              useThresholds
              minimizeIcons
              gapHighlightMode={GapHighlight.FullCooldown}
            />{' '}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            <strong>{t({ id: 'shaman.restoration.ns.casts_title', message: 'Casts' })}</strong>
            <small>
              <>
                {t({ id: 'shaman.restoration.as.casts_desc.p1', message: '- Green indicates a good use of the' })}{' '}
                <SpellLink spell={TALENTS_SHAMAN.ANCESTRAL_SWIFTNESS_TALENT} />
                {t({ id: 'shaman.restoration.as.casts_desc.p2', message: ' buff, Yellow indicates an ok use, and Red is an incorrect use or the buff expired.' })}
              </>
            </small>
            <PerformanceBoxRow values={this.castEntries} />
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(farseerExplanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }
}

export default NaturesSwiftness;
