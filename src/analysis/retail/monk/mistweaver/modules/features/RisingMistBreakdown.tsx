import Analyzer, { Options } from 'parser/core/Analyzer';
import RisingMist from '../spells/RisingMist';
import talents from 'common/TALENTS/monk';
import { SpellLink } from 'interface';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { TalentAggregateBarSpec } from 'parser/ui/TalentAggregateStatistic';
import SPELLS from 'common/SPELLS';
import { getCurrentRSKTalent, SPELL_COLORS } from '../../constants';
import TalentAggregateStatisticContainer from 'parser/ui/TalentAggregateStatisticContainer';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import { formatNumber } from 'common/format';
import TalentAggregateBars from 'parser/ui/TalentAggregateStatistic';
import DonutChart from 'parser/ui/DonutChart';
import { Talent } from 'common/TALENTS/types';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

class RisingMistBreakdown extends Analyzer {
  static dependencies = {
    risingMist: RisingMist,
  };
  risingMistItems: TalentAggregateBarSpec[] = [];
  currentRskTalent: Talent;
  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(talents.RISING_MIST_TALENT);
    this.currentRskTalent = getCurrentRSKTalent(this.selectedCombatant);
  }
  protected risingMist!: RisingMist;

  getRisingMistDataItems() {
    this.risingMistItems = [
      {
        spell: SPELLS.RISING_MIST_HEAL,
        amount: this.risingMist.directHealing,
        color: SPELL_COLORS.DANCING_MIST,
        tooltip: this.risingMistDirectTooltip(),
      },
      {
        spell: SPELLS.RENEWING_MIST_HEAL,
        amount: this.risingMist.renewingMistExtensionHealing,
        color: SPELL_COLORS.RENEWING_MIST,
        tooltip: this.renewingMistTooltip(),
      },
      {
        //enveloping mist extension healing
        spell: talents.ENVELOPING_MIST_TALENT,
        amount:
          this.risingMist.envMistyPeaksExtensionHealing +
          this.risingMist.envHardcastExtensionHealing,
        color: SPELL_COLORS.ENVELOPING_MIST,
        tooltip: this.envelopingMistTooltip(),
        subSpecs: [
          {
            //bonus healing from healing bonus
            spell: talents.ENVELOPING_MIST_TALENT,
            amount: this.risingMist.envBonusHealing,
            color: SPELL_COLORS.BLACKOUT_KICK_TOTM,
            tooltip: this.envelopingMistBonusHealingTooltip(),
          },
        ],
      },
      {
        spell: SPELLS.VIVIFY,
        amount: this.risingMist.vivHealing,
        color: SPELL_COLORS.VIVIFY,
        tooltip: this.vivifyTooltip(),
        subSpecs: [
          {
            //additional zen pulse healing from extended rems
            spell: talents.ZEN_PULSE_TALENT,
            amount: this.risingMist.zpHealing,
            color: SPELL_COLORS.ZEN_PULSE,
            tooltip: this.zenPulseTooltip(),
          },
        ],
      },
    ];
    return this.risingMistItems;
  }

  envelopingMistTooltip() {
    const items = [
      {
        color: SPELL_COLORS.ENVELOPING_MIST,
        label: t({ id: 'monk.mistweaver.rising_mist.hardcast', message: 'Hardcast' }),
        spellId: talents.ENVELOPING_MIST_TALENT.id,
        value: this.risingMist.envHardcastExtensionHealing,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.MISTY_PEAKS,
        label: talents.MISTY_PEAKS_TALENT.name,
        spellId: talents.MISTY_PEAKS_TALENT.id,
        value: this.risingMist.envMistyPeaksExtensionHealing,
        valuePercent: false,
      },
    ];
    return (
      <>
        <><SpellLink spell={talents.ENVELOPING_MIST_TALENT} />
          {t({ id: 'monk.mistweaver.rising_mist.env_extension_by_source.p1', message: 'extension healing by source:' })}
        </>
        <hr />
        <DonutChart items={items} />
      </>
    );
  }

  envelopingMistBonusHealingTooltip() {
    const items = [
      {
        color: SPELL_COLORS.ENVELOPING_MIST,
        label: t({ id: 'monk.mistweaver.rising_mist.hardcast', message: 'Hardcast' }),
        spellId: talents.ENVELOPING_MIST_TALENT.id,
        value: this.risingMist.envBonusHardcast,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.MISTY_PEAKS,
        label: talents.MISTY_PEAKS_TALENT.name,
        spellId: talents.MISTY_PEAKS_TALENT.id,
        value: this.risingMist.envBonusMistyPeaks,
        valuePercent: false,
      },
    ];
    return (
      <>
        <>{t({ id: 'monk.mistweaver.rising_mist.env_bonus_healing_by_source.p1', message: 'Additional bonus healing from the extra ' })}
          <SpellLink spell={talents.ENVELOPING_MIST_TALENT} />
          {t({ id: 'monk.mistweaver.rising_mist.env_bonus_healing_by_source.p2', message: 'buff uptime by source:' })}
        </>
        <hr />
        <DonutChart items={items} />
      </>
    );
  }

  renewingMistTooltip() {
    const items = [
      {
        color: SPELL_COLORS.DANCING_MISTS,
        label: talents.DANCING_MISTS_TALENT.name,
        spellId: talents.DANCING_MISTS_TALENT.id,
        value: this.risingMist.renewingMistDancingMistExtensionHealing,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RAPID_DIFFUSION,
        label: talents.RAPID_DIFFUSION_TALENT.name,
        spellId: talents.RAPID_DIFFUSION_TALENT.id,
        value: this.risingMist.renewingMistRapidDiffusionExtensionHealing,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RENEWING_MIST,
        label: t({ id: 'monk.mistweaver.rising_mist.hardcast', message: 'Hardcast' }),
        spellId: SPELLS.RENEWING_MIST_HEAL.id,
        value: this.risingMist.renewingMistHardcastExtensionHealing,
        valuePercent: false,
      },
    ];
    return (
      <>
        <><SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
          {t({ id: 'monk.mistweaver.rising_mist.extension_by_source.p1', message: 'extension healing by source:' })}
        </>
        <hr />
        <DonutChart items={items} />
      </>
    );
  }

  risingMistDirectTooltip() {
    return (
      <>
        <><SpellLink spell={talents.RISING_MIST_TALENT} />
          {t({ id: 'monk.mistweaver.rising_mist.direct_healing.p1', message: 'direct healing from' })}
          {' '}
          <SpellLink spell={this.currentRskTalent} />
          {t({ id: 'monk.mistweaver.rising_mist.direct_healing.p2', message: 'casts' })}
        </>
        <ul>
          <li>
            {(() => {
              const healing = formatNumber(this.risingMist.averageHealing);
              return (
                <>{healing}
                  {t({ id: 'monk.mistweaver.rising_mist.avg_healing_per.p1', message: 'average healing per' })}
                  <SpellLink spell={this.currentRskTalent} />
                </>
              );
            })()}
          </li>
          <li>
            {(() => {
              const hits = this.risingMist.averageTargetsPerRSKCast();
              return (
                <>{hits}
                  {t({ id: 'monk.mistweaver.rising_mist.avg_hits_per.p1', message: 'average hits per' })}
                  <SpellLink spell={this.currentRskTalent} />
                </>
              );
            })()}
          </li>
        </ul>
      </>
    );
  }

  vivifyTooltip() {
    const items = [
      {
        color: SPELL_COLORS.DANCING_MISTS,
        label: talents.DANCING_MISTS_TALENT.name,
        spellId: talents.DANCING_MISTS_TALENT.id,
        value: this.risingMist.vivhealingFromDancingMistRems,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RAPID_DIFFUSION,
        label: talents.RAPID_DIFFUSION_TALENT.name,
        spellId: talents.RAPID_DIFFUSION_TALENT.id,
        value: this.risingMist.vivHealingFromRapidDiffusionRems,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RENEWING_MIST,
        label: t({ id: 'monk.mistweaver.rising_mist.hardcast', message: 'Hardcast' }),
        spellId: SPELLS.RENEWING_MIST_HEAL.id,
        value: this.risingMist.vivHealingFromHardcastRems,
        valuePercent: false,
      },
    ];
    return (
      <>
        {(() => {
          const vivCleaves = this.risingMist.vivCleaves;
          return (
            <><strong>{vivCleaves}</strong>
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_vivify_hits.p1', message: 'total extra' })}
              {' '}
              <SpellLink spell={talents.INVIGORATING_MISTS_TALENT} />
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_vivify_hits.p2', message: 'hits from extended ' })}
              <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_vivify_hits.p3', message: 'by source:' })}
            </>
          );
        })()}
        <hr />
        <DonutChart items={items} />
      </>
    );
  }

  zenPulseTooltip() {
    const items = [
      {
        color: SPELL_COLORS.DANCING_MISTS,
        label: talents.DANCING_MISTS_TALENT.name,
        spellId: talents.DANCING_MISTS_TALENT.id,
        value: this.risingMist.zphealingFromDancingMistRems,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RAPID_DIFFUSION,
        label: talents.RAPID_DIFFUSION_TALENT.name,
        spellId: talents.RAPID_DIFFUSION_TALENT.id,
        value: this.risingMist.zpHealingFromRapidDiffusionRems,
        valuePercent: false,
      },
      {
        color: SPELL_COLORS.RENEWING_MIST,
        label: t({ id: 'monk.mistweaver.rising_mist.hardcast', message: 'Hardcast' }),
        spellId: SPELLS.RENEWING_MIST_HEAL.id,
        value: this.risingMist.zpHealingFromHardcastRems,
        valuePercent: false,
      },
    ];
    return (
      <>
        {(() => {
          const zpHits = this.risingMist.zpHits;
          return (
            <><strong>{zpHits}</strong>
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_zp_hits.p1', message: 'total extra ' })}
              <SpellLink spell={talents.ZEN_PULSE_TALENT} />
              {' '}
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_zp_hits.p2', message: 'hits from extended ' })}
              <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
              {t({ id: 'monk.mistweaver.rising_mist.total_extra_zp_hits.p3', message: 'by source:' })}
            </>
          );
        })()}
        <hr />
        <DonutChart items={items} />
      </>
    );
  }

  statistic() {
    return (
      <TalentAggregateStatisticContainer
        title={
          <>
            <SpellLink spell={talents.RISING_MIST_TALENT} /> -{' '}
            <ItemHealingDone amount={this.risingMist.totalHealing} />
          </>
        }
        category={STATISTIC_CATEGORY.TALENTS}
        position={STATISTIC_ORDER.CORE(1)}
        footer={
          <Trans id="monk.mistweaver.rising_mist.see_tab">
            See the Rising Mist tab for HoT extension details
          </Trans>
        }
        smallFooter
        tooltip={this.risingMist.toolTip()}
        wide
      >
        <TalentAggregateBars bars={this.getRisingMistDataItems()} wide></TalentAggregateBars>
      </TalentAggregateStatisticContainer>
    );
  }
}

export default RisingMistBreakdown;
