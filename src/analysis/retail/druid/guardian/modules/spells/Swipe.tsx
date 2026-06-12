import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SpellLink from 'interface/SpellLink';
import SPELLS from 'common/SPELLS';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { Options } from 'parser/core/Module';
import Events, { CastEvent } from 'parser/core/Events';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { cdSpell, inBerserk } from 'analysis/retail/druid/guardian/constants';

export default class Swipe extends Analyzer.withDependencies({ spellUsable: SpellUsable }) {
  castEntries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SWIPE_BEAR),
      this.onSwipeCast,
    );
  }

  onSwipeCast(event: CastEvent) {
    const hasBerserk = inBerserk(this.selectedCombatant);
    const remainingThrashCd = this.deps.spellUsable.cooldownRemaining(SPELLS.THRASH_BEAR.id);
    const remainingMangleCd = this.deps.spellUsable.cooldownRemaining(SPELLS.MANGLE_BEAR.id);

    const value =
      remainingThrashCd <= 1000 || remainingMangleCd <= 1000 || hasBerserk
        ? QualitativePerformance.Fail
        : QualitativePerformance.Good;
    const tooltip = (
      <>
        @<strong>{this.owner.formatTimestamp(event.timestamp)}</strong>
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {hasBerserk && (
          <>
            {t({ id: 'druid.guardian.swipe.in_berserk', message: 'in ' })}
            <SpellLink spell={cdSpell(this.selectedCombatant)} />
            {t({
              id: 'druid.guardian.swipe.in_berserk.p2',
              message: ' (Mangle or Thrash always available)',
            })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        )}
        {remainingMangleCd === 0 && (
          <>
            <SpellLink spell={SPELLS.MANGLE_BEAR} />
            {t({ id: 'druid.guardian.swipe.mangle_available', message: ' was available' })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        )}
        {remainingMangleCd > 0 && remainingMangleCd < 1000 && (
          <>
            <SpellLink spell={SPELLS.MANGLE_BEAR} />
            {t({
              id: 'druid.guardian.swipe.mangle_available_in',
              message: ' is available in ',
            })}
            {(remainingMangleCd / 1000).toFixed(1)}
            {t({ id: 'druid.guardian.swipe.mangle_available_in.p2', message: ' seconds.' })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        )}
        {remainingThrashCd === 0 && (
          <>
            <SpellLink spell={SPELLS.THRASH_BEAR} />
            {t({ id: 'druid.guardian.swipe.thrash_available', message: ' was available' })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        )}
        {remainingThrashCd > 0 && remainingThrashCd < 1000 && (
          <>
            <SpellLink spell={SPELLS.THRASH_BEAR} />
            {t({
              id: 'druid.guardian.swipe.thrash_available_in',
              message: ' is available in ',
            })}
            {(remainingThrashCd / 1000).toFixed(1)}
            {t({ id: 'druid.guardian.swipe.thrash_available_in.p2', message: ' seconds.' })}
            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
            <br />
          </>
        )}
      </>
    );

    this.castEntries.push({
      value,
      tooltip,
    });
  }

  get guideSubsection() {
    const explanation = (
      <>
        <p>
          <strong>
            <SpellLink spell={SPELLS.SWIPE_BEAR} />
          </strong>{' '}
          {t({
            id: 'druid.guardian.swipe.explanation_p1',
            message:
              "is your filler spell. It does not generate rage and does very weak damage. Swipe is barely better than an empty GCD and shouldn't be used if it delays another ability - even by a little.",
          })}
        </p>
        <p>
          <strong>
            <Trans id="druid.guardian.swipe.explanation_p2">
              Generally speaking, it's fine not to use Swipe at all.
            </Trans>
          </strong>
        </p>
      </>
    );

    const data =
      this.castEntries.length !== 0 ? (
        <div>
          <strong>{t({ id: 'druid.guardian.swipe.casts_title', message: 'Swipe casts' })}</strong>
          <small>
            <Trans id="druid.guardian.swipe.casts_legend">
              - Green is an acceptable cast, Red is when another spell was available or almost
              available
            </Trans>
          </small>
          <PerformanceBoxRow values={this.castEntries} />
        </div>
      ) : (
        <div>
          <strong>
            {t({
              id: 'druid.guardian.swipe.never_used',
              message: 'You never used Swipe this encounter.',
            })}
          </strong>
        </div>
      );

    return explanationAndDataSubsection(explanation, data);
  }
}
