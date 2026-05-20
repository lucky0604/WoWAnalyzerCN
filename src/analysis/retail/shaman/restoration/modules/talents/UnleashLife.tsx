import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/shaman';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { calculateEffectiveHealing } from 'parser/core/EventCalculateLib';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  HealEvent,
  RefreshBuffEvent,
  RemoveBuffEvent,
} from 'parser/core/Events';
import DonutChart from 'parser/ui/DonutChart';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';

import {
  CHAIN_HEAL_TARGETS,
  RESTORATION_COLORS,
  UNLEASH_LIFE_HEALING_INCREASE,
  UNLEASH_LIFE_REMOVE_MS,
} from '../../constants';
import CooldownThroughputTracker from '../features/CooldownThroughputTracker';
import {
  getUnleashLifeHealingWaves,
  isBuffedByUnleashLife,
  wasUnleashLifeConsumed,
} from '../../normalizers/UnleashLifeNormalizer';
import RiptideTracker from '../core/RiptideTracker';
import ChainHealNormalizer from '../../normalizers/ChainHealNormalizer';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import TalentSpellText from 'parser/ui/TalentSpellText';
import WarningIcon from 'interface/icons/Warning';
import CheckmarkIcon from 'interface/icons/Checkmark';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

const debug = false;

type HealingMap = Record<
  number,
  {
    amount: number;
    casts: number;
  }
>;

interface TooltipData {
  spellId: number;
  amount: number;
  active: boolean;
  extraHits?: number;
  missedHits?: number;
}
/**
 * Unleash Life:
 * Unleashes elemental forces of Life, healing a friendly target and increasing the effect of the Shaman's next direct heal.
 */

class UnleashLife extends Analyzer {
  static dependencies = {
    cooldownThroughputTracker: CooldownThroughputTracker,
    riptideTracker: RiptideTracker,
    chainHealNormalizer: ChainHealNormalizer,
  };
  chainHealNormalizer!: ChainHealNormalizer;
  protected riptideTracker!: RiptideTracker;
  protected cooldownThroughputTracker!: CooldownThroughputTracker;

  wastedBuffs = 0;
  healingMap: HealingMap = {
    [TALENTS.RIPTIDE_TALENT.id]: {
      amount: 0,
      casts: 0,
    },
    [TALENTS.CHAIN_HEAL_TALENT.id]: {
      amount: 0,
      casts: 0,
    },
    [SPELLS.HEALING_WAVE.id]: {
      amount: 0,
      casts: 0,
    },
  };
  //ul direct
  directHealing = 0;

  //healing wave
  healingWaveHealing = 0;

  //chain heal
  chainHealHealing = 0;
  missedJumps = 0;

  unleashLifeCount = 0;
  ulActive = false;
  lastUlSpellId = -1;
  lastRemoved = -1;

  //guide vars
  castEntries: BoxRowEntry[] = [];
  goodSpells: number[] = [];
  okSpells: number[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.UNLEASH_LIFE_TALENT);

    const spellFilter = [TALENTS.CHAIN_HEAL_TALENT, SPELLS.HEALING_WAVE];
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(spellFilter), this._onCast);
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(TALENTS.UNLEASH_LIFE_TALENT),
      this._onHealUL,
    );
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(TALENTS.RIPTIDE_TALENT),
      this._onRiptide,
    );
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(TALENTS.UNLEASH_LIFE_TALENT),
      this._onApplyUL,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(TALENTS.UNLEASH_LIFE_TALENT),
      this._onRemoveUL,
    );

    this.goodSpells.push(TALENTS.CHAIN_HEAL_TALENT.id);
    this.okSpells.push(SPELLS.HEALING_WAVE.id);
    if (this.selectedCombatant.hasTalent(TALENTS.CALL_OF_THE_ANCESTORS_TALENT)) {
      this.okSpells.push(TALENTS.RIPTIDE_TALENT.id);
    }
  }
  //necessary because riptide can be spellqued into the spell that actually consumed UL and event linking will match both
  _wasAlreadyConsumed(event: CastEvent | HealEvent) {
    if (this.lastRemoved + UNLEASH_LIFE_REMOVE_MS < event.timestamp || this.ulActive) {
      this.ulActive = false;
      this.lastUlSpellId = event.ability.guid;
      return false;
    }
    return true;
  }

  _onApplyUL() {
    this.unleashLifeCount += 1;
    this.ulActive = true;
  }

  _onHealUL(event: HealEvent) {
    this.directHealing += event.amount + (event.absorbed || 0);
  }

  _onCast(event: CastEvent) {
    const spellId = event.ability.guid;
    if (isBuffedByUnleashLife(event) && !this._wasAlreadyConsumed(event)) {
      this.healingMap[spellId].casts += 1;
      this.tallyCastEntry(spellId);
      debug &&
        console.log(
          'Unleash Life ' +
            event.ability.name +
            ' at ' +
            this.owner.formatTimestamp(event.timestamp, 3) +
            ' ',
          event,
        );
      switch (spellId) {
        case SPELLS.HEALING_WAVE.id:
          this._onHealingWave(event);
          break;
        case TALENTS.CHAIN_HEAL_TALENT.id:
          this._onChainHeal(event);
          break;
        default:
          //riptide is handled
          //with its own event listener
          return;
      }
    }
  }

  _onRemoveUL(event: RemoveBuffEvent) {
    this.lastRemoved = event.timestamp;
    if (wasUnleashLifeConsumed(event)) {
      return;
    }
    this.wastedBuffs += 1;
    this.tallyCastEntry(-1);
  }

  private _onRiptide(event: HealEvent) {
    const spellId = event.ability.guid;
    const targetId = event.targetID;
    //hot ticks -- the hot tracker resets attributions on refresh buff, so if a UL Riptide gets overwritten it will be excluded here
    if (event.tick) {
      if (!this.riptideTracker.hots[targetId] || !this.riptideTracker.hots[targetId][spellId]) {
        return;
      }
      const riptide = this.riptideTracker.hots[targetId][spellId];
      if (this.riptideTracker.fromUnleashLife(riptide)) {
        debug && console.log('Unleash Life Riptide Tick: ', event);
        this.healingMap[spellId].amount += calculateEffectiveHealing(
          event,
          UNLEASH_LIFE_HEALING_INCREASE,
        );
      }
      return;
    }
    //we use initial hit heal event here instead of cast because primordial wave riptide can also consume UL
    if (isBuffedByUnleashLife(event) && !this._wasAlreadyConsumed(event)) {
      this.healingMap[spellId].casts += 1;
      this.tallyCastEntry(spellId);
      debug &&
        console.log(
          'Unleash Life ' +
            event.ability.name +
            ' at ' +
            this.owner.formatTimestamp(event.timestamp, 3) +
            ' ',
          event,
        );
      this.healingMap[spellId].amount += calculateEffectiveHealing(
        event,
        UNLEASH_LIFE_HEALING_INCREASE,
      );
    }
  }

  private _onHealingWave(event: CastEvent) {
    const spellId = event.ability.guid;
    const ulHealingWaves = getUnleashLifeHealingWaves(event);
    if (ulHealingWaves.length > 0) {
      this.healingMap[spellId].amount += this._tallyHealingIncrease(
        ulHealingWaves,
        UNLEASH_LIFE_HEALING_INCREASE,
      );
    }
  }

  private _onChainHeal(event: CastEvent) {
    const orderedChainHeal = this.chainHealNormalizer.normalizeChainHealOrder(event);
    if (orderedChainHeal.length > 0) {
      //target count check --- if less than 4 (5 w/ancestral reach), no extra hit
      if (
        orderedChainHeal.length >
        CHAIN_HEAL_TARGETS + this.selectedCombatant.getTalentRank(TALENTS.ANCESTRAL_REACH_TALENT)
      ) {
        const extraHit = orderedChainHeal.splice(orderedChainHeal.length - 1);
        this.healingMap[event.ability.guid].amount += this._tallyHealing(extraHit);
      } else {
        this.missedJumps += 1;
      }
      this.healingMap[event.ability.guid].amount += this._tallyHealingIncrease(
        orderedChainHeal,
        UNLEASH_LIFE_HEALING_INCREASE,
      );
    }
  }

  private _tallyHealingIncrease(events: HealEvent[], healIncrease: number): number {
    if (events.length > 0) {
      return events.reduce(
        (amount, event) => amount + calculateEffectiveHealing(event, healIncrease),
        0,
      );
    }
    return 0;
  }

  private _tallyHealing(events: HealEvent[]): number {
    if (events.length > 0) {
      return events.reduce((amount, event) => amount + event.amount, 0);
    }
    return 0;
  }

  private _tooltip(primary: TooltipData, secondary?: TooltipData) {
    return (
      <>
        <Trans id="shaman.restoration.ul.used">
          You used <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} /> on{' '}
          <SpellLink spell={primary.spellId} />{' '}
          <strong>{this.healingMap[primary.spellId].casts} </strong>times
        </Trans>
        <hr />
        <ul>
          {secondary && secondary.active && (
            <li>
              <Trans id="shaman.restoration.ul.total_healing">
                <strong>{formatNumber(this.healingMap[primary.spellId].amount)}</strong> total healing
              </Trans>
            </li>
          )}
          <li>
            <Trans id="shaman.restoration.ul.extra_healing">
              <strong>{formatNumber(primary.amount)} </strong> extra{' '}
              <SpellLink spell={primary.spellId} /> healing
            </Trans>
          </li>
          {primary && primary.extraHits && (
            <li>
              <Trans id="shaman.restoration.ul.extra_hits">
                <strong>{primary.extraHits}</strong> extra hits
              </Trans>
              {primary.missedHits! > 0 ? (
                <Trans id="shaman.restoration.ul.missed">
                  , <strong>{primary.missedHits}</strong> missed
                </Trans>
              ) : (
                <></>
              )}
            </li>
          )}
          {secondary && secondary.active && (
            <li>
              <Trans id="shaman.restoration.ul.extra_healing">
                <strong>{formatNumber(secondary.amount)}</strong> extra{' '}
                <SpellLink spell={secondary.spellId} /> healing
              </Trans>
            </li>
          )}
          {secondary && secondary.active && secondary.extraHits && (
            <li>
              <Trans id="shaman.restoration.ul.extra_hits">
                <strong>{secondary.extraHits}</strong> extra hits
              </Trans>
              {secondary.missedHits! > 0 ? (
                <Trans id="shaman.restoration.ul.missed">
                  , <strong>{secondary.missedHits}</strong> missed
                </Trans>
              ) : (
                <></>
              )}
            </li>
          )}
          <li>
            <Trans id="shaman.restoration.ul.avg_healing">
              <strong>{formatNumber(this._getAveragePerCast(primary.spellId))} </strong> healing per use
            </Trans>
          </li>
        </ul>
      </>
    );
  }

  private _getAveragePerCast(spellId: number): number {
    return this.healingMap[spellId].amount / this.healingMap[spellId].casts;
  }

  get totalBuffedHealing() {
    return Object.values(this.healingMap).reduce((sum, spell) => sum + spell.amount, 0);
  }

  get totalHealing() {
    return this.totalBuffedHealing + this.directHealing;
  }

  get buffIcon() {
    return this.wastedBuffs > 0 ? <WarningIcon /> : <CheckmarkIcon />;
  }

  get unleashLifeCastRatioChart() {
    debug && console.log(this.healingMap);
    const items = [
      {
        color: RESTORATION_COLORS.CHAIN_HEAL,
        label: <Trans id="shaman.restoration.spell.chainHeal">Chain Heal</Trans>,
        spellId: TALENTS.CHAIN_HEAL_TALENT.id,
        value: this.healingMap[TALENTS.CHAIN_HEAL_TALENT.id].amount,
        valueTooltip: this._tooltip({
          spellId: TALENTS.CHAIN_HEAL_TALENT.id,
          amount: this.healingMap[TALENTS.CHAIN_HEAL_TALENT.id].amount,
          active: this.selectedCombatant.hasTalent(TALENTS.CHAIN_HEAL_TALENT),
          extraHits: this.healingMap[TALENTS.CHAIN_HEAL_TALENT.id].casts - this.missedJumps,
          missedHits: this.missedJumps,
        }),
      },
      {
        color: RESTORATION_COLORS.HEALING_WAVE,
        label: <Trans id="shaman.restoration.spell.healingWave">Healing Wave</Trans>,
        spellId: SPELLS.HEALING_WAVE.id,
        value: this.healingMap[SPELLS.HEALING_WAVE.id].amount,
        valueTooltip: this._tooltip({
          spellId: SPELLS.HEALING_WAVE.id,
          amount: this.healingWaveHealing,
          active: true,
        }),
      },
      {
        color: RESTORATION_COLORS.RIPTIDE,
        label: <Trans id="shaman.restoration.spell.riptide">Riptide</Trans>,
        spellId: TALENTS.RIPTIDE_TALENT.id,
        value: this.healingMap[TALENTS.RIPTIDE_TALENT.id].amount,
        valueTooltip: this._tooltip({
          spellId: TALENTS.RIPTIDE_TALENT.id,
          amount: this.healingMap[TALENTS.RIPTIDE_TALENT.id].amount,
          active: true,
        }),
      },
    ]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    return <DonutChart items={items} />;
  }
  // external function for other modules that need  the additional checks here because of spellqueing
  _isBuffedByUnleashLife(event: CastEvent | HealEvent | ApplyBuffEvent | RefreshBuffEvent) {
    return (
      isBuffedByUnleashLife(event) &&
      this.lastRemoved <= event.timestamp &&
      this.lastUlSpellId === event.ability.guid
    );
  }

  statistic() {
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        position={STATISTIC_ORDER.CORE(3)}
        size="flexible"
      >
        <TalentSpellText talent={TALENTS.UNLEASH_LIFE_TALENT}>
          <ItemHealingDone amount={this.totalHealing} />
          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
          <br />
          {this.buffIcon} {this.wastedBuffs} <small> <Trans id="shaman.restoration.ul.wasted_buffs">wasted buffs</Trans></small>
        </TalentSpellText>
        <aside className="pad">
          <hr />
          <header>
            <label><Trans id="shaman.restoration.ul.breakdown_title">Breakdown of Unleash Life Healing</Trans></label>
          </header>
          {this.unleashLifeCastRatioChart}
        </aside>
      </Statistic>
    );
  }

  /** Guide subsection describing the proper usage of Unleash Life */
  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <Trans id="shaman.restoration.ul.explanation">
          <b>
            <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
          </b>{' '}
          is a very efficient and potent heal on a short cooldown that also provides a buff that
          improves your next <SpellLink spell={TALENTS.CHAIN_HEAL_TALENT} />,{' '}
          <SpellLink spell={SPELLS.HEALING_WAVE} />, or <SpellLink spell={TALENTS.RIPTIDE_TALENT} />.
        </Trans>
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <Trans id="shaman.restoration.ul.efficiency">
              <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} /> cast efficiency
            </Trans>
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            {this.guideSubStatistic()} <br />
            <strong>{t({ id: 'shaman.restoration.ul.casts_label', message: 'Casts ' })}</strong>
            <small>
              <Trans id="shaman.restoration.ul.casts_desc">
                - Green indicates a good use of the <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />{' '}
                buff, Yellow indicates an ok use, and Red is an incorrect use or the buff expired.
              </Trans>
            </small>
            <PerformanceBoxRow values={this.castEntries} />
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  guideSubStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS.UNLEASH_LIFE_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        useThresholds
        minimizeIcons
      />
    );
  }

  tallyCastEntry(spellId: number) {
    let value = null;
    let tooltip = null;
    if (this.goodSpells.includes(spellId)) {
      value = QualitativePerformance.Good;
      tooltip = (
        <Trans id="shaman.restoration.ul.correct">
          Correct cast: buffed <SpellLink spell={spellId} />
        </Trans>
      );
    } else if (this.okSpells.includes(spellId)) {
      value = QualitativePerformance.Ok;
      tooltip = (
        <Trans id="shaman.restoration.ul.ok">
          Ok cast: buffed <SpellLink spell={spellId} />
        </Trans>
      );
    } else {
      value = QualitativePerformance.Fail;
      tooltip = (
        <>
          <Trans id="shaman.restoration.ul.incorrect">Incorrect cast: </Trans>
          {spellId === -1 ? (
            <Trans id="shaman.restoration.ul.unused">Unused Buff!</Trans>
          ) : (
            <Trans id="shaman.restoration.ul.buffed_spell">
              buffed <SpellLink spell={spellId} />
            </Trans>
          )}
        </>
      );
    }
    this.castEntries.push({ value, tooltip });
  }
}

export default UnleashLife;
