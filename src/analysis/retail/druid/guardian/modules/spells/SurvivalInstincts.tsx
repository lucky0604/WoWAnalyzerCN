import {
  absoluteMitigation,
  buff,
  MajorDefensiveBuff,
} from 'interface/guide/components/MajorDefensives/MajorDefensiveAnalyzer';
import { t } from '@lingui/core/macro';
import { Options } from 'parser/core/Module';
import Events, { DamageEvent } from 'parser/core/Events';
import { ReactNode } from 'react';
import MajorDefensiveStatistic from 'interface/MajorDefensiveStatistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { SELECTED_PLAYER } from 'parser/core/Analyzer';
import { survivalInstinctsMitigation } from 'analysis/retail/druid/guardian/constants';

/**
 * **Survival Instincts**
 * Spec Talents
 *
 * Reduces all damage the target takes by 50% for 6 sec.
 */
export default class SurvivalInstincts extends MajorDefensiveBuff {
  constructor(options: Options) {
    super(SPELLS.SURVIVAL_INSTINCTS, buff(SPELLS.SURVIVAL_INSTINCTS), options);

    this.addEventListener(Events.damage.to(SELECTED_PLAYER), this.recordDamage);
  }

  private recordDamage(event: DamageEvent) {
    if (this.defensiveActive(event) && !event.sourceIsFriendly) {
      this.recordMitigation({
        event,
        mitigatedAmount: absoluteMitigation(
          event,
          survivalInstinctsMitigation(this.selectedCombatant),
        ),
      });
    }
  }

  description(): React.ReactNode {
    return (
      <>
        <p>
          <strong>
            <SpellLink spell={SPELLS.SURVIVAL_INSTINCTS} />
          </strong>{' '}
          {t({
            id: 'guardian.survivalInstincts.description',
            message: 'provides a brief but very powerful damage reduction.',
          })}
        </p>
        <p>
          {t({
            id: 'guardian.survivalInstincts.usage',
            message:
              'More than your other cooldowns, Survival Instincts can be held for times of extreme danger.',
          })}
        </p>
      </>
    );
  }

  statistic(): ReactNode {
    return <MajorDefensiveStatistic analyzer={this} category={STATISTIC_CATEGORY.TALENTS} />;
  }
}
