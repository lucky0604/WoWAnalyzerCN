import { t } from '@lingui/core/macro';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { calculateEffectiveHealing } from 'parser/core/EventCalculateLib';
import Events, {
  AbsorbedEvent,
  ApplyBuffEvent,
  CastEvent,
  HealEvent,
  RefreshBuffEvent,
} from 'parser/core/Events';
import Combatants from 'parser/shared/modules/Combatants';
import StatTracker from 'parser/shared/modules/StatTracker';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

const debug = false;

const TEMPORAL_ANOMALY_DURATION_MS = 15000;
const TEMPORAL_ANOMALY_SHIELD_COEFF = 1.75;
const SHIELD_DURATIONS_MAP = new Map([
  [SPELLS.TEMPORAL_ANOMALY_SHIELD.id, TEMPORAL_ANOMALY_DURATION_MS],
]);

const SHIELD_DURATIONS = Object.fromEntries(SHIELD_DURATIONS_MAP);

interface ShieldInfo {
  event: ApplyBuffEvent | RefreshBuffEvent;
  baseShieldValue: number;
  hasMasteryBoost: boolean;
  masteryValue: number;
}

class MasteryEffectiveness extends Analyzer {
  static dependencies = {
    combatant: Combatants,
    statTracker: StatTracker,
  };

  protected combatants!: Combatants;
  protected statTracker!: StatTracker;
  masteryAffectedHealing = 0;
  nonMasteryAffectedHealing = 0;
  totalHealingEffectedByMastery = 0;
  additionalHealingFromMastery = 0;
  private prevokerHealthPercent = 0;
  private prevokerMaxHealth = 0;
  private anomalyShieldApplications = new Map<number, ShieldInfo | null>();

  totalShieldEvents = 0;
  totalShieldEventsAffectedByMastery = 0;
  totalEventsAffectedByMastery = 0;
  totalEvents = 0;

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this.onCast);
    this.addEventListener(Events.heal.by(SELECTED_PLAYER), this.onHeal);
    this.addEventListener(Events.absorbed.by(SELECTED_PLAYER), this.onAbsorbedByPlayer);
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.TEMPORAL_ANOMALY_SHIELD),
      this.onAnomalyShieldApplication,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell([SPELLS.TEMPORAL_ANOMALY_SHIELD]),
      this.onShieldRefresh,
    );
  }

  onShieldRefresh(event: RefreshBuffEvent) {
    //apply
    if (this.isEventAbilityAnomaly(event.ability.guid)) {
      this.onAnomalyShieldApplication(event);
    }
  }

  onAnomalyShieldApplication(event: ApplyBuffEvent | RefreshBuffEvent) {
    this.totalShieldEvents += 1;
    let existingAbsorb = 0;
    //shield refresh event's absorb value is a sum of any exising absorb and the new absorb. find the existing absorb for calc in map then  remove
    if (this.anomalyShieldApplications.get(event.targetID)) {
      existingAbsorb = this.anomalyShieldApplications.get(event.targetID)?.event.absorb || 0;
      debug && console.log('Existing absorb: ' + existingAbsorb);
      this.anomalyShieldApplications.set(event.targetID, null);
    }
    //check for mastery amp
    const masteryEvent = this.masteryBoostCheck(event, existingAbsorb);
    if (masteryEvent) {
      debug && console.log('Mastery boosted TA found');
      this.totalShieldEventsAffectedByMastery += 1;
    }
    //push new shield to map
    this.anomalyShieldApplications.set(event.targetID, {
      event: event,
      baseShieldValue: this.calculateShield(event, existingAbsorb),
      hasMasteryBoost: masteryEvent,
      masteryValue: this.statTracker.currentMasteryPercentage,
    });
  }

  onHeal(event: HealEvent) {
    this.totalEvents += 1;
    this.processHealForMastery(event);
  }
  onCast(event: CastEvent) {
    this.prevokerMaxHealth = event.maxHitPoints || 0;
    this.prevokerHealthPercent = ((event.hitPoints || 0) / (event.maxHitPoints || 0)) * 100;
  }
  onAbsorbedByPlayer(event: AbsorbedEvent) {
    //find any existing shield on player and update the values in our Map
    let info;
    const spellId = event.ability.guid;
    if (this.isEventAbilityAnomaly(spellId)) {
      info = this.anomalyShieldApplications.get(event.targetID);
    }
    const shieldDurationMS = SHIELD_DURATIONS[event.ability.guid];

    if (
      !info ||
      info.event.timestamp > event.timestamp ||
      info.event.timestamp + shieldDurationMS < event.timestamp
    ) {
      return;
    }
    info.baseShieldValue -= event.amount;
  }

  private masteryBoostCheck(event: ApplyBuffEvent | RefreshBuffEvent, existingAbsorb: number) {
    const baseMastery = this.statTracker.baseMasteryPercentage;
    const mastery = this.statTracker.currentMasteryPercentage;
    const baseShieldValue = this.calculateShield(event, existingAbsorb);
    //base mastery is 16% for preservation a minimum amp will fall inside of this threshold
    const lowerShieldBound = baseShieldValue * (1 + (mastery - baseMastery));
    const upperShieldBound = baseShieldValue * (1 + (mastery + baseMastery));
    if (event.absorb) {
      if (lowerShieldBound <= event.absorb && event.absorb <= upperShieldBound) {
        return true;
      }
    }
    return false;
  }

  private calculateShield(event: ApplyBuffEvent | RefreshBuffEvent, existingAbsorb: number) {
    //calculate expected shield size without mastery and compare to actual size to determine if the shield was affected
    let baseShielding = 0;
    const vers = this.statTracker.currentVersatilityPercentage;
    if (this.isEventAbilityAnomaly(event.ability.guid)) {
      const intellect = this.statTracker.currentIntellectRating;
      baseShielding = intellect * TEMPORAL_ANOMALY_SHIELD_COEFF * (1 + vers) + existingAbsorb;
    }
    return Math.round(baseShielding);
  }

  private processHealForMastery(event: HealEvent) {
    const targetPlayerHealthPercent = ((event.hitPoints - event.amount) / event.maxHitPoints) * 100;
    //check to see if this is a mastery event
    if (this.prevokerHealthPercent >= targetPlayerHealthPercent) {
      this.totalEventsAffectedByMastery += 1;
      this.masteryAffectedHealing += event.amount + (event.absorbed || 0);
      const mastery = this.statTracker.currentMasteryPercentage;
      this.additionalHealingFromMastery += calculateEffectiveHealing(event, mastery);
    } else {
      this.nonMasteryAffectedHealing += event.amount + (event.absorbed || 0);
    }
  }

  private isEventAbilityAnomaly(spellId: number) {
    return spellId === SPELLS.TEMPORAL_ANOMALY_SHIELD.id;
  }

  get percentOfHealingAffectedByMastery() {
    return (
      this.masteryAffectedHealing / (this.masteryAffectedHealing + this.nonMasteryAffectedHealing)
    );
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        position={STATISTIC_ORDER.CORE(10)}
        category={STATISTIC_CATEGORY.GENERAL}
        tooltip={
          <>
            {this.totalEventsAffectedByMastery} {t({ id: 'evoker.preservation.masteryEffectiveness.outOf', message: 'out of' })} {this.totalEvents} {t({ id: 'evoker.preservation.masteryEffectiveness.healsAffected', message: 'heals were affected by mastery.' })}
          </>
        }
      >
        <div className="pad">
          <label>
            <SpellLink spell={SPELLS.MASTERY_LIFEBINDER} />
          </label>
          <div className="value">
            {formatPercentage(this.percentOfHealingAffectedByMastery)}%
            <small> {t({ id: 'evoker.preservation.masteryEffectiveness.ofHealingAffected', message: 'of Healing Affected' })}</small>
          </div>
          <div className="value">
            <ItemHealingDone amount={this.additionalHealingFromMastery} />
          </div>
        </div>
      </Statistic>
    );
  }
}

export default MasteryEffectiveness;
