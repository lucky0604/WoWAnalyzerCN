import type { JSX } from 'react';
import { formatPercentage, formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import { TALENTS_PRIEST } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyDebuffEvent,
  CastEvent,
  DamageEvent,
  RefreshDebuffEvent,
  RemoveDebuffEvent,
} from 'parser/core/Events';
import { OpenTimePeriod } from 'parser/core/mergeTimePeriods';
import { Options } from 'parser/core/Module';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import Enemies from 'parser/shared/modules/Enemies';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { PAIN_AND_SUFFERING_INCREASE } from '../../constants';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import Spell from 'common/SPELLS/Spell';
import { t } from '@lingui/core/macro';

type DotInformation =
  | {
      throesOfPain: number;
      revelInPurity: number;
      painAndSuffering: number;
    }
  | Record<string, never>;

class EncroachingShadows extends Analyzer {
  protected enemies!: Enemies;
  protected abilityTracker!: AbilityTracker;

  static dependencies = {
    enemies: Enemies,
    abilityTracker: AbilityTracker,
  };
  revelInPurityActive = false;
  painAndSufferingActive = false;

  painAndSufferingIncrease = 0;
  throesOfPainIncrease = 0;
  revelInPurityIncrease = 0;
  totalAmplification = 0;
  effectiveIncrease = 0;

  ptwCleaveDamage = 0;
  dotSpell: Spell;
  ptwCasts = 0;
  ptwApplications = 0;
  lastCastTarget = 0;
  ptwCleaveTracker: number[] = [];
  dotRatios: DotInformation = {};

  ptwUptimes: OpenTimePeriod[] = [];

  constructor(options: Options) {
    super(options);
    this.dotSpell = SPELLS.SHADOW_WORD_PAIN;
    if (this.selectedCombatant.hasTalent(TALENTS_PRIEST.ENCROACHING_SHADOWS_TALENT)) {
      if (this.selectedCombatant.hasTalent(TALENTS_PRIEST.REVEL_IN_DARKNESS_TALENT)) {
        this.revelInPurityActive = true;
        this.revelInPurityIncrease = 0.05;
      }
    }

    this.painAndSufferingActive = this.selectedCombatant.hasTalent(
      TALENTS_PRIEST.PAIN_AND_SUFFERING_TALENT,
    );

    if (this.painAndSufferingActive) {
      this.painAndSufferingIncrease =
        PAIN_AND_SUFFERING_INCREASE[
          this.selectedCombatant.getTalentRank(TALENTS_PRIEST.PAIN_AND_SUFFERING_TALENT) - 1
        ];
    }

    this.totalAmplification =
      this.painAndSufferingIncrease + this.revelInPurityIncrease + this.throesOfPainIncrease;

    this.effectiveIncrease =
      (this.painAndSufferingIncrease + 1) *
      (this.revelInPurityIncrease + 1) *
      (this.throesOfPainIncrease + 1);

    this.dotRatios = {
      painAndSuffering: this.painAndSufferingIncrease / this.totalAmplification,
      revelInPurity: this.revelInPurityIncrease / this.totalAmplification,
      throesOfPain: this.throesOfPainIncrease / this.totalAmplification,
    };

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell([SPELLS.SHADOW_WORD_PAIN]),
      this.onDotCast,
    );
    this.addEventListener(
      Events.applydebuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_WORD_PAIN),
      this.onDotApply,
    );
    this.addEventListener(
      Events.refreshdebuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_WORD_PAIN),
      this.onDotApply,
    );
    this.addEventListener(
      Events.removedebuff.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_WORD_PAIN),
      this.onDotRemove,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_WORD_PAIN),
      this.onDotDamage,
    );
  }

  get uptime() {
    return this.enemies.getBuffUptime(this.dotSpell.id) / this.owner.fightDuration;
  }

  get extraPTWs() {
    return this.ptwApplications - this.ptwCasts;
  }

  onDotCast(event: CastEvent) {
    this.ptwCasts += 1;
    if (event.targetID) {
      this.lastCastTarget = event.targetID;
    }
  }

  onDotApply(event: ApplyDebuffEvent | RefreshDebuffEvent) {
    this.ptwApplications += 1;
    this.ptwUptimes.push({ start: event.timestamp, end: event.timestamp + 16000 });
    if (event.targetID !== this.lastCastTarget) {
      this.ptwCleaveTracker[event.targetID] = 1;
    }
  }

  onDotRemove(event: RemoveDebuffEvent) {
    this.ptwUptimes[this.ptwUptimes.length - 1].end = event.timestamp;
    delete this.ptwCleaveTracker[event.targetID];
  }

  onDotDamage(event: DamageEvent) {
    if (this.ptwCleaveTracker[event.targetID]) {
      this.ptwCleaveDamage += event.amount + (event.absorbed || 0);
    }
  }

  statistic() {
    const uptime = this.uptime || 0;

    return (
      <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        position={STATISTIC_ORDER.CORE(5)}
        tooltip={(() => { const amount = formatThousands(this.ptwCleaveDamage); return t({ id: 'priest.discipline.encroachingShadows.tooltip', message: `The additional dots contributed ${{amount}} damage.` }); })()}
      >
        <BoringSpellValueText spell={SPELLS.SHADOW_WORD_PAIN}>
          <div>{formatPercentage(uptime)}% {t({ id: 'priest.discipline.encroachingShadows.uptime', message: 'Uptime' })}</div>
          <div>{this.extraPTWs} {t({ id: 'priest.discipline.encroachingShadows.extraDots', message: 'Extra DOTs' })}</div>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <strong>{t({ id: 'priest.discipline.encroachingShadows.explanation.bold', message: 'Maintain ' })}<SpellLink spell={SPELLS.SHADOW_WORD_PAIN} /></strong>{' '}
          {t({ id: 'priest.discipline.encroachingShadows.explanation.p1', message: 'at all times. It is an efficient source of damage for atonement, and is the sole source of procs for ' })}<SpellLink spell={TALENTS_PRIEST.POWER_OF_THE_DARK_SIDE_TALENT} />{t({ id: 'priest.discipline.encroachingShadows.explanation.p2', message: '. The uptime of this debuff should be kept as high as possible. Consider using ' })}<SpellLink spell={TALENTS_PRIEST.PAINFUL_PUNISHMENT_TALENT} />{t({ id: 'priest.discipline.encroachingShadows.explanation.p3', message: ' if you struggle to keep a good uptime.' })}
        </p>
      </>
    );

    const data = (
      <div>
        <strong>
          <SpellLink spell={this.dotSpell} />
        </strong>
        {this.subStatistic()}
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  get uptimeHistory() {
    return this.enemies.getDebuffHistory(SPELLS.SHADOW_WORD_PAIN.id);
  }

  subStatistic() {
    return uptimeBarSubStatistic(this.owner.fight, {
      spells: [SPELLS.SHADOW_WORD_PAIN],
      uptimes: this.uptimeHistory,
    });
  }
}

export default EncroachingShadows;
