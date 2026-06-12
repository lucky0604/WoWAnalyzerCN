import type { JSX } from 'react';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  ApplyBuffStackEvent,
  CastEvent,
  EventType,
  GetRelatedEvent,
  RefreshBuffEvent,
  RemoveBuffEvent,
  RemoveBuffStackEvent,
} from 'parser/core/Events';
import SPELLS from 'common/SPELLS/shaman';
import TALENTS from 'common/TALENTS/shaman';
import SpellLink from 'interface/SpellLink';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { EnhancementEventLinks } from '../../constants';
import { SubSection } from 'interface/guide';
import BuffUptimeBar from 'interface/guide/components/BuffUptimeBar';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

class StormUnleashed extends Analyzer {
  totalProcs = 0;
  wastedRefreshes = 0;
  wastedExpires = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.STORM_UNLEASHED_1_ENHANCEMENT_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.STORM_UNLEASHED_BUFF),
      this.onApplyBuff,
    );
    this.addEventListener(
      Events.applybuffstack.by(SELECTED_PLAYER).spell(SPELLS.STORM_UNLEASHED_BUFF),
      this.onApplyBuff,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.STORM_UNLEASHED_BUFF),
      this.onRefreshBuff,
    );
    this.addEventListener(
      Events.removebuffstack.by(SELECTED_PLAYER).spell(SPELLS.STORM_UNLEASHED_BUFF),
      this.onRemoveBuff,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.STORM_UNLEASHED_BUFF),
      this.onRemoveBuff,
    );
  }

  onApplyBuff(event: ApplyBuffEvent | ApplyBuffStackEvent) {
    // For a stacking proc, ApplyBuff is the first stack.
    this.totalProcs += 1;
  }

  onRefreshBuff(_event: RefreshBuffEvent) {
    // A refresh implies the proc was already active and got overwritten.
    this.totalProcs += 1;
    this.wastedRefreshes += 1;
  }

  onRemoveBuff(event: RemoveBuffEvent | RemoveBuffStackEvent) {
    const linkedCast = GetRelatedEvent<CastEvent>(
      event,
      EnhancementEventLinks.STORM_UNLEASHED_LINK,
      (e) => e.type === EventType.Cast && e.ability.guid === TALENTS.CRASH_LIGHTNING_TALENT.id,
    );

    if (!linkedCast) {
      this.wastedExpires += 1;
    }
  }

  get guideSubsection(): JSX.Element | null {
    if (!this.active) {
      return null;
    }

    const fightStart = this.owner.fight.start_time;
    const fightEnd = this.owner.fight.end_time;
    const crashLightningBuffHistory = this.selectedCombatant.getBuffHistory(
      SPELLS.CRASH_LIGHTNING_BUFF.id,
    );
    const crashLightningMaxStacks = this.selectedCombatant.hasTalent(
      TALENTS.STORM_UNLEASHED_1_ENHANCEMENT_TALENT,
    )
      ? 3
      : 1;

    const explanation = (
      <>
        <p>
          <><SpellLink spell={SPELLS.STORM_UNLEASHED_BUFF} />{t({ id: 'shaman.enhancement.stormunleashed.explanation1.p1', message: ' allows you to cast ' })}<SpellLink spell={TALENTS.CRASH_LIGHTNING_TALENT} />{t({ id: 'shaman.enhancement.stormunleashed.explanation1.p2', message: " without triggering it's cooldown, and while " })}<SpellLink spell={TALENTS.CRASH_LIGHTNING_TALENT} />{t({ id: 'shaman.enhancement.stormunleashed.explanation1.p3', message: ' is already on cooldown.' })}</>
        </p>
        <p>
          <><SpellLink spell={TALENTS.CRASH_LIGHTNING_TALENT} />{t({ id: 'shaman.enhancement.stormunleashed.explanation2.p1', message: ' is a significant damage source in single target, so it\'s important to avoid unnecessarily wasting potential casts by holding on to the ' })}<SpellLink spell={SPELLS.STORM_UNLEASHED_BUFF} />{t({ id: 'shaman.enhancement.stormunleashed.explanation2.p2', message: ' proc for too long, and either letting it expire or be overwritten.' })}</>
        </p>
      </>
    );

    const data = (
      <>
        <SubSection title={<SpellLink spell={SPELLS.CRASH_LIGHTNING_BUFF} />}>
          <p>
            <>{t({ id: 'shaman.enhancement.stormunleashed.graph_description.p1', message: 'The graph below shows your uptime and stack count of ' })}<SpellLink spell={SPELLS.CRASH_LIGHTNING_BUFF} />{t({ id: 'shaman.enhancement.stormunleashed.graph_description.p2', message: '.' })}</>
          </p>
          <BuffUptimeBar
            spell={SPELLS.CRASH_LIGHTNING_BUFF}
            buffHistory={crashLightningBuffHistory}
            startTime={fightStart}
            endTime={fightEnd}
            maxStacks={crashLightningMaxStacks}
          />
          {this.wastedRefreshes > 0 || this.wastedExpires > 0 ? (
            <>
              <hr />
              <SubSection>
                <>{t({ id: 'shaman.enhancement.stormunleashed.wasted_procs.p1', message: 'You wasted ' })}<SpellLink spell={SPELLS.STORM_UNLEASHED_BUFF} />{t({ id: 'shaman.enhancement.stormunleashed.wasted_procs.p2', message: ' procs:' })}</>
                <ul>
                  {this.wastedRefreshes > 0 && (
                    <li>
                      <Trans id="shaman.enhancement.stormunleashed.overwritten">
                        Overwritten while already active:{' '}
                      </Trans>
                      <strong>{this.wastedRefreshes}</strong>
                    </li>
                  )}
                  {this.wastedExpires > 0 && (
                    <li>
                      <Trans id="shaman.enhancement.stormunleashed.expired">
                        Expired unused:{' '}
                      </Trans>
                      <strong>{this.wastedExpires}</strong>
                    </li>
                  )}
                </ul>
                <div style={{ marginTop: 8 }}>
                  <Trans id="shaman.enhancement.stormunleashed.total_procs">
                    Total procs:{' '}
                  </Trans>
                  <strong>{this.totalProcs}</strong>
                </div>
              </SubSection>
            </>
          ) : null}
        </SubSection>
      </>
    );

    return (
      <ExplanationAndDataSubSection
        title={SPELLS.STORM_UNLEASHED_BUFF.name}
        explanation={explanation}
        data={data}
      />
    );
  }
}

export default StormUnleashed;
