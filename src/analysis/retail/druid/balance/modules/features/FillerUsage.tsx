import SPELLS from 'common/SPELLS';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { hardcastTargetsHit } from '../../normalizers/CastLinkNormalizer';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { currentEclipse } from 'analysis/retail/druid/balance/constants';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import { TALENTS_DRUID } from 'common/TALENTS';

// TODO TWW - look at these numbers again after TWW talent changes / sims
const MIN_STARFIRE_TARGETS_LUNAR = 3;
const MIN_STARFIRE_TARGETS_CA = 4;

export default class FillerUsage extends Analyzer {
  /** Total number of wrath hardcasts */
  totalWraths = 0;
  /** Wrath hardcasts during Lunar Eclipse */
  lunarWraths = 0;

  /** Total number of starfire hardcasts */
  totalStarfires = 0;
  /** Starfire hardcasts that hit too few targets */
  lowTargetStarfires = 0;
  /** Starfire hardcasts during Solar Eclipse */
  solarStarfires = 0;
  /** Starefire casts w/ Lunar Calling outside of Eclipse (must wrath to enter Eclipse) */
  noEclipseLcStarfires = 0;

  hasLunarCalling: boolean;

  constructor(options: Options) {
    super(options);

    this.hasLunarCalling = this.selectedCombatant.hasTalent(TALENTS_DRUID.LUNAR_CALLING_TALENT);

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.STARFIRE), this.onStarfire);
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.WRATH_MOONKIN),
      this.onWrath,
    );
  }

  onStarfire(event: CastEvent) {
    this.totalStarfires += 1;
    const targetsHit = hardcastTargetsHit(event);
    const eclipse = currentEclipse(this.selectedCombatant);

    if (eclipse === 'solar') {
      addInefficientCastReason(
        event,
        defineMessage({
          id: 'balance.filler.solar_starfire_reason',
          message: 'Use Wrath instead of Starfire in Solar Eclipse, regardless of target count',
        }),
      );
      this.solarStarfires += 1;
    } else if (eclipse === 'lunar' && !this.hasLunarCalling) {
      if (targetsHit < MIN_STARFIRE_TARGETS_LUNAR) {
        addInefficientCastReason(
          event,
          defineMessage({
            id: 'balance.filler.too_few_targets',
            message: `You hit too few targets: ${targetsHit} - use Wrath instead`,
          }),
        );
        this.lowTargetStarfires += 1;
      }
    } else if (eclipse === 'both' && !this.hasLunarCalling) {
      if (targetsHit < MIN_STARFIRE_TARGETS_CA) {
        addInefficientCastReason(
          event,
          defineMessage({
            id: 'balance.filler.too_few_targets_ca',
            message: `You hit too few targets: ${targetsHit} - use Wrath instead`,
          }),
        );
        this.lowTargetStarfires += 1;
      }
    } else if (eclipse === 'none' && this.hasLunarCalling) {
      addInefficientCastReason(
        event,
        defineMessage({
          id: 'balance.filler.no_eclipse_lc_reason',
          message:
            'You cast Starfire while not in eclipse. Because you took Lunar Calling, you need to use Wrath to reenter eclipse.',
        }),
      );
    }
  }

  onWrath(event: CastEvent) {
    this.totalWraths += 1;
    const eclipse = currentEclipse(this.selectedCombatant);

    if (eclipse === 'lunar') {
      this.lunarWraths += 1;
    }
  }

  get totalFillers() {
    return this.totalWraths + this.totalStarfires;
  }

  get goodFillers() {
    return this.totalFillers - this.okFillers - this.badFillers;
  }

  get okFillers() {
    return this.lunarWraths;
  }

  get badFillers() {
    return this.lowTargetStarfires + this.solarStarfires + this.noEclipseLcStarfires;
  }

  get percentGoodFillers() {
    return this.totalFillers === 0 ? 1 : this.goodFillers / this.totalFillers;
  }

  get guideSubsection() {
    const explanation = (
      <>
        <p>
          <Trans id="balance.filler.explanation_p1">
            <strong>Filler spells</strong> are{' '}
            <strong>
              <SpellLink spell={SPELLS.WRATH} />
            </strong>{' '}
            and{' '}
            <strong>
              <SpellLink spell={SPELLS.STARFIRE} />
            </strong>
            .
          </Trans>
        </p>
        <p>
          <Trans id="balance.filler.explanation_p2">
            They are spammable and generate Astral Power. Use <SpellLink spell={SPELLS.WRATH} /> in
            single target and <SpellLink spell={SPELLS.STARFIRE} /> against multiple stacked
            targets.
          </Trans>
        </p>
        <p>
          <Trans id="balance.filler.explanation_p3">
            Your fillers are greatly buffed by their corresponding{' '}
            <SpellLink spell={TALENTS_DRUID.ECLIPSE_TALENT} /> - aim to enter an Eclipse that
            matches your current target count.
          </Trans>
        </p>
        {this.hasLunarCalling && (
          <p>
            <i>
              <Trans id="balance.filler.explanation_lc">
                However, because you took <SpellLink spell={TALENTS_DRUID.LUNAR_CALLING_TALENT} />,
                you can only enter Lunar Eclipse. When Eclipse drops you must use Wrath to reenter
                Eclipse.
              </Trans>
            </i>
          </p>
        )}
        {!this.hasLunarCalling && (
          <p>
            <Trans id="balance.filler.explanation_no_lc">
              If you make a mistake and find yourself in Lunar Eclipse with no stacked targets or in
              Solar Eclipse with stacked targets, you should use <SpellLink spell={SPELLS.WRATH} />.
            </Trans>
          </p>
        )}
      </>
    );

    const goodFillerData = {
      count: this.goodFillers,
      label: <Trans id="balance.filler.good_label">Good Fillers</Trans>,
    };
    const okFillerData = {
      count: this.okFillers,
      label: (
        <Trans id="balance.filler.ok_label">
          Wraths during Lunar Eclipse (did you enter the wrong Eclipse?)
        </Trans>
      ),
    };
    const badFillerData = {
      count: this.badFillers,
      label: this.hasLunarCalling ? (
        <Trans id="balance.filler.bad_lc_label">
          Starfire when out of Eclipse (with Lunar Calling, you must Wrath to enter eclipse)
        </Trans>
      ) : (
        <Trans id="balance.filler.bad_no_lc_label">
          Starfires during Solar Eclipse or that hit too few targets
        </Trans>
      ),
    };

    const data = (
      <div>
        <strong>
          <Trans id="balance.filler.breakdown_title">Filler cast breakdown</Trans>
        </strong>
        <small>
          {' '}
          <Trans id="balance.filler.breakdown_desc">
            - Green is a good cast, Yellow is a Wrath during Lunar Eclipse, Red is a bad Starfire.
            Mouseover for more details.
          </Trans>
        </small>
        <GradiatedPerformanceBar good={goodFillerData} ok={okFillerData} bad={badFillerData} />
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}
