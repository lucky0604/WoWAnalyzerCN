import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ConvokeSpirits } from 'analysis/retail/druid/shared';
import SPELLS from 'common/SPELLS';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemPercentDamageDone from 'parser/ui/ItemPercentDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import CooldownExpandable, {
  CooldownExpandableItem,
} from 'interface/guide/components/CooldownExpandable';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { ApplyBuffEvent } from 'parser/core/Events';
import { PassFailCheckmark } from 'interface/guide';
import { cdSpell } from 'analysis/retail/druid/feral/constants';

class ConvokeSpiritsFeral extends ConvokeSpirits {
  /** Mapping from convoke cast number to a tracker for that cast - note that index zero will always be empty */
  feralConvokeTracker: FeralConvokeCast[] = [];

  onConvoke(event: ApplyBuffEvent) {
    super.onConvoke(event);

    const tfOnCast = this.selectedCombatant.hasBuff(SPELLS.TIGERS_FURY.id);
    const berserkOnCast = this.selectedCombatant.hasBuff(cdSpell(this.selectedCombatant));

    this.feralConvokeTracker[this.cast] = {
      tfOnCast,
      berserkOnCast,
    };
  }

  // TODO also show energy and CP gained
  statistic() {
    return (
      <Statistic
        wide
        position={STATISTIC_ORDER.CORE()}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            <p>
              <strong>
                <Trans id="druid.feral.convoke.damage_caveat_p1">
                  Damage amount listed considers only the direct damage and non-refreshable DoT
                  damage done by convoked abilities!{' '}
                </Trans>
              </strong>
              <Trans id="druid.feral.convoke.damage_caveat_p2">
                (Non-refreshable DoTs are Starfall and Feral Frenzy) Refreshable DoTs, heals, and
                the energy and damage boost from Tiger's Fury are all not considered by this number,
                making it almost certainly an undercount of Convoke's true value.
              </Trans>
            </p>
            {this.baseTooltip}
          </>
        }
        dropdown={this.baseTable}
      >
        <BoringSpellValueText spell={SPELLS.CONVOKE_SPIRITS}>
          <ItemPercentDamageDone greaterThan amount={this.totalDamage} />
        </BoringSpellValueText>
      </Statistic>
    );
  }

  /** Guide fragment showing a breakdown of each Convoke cast */
  get guideCastBreakdown() {
    const explanation = (
      <>
        <p>
          <Trans id="druid.feral.convoke.explanation">
            <strong>
              <SpellLink spell={SPELLS.CONVOKE_SPIRITS} />
            </strong>{' '}
            is a powerful but somewhat random burst of damage. Always pair it with{' '}
            <SpellLink spell={SPELLS.TIGERS_FURY} /> and{' '}
            <SpellLink spell={cdSpell(this.selectedCombatant)} /> to maximize damage.
          </Trans>
        </p>
      </>
    );

    const data = (
      <div>
        <strong>
          {t({ id: 'druid.feral.convoke.per_cast_breakdown', message: 'Per-Cast Breakdown' })}
        </strong>
        <small>{t({ id: 'druid.feral.convoke.click_expand', message: '- click to expand' })}</small>
        {this.convokeTracker.map((cast, ix) => {
          const feralCast = this.feralConvokeTracker[ix];

          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.timestamp)} &mdash;{' '}
              <SpellLink spell={SPELLS.CONVOKE_SPIRITS} />
            </>
          );

          let overallPerf = QualitativePerformance.Good;

          const checklistItems: CooldownExpandableItem[] = [];
          checklistItems.push({
            label: (
              <Trans id="druid.feral.convoke.tf_active">
                <SpellLink spell={SPELLS.TIGERS_FURY} /> active
              </Trans>
            ),
            result: <PassFailCheckmark pass={feralCast.tfOnCast} />,
          });
          if (!feralCast.tfOnCast) {
            overallPerf = QualitativePerformance.Fail;
          }

          checklistItems.push({
            label: (
              <Trans id="druid.feral.convoke.berserk_active">
                <SpellLink spell={cdSpell(this.selectedCombatant)} /> active
              </Trans>
            ),
            result: <PassFailCheckmark pass={feralCast.berserkOnCast} />,
          });
          if (!feralCast.berserkOnCast) {
            overallPerf = QualitativePerformance.Fail;
          }

          return (
            <CooldownExpandable
              header={header}
              checklistItems={checklistItems}
              perf={overallPerf}
              key={ix}
            />
          );
        })}
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}

/** A tracker for feral specific things that happen in a single Convoke cast */
interface FeralConvokeCast {
  tfOnCast: boolean;
  berserkOnCast: boolean;
}

export default ConvokeSpiritsFeral;
