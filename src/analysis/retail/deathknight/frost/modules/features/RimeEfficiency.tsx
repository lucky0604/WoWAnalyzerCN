import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { JSX } from 'react';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/deathknight';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyBuffEvent, RefreshBuffEvent, RemoveBuffEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

const BUFF_DURATION_SEC = 15;

class RimeEfficiency extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };

  rimeProcs = 0;
  lastProcTime = 0;
  refreshedRimeProcs = 0;
  expiredRimeProcs = 0;

  constructor(options: Options) {
    super(options);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onApplyBuff,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onRemoveBuff,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onRefreshBuff,
    );
  }

  onApplyBuff(event: ApplyBuffEvent) {
    this.rimeProcs += 1;
    this.lastProcTime = event.timestamp;
  }

  onRemoveBuff(event: RemoveBuffEvent) {
    const durationHeld = event.timestamp - this.lastProcTime;
    if (durationHeld > BUFF_DURATION_SEC * 1000) {
      this.expiredRimeProcs += 1;
    }
  }

  onRefreshBuff(event: RefreshBuffEvent) {
    this.refreshedRimeProcs += 1;
    this.rimeProcs += 1;
  }

  get totalWastedProcs() {
    return this.refreshedRimeProcs + this.expiredRimeProcs;
  }

  get wastedProcRate() {
    return this.totalWastedProcs / this.rimeProcs;
  }

  get efficiency() {
    return 1 - this.wastedProcRate;
  }

  get suggestionThresholds() {
    return {
      actual: this.efficiency,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.85,
      },
      style: ThresholdStyle.PERCENTAGE,
      suffix: 'Average',
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(5)}
        size="flexible"
        tooltip={t({
          id: 'deathknight.frost.rimeEfficiency.tooltip',
          message:
            'You wasted {wasted} out of {total} Rime procs ({percent}%). {expired} procs expired without being used and {overwritten} procs were overwritten by new procs.',
          values: {
            wasted: this.totalWastedProcs,
            total: this.rimeProcs,
            percent: formatPercentage(this.wastedProcRate),
            expired: this.expiredRimeProcs,
            overwritten: this.refreshedRimeProcs,
          },
        })}
      >
        <BoringSpellValueText spell={SPELLS.RIME}>
          <>
            {formatPercentage(this.efficiency)} % <small>{t({ id: 'deathknight.frost.rimeEfficiency.efficiency', message: 'efficiency' })}</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const goodRimes = {
      count: this.rimeProcs - this.expiredRimeProcs - this.refreshedRimeProcs,
      label: t({ id: 'deathknight.frost.rimeEfficiency.guide.goodRimes', message: 'Consumed Rimes' }),
    };

    const refreshedRimes = {
      count: this.refreshedRimeProcs,
      label: t({ id: 'deathknight.frost.rimeEfficiency.guide.refreshedRimes', message: 'Refreshed Rimes' }),
    };

    const expiredRimes = {
      count: this.expiredRimeProcs,
      label: t({ id: 'deathknight.frost.rimeEfficiency.guide.expiredRimes', message: 'Expired Rimes' }),
    };

    const explanation = (
      <p>
        <strong>
          <SpellLink spell={SPELLS.RIME} />
        </strong>
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation',
          message: ' turns ',
        })}
        <SpellLink spell={talents.HOWLING_BLAST_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p2',
          message:
            ' from a weak ability you only use to apply Frost Fever to a powerful spell that jumps to the top of the priority list. This is especially true if ',
        })}
        <SpellLink spell={talents.AVALANCHE_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p3',
          message: ' or ',
        })}
        <SpellLink spell={talents.ICEBREAKER_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p4',
          message:
            ' are talented. Rime has a chance to proc whenever you cast ',
        })}
        <SpellLink spell={talents.OBLITERATE_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p5',
          message:
            ' and you prevent wasting the proc by making sure to consume Rime before casting Obliterate. You should aim to consume as many Rimes as you can. However, there are times when other spells take priority such as casting ',
        })}
        <SpellLink spell={talents.FROST_STRIKE_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p6',
          message: ' to refresh ',
        })}
        <SpellLink spell={talents.ICY_TALONS_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p7',
          message: ' or using ',
        })}
        <SpellLink spell={talents.OBLITERATE_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p8',
          message: ' to maintain ',
        })}
        <SpellLink spell={talents.BREATH_OF_SINDRAGOSA_TALENT} />
        {t({
          id: 'deathknight.frost.rimeEfficiency.guide.explanation.p9',
          message: ' when your RP is low.',
        })}
      </p>
    );

    const data = (
      <div>
        <strong>{t({ id: 'deathknight.frost.rimeEfficiency.guide.breakdown', message: 'Rime breakdown' })}</strong>
        <GradiatedPerformanceBar good={goodRimes} ok={refreshedRimes} bad={expiredRimes} />
      </div>
    );

    return explanationAndDataSubsection(explanation, data, 50);
  }
}

export default RimeEfficiency;
