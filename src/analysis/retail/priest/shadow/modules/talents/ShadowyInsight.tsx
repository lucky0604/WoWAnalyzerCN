import { t } from '@lingui/core/macro';
import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/priest';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyBuffEvent, RemoveBuffEvent, RefreshBuffEvent } from 'parser/core/Events';
import Abilities from 'parser/core/modules/Abilities';
import EventHistory from 'parser/shared/modules/EventHistory';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';

class ShadowyInsight extends Analyzer {
  static dependencies = {
    abilities: Abilities,
    eventHistory: EventHistory,
    spellUsable: SpellUsable,
  };
  protected abilities!: Abilities;
  protected eventHistory!: EventHistory;
  protected spellUsable!: SpellUsable;

  procsGained = 0;
  procsUsed = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.SHADOWY_INSIGHT_TALENT);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOWY_INSIGHT_BUFF),
      this.onBuffApplied,
    );

    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOWY_INSIGHT_BUFF),
      this.onBuffRemoved,
    );

    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOWY_INSIGHT_BUFF),
      this.onBuffRefreshed,
    );

    // this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(TALENTS.MIND_BLAST_TALENT), this.onCast);
    // this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_PRIEST_VOIDWEAVER_VOID_BLAST), this.onCast);
  }

  onBuffApplied(event: ApplyBuffEvent) {
    this.spellUsable.endCooldown(TALENTS.MIND_BLAST_TALENT.id, event.timestamp, false, false);
    this.spellUsable.endCooldown(
      SPELLS.SHADOW_PRIEST_VOIDWEAVER_VOID_BLAST.id,
      event.timestamp,
      false,
      false,
    );
    this.procsGained += 1;
  }

  onCast() {
    /*
    // for debuging. Sometimes chargesAvailable, and chargesOnCooldown don't correctly add up to getMaxCharges.
    if(Math.abs(this.spellUsable.chargesAvailable(TALENTS.MIND_BLAST_TALENT.id)) + Math.abs(this.spellUsable.chargesOnCooldown(TALENTS.MIND_BLAST_TALENT.id)) != this.abilities.getMaxCharges(TALENTS.MIND_BLAST_TALENT.id)){
      console.log("ERROR",this.spellUsable.chargesAvailable(TALENTS.MIND_BLAST_TALENT.id),"/",this.spellUsable.chargesOnCooldown(TALENTS.MIND_BLAST_TALENT.id),"max:",this.abilities.getMaxCharges(TALENTS.MIND_BLAST_TALENT.id));
    }

    console.log("MB CAST",this.spellUsable.chargesAvailable(TALENTS.MIND_BLAST_TALENT.id),"/",this.spellUsable.chargesOnCooldown(TALENTS.MIND_BLAST_TALENT.id),"max:",this.abilities.getMaxCharges(TALENTS.MIND_BLAST_TALENT.id));
    */
  }

  onBuffRemoved(event: RemoveBuffEvent) {
    // console.log("EVENT HISTORY", this.eventHistory.last(1,100, Events.cast.by(SELECTED_PLAYER)))
    // When the buff is removed, we check if our recent cast was VoidBlast or Mind Blast.
    // If it was Void Blast or Mind Blast, then this buff got used.
    const lastCast = this.eventHistory.last(
      1,
      100,
      Events.cast.by(SELECTED_PLAYER),
      event.timestamp,
    )[0]?.ability.guid;
    if (
      lastCast === TALENTS.MIND_BLAST_TALENT.id ||
      lastCast === SPELLS.SHADOW_PRIEST_VOIDWEAVER_VOID_BLAST.id
    ) {
      this.procsUsed += 1;
    }
  }

  onBuffRefreshed(event: RefreshBuffEvent) {
    this.procsGained += 1;
  }

  get procsWasted() {
    return this.procsGained - this.procsUsed;
  }

  statistic() {
    return (
      <Statistic category={STATISTIC_CATEGORY.GENERAL} size="flexible">
        <BoringSpellValueText spell={TALENTS.SHADOWY_INSIGHT_TALENT}>
          <>
            {this.procsUsed}/{this.procsGained}{' '}
            <small>
              {t({
                id: 'priest.shadow.shadowyInsight.procsUsed',
                message: 'Procs Used',
              })}
            </small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const goodSI = {
      count: this.procsUsed,
      label: t({
        id: 'priest.shadow.shadowyInsight.procsUsedLabel',
        message: 'Shadowy Insight procs used',
      }),
    };

    const badSI = {
      count: this.procsWasted,
      label: t({
        id: 'priest.shadow.shadowyInsight.procsWastedLabel',
        message: 'Shadowy Insight procs wasted',
      }),
    };

    const explanation = (
      <p>
        <b>
          <SpellLink spell={TALENTS.SHADOWY_INSIGHT_TALENT} />
        </b>{' '}
        {t({
          id: 'priest.shadow.shadowyInsight.gainedFrom',
          message: 'is gained randomly from',
        })}{' '}
        <SpellLink spell={SPELLS.SHADOW_WORD_PAIN} />{' '}
        {t({
          id: 'priest.shadow.shadowyInsight.damage',
          message: 'damage.',
        })}{' '}
        <div />
        {t({
          id: 'priest.shadow.shadowyInsight.castMindBlast',
          message: 'Cast',
        })}{' '}
        <SpellLink spell={TALENTS.MIND_BLAST_TALENT} />{' '}
        {t({
          id: 'priest.shadow.shadowyInsight.whileBuffActive',
          message: 'while the buff is active to avoid wasting procs.',
        })}
      </p>
    );

    const data = (
      <div>
        <strong>
          {t({
            id: 'priest.shadow.shadowyInsight.breakdown',
            message: 'Shadowy Insight breakdown',
          })}
        </strong>
        <GradiatedPerformanceBar good={goodSI} bad={badSI} />
      </div>
    );
    return explanationAndDataSubsection(explanation, data, 50);
  }
}

export default ShadowyInsight;
