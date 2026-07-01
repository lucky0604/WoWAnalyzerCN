import { formatNumber } from 'common/format';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
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
    const timestamp = event.timestamp;
    const channeledTicks = getTranquilityTicks(event).length;
    this.tranqCasts.push({
      timestamp,
      directHealing,
      wgsOnCast,
      rejuvsOnCast,
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
              {t({
                id: 'restoration.tranquility.explanation_p2',
                message: 'In Midnight, ',
              })}
              <strong>
                {t({
                  id: 'restoration.tranquility.explanation_p2_strong',
                  message: 'Flourish is passive on Tranquility',
                })}
              </strong>
              {t({
                id: 'restoration.tranquility.explanation_p2_2',
                message:
                  '. Each Tranquility tick extends active HoTs by 2 seconds (up to 10 seconds overall), so the value of every cast depends heavily on how many HoTs are active when you start channeling.',
              })}
            </p>
            <p>
              {t({
                id: 'restoration.tranquility.explanation_p3',
                message: 'In the lead-up to Tranquility, prioritize setting up as many ',
              })}
              <SpellLink spell={SPELLS.REJUVENATION} />
              {t({
                id: 'restoration.tranquility.explanation_p3_after_rejuv',
                message: 's as possible, then cast ',
              })}
              <SpellLink spell={SPELLS.SWIFTMEND} />
              {t({
                id: 'restoration.tranquility.explanation_p3_after_sm',
                message: ', one more ',
              })}
              <SpellLink spell={SPELLS.REJUVENATION} />
              {t({
                id: 'restoration.tranquility.explanation_p3_after_rejuv2',
                message: ', and a ',
              })}
              <SpellLink spell={SPELLS.WILD_GROWTH} />
              {t({
                id: 'restoration.tranquility.explanation_p3_after_wg',
                message:
                  ' before channeling Tranquility. After the channel starts, use the extended HoT window to cast as many ',
              })}
              <SpellLink spell={SPELLS.REGROWTH} />
              {t({
                id: 'restoration.tranquility.explanation_p3_after_regrowth',
                message: 's as needed.',
              })}
            </p>
          </>
        )}
        {this.selectedCombatant.hasTalent(TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT) && (
          <p>
            {t({
              id: 'restoration.tranquility.explanation_p4',
              message: 'If you are talented into ',
            })}
            <SpellLink spell={TALENTS_DRUID.INCARNATION_TREE_OF_LIFE_TALENT} />
            {t({
              id: 'restoration.tranquility.explanation_p4_2',
              message:
                ", it's often worth combining it with Tranquility, since channeling Tranquility pauses the remaining duration of your Tree buff.",
            })}
          </p>
        )}
        <p>
          <Trans id="restoration.tranquility.explanation_p5">
            Watch your positioning before casting so you can complete the full channel without
            moving and avoid clipping ticks at the end.
          </Trans>
        </p>
      </>
    );

    const data = (
      <div>
        <strong>
          {t({ id: 'restoration.tranquility.per_cast_breakdown', message: 'Per-Cast Breakdown' })}
        </strong>
        <small>
          {t({ id: 'restoration.tranquility.click_expand', message: '- click to expand' })}
        </small>
        {this.tranqCasts.map((cast, ix) => {
          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.timestamp)} &mdash;{' '}
              <SpellLink spell={SPELLS.TRANQUILITY_CAST} /> ({formatNumber(cast.directHealing)}{' '}
              {t({ id: 'restoration.tranquility.healing', message: 'healing' })})
            </>
          );

          const wgRamp = cast.wgsOnCast > 0;
          const rejuvRamp = cast.rejuvsOnCast > 10;
          const channeledMaxTicks = cast.channeledTicks === MAX_TRANQ_TICKS;
          const overallPerf =
            wgRamp && rejuvRamp && channeledMaxTicks
              ? QualitativePerformance.Good
              : QualitativePerformance.Fail;

          const checklistItems: CooldownExpandableItem[] = [];
          checklistItems.push({
            label: (
              <>
                <SpellLink spell={SPELLS.WILD_GROWTH} />{' '}
                {t({ id: 'restoration.tranquility.wg_ramp', message: 'ramp' })}
              </>
            ),
            result: <PassFailCheckmark pass={wgRamp} />,
            details: (
              <Trans id="restoration.tranquility.wg_active">({cast.wgsOnCast} HoTs active)</Trans>
            ),
          });
          checklistItems.push({
            label: (
              <>
                <SpellLink spell={SPELLS.REJUVENATION} />{' '}
                {t({ id: 'restoration.tranquility.rejuv_ramp', message: 'ramp' })}
              </>
            ),
            result: <PassFailCheckmark pass={rejuvRamp} />,
            details: (
              <Trans id="restoration.tranquility.rejuv_active">
                ({cast.rejuvsOnCast} HoTs active)
              </Trans>
            ),
          });
          checklistItems.push({
            label: (
              <>
                <Trans id="restoration.tranquility.channeled_full_duration">
                  Channeled full duration
                </Trans>{' '}
                <Tooltip
                  hoverable
                  content={
                    <Trans id="restoration.tranquility.channeled_full_duration_tooltip">
                      Every tick of Tranquility is very powerful - plan ahead so you're in a
                      position to channel it for its full duration, and be careful not to clip ticks
                      at the end.
                    </Trans>
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
              <Trans id="restoration.tranquility.ticks_count">
                ({cast.channeledTicks} / {MAX_TRANQ_TICKS} ticks)
              </Trans>
            ),
          });

          const detailItems: CooldownExpandableItem[] = [];
          detailItems.push({
            label: t({
              id: 'restoration.tranquility.direct_healing_label',
              message: 'Direct Healing',
            }),
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
  /** The number of Wild Growths out at the moment this Convoke is cast */
  wgsOnCast: number;
  /** The number of Rejuvs out at the moment this Convoke is cast */
  rejuvsOnCast: number;
  /** The number of ticks that were channeled in this cast */
  channeledTicks: number;
}

export default Tranquility;
