import { t, defineMessage } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS/demonhunter';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Events, { CastEvent, DamageEvent } from 'parser/core/Events';
import Enemies from 'parser/shared/modules/Enemies';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { ThresholdStyle } from 'parser/core/ParseResults';
import {
  getBuffedCasts,
  getPreviousVengefulRetreat,
} from '../../normalizers/EssenceBreakNormalizer';
import { Expandable, SpellLink } from 'interface';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import TalentSpellText from 'parser/ui/TalentSpellText';
import InitiativeExplanation from 'analysis/retail/demonhunter/havoc/guide/InitiativeExplanation';
import DemonicExplanation from 'analysis/retail/demonhunter/havoc/guide/DemonicExplanation';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import { ReactNode } from 'react';
import NoDemonicExplanation from 'analysis/retail/demonhunter/havoc/guide/NoDemonicExplanation';
import { ChecklistUsageInfo, SpellUse, UsageInfo } from 'parser/core/SpellUsage/core';
import MajorCooldown, { CooldownTrigger } from 'parser/core/MajorCooldowns/MajorCooldown';
import { ExplanationSection } from 'analysis/retail/demonhunter/shared/guide/CommonComponents';
import { SectionHeader } from 'interface/guide';

/*
  example report: https://www.warcraftlogs.com/reports/8gAWrDqPhVj6BZkQ/#fight=29&source=7
 */

interface EssenceBreakCooldownCast extends CooldownTrigger<CastEvent> {
  buffedCasts: number;
  deathSweepCasts: number;
  annihilationCasts: number;
  bladeDanceCasts: number;
  chaosStrikeCasts: number;
  hasInitiativeOnCast: boolean;
  hasMetamorphosisOnCast: boolean;
  metamorphosisAvailable: boolean;
}

const DAMAGE_SPELLS = [
  SPELLS.CHAOS_STRIKE_MH_DAMAGE,
  SPELLS.CHAOS_STRIKE_OH_DAMAGE,
  SPELLS.ANNIHILATION_MH_DAMAGE,
  SPELLS.ANNIHILATION_OH_DAMAGE,
  SPELLS.BLADE_DANCE_DAMAGE,
  SPELLS.BLADE_DANCE_DAMAGE_LAST_HIT,
  SPELLS.DEATH_SWEEP_DAMAGE,
  SPELLS.DEATH_SWEEP_DAMAGE_LAST_HIT,
];
const DAMAGE_INCREASE = 0.4;

class EssenceBreak extends MajorCooldown<EssenceBreakCooldownCast> {
  static dependencies = {
    ...MajorCooldown.dependencies,
    enemies: Enemies,
    spellUsable: SpellUsable,
  };

  protected enemies!: Enemies;
  protected spellUsable!: SpellUsable;
  private extraDamage = 0;
  private talentDamage = 0;

  constructor(options: Options) {
    super({ spell: TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT }, options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT),
      this.onCast,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(DAMAGE_SPELLS),
      this.onBuffedSpellDamage,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT),
      this.onEssBDamage,
    );
  }

  get suggestionThresholds() {
    return {
      actual: this.casts.filter((cast) => cast.buffedCasts < 2).length,
      isGreaterThan: {
        minor: 0,
        average: 0,
        major: 1,
      },
      style: ThresholdStyle.NUMBER,
    };
  }

  statistic() {
    const totalDamage = this.extraDamage + this.talentDamage;

    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(6)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            {formatThousands(this.talentDamage)}{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.tooltip.talentDamage',
              message: 'talent damage',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
            {formatThousands(this.extraDamage)}{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.tooltip.extraDamage',
              message: 'damage added to Chaos Strike/Annihilation/Blade Dance/Death Sweep',
            })}
          </>
        }
      >
        <TalentSpellText talent={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT}>
          <ItemDamageDone amount={totalDamage} />
        </TalentSpellText>
      </Statistic>
    );
  }

  description(): ReactNode {
    const hasDemonic = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.DEMONIC_TALENT);
    const hasInitiative = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.INITIATIVE_TALENT);
    const hasInnerDemon = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.INNER_DEMON_TALENT);

    return (
      <>
        <ExplanationSection>
          <p>
            <strong>
              <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />
            </strong>
            {t({
              id: 'demonhunter.havoc.essenceBreak.description.p1',
              message: ' is a powerful burst of damage that also amplifies the damage done by ',
            })}
            <SpellLink spell={SPELLS.CHAOS_STRIKE} />
            {t({ id: 'demonhunter.havoc.essenceBreak.description.p2', message: ', ' })}
            <SpellLink spell={SPELLS.ANNIHILATION} />
            {t({ id: 'demonhunter.havoc.essenceBreak.description.p3', message: ', ' })}
            <SpellLink spell={SPELLS.BLADE_DANCE} />
            {t({ id: 'demonhunter.havoc.essenceBreak.description.p4', message: ', and ' })}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />
            {t({
              id: 'demonhunter.havoc.essenceBreak.description.p5',
              message:
                '. You want to fit as many empowered casts into each Essence Break window as you can.',
            })}
          </p>
        </ExplanationSection>
        <ExplanationSection>
          <NoDemonicExplanation />
          <DemonicExplanation />
          <InitiativeExplanation />
        </ExplanationSection>
        <Expandable
          header={
            <SectionHeader>
              <strong>
                {t({
                  id: 'demonhunter.havoc.essenceBreak.metaAvailable.title.p1',
                  message: 'When ',
                })}
                <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />
                {t({
                  id: 'demonhunter.havoc.essenceBreak.metaAvailable.title.p2',
                  message: ' is available',
                })}
              </strong>
            </SectionHeader>
          }
          element="section"
        >
          <div>
            {t({
              id: 'demonhunter.havoc.essenceBreak.metaAvailable.description.p1',
              message: 'An ',
            })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />
            {t({
              id: 'demonhunter.havoc.essenceBreak.metaAvailable.description.p2',
              message: ' window with ',
            })}
            <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />
            {t({
              id: 'demonhunter.havoc.essenceBreak.metaAvailable.description.p3',
              message: ' available will look like:',
            })}
            <ul>
              {hasDemonic && (
                <li>
                  <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
                </li>
              )}
              {hasInnerDemon && (
                <li>
                  <SpellLink spell={SPELLS.ANNIHILATION} />
                </li>
              )}
              {hasInitiative && (
                <li>
                  <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
                </li>
              )}
              <li>
                <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />
              </li>
              <li>
                <SpellLink spell={SPELLS.DEATH_SWEEP} />
              </li>
              <li>
                <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />
              </li>
              <li>
                <SpellLink spell={SPELLS.DEATH_SWEEP} />
              </li>
            </ul>
          </div>
        </Expandable>
        <Expandable
          header={
            <SectionHeader>
              <strong>
                {t({
                  id: 'demonhunter.havoc.essenceBreak.standard.title',
                  message: 'Standard',
                })}
              </strong>
            </SectionHeader>
          }
          element="section"
        >
          <div>
            {t({ id: 'demonhunter.havoc.essenceBreak.standard.description.p1', message: 'An ' })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.standard.description.p2',
              message: ' window without',
            })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.standard.description.p3', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.standard.description.p4',
              message: ' available will look like:',
            })}
            <ul>
              {hasDemonic && (
                <li>
                  <SpellLink spell={TALENTS_DEMON_HUNTER.EYE_BEAM_TALENT} />
                </li>
              )}
              {hasInnerDemon && (
                <li>
                  <SpellLink spell={SPELLS.ANNIHILATION} />
                </li>
              )}
              {hasInitiative && (
                <li>
                  <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />
                </li>
              )}
              <li>
                <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />
              </li>
              <li>
                <SpellLink spell={SPELLS.DEATH_SWEEP} />
              </li>
              <li>
                <SpellLink spell={SPELLS.ANNIHILATION} />
              </li>
              <li>
                <SpellLink spell={SPELLS.ANNIHILATION} />
              </li>
            </ul>
          </div>
        </Expandable>
      </>
    );
  }

  explainPerformance(cast: EssenceBreakCooldownCast): SpellUse {
    if (!this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.DEMONIC_TALENT)) {
      return {
        event: cast.event,
        performance: QualitativePerformance.Fail,
        performanceExplanation: i18n._(
          defineMessage({ id: 'demonhunter.havoc.essenceBreak.badUsage', message: 'Bad Usage' }),
        ),
        checklistItems: [
          {
            check: 'demonic',
            performance: QualitativePerformance.Fail,
            timestamp: cast.event.timestamp,
            summary: (
              <div>
                {t({
                  id: 'demonhunter.havoc.essenceBreak.noDemonic.title.p1',
                  message: 'Did not have ',
                })}{' '}
                <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} />{' '}
                {t({
                  id: 'demonhunter.havoc.essenceBreak.noDemonic.title.p2',
                  message: ' talented',
                })}
              </div>
            ),
            details: (
              <div>
                {t({
                  id: 'demonhunter.havoc.essenceBreak.noDemonic.details.p1',
                  message: 'Did not have ',
                })}{' '}
                <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} />{' '}
                {t({
                  id: 'demonhunter.havoc.essenceBreak.noDemonic.details.p2',
                  message:
                    ' talented. In order to get the maximum amount of damage possible out of Essence Break, you should use ',
                })}{' '}
                <SpellLink spell={TALENTS_DEMON_HUNTER.DEMONIC_TALENT} />{' '}
                {t({ id: 'demonhunter.havoc.essenceBreak.noDemonic.details.p3', message: '.' })}
              </div>
            ),
          },
        ],
      };
    }

    const inMetamorphosisPerformance = this.inMetamorphosisOnCastPerformance(cast);
    const initiativePerformance = this.initiativePerformance(cast);
    const essbWindowCastPerformance = this.essbWindowCastPerformance(cast);

    const checklistItems: ChecklistUsageInfo[] = [
      { check: 'in-metamorphosis', timestamp: cast.event.timestamp, ...inMetamorphosisPerformance },
      {
        check: 'buffed-casts',
        timestamp: cast.event.timestamp,
        ...essbWindowCastPerformance,
      },
    ];
    if (initiativePerformance) {
      checklistItems.push({
        check: 'initiative',
        timestamp: cast.event.timestamp,
        ...initiativePerformance,
      });
    }

    const actualPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );
    return {
      event: cast.event,
      checklistItems: checklistItems,
      performance: actualPerformance,
      performanceExplanation:
        actualPerformance !== QualitativePerformance.Fail
          ? `${actualPerformance} ${i18n._(defineMessage({ id: 'demonhunter.havoc.essenceBreak.usage', message: 'Usage' }))}`
          : i18n._(
              defineMessage({
                id: 'demonhunter.havoc.essenceBreak.badUsage',
                message: 'Bad Usage',
              }),
            ),
    };
  }

  private inMetamorphosisOnCastPerformance(cast: EssenceBreakCooldownCast): UsageInfo {
    const summary = (
      <div>
        {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaOnCast.p1', message: 'Have ' })}{' '}
        <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC_BUFF} />{' '}
        {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaOnCast.p2', message: ' on cast' })}
      </div>
    );

    if (!cast.hasMetamorphosisOnCast) {
      return {
        performance: QualitativePerformance.Fail,
        summary: summary,
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p1', message: 'Have ' })}{' '}
            <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC_BUFF} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.noMetaBad.p2',
              message: " on cast. Not having the buff means that you can't cast ",
            })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p3', message: ' or' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p4', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.ANNIHILATION} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.noMetaBad.p5',
              message: ', instead having to cast',
            })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p6', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.BLADE_DANCE} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p7', message: ' and ' })}{' '}
            <SpellLink spell={SPELLS.CHAOS_STRIKE} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noMetaBad.p8', message: '.' })}
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Perfect,
      summary: summary,
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaGood.p1', message: 'You were in ' })}{' '}
          <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC_BUFF} />{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaGood.p2', message: ' when you cast' })}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaGood.p3', message: ' ' })}{' '}
          <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.haveMetaGood.p4', message: '. Good job!' })}
        </div>
      ),
    };
  }

  private initiativePerformance(cast: EssenceBreakCooldownCast): UsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.INITIATIVE_TALENT)) {
      return undefined;
    }

    const summary = (
      <div>
        {t({ id: 'demonhunter.havoc.essenceBreak.hadInitiativeBuff.p1', message: 'Had ' })}{' '}
        <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />{' '}
        {t({ id: 'demonhunter.havoc.essenceBreak.hadInitiativeBuff.p2', message: ' buff' })}
      </div>
    );

    const previousVengefulRetreat = getPreviousVengefulRetreat(cast.event);
    if (cast.hasInitiativeOnCast) {
      return {
        performance: QualitativePerformance.Perfect,
        summary: summary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.essenceBreak.hadInitiativeBuffDetails.p1',
              message: 'Had ',
            })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.hadInitiativeBuffDetails.p2',
              message: ' buff.',
            })}
          </div>
        ),
      };
    }
    if (previousVengefulRetreat) {
      return {
        performance: QualitativePerformance.Good,
        summary: summary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.essenceBreak.castAfterVR.p1',
              message: 'Cast shortly after casting',
            })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.castAfterVR.p2', message: ' ' })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.castAfterVR.p3',
              message: '. You might have been damaged and lost your ',
            })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.castAfterVR.p4',
              message: " buff, but that's okay, you still did your rotation correctly.",
            })}
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary: summary,
      details: (
        <div>
          {t({
            id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p1',
            message: 'Cast without previously casting',
          })}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p2', message: ' ' })}{' '}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p3', message: '. Try casting' })}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p4', message: ' ' })}{' '}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VENGEFUL_RETREAT_TALENT} />{' '}
          {t({
            id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p5',
            message:
              ' before casting for the critical strike chance buff that it applies (courtesy of',
          })}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p6', message: ' ' })}{' '}
          <SpellLink spell={TALENTS_DEMON_HUNTER.INITIATIVE_TALENT} />{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.castWithoutVR.p7', message: ' ).' })}
        </div>
      ),
    };
  }

  private essbWindowCastPerformance(cast: EssenceBreakCooldownCast): UsageInfo {
    const maximumNumberOfDeathSweepsPossible =
      (cast.hasMetamorphosisOnCast ? 1 : 0) + (cast.metamorphosisAvailable ? 1 : 0);
    const nonDeathSweepBuffedCasts = Math.max(0, cast.buffedCasts - cast.deathSweepCasts);

    const maxDeathSweepsSummary = (
      <div>
        {t({ id: 'demonhunter.havoc.essenceBreak.castDeathSweeps.p1', message: 'Cast ' })}{' '}
        {maximumNumberOfDeathSweepsPossible}{' '}
        {t({ id: 'demonhunter.havoc.essenceBreak.castDeathSweeps.p2', message: '+ ' })}{' '}
        <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
        {t({
          id: 'demonhunter.havoc.essenceBreak.castDeathSweeps.p3',
          message: ' (s) during window',
        })}
      </div>
    );

    // if meta is available and we've cast EssB, the sequence should be
    // EssB -> DS -> Meta -> DS
    if (cast.metamorphosisAvailable) {
      if (cast.deathSweepCasts >= maximumNumberOfDeathSweepsPossible) {
        return {
          performance: QualitativePerformance.Perfect,
          summary: maxDeathSweepsSummary,
          details: (
            <div>
              {t({ id: 'demonhunter.havoc.essenceBreak.perfectDS.p1', message: 'You cast ' })}{' '}
              {cast.deathSweepCasts}{' '}
              {t({ id: 'demonhunter.havoc.essenceBreak.perfectDS.p2', message: ' ' })}{' '}
              <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
              {t({ id: 'demonhunter.havoc.essenceBreak.perfectDS.p3', message: ' (s).' })}
            </div>
          ),
        };
      }
      return {
        performance:
          cast.deathSweepCasts > 0 ? QualitativePerformance.Ok : QualitativePerformance.Fail,
        summary: maxDeathSweepsSummary,
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.essenceBreak.okDS.p1', message: 'You cast ' })}{' '}
            {cast.deathSweepCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.okDS.p2', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.okDS.p3',
              message: ' (s) when you could have cast ',
            })}{' '}
            {maximumNumberOfDeathSweepsPossible}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.okDS.p4', message: ' by pressing' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.okDS.p5', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.METAMORPHOSIS_HAVOC} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.okDS.p6', message: '.' })}
          </div>
        ),
      };
    }

    // meta isn't available and we've cast EssB, the sequence should be
    // EssB -> DS -> Anni -> Anni
    if (cast.deathSweepCasts === 0) {
      return {
        performance: QualitativePerformance.Fail,
        summary: maxDeathSweepsSummary,
        details: (
          <div>
            {t({ id: 'demonhunter.havoc.essenceBreak.failDS.p1', message: 'You cast ' })}{' '}
            {cast.deathSweepCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.failDS.p2', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.failDS.p3',
              message: ' (s). Always try to cast ',
            })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.failDS.p4', message: ' during your' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.failDS.p5', message: ' ' })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.failDS.p6', message: ' window.' })}
          </div>
        ),
      };
    }
    // means we have at least 1 cast of DS, so we should check if we have other buffed casts
    if (nonDeathSweepBuffedCasts === 0) {
      return {
        performance: QualitativePerformance.Ok,
        summary: maxDeathSweepsSummary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p1',
              message: 'You cast ',
            })}{' '}
            {cast.deathSweepCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p2', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p3',
              message: ' and no other buffed spells. Try adding another ',
            })}{' '}
            <SpellLink spell={SPELLS.ANNIHILATION} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p4', message: ' or' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p5', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.CHAOS_STRIKE} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p6',
              message: ' inside your',
            })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p7', message: ' ' })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.noOtherBuffedSpells.p8',
              message: ' window.',
            })}
          </div>
        ),
      };
    }
    if (nonDeathSweepBuffedCasts === 1) {
      return {
        performance: QualitativePerformance.Good,
        summary: maxDeathSweepsSummary,
        details: (
          <div>
            {t({
              id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p1',
              message: 'You cast ',
            })}{' '}
            {cast.deathSweepCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p2', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p3', message: ',' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p4', message: ' ' })}{' '}
            {cast.bladeDanceCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p5', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.BLADE_DANCE} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p6', message: ',' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p7', message: ' ' })}{' '}
            {cast.annihilationCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p8', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.ANNIHILATION} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p9', message: ', and' })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p10', message: ' ' })}{' '}
            {cast.chaosStrikeCasts}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p11', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.CHAOS_STRIKE} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p12',
              message: '. Try adding another',
            })}{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p13', message: ' ' })}{' '}
            <SpellLink spell={SPELLS.ANNIHILATION} />{' '}
            {t({ id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p14', message: ' or ' })}{' '}
            <SpellLink spell={SPELLS.CHAOS_STRIKE} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p15',
              message: ' inside your ',
            })}{' '}
            <SpellLink spell={TALENTS_DEMON_HUNTER.ESSENCE_BREAK_TALENT} />{' '}
            {t({
              id: 'demonhunter.havoc.essenceBreak.oneOtherBuffedSpells.p16',
              message: ' window.',
            })}
          </div>
        ),
      };
    }
    return {
      performance:
        nonDeathSweepBuffedCasts > 1 ? QualitativePerformance.Perfect : QualitativePerformance.Good,
      summary: maxDeathSweepsSummary,
      details: (
        <div>
          {t({ id: 'demonhunter.havoc.essenceBreak.goodBuffedSpells.p1', message: 'You cast ' })}{' '}
          {cast.deathSweepCasts}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.goodBuffedSpells.p2', message: ' ' })}{' '}
          <SpellLink spell={SPELLS.DEATH_SWEEP} />{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.goodBuffedSpells.p3', message: ' and' })}{' '}
          {t({ id: 'demonhunter.havoc.essenceBreak.goodBuffedSpells.p4', message: ' ' })}{' '}
          {nonDeathSweepBuffedCasts}{' '}
          {t({
            id: 'demonhunter.havoc.essenceBreak.goodBuffedSpells.p5',
            message: ' other buffed spell(s).',
          })}
        </div>
      ),
    };
  }

  private onCast(event: CastEvent) {
    this.recordCooldown({
      event,
      buffedCasts: getBuffedCasts(event).length,
      deathSweepCasts: getBuffedCasts(event).filter(
        (it) => it.ability.guid === SPELLS.DEATH_SWEEP.id,
      ).length,
      bladeDanceCasts: getBuffedCasts(event).filter(
        (it) => it.ability.guid === SPELLS.BLADE_DANCE.id,
      ).length,
      annihilationCasts: getBuffedCasts(event).filter(
        (it) => it.ability.guid === SPELLS.ANNIHILATION.id,
      ).length,
      chaosStrikeCasts: getBuffedCasts(event).filter(
        (it) => it.ability.guid === SPELLS.CHAOS_STRIKE.id,
      ).length,
      hasInitiativeOnCast: this.selectedCombatant.hasBuff(
        SPELLS.INITIATIVE_BUFF.id,
        event.timestamp,
      ),
      hasMetamorphosisOnCast: this.selectedCombatant.hasBuff(
        SPELLS.METAMORPHOSIS_HAVOC_BUFF.id,
        event.timestamp,
      ),
      metamorphosisAvailable: this.spellUsable.isAvailable(SPELLS.METAMORPHOSIS_HAVOC.id),
    });
  }

  private onBuffedSpellDamage(event: DamageEvent) {
    const target = this.enemies.getEntity(event);
    if (!target) {
      return;
    }
    const hasEssenceBreakDebuff = target.hasBuff(SPELLS.ESSENCE_BREAK_DAMAGE.id, event.timestamp);

    if (hasEssenceBreakDebuff) {
      this.extraDamage += calculateEffectiveDamage(event, DAMAGE_INCREASE);
    }
  }

  private onEssBDamage(event: DamageEvent) {
    this.talentDamage += event.amount;
  }
}

export default EssenceBreak;
