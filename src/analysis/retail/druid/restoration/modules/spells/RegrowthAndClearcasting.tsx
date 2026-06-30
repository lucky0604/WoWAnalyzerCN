import type { JSX } from 'react';
import { i18n } from '@lingui/core';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellIcon, SpellLink } from 'interface';
import CheckmarkIcon from 'interface/icons/Checkmark';
import CrossIcon from 'interface/icons/Cross';
import HealthIcon from 'interface/icons/Health';
import UptimeIcon from 'interface/icons/Uptime';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import Combatants from 'parser/shared/modules/Combatants';
import HotTrackerRestoDruid from 'analysis/retail/druid/restoration/modules/core/hottracking/HotTrackerRestoDruid';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import { BoxRowEntry } from 'interface/guide/components/PerformanceBoxRow';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { TALENTS_DRUID } from 'common/TALENTS';
import { getDirectHeal } from 'analysis/retail/druid/restoration/normalizers/CastLinkNormalizer';
import { buffedByClearcast } from 'analysis/retail/druid/restoration/normalizers/ClearcastingNormalizer';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import { calculateHealTargetHealthPercent } from 'parser/core/EventCalculateLib';
import { ABUNDANCE_MANA_REDUCTION } from 'analysis/retail/druid/restoration/modules/spells/Abundance';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import CastSummaryAndBreakdown from 'interface/guide/components/CastSummaryAndBreakdown';

/** Health percent below which we consider a heal to be 'triage' (always Good) */
const TRIAGE_THRESHOLD = 0.3;
/** Max time from cast to heal event to consider the events linked */
const MS_BUFFER = 100;
/** Min stacks required to consider a regrowth efficient */
const ABUNDANCE_EXCEPTION_STACKS = 6;
/** Overheal percent at or below which we consider the direct heal effective */
const LOW_OVERHEAL_THRESHOLD = 0.4;
const PANDEMIC = 0.3;

/**
 * Tracks stats relating to Regrowth and the Clearcasting proc
 */
class RegrowthAndClearcasting extends Analyzer {
  static dependencies = {
    combatants: Combatants,
    hotTracker: HotTrackerRestoDruid,
  };

  combatants!: Combatants;
  hotTracker!: HotTrackerRestoDruid;

  /** total clearcasting procs */
  totalClearcasts = 0;
  /** overwritten clearcasting procs */
  overwrittenClearcasts = 0;
  /** set to 1 iff there is a clearcast active at fight end */
  endingClearcasts = 0;

  /** total regrowth hardcasts */
  totalRegrowths = 0;
  /** regrowth hardcasts made free by innervate */
  innervateRegrowths = 0;
  /** regrowth hardcasts made free by nature's swiftness */
  nsRegrowths = 0;
  /** regrowth hardcasts made free by clearcasting */
  ccRegrowths = 0;
  /** regrowth hardcasts that were cheap enough to be efficient due to abundance */
  abundanceRegrowths = 0;
  /** full price regrowth hardcasts that were on low health targets */
  triageRegrowths = 0;
  /** full price regrowth hardcasts on healthy targets */
  badRegrowths = 0;
  /** regrowth hardcasts that were ok but not ideal (high overheal or non-pandemic overwrite) */
  okRegrowths = 0;

  /** Box row entry for each Regrowth cast */
  castEntries: BoxRowEntry[] = [];

  hasAbundance: boolean;
  hasTranquilMind: boolean;
  hasNaturesBounty: boolean;

  constructor(options: Options) {
    super(options);

    this.hasAbundance = this.selectedCombatant.hasTalent(TALENTS_DRUID.ABUNDANCE_TALENT);
    this.hasTranquilMind = this.selectedCombatant.hasTalent(TALENTS_DRUID.TRANQUIL_MIND_TALENT);
    this.hasNaturesBounty = this.selectedCombatant.hasTalent(TALENTS_DRUID.NATURES_BOUNTY_TALENT);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.CLEARCASTING_BUFF),
      this.onApplyClearcast,
    );
    this.addEventListener(
      Events.applybuffstack.by(SELECTED_PLAYER).spell(SPELLS.CLEARCASTING_BUFF),
      this.onApplyClearcast,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.CLEARCASTING_BUFF),
      this.onRefreshClearcast,
    );

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH),
      this.onCastRegrowth,
    );
    this.addEventListener(Events.fightend, this.onFightEnd);
  }

  onApplyClearcast() {
    this.totalClearcasts += 1;
  }

  onRefreshClearcast() {
    if (
      this.hasTranquilMind &&
      this.selectedCombatant.getBuffStacks(SPELLS.CLEARCASTING_BUFF.id) === 1
    ) {
      // With Tranquil Mind talent, a refreshbuff occurs when player USES a clearcast at 2 stacks -
      // we don't want to count that as an overwrite or a clearcast gained.
      // The refresh happens after the 2nd stack is lost, so we can tell this happened by stack count
      return;
    }

    this.totalClearcasts += 1;
    this.overwrittenClearcasts += 1;
  }

  onCastRegrowth(event: CastEvent) {
    this.totalRegrowths += 1;

    // Gather info about the cast
    const regrowthHeal = getDirectHeal(event);
    const targetHealthPercent = regrowthHeal
      ? calculateHealTargetHealthPercent(regrowthHeal, true)
      : undefined;
    const overhealPercent =
      regrowthHeal && regrowthHeal.amount + (regrowthHeal.overheal || 0) > 0
        ? (regrowthHeal.overheal || 0) / (regrowthHeal.amount + (regrowthHeal.overheal || 0))
        : undefined;
    const isLowOverheal =
      overhealPercent !== undefined && overhealPercent <= LOW_OVERHEAL_THRESHOLD;

    // Determine if cast was free or cheap
    let isFreeOrCheap = false;
    let freeNote = '';
    if (this.selectedCombatant.hasBuff(SPELLS.INNERVATE.id)) {
      this.innervateRegrowths += 1;
      isFreeOrCheap = true;
      freeNote = i18n._(
        defineMessage({ id: 'restoration.regrowth.free_innervate', message: 'Free (Innervate)' }),
      );
    } else if (
      this.selectedCombatant.hasBuff(SPELLS.NATURES_SWIFTNESS.id, event.timestamp, MS_BUFFER)
    ) {
      this.nsRegrowths += 1;
      isFreeOrCheap = true;
      freeNote = i18n._(
        defineMessage({ id: 'restoration.regrowth.free_ns', message: "Free (Nature's Swiftness)" }),
      );
    } else if (buffedByClearcast(event)) {
      this.ccRegrowths += 1;
      isFreeOrCheap = true;
      freeNote = i18n._(
        defineMessage({ id: 'restoration.regrowth.free_cc', message: 'Free (Clearcasting)' }),
      );
    } else if (
      this.selectedCombatant.getBuffStacks(SPELLS.ABUNDANCE_BUFF.id) >= ABUNDANCE_EXCEPTION_STACKS
    ) {
      this.abundanceRegrowths += 1;
      isFreeOrCheap = true;
      const abundanceStacks = this.selectedCombatant.getBuffStacks(SPELLS.ABUNDANCE_BUFF.id);
      freeNote =
        ABUNDANCE_MANA_REDUCTION * abundanceStacks >= 1
          ? i18n._(
              defineMessage({
                id: 'restoration.regrowth.free_abundance_prefix',
                message: 'Free (',
              }),
            ) +
            abundanceStacks +
            i18n._(
              defineMessage({
                id: 'restoration.regrowth.free_abundance_suffix',
                message: ' Abundance stacks)',
              }),
            )
          : i18n._(
              defineMessage({
                id: 'restoration.regrowth.cheap_abundance_prefix',
                message: 'Cheap (',
              }),
            ) +
            abundanceStacks +
            i18n._(
              defineMessage({
                id: 'restoration.regrowth.cheap_abundance_suffix',
                message: ' Abundance stacks)',
              }),
            );
    }

    // Check if target already has Regrowth HoT and whether refresh is within pandemic window
    // (only relevant with Nature's Bounty)
    let targetHadRegrowth = false;
    let isPandemicRefresh = false;
    if (this.hasNaturesBounty && event.targetID !== undefined) {
      const targetHots = this.hotTracker.hots[event.targetID];
      const existingRegrowth = targetHots?.[SPELLS.REGROWTH.id];
      if (existingRegrowth) {
        targetHadRegrowth = true;
        const remaining = existingRegrowth.end - event.timestamp;
        const freshDuration = this.hotTracker._getDuration(
          this.hotTracker.hotInfo[SPELLS.REGROWTH.id],
        );
        isPandemicRefresh = remaining <= freshDuration * PANDEMIC;
      }
    }

    const isTriage = targetHealthPercent !== undefined && targetHealthPercent < TRIAGE_THRESHOLD;

    // Classify the cast
    let performance: QualitativePerformance;
    let castNote: string;

    if (isTriage) {
      // Triage is always Good regardless of cost
      this.triageRegrowths += 1;
      performance = QualitativePerformance.Good;
      castNote = isFreeOrCheap
        ? freeNote +
          i18n._(
            defineMessage({
              id: 'restoration.regrowth.on_critically_low',
              message: ' on a critically low target',
            }),
          )
        : i18n._(
            defineMessage({
              id: 'restoration.regrowth.triage_critically_low',
              message: 'Triage cast on a critically low target',
            }),
          );
    } else if (isFreeOrCheap) {
      if (this.hasNaturesBounty) {
        if (!targetHadRegrowth || isPandemicRefresh) {
          // Good: free/cheap on a new target or pandemic refresh
          performance = QualitativePerformance.Good;
          castNote = isPandemicRefresh
            ? freeNote +
              i18n._(
                defineMessage({
                  id: 'restoration.regrowth.pandemic_refresh',
                  message: ' — pandemic refresh of existing Regrowth',
                }),
              )
            : freeNote +
              i18n._(
                defineMessage({
                  id: 'restoration.regrowth.new_target',
                  message: ' — new Regrowth target',
                }),
              );
        } else {
          // Ok: free/cheap but early overwrite of existing Regrowth HoT
          this.okRegrowths += 1;
          performance = QualitativePerformance.Ok;
          castNote =
            freeNote +
            i18n._(
              defineMessage({
                id: 'restoration.regrowth.overwrote_existing',
                message: ' — overwrote existing Regrowth HoT (not in pandemic window)',
              }),
            );
        }
      } else {
        if (isLowOverheal) {
          // Good: free/cheap with effective healing
          performance = QualitativePerformance.Good;
          castNote = freeNote;
        } else {
          // Ok: free/cheap but high overheal
          this.okRegrowths += 1;
          performance = QualitativePerformance.Ok;
          castNote =
            freeNote +
            i18n._(
              defineMessage({
                id: 'restoration.regrowth.high_overheal',
                message: ' — high overheal',
              }),
            );
        }
      }
    } else {
      // Not free/cheap and not triage = Bad
      this.badRegrowths += 1;
      performance = QualitativePerformance.Fail;
      const currentAbundanceStacks = this.selectedCombatant.getBuffStacks(SPELLS.ABUNDANCE_BUFF.id);
      if (currentAbundanceStacks > 0) {
        castNote =
          i18n._(
            defineMessage({
              id: 'restoration.regrowth.no_cc_low_abundance_prefix',
              message: 'No Clearcasting and only ',
            }),
          ) +
          currentAbundanceStacks +
          (currentAbundanceStacks > 1
            ? i18n._(
                defineMessage({
                  id: 'restoration.regrowth.abundance_stacks',
                  message: ' Abundance stacks',
                }),
              )
            : i18n._(
                defineMessage({
                  id: 'restoration.regrowth.abundance_stack',
                  message: ' Abundance stack',
                }),
              )) +
          i18n._(
            defineMessage({
              id: 'restoration.regrowth.abundance_stacks_needed',
              message: ' (need 6+)',
            }),
          );
      } else {
        castNote = i18n._(
          defineMessage({
            id: 'restoration.regrowth.no_cc_or_abundance',
            message: 'No Clearcasting or Abundance stacks',
          }),
        );
      }
    }

    const targetHealthString =
      targetHealthPercent !== undefined
        ? `${formatPercentage(targetHealthPercent, 0)}`
        : i18n._(defineMessage({ id: 'restoration.regrowth.unknown_health', message: 'unknown' }));
    const overhealString =
      overhealPercent !== undefined
        ? ' (' +
          formatPercentage(overhealPercent, 0) +
          i18n._(
            defineMessage({ id: 'restoration.regrowth.overheal_suffix', message: '% overheal)' }),
          )
        : '';

    this.castEntries.push({
      value: performance,
      tooltip: (
        <>
          @ <strong>{this.owner.formatTimestamp(event.timestamp)}</strong> - {castNote}
          {overhealString}
          <br />
          {t({ id: 'restoration.regrowth.targeting', message: 'targeting' })}{' '}
          <strong>{this.owner.getTargetName(event)}</strong>{' '}
          {t({ id: 'restoration.regrowth.with_health', message: 'w/' })}{' '}
          <strong>{targetHealthString}%</strong>{' '}
          {t({ id: 'restoration.regrowth.health', message: 'health' })}
        </>
      ),
    });
  }

  onFightEnd() {
    if (this.selectedCombatant.hasBuff(SPELLS.CLEARCASTING_BUFF.id)) {
      this.endingClearcasts = 1;
    }
  }

  get usedClearcasts() {
    return this.ccRegrowths;
  }

  get expiredClearcasts() {
    return (
      this.totalClearcasts -
      this.overwrittenClearcasts -
      this.usedClearcasts -
      this.endingClearcasts
    );
  }

  get wastedClearcasts() {
    return this.totalClearcasts - this.usedClearcasts;
  }

  /** Percentage of gained clearcasts that were used */
  get clearcastUtilPercent() {
    // return 100% when no clearcasts to avoid suggestion
    // clearcast still active at end shouldn't be counted in util, hence the subtraction from total
    return this.totalClearcasts === 0
      ? 1
      : this.usedClearcasts / (this.totalClearcasts - this.endingClearcasts);
  }

  get freeRegrowths() {
    return this.innervateRegrowths + this.ccRegrowths + this.nsRegrowths;
  }

  /** Guide subsection describing the proper usage of Regrowth */
  get guideSubsection(): JSX.Element {
    const hasAbundance = this.selectedCombatant.hasTalent(TALENTS_DRUID.ABUNDANCE_TALENT);
    const explanation = this.hasNaturesBounty ? (
      <p>
        <b>
          <SpellLink spell={SPELLS.REGROWTH} />
        </b>{' '}
        {t({
          id: 'restoration.regrowth.explanation_nb',
          message: 'is for spot healing. The HoT is normally very weak, but with',
        })}{' '}
        <SpellLink spell={TALENTS_DRUID.NATURES_BOUNTY_TALENT} />{' '}
        {t({
          id: 'restoration.regrowth.explanation_nb_p2',
          message:
            'it becomes important to play around. Try to avoid overwriting existing Regrowth HoTs when choosing targets in order to maximize cleave healing from',
        })}{' '}
        <SpellLink spell={TALENTS_DRUID.NATURES_BOUNTY_TALENT} />.{' '}
        {t({
          id: 'restoration.regrowth.explanation_nb_p3',
          message: 'Also be careful not to cast Regrowth without a',
        })}{' '}
        <SpellLink spell={SPELLS.CLEARCASTING_BUFF} />{' '}
        {t({ id: 'restoration.regrowth.explanation_nb_p4', message: 'proc' })}
        {hasAbundance && (
          <>
            {' '}
            {t({
              id: 'restoration.regrowth.explanation_nb_p5',
              message: 'or enough',
            })}{' '}
            <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />{' '}
            {t({ id: 'restoration.regrowth.explanation_nb_p6', message: 'stacks' })}
          </>
        )}
        {t({
          id: 'restoration.regrowth.explanation_nb_p7',
          message: ', as it is very mana inefficient otherwise.',
        })}
      </p>
    ) : (
      <p>
        <b>
          <SpellLink spell={SPELLS.REGROWTH} />
        </b>{' '}
        {t({
          id: 'restoration.regrowth.explanation_base',
          message:
            'is for spot healing. The HoT is very weak — Regrowth is only efficient when its direct portion is effective. Try to minimize overheal on the direct portion. Exceptions are when Regrowth is free due to',
        })}{' '}
        <SpellLink spell={SPELLS.CLEARCASTING_BUFF} /> /{' '}
        <SpellLink spell={SPELLS.NATURES_SWIFTNESS} />
        {hasAbundance && (
          <>
            {' '}
            {t({
              id: 'restoration.regrowth.explanation_base_p2',
              message: 'or cheap due to',
            })}{' '}
            <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />
          </>
        )}
        .
      </p>
    );

    const data = (
      <div>
        <div>
          <CastSummaryAndBreakdown
            spell={SPELLS.REGROWTH}
            castEntries={this.castEntries}
            badExtraExplanation={
              <Trans id="restoration.regrowth.bad_extra_explanation">
                without Clearcasting or low Abundance stacks
              </Trans>
            }
            goodExtraExplanation={
              this.hasNaturesBounty
                ? t({
                    id: 'restoration.regrowth.good_extra_nb',
                    message:
                      'free/cheap on a new Regrowth target, or triage on a critically low target',
                  })
                : t({
                    id: 'restoration.regrowth.good_extra_base',
                    message:
                      'free/cheap with effective healing, or triage on a critically low target',
                  })
            }
            okExtraExplanation={
              this.hasNaturesBounty
                ? t({
                    id: 'restoration.regrowth.ok_extra_nb',
                    message:
                      'free/cheap but overwrote an existing Regrowth HoT outside pandemic window',
                  })
                : t({
                    id: 'restoration.regrowth.ok_extra_base',
                    message: 'free/cheap but high overheal',
                  })
            }
          />
        </div>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        position={STATISTIC_ORDER.CORE(20)} // chosen for fixed ordering of general stats
        tooltip={
          <>
            <SpellLink spell={SPELLS.REGROWTH} />{' '}
            {t({
              id: 'restoration.regrowth.statistic_tooltip_p1',
              message: 'is mana inefficient relative to',
            })}{' '}
            <SpellLink spell={SPELLS.REJUVENATION} />{' '}
            {t({
              id: 'restoration.regrowth.statistic_tooltip_p2',
              message: 'and should only be cast when free due to',
            })}{' '}
            <SpellLink spell={SPELLS.INNERVATE} />, <SpellLink spell={SPELLS.NATURES_SWIFTNESS} />{' '}
            {t({
              id: 'restoration.regrowth.statistic_tooltip_p3',
              message: 'or',
            })}{' '}
            <SpellLink spell={SPELLS.CLEARCASTING_BUFF} />,{' '}
            {this.hasAbundance && (
              <>
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_p4',
                  message: 'cheap due to',
                })}{' '}
                {ABUNDANCE_EXCEPTION_STACKS}+ <SpellLink spell={TALENTS_DRUID.ABUNDANCE_TALENT} />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_p5',
                  message: 'stacks,',
                })}
              </>
            )}{' '}
            {t({
              id: 'restoration.regrowth.statistic_tooltip_p6',
              message: 'or to save a critically low health target.',
            })}
            <br />
            <br />
            <strong>
              {t({
                id: 'restoration.regrowth.statistic_tooltip_p7',
                message: 'You hardcast',
              })}{' '}
              {this.totalRegrowths} <SpellLink spell={SPELLS.REGROWTH} />
            </strong>
            <ul>
              <li>
                <SpellIcon spell={SPELLS.INNERVATE} />{' '}
                <SpellIcon spell={SPELLS.CLEARCASTING_BUFF} />{' '}
                <SpellIcon spell={SPELLS.NATURES_SWIFTNESS} />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_free_casts',
                  message: 'Free Casts:',
                })}{' '}
                <strong>{this.freeRegrowths}</strong>
              </li>
              {this.hasAbundance && (
                <li>
                  <SpellIcon spell={SPELLS.ABUNDANCE_BUFF} />{' '}
                  {t({
                    id: 'restoration.regrowth.statistic_tooltip_cheap_casts',
                    message: 'Cheap Casts:',
                  })}{' '}
                  <strong>{this.abundanceRegrowths}</strong>
                </li>
              )}
              <li>
                <HealthIcon />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_triage',
                  message: 'Full Price Triage',
                })}{' '}
                ({'<'}
                {formatPercentage(TRIAGE_THRESHOLD, 0)}% HP){' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_casts',
                  message: 'Casts:',
                })}{' '}
                <strong>{this.triageRegrowths}</strong>
              </li>
              {this.okRegrowths > 0 && (
                <li>
                  {t({
                    id: 'restoration.regrowth.statistic_tooltip_ok_casts',
                    message: 'Ok Casts:',
                  })}{' '}
                  <strong>{this.okRegrowths}</strong>
                </li>
              )}
              <li>
                <CrossIcon />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_bad_casts',
                  message: 'Bad Casts:',
                })}{' '}
                <strong>{this.badRegrowths}</strong>
              </li>
            </ul>
            <br />
            <strong>
              {t({
                id: 'restoration.regrowth.statistic_tooltip_cc_gained',
                message: 'You gained',
              })}{' '}
              {this.totalClearcasts} <SpellLink spell={SPELLS.CLEARCASTING_BUFF} />
            </strong>
            <ul>
              <li>
                <SpellIcon spell={SPELLS.REGROWTH} />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_used',
                  message: 'Used:',
                })}{' '}
                <strong>{this.usedClearcasts}</strong>
              </li>
              <li>
                <CrossIcon />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_overwritten',
                  message: 'Overwritten:',
                })}{' '}
                <strong>{this.overwrittenClearcasts}</strong>
              </li>
              <li>
                <UptimeIcon />{' '}
                {t({
                  id: 'restoration.regrowth.statistic_tooltip_expired',
                  message: 'Expired:',
                })}{' '}
                <strong>{this.expiredClearcasts}</strong>
              </li>
              {this.endingClearcasts > 0 && (
                <li>
                  {t({
                    id: 'restoration.regrowth.statistic_tooltip_active',
                    message: 'Still active at fight end:',
                  })}{' '}
                  <strong>{this.endingClearcasts}</strong>
                </li>
              )}
            </ul>
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.REGROWTH}>
          <>
            {this.badRegrowths === 0 ? <CheckmarkIcon /> : <CrossIcon />}
            {'  '}
            {this.badRegrowths}{' '}
            <small>{t({ id: 'restoration.regrowth.bad_casts', message: 'bad casts' })}</small>
            <br />
            <SpellIcon spell={SPELLS.CLEARCASTING_BUFF} />
            {'  '}
            {formatPercentage(this.clearcastUtilPercent, 1)}%{' '}
            <small>{t({ id: 'restoration.regrowth.util_label', message: 'util' })}</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default RegrowthAndClearcasting;
