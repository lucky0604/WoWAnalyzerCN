import Analyzer from 'parser/core/Analyzer';
import StatisticBar from 'parser/ui/StatisticBar';
import { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';
import { SpellLink } from 'interface';
import SPELLS from 'common/SPELLS';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import ShadowWordPain from 'analysis/retail/priest/shared/ShadowWordPain';
import { TALENTS_PRIEST } from 'common/TALENTS';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

class DotUptimes extends Analyzer {
  static dependencies = {
    shadowWordPain: ShadowWordPain,
  };
  protected shadowWordPain!: ShadowWordPain;

  get guideSubsection() {
    const explanation = (
      <>
        <p>
          <strong>
            <Trans id="priest.discipline.dotUptimes.explanation.title">
              Keep your DoTs up on the boss.
            </Trans>
          </strong>
        </p>
        <p>
          <>{t({ id: 'priest.discipline.dotUptimes.explanation.swp.p1', message: 'By keeping ' })}<SpellLink spell={SPELLS.SHADOW_WORD_PAIN} />{t({ id: 'priest.discipline.dotUptimes.explanation.swp.p2', message: ' active, your over time healing through ' })}<SpellLink spell={SPELLS.ATONEMENT_BUFF} />{t({ id: 'priest.discipline.dotUptimes.explanation.swp.p3', message: ' is increased.' })}</>
        </p>
        <p>
          <>{t({ id: 'priest.discipline.dotUptimes.explanation.synergies.p1', message: 'If talented, ' })}<SpellLink spell={TALENTS_PRIEST.POWER_OF_THE_DARK_SIDE_TALENT} />{t({ id: 'priest.discipline.dotUptimes.explanation.synergies.p2', message: ', ' })}<SpellLink spell={TALENTS_PRIEST.SHADOW_MEND_TALENT} />{t({ id: 'priest.discipline.dotUptimes.explanation.synergies.p3', message: ', and ' })}<SpellLink spell={TALENTS_PRIEST.EXPIATION_TALENT} />{t({ id: 'priest.discipline.dotUptimes.explanation.synergies.p4', message: ' will synergize with ' })}<SpellLink spell={SPELLS.SHADOW_WORD_PAIN} />{t({ id: 'priest.discipline.dotUptimes.explanation.synergies.p5', message: ' and increase your overall output.' })}</>
        </p>
      </>
    );

    const data = <RoundedPanel>{this.shadowWordPain.subStatistic()}</RoundedPanel>;

    return explanationAndDataSubsection(explanation, data);
  }

  statistic() {
    return (
      <StatisticBar wide position={STATISTIC_ORDER.CORE(1)}>
        {this.shadowWordPain.subStatistic()}
      </StatisticBar>
    );
  }
}

export default DotUptimes;
