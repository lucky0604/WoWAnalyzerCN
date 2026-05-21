import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import DonutChart from 'parser/ui/DonutChart';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import Haste from 'parser/shared/modules/Haste';
import {
  getCurrentRSKTalent,
  SECRET_INFUSION_INCREASE_PER_RANK,
  SPELL_COLORS,
  THUNDER_FOCUS_TEA_SPELLS,
} from '../../constants';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { Arrow } from 'interface/icons';
import { Talent } from 'common/TALENTS/types';
import { Trans } from '@lingui/react/macro';

const debug = false;

//TODO clean up and make easier to add triggers
class ThunderFocusTea extends Analyzer {
  static dependencies = {
    haste: Haste,
  };

  protected haste!: Haste;

  castEntries: BoxRowEntry[] = [];
  castsTftRsk = 0;
  castsTftEnm = 0;
  castsTftRem = 0;

  castsTft = 0;
  castsUnderTft = 0;

  correctCasts = 0;

  castBufferTimestamp = 0;
  ftActive = false;
  correctCapstoneSpells: number[] = [];
  okCapstoneSpells: number[] = [];
  currentRskTalent: Talent;

  constructor(options: Options) {
    super(options);
    this.haste = options.haste as Haste;
    this.active = this.selectedCombatant.hasTalent(TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT);
    const secretInfusionRank = this.selectedCombatant.getTalentRank(
      TALENTS_MONK.SECRET_INFUSION_TALENT,
    );

    this.haste.addHasteBuff(
      SPELLS.SECRET_INFUSION_HASTE_BUFF.id,
      SECRET_INFUSION_INCREASE_PER_RANK * secretInfusionRank,
    );

    this.ftActive = this.selectedCombatant.hasTalent(TALENTS_MONK.FOCUSED_THUNDER_TALENT);
    this.currentRskTalent = getCurrentRSKTalent(this.selectedCombatant);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT),
      this.tftCast,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(THUNDER_FOCUS_TEA_SPELLS),
      this.buffedCast,
    );
    if (this.selectedCombatant.hasTalent(TALENTS_MONK.INVOKE_CHI_JI_THE_RED_CRANE_TALENT)) {
      this.correctCapstoneSpells = [getCurrentRSKTalent(this.selectedCombatant).id];
      this.okCapstoneSpells = [TALENTS_MONK.ENVELOPING_MIST_TALENT.id];
    } else {
      this.correctCapstoneSpells = [SPELLS.RENEWING_MIST_CAST.id];
      this.okCapstoneSpells = [
        getCurrentRSKTalent(this.selectedCombatant).id,
        TALENTS_MONK.ENVELOPING_MIST_TALENT.id,
      ];
    }
  }

  get incorrectTftCasts() {
    return this.castsUnderTft - this.correctCasts;
  }

  isCorrect(event: CastEvent, isOk: boolean): boolean {
    const spellId: number = event.ability.guid;
    const spellMap = isOk ? this.okCapstoneSpells : this.correctCapstoneSpells;
    return spellMap.includes(spellId);
  }

  tftCast(event: CastEvent) {
    this.castsTft += this.ftActive ? 2 : 1;
  }

  buffedCast(event: CastEvent) {
    const spellId: number = event.ability.guid;

    // Implemented as a way to remove non-buffed REM casts that occur at the same timestamp as the buffed Viv cast.
    // Need to think of cleaner solution
    if (
      event.timestamp - this.castBufferTimestamp < 25 ||
      !this.selectedCombatant.hasBuff(TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT.id)
    ) {
      return;
    }

    if (this.currentRskTalent.id === spellId) {
      this.castsUnderTft += 1;
      this.castsTftRsk += 1;
      debug && console.log('RSK TFT Check ', event.timestamp);
    } else if (TALENTS_MONK.ENVELOPING_MIST_TALENT.id === spellId) {
      this.castsUnderTft += 1;
      this.castsTftEnm += 1;
      debug && console.log('Enm TFT Check ', event.timestamp);
    } else if (SPELLS.RENEWING_MIST_CAST.id === spellId) {
      this.castsUnderTft += 1;
      this.castsTftRem += 1;
      debug && console.log('REM TFT Check ', event.timestamp);
    } else {
      return;
    }
    let tooltip = null;
    let value = null;
    if (this.isCorrect(event, false /* isOk */)) {
      value = QualitativePerformance.Good;
      tooltip = (
        <Trans id="monk.mistweaver.tft.correct_cast">
          Correct cast: buffed <SpellLink spell={spellId} />
        </Trans>
      );
      this.correctCasts += 1;
    } else if (this.isCorrect(event, true /* isOk */)) {
      value = QualitativePerformance.Ok;
      tooltip = (
        <Trans id="monk.mistweaver.tft.ok_cast">
          Ok cast: buffed <SpellLink spell={spellId} />
        </Trans>
      );
    } else {
      value = QualitativePerformance.Fail;
      tooltip = (
        <Trans id="monk.mistweaver.tft.incorrect_cast">
          Incorrect cast: buffed <SpellLink spell={spellId} />
        </Trans>
      );
    }
    this.castEntries.push({ value, tooltip });
  }

  renderCastRatioChart() {
    const items = [
      {
        color: SPELL_COLORS.RENEWING_MIST,
        label: t({ id: 'monk.mistweaver.tft.renewing_mist', message: 'Renewing Mist' }),
        spellId: SPELLS.RENEWING_MIST_CAST.id,
        value: this.castsTftRem,
      },
      {
        color: SPELL_COLORS.ENVELOPING_MIST,
        label: t({ id: 'monk.mistweaver.tft.enveloping_mists', message: 'Enveloping Mists' }),
        spellId: TALENTS_MONK.ENVELOPING_MIST_TALENT.id,
        value: this.castsTftEnm,
      },
      {
        color: SPELL_COLORS.RISING_SUN_KICK,
        label: t({ id: 'monk.mistweaver.tft.rising_sun_kick', message: 'Rising Sun Kick' }),
        spellId: this.currentRskTalent.id,
        value: this.castsTftRsk,
      },
    ];
    return <DonutChart items={items} />;
  }

  /** Guide subsection describing the proper usage of TFT */
  get guideSubsection(): JSX.Element {
    const explanation = (
      <>
        <p>
          <Trans id="monk.mistweaver.tft.explanation">
            <b>
              <SpellLink spell={TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT} />
            </b>{' '}
            is an important spell used to empower other abilities. It should be used on cooldown at
            all times and the spell that you use it on depends on your talent selection, in general
            try to adhere to the following priority list
          </Trans>
        </p>
        <ol>
          <li>
            <Trans id="monk.mistweaver.tft.priority_chiji">
              <SpellLink spell={TALENTS_MONK.INVOKE_CHI_JI_THE_RED_CRANE_TALENT} /> talented <Arrow />{' '}
              use on <SpellLink spell={getCurrentRSKTalent(this.selectedCombatant)} /> (
              <span style={{ color: 'green' }}>best</span>) or{' '}
              <SpellLink spell={TALENTS_MONK.ENVELOPING_MIST_TALENT} /> (
              <span style={{ color: 'yellow' }}>ok</span>)
            </Trans>
          </li>
          <li>
            <Trans id="monk.mistweaver.tft.priority_yulon">
              {' '}
              <SpellLink spell={TALENTS_MONK.INVOKE_YULON_THE_JADE_SERPENT_TALENT} /> talented{' '}
              <Arrow /> use on <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> (
              <span style={{ color: 'green' }}>best</span>) or{' '}
              <SpellLink spell={getCurrentRSKTalent(this.selectedCombatant)} /> (
              <span style={{ color: 'yellow' }}>ok</span>) or{' '}
              <SpellLink spell={TALENTS_MONK.ENVELOPING_MIST_TALENT} /> (
              <span style={{ color: 'yellow' }}>ok</span>)
            </Trans>
          </li>
        </ol>
      </>
    );
    const data = (
      <div>
        <RoundedPanel>
          <strong>
            <Trans id="monk.mistweaver.tft.efficiency">
              <SpellLink spell={TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT} /> cast efficiency
            </Trans>
          </strong>
          <div>
            {this.subStatistic()}
            <p>
              <strong>
                <Trans id="monk.mistweaver.tft.casts_label">Casts </Trans>
              </strong>
              <small>
                <Trans id="monk.mistweaver.tft.casts_desc">
                  - Green indicates a correct{' '}
                  <SpellLink spell={TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT} /> cast, while red
                  indicates an incorrect cast.
                </Trans>
              </small>
            </p>
            <PerformanceBoxRow values={this.castEntries} />
          </div>
        </RoundedPanel>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  subStatistic() {
    return (
      <CastEfficiencyBar
        spell={TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT}
        gapHighlightMode={GapHighlight.FullCooldown}
        minimizeIcons
        useThresholds
      />
    );
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(23)}
        size="flexible"
        category={STATISTIC_CATEGORY.GENERAL}
      >
        <div className="pad">
          <label>
            <Trans id="monk.mistweaver.tft.usage">
              <SpellLink spell={TALENTS_MONK.THUNDER_FOCUS_TEA_TALENT} /> usage
            </Trans>
          </label>
          {this.renderCastRatioChart()}
        </div>
      </Statistic>
    );
  }
}

export default ThunderFocusTea;
