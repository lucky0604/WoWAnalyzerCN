import type { JSX } from 'react';
import { formatNumber } from 'common/format';
import SPELLS from 'common/SPELLS/shaman';
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
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
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
import CooldownThroughputTracker from '../features/CooldownThroughputTracker';
import { RESTORATION_COLORS, healingIncreases, UNLEASH_LIFE_REMOVE_MS } from '../../constants';

import {
  wasUnleashLifeConsumed,
  isBuffedByUnleashLife,
  getUnleashLifeHealingWaves,
} from '../../normalizers/UnleashLifeNormalizer';

import RiptideTracker from '../core/RiptideTracker';
import ChainHealNormalizer from '../../normalizers/ChainHealNormalizer';

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

  //Checking if the player runs only with UL or UL+EA in order to prevent the misatribution of increased healing from EA to UL later in the module
  private _getUnleashLifeRate(): number {
    return this.selectedCombatant.hasTalent(TALENTS.EARTHEN_ACCORD_TALENT)
      ? healingIncreases.UNLEASH_LIFE_HEALING_INCREASE +
          healingIncreases.EARTHEN_ACCORD_BUFF_INCREASE
      : healingIncreases.UNLEASH_LIFE_HEALING_INCREASE;
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
    const totalRate = this._getUnleashLifeRate();
    const ulShare = healingIncreases.UNLEASH_LIFE_HEALING_INCREASE / totalRate;
    //hot ticks -- the hot tracker resets attributions on refresh buff, so if a UL Riptide gets overwritten it will be excluded here
    if (event.tick) {
      if (!this.riptideTracker.hots[targetId] || !this.riptideTracker.hots[targetId][spellId]) {
        return;
      }
      const riptide = this.riptideTracker.hots[targetId][spellId];
      if (this.riptideTracker.fromUnleashLife(riptide)) {
        this.healingMap[spellId].amount += calculateEffectiveHealing(event, totalRate) * ulShare;
      }
      return;
    }
    //we use initial hit heal event here instead of cast because primordial wave riptide can also consume UL
    if (isBuffedByUnleashLife(event) && !this._wasAlreadyConsumed(event)) {
      this.healingMap[spellId].casts += 1;
      this.tallyCastEntry(spellId);
      this.healingMap[spellId].amount += calculateEffectiveHealing(event, totalRate) * ulShare;
    }
  }

  private _tallyHealingIncrease(events: HealEvent[]): number {
    if (events.length > 0) {
      const totalRate = this._getUnleashLifeRate();
      const ulShare = healingIncreases.UNLEASH_LIFE_HEALING_INCREASE / totalRate;
      return events.reduce(
        (amount, event) => amount + calculateEffectiveHealing(event, totalRate) * ulShare,
        0,
      );
    }
    return 0;
  }

  private _onHealingWave(event: CastEvent) {
    const spellId = event.ability.guid;
    const ulHealingWaves = getUnleashLifeHealingWaves(event);
    if (ulHealingWaves.length > 0) {
      this.healingMap[spellId].amount += this._tallyHealingIncrease(ulHealingWaves);
    }
  }

  private _onChainHeal(event: CastEvent) {
    const orderedChainHeal = this.chainHealNormalizer.normalizeChainHealOrder(event);
    this.healingMap[event.ability.guid].amount += this._tallyHealingIncrease(orderedChainHeal);
  }

  private _tooltip(primary: TooltipData, secondary?: TooltipData) {
    return (
      <>
        <>
          {t({
            id: 'shaman.restoration.ul.used.p1',
            message: 'You used',
          })}{' '}
          <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
          {t({ id: 'shaman.restoration.ul.used.p2', message: ' on ' })}
          <SpellLink spell={primary.spellId} />{' '}
          <strong>
            {t({
              id: 'shaman.restoration.ul.used.p3',
              message: '{0} times',
              values: { 0: this.healingMap[primary.spellId].casts },
            })}
          </strong>
        </>
        <hr />
        <ul>
          {secondary && secondary.active && (
            <li>
              <strong>
                {t({
                  id: 'shaman.restoration.ul.total_healing',
                  message: '{0} total healing',
                  values: { 0: formatNumber(this.healingMap[primary.spellId].amount) },
                })}
              </strong>
            </li>
          )}
          <li>
            <strong>
              {t({
                id: 'shaman.restoration.ul.extra_healing.p1',
                message: '{0} extra',
                values: { 0: formatNumber(primary.amount) },
              })}
            </strong>{' '}
            <SpellLink spell={primary.spellId} />
            {t({
              id: 'shaman.restoration.ul.extra_healing.p2',
              message: ' healing',
            })}
          </li>
          {secondary && secondary.active && (
            <li>
              <strong>
                {t({
                  id: 'shaman.restoration.ul.extra_healing.p1',
                  message: '{0} extra',
                  values: { 0: formatNumber(secondary.amount) },
                })}
              </strong>{' '}
              <SpellLink spell={secondary.spellId} />
              {t({
                id: 'shaman.restoration.ul.extra_healing.p2',
                message: ' healing',
              })}
            </li>
          )}
          <li>
            <strong>
              {t({
                id: 'shaman.restoration.ul.avg_healing',
                message: '{0} healing per use',
                values: { 0: formatNumber(this._getAveragePerCast(primary.spellId)) },
              })}
            </strong>
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
        label: t({ id: 'shaman.restoration.spell.chainHeal', message: 'Chain Heal' }),
        spellId: TALENTS.CHAIN_HEAL_TALENT.id,
        value: this.healingMap[TALENTS.CHAIN_HEAL_TALENT.id].amount,
        valueTooltip: this._tooltip({
          spellId: TALENTS.CHAIN_HEAL_TALENT.id,
          amount: this.healingMap[TALENTS.CHAIN_HEAL_TALENT.id].amount,
          active: this.selectedCombatant.hasTalent(TALENTS.CHAIN_HEAL_TALENT),
        }),
      },
      {
        color: RESTORATION_COLORS.HEALING_WAVE,
        label: t({ id: 'shaman.restoration.spell.healingWave', message: 'Healing Wave' }),
        spellId: SPELLS.HEALING_WAVE.id,
        value: this.healingMap[SPELLS.HEALING_WAVE.id].amount,
        valueTooltip: this._tooltip({
          spellId: SPELLS.HEALING_WAVE.id,
          amount: this.healingMap[SPELLS.HEALING_WAVE.id].amount,
          active: true,
        }),
      },
      {
        color: RESTORATION_COLORS.RIPTIDE,
        label: t({ id: 'shaman.restoration.spell.riptide', message: 'Riptide' }),
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
          {this.buffIcon} {this.wastedBuffs}{' '}
          <small> {t({ id: 'shaman.restoration.ul.wasted_buffs', message: 'wasted buffs' })}</small>
        </TalentSpellText>
        <aside className="pad">
          <hr />
          <header>
            <label>
              <Trans id="shaman.restoration.ul.breakdown_title">
                Breakdown of Unleash Life Healing
              </Trans>
            </label>
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
        <b>
          <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
        </b>{' '}
        {t({
          id: 'shaman.restoration.ul.explanation',
          message:
            'is a very efficient and potent heal on a short cooldown that also provides a buff that improves your next',
        })}{' '}
        <SpellLink spell={TALENTS.CHAIN_HEAL_TALENT} />,{' '}
        <SpellLink spell={SPELLS.HEALING_WAVE} />
        {t({ id: 'shaman.restoration.ul.explanation.riptide', message: ', or ' })}
        <SpellLink spell={TALENTS.RIPTIDE_TALENT} />.
      </p>
    );

    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
            {t({
              id: 'shaman.restoration.ul.efficiency',
              message: ' cast efficiency',
            })}
          </strong>
          <div className="flex-main chart" style={{ padding: 15 }}>
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            {this.guideSubStatistic()} <br />
            <strong>{t({ id: 'shaman.restoration.ul.casts_label', message: 'Casts ' })}</strong>
            <small>
              <>
                {t({ id: 'shaman.restoration.ul.casts_desc.p1', message: '- Green indicates a good use of the' })}{' '}
                <SpellLink spell={TALENTS.UNLEASH_LIFE_TALENT} />
                {t({ id: 'shaman.restoration.ul.casts_desc.p2', message: ' buff, Yellow indicates an ok use, and Red is an incorrect use or the buff expired.' })}
              </>
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
        <>
          {t({
            id: 'shaman.restoration.ul.correct',
            message: 'Correct cast: buffed',
          })}{' '}
          <SpellLink spell={spellId} />
        </>
      );
    } else if (this.okSpells.includes(spellId)) {
      value = QualitativePerformance.Ok;
      tooltip = (
        <>
          {t({
            id: 'shaman.restoration.ul.ok',
            message: 'Ok cast: buffed',
          })}{' '}
          <SpellLink spell={spellId} />
        </>
      );
    } else {
      value = QualitativePerformance.Fail;
      tooltip = (
        <>
          {t({ id: 'shaman.restoration.ul.incorrect', message: 'Incorrect cast:' })}{' '}
          {spellId === -1 ? (
            t({ id: 'shaman.restoration.ul.unused', message: 'Unused Buff!' })
          ) : (
            <>
              {t({
                id: 'shaman.restoration.ul.buffed_spell',
                message: 'buffed',
              })}{' '}
              <SpellLink spell={spellId} />
            </>
          )}
        </>
      );
    }
    this.castEntries.push({ value, tooltip });
  }
}

export default UnleashLife;
