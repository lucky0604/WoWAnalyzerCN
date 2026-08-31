import { formatNumber } from 'common/format';
import SPELLS from 'common/SPELLS';
import { t } from '@lingui/core/macro';
import { SpellLink, Tooltip } from 'interface';
import { PassFailCheckmark } from 'interface/guide';
import InformationIcon from 'interface/icons/Information';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent, HealEvent } from 'parser/core/Events';

import CooldownExpandable, {
  CooldownExpandableItem,
} from 'interface/guide/components/CooldownExpandable';
import { GUIDE_CORE_EXPLANATION_PERCENT } from 'analysis/retail/druid/restoration/Guide';
import { getTranquilityTicks } from 'analysis/retail/druid/restoration/normalizers/CastLinkNormalizer';
import HotTrackerRestoDruid from 'analysis/retail/druid/restoration/modules/core/hottracking/HotTrackerRestoDruid';
import { TALENTS_DRUID } from 'common/TALENTS';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';

const MAX_TRANQ_TICKS = 7;
/** Official 12.1 ramp: extend as many Regrowths as possible into Tranquility */
const REGROWTH_RAMP_THRESHOLD = 5;

/**
 * Tracks stats relating to Tranquility
 */
class Tranquility extends Analyzer {
  static dependencies = {
    hotTracker: HotTrackerRestoDruid,
  };

  hotTracker!: HotTrackerRestoDruid;

  tranqCasts: TranquilityCast[] = [];

  constructor(options: Options) {
    super(options);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.TRANQUILITY_CAST),
      this.onTranqCast,
    );
    this.addEventListener(
      Events.heal.by(SELECTED_PLAYER).spell(SPELLS.TRANQUILITY_HEAL),
      this.onTranqHeal,
    );
  }

  onTranqCast(event: CastEvent) {
    const directHealing = 0;
    const rejuvsOnCast =
      this.hotTracker.getHotCount(SPELLS.REJUVENATION.id) +
      this.hotTracker.getHotCount(SPELLS.REJUVENATION_GERMINATION.id);
    const wgsOnCast = this.hotTracker.getHotCount(SPELLS.WILD_GROWTH.id);
    const regrowthsOnCast = this.hotTracker.getHotCount(SPELLS.REGROWTH.id);
    const timestamp = event.timestamp;
    const channeledTicks = getTranquilityTicks(event).length;
    this.tranqCasts.push({
      timestamp,
      directHealing,
      wgsOnCast,
      rejuvsOnCast,
      regrowthsOnCast,
      channeledTicks,
    });
  }

  onTranqHeal(event: HealEvent) {
    const effectiveAmount = event.amount + (event.absorbed || 0);
    if (this.tranqCasts.length > 0) {
      this.tranqCasts[this.tranqCasts.length - 1].directHealing += effectiveAmount;
    }
  }

  /** Guide fragment showing a breakdown of each Tranquility cast */
  get guideCastBreakdown() {
    const explanation = (
      <>
        <p>
          <strong>
            <SpellLink spell={SPELLS.TRANQUILITY_CAST} />
          </strong>{' '}
          {t({
            id: 'restoration.tranquility.explanation_p1',
            message:
              "is your most powerful raid healing cooldown. You should line it up with the most dangerous moments of the fight, and in many raids you'll be assigned to use it at specific timings.",
          })}
        </p>
        {this.selectedCombatant.hasTalent(TALENTS_DRUID.FLOURISH_TALENT) && (
          <>
            <p>
              {t({ id: 'restoration.tranquility.flourish_p1', message: 'In Midnight, ' })}
              <strong>
                {t({
                  id: 'restoration.tranquility.flourish_strong',
                  message: 'Flourish is passive on Tranquility',
                })}
              </strong>
              {t({
                id: 'restoration.tranquility.flourish_p2',
                message:
                  '. Each Tranquility tick extends active HoTs by 2 seconds (up to 10 seconds overall). The most valuable HoT to extend is ',
              })}
              <SpellLink spell={SPELLS.REGROWTH} />
              {t({
                id: 'restoration.tranquility.flourish_p3',
                message:
                  '. Those extended HoTs give you a wide window to keep casting Regrowth afterwards',
              })}
              {this.selectedCombatant.hasTalent(TALENTS_DRUID.NATURES_BOUNTY_TALENT) ? (
                <>
                  {t({
                    id: 'restoration.tranquility.flourish_nb',
                    message: ', and those casts splash via ',
                  })}
                  <SpellLink spell={TALENTS_DRUID.NATURES_BOUNTY_TALENT} />
                </>
              ) : null}
              .
            </p>
            <p>
              {t({
                id: 'restoration.tranquility.ramp_p1',
                message:
                  'Start the ramp about 15–20 seconds before Tranquility is assigned: ',
              })}
              <SpellLink spell={SPELLS.SWIFTMEND} />
              {t({ id: 'restoration.tranquility.ramp_p2', message: ', a few ' })}
              <SpellLink spell={SPELLS.REJUVENATION} />
              {t({ id: 'restoration.tranquility.ramp_p3', message: 's, as many ' })}
              <SpellLink spell={SPELLS.REGROWTH} />
              {t({
                id: 'restoration.tranquility.ramp_p4',
                message:
                  's as you can, Swiftmend again, another Regrowth, ',
              })}
              <SpellLink spell={SPELLS.WILD_GROWTH} />
              {t({
                id: 'restoration.tranquility.ramp_p5',
                message:
                  ', then Tranquility, then Regrowth spam. After the channel, keep spending on Regrowth while the extended HoTs last.',
              })}
            </p>
          </>
        )}
        {this.selectedCombatant.hasTalent(TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT) && (
          <p>
            {t({ id: 'restoration.tranquility.incarnation_p1', message: 'If you take ' })}
            <SpellLink spell={TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT} />
            {t({
              id: 'restoration.tranquility.incarnation_p2',
              message:
                ', it is often worth combining it with Tranquility because channeling Tranquility pauses the remaining duration of your Tree buff.',
            })}
          </p>
        )}
        <p>
          {t({
            id: 'restoration.tranquility.positioning',
            message:
              'Watch your positioning before casting so you can complete the full channel without moving and avoid clipping ticks at the end. In dungeons, Tranquility is used more for the healing it does by itself than for its ramp combo. Press it when the group is in danger.',
          })}
        </p>
      </>
    );

    const data = (
      <div>
        <strong>
          {t({ id: 'restoration.tranquility.per_cast_breakdown', message: 'Per-Cast Breakdown' })}
        </strong>
        <small>{t({ id: 'restoration.tranquility.click_to_expand', message: ' - click to expand' })}</small>
        {this.tranqCasts.map((cast, ix) => {
          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.timestamp)} &mdash;{' '}
              <SpellLink spell={SPELLS.TRANQUILITY_CAST} /> (
              {formatNumber(cast.directHealing)}
              {t({ id: 'restoration.tranquility.header_healing', message: ' healing' })})
            </>
          );

          const wgRamp = cast.wgsOnCast > 0;
          const rejuvRamp = cast.rejuvsOnCast >= 5;
          const rgRamp = cast.regrowthsOnCast >= REGROWTH_RAMP_THRESHOLD;
          const channeledMaxTicks = cast.channeledTicks === MAX_TRANQ_TICKS;
          const overallPerf =
            wgRamp && rgRamp && channeledMaxTicks
              ? QualitativePerformance.Good
              : QualitativePerformance.Fail;

          const checklistItems: CooldownExpandableItem[] = [];
          checklistItems.push({
            label: (
              <>
                <SpellLink spell={SPELLS.WILD_GROWTH} />
                {t({ id: 'restoration.tranquility.ramp', message: ' ramp' })}
              </>
            ),
            result: <PassFailCheckmark pass={wgRamp} />,
            details: (
              <>
                ({cast.wgsOnCast}
                {t({ id: 'restoration.tranquility.hots_active', message: ' HoTs active' })})
              </>
            ),
          });
          checklistItems.push({
            label: (
              <>
                <SpellLink spell={SPELLS.REGROWTH} />
                {t({ id: 'restoration.tranquility.ramp', message: ' ramp' })}
              </>
            ),
            result: <PassFailCheckmark pass={rgRamp} />,
            details: (
              <>
                ({cast.regrowthsOnCast}
                {t({
                  id: 'restoration.tranquility.hots_active_aim',
                  message: ' HoTs active, aim for ',
                })}
                {REGROWTH_RAMP_THRESHOLD}+)
              </>
            ),
          });
          checklistItems.push({
            label: (
              <>
                <SpellLink spell={SPELLS.REJUVENATION} />
                {t({ id: 'restoration.tranquility.rejuvs_active', message: 's active' })}
              </>
            ),
            result: <PassFailCheckmark pass={rejuvRamp} />,
            details: (
              <>
                ({cast.rejuvsOnCast}
                {t({ id: 'restoration.tranquility.hots_active', message: ' HoTs active' })})
              </>
            ),
          });
          checklistItems.push({
            label: (
              <>
                {t({
                  id: 'restoration.tranquility.channeled_full',
                  message: 'Channeled full duration ',
                })}
                <Tooltip
                  hoverable
                  content={
                    <>
                      {t({
                        id: 'restoration.tranquility.channeled_tooltip',
                        message:
                          "Every tick of Tranquility is very powerful - plan ahead so you're in a position to channel it for its full duration, and be careful not to clip ticks at the end.",
                      })}
                    </>
                  }
                >
                  <span>
                    <InformationIcon />
                  </span>
                </Tooltip>
              </>
            ),
            result: <PassFailCheckmark pass={channeledMaxTicks} />,
            details: (
              <>
                ({cast.channeledTicks} / {MAX_TRANQ_TICKS}
                {t({ id: 'restoration.tranquility.ticks_suffix', message: ' ticks' })})
              </>
            ),
          });

          const detailItems: CooldownExpandableItem[] = [];
          detailItems.push({
            label: t({ id: 'restoration.tranquility.direct_healing', message: 'Direct Healing' }),
            result: '',
            details: <>{formatNumber(cast.directHealing)}</>,
          });

          return (
            <CooldownExpandable
              header={header}
              checklistItems={checklistItems}
              detailItems={detailItems}
              perf={overallPerf}
              key={ix}
            />
          );
        })}
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }
}

interface TranquilityCast {
  /** Timestamp of the start of the Tranquility channel */
  timestamp: number;
  /** The healing from this cast's direct portion */
  directHealing: number;
  /** The number of Wild Growths out at the moment this Tranquility is cast */
  wgsOnCast: number;
  /** The number of Rejuvs out at the moment this Tranquility is cast */
  rejuvsOnCast: number;
  /** The number of Regrowths out at the moment this Tranquility is cast */
  regrowthsOnCast: number;
  /** The number of ticks that were channeled in this cast */
  channeledTicks: number;
}

export default Tranquility;
