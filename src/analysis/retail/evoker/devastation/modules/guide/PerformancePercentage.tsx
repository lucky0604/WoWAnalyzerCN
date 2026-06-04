import { PerformanceMark } from 'interface/guide';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { formatNumber, formatPercentage } from 'common/format';
import PerformanceStrongWithTooltip from 'interface/PerformanceStrongWithTooltip';
import { t } from '@lingui/core/macro';

interface Props {
  performance: QualitativePerformance;
  perfectPercentage: number;
  goodPercentage: number;
  okPercentage: number;
  percentage: number;
  flatAmount: number;
}
const PerformancePercentage = ({
  performance,
  perfectPercentage,
  goodPercentage,
  okPercentage,
  percentage,
  flatAmount,
}: Props) => {
  const perfectSign = perfectPercentage > 0 ? '<=' : '=';

  return (
    <PerformanceStrongWithTooltip
      performance={performance}
      tooltip={
        <>
          <div>
            <PerformanceMark perf={QualitativePerformance.Perfect} />{' '}
            {t({ id: 'evoker.devastation.performancePercentage.perfect', message: 'Perfect usage' })}{' '}
            {perfectSign} {formatPercentage(perfectPercentage, 0)}%
          </div>
          <div>
            <PerformanceMark perf={QualitativePerformance.Good} />{' '}
            {t({ id: 'evoker.devastation.performancePercentage.good', message: 'Good usage' })}{' '}
            &lt;= {formatPercentage(goodPercentage, 0)}%
          </div>
          <div>
            <PerformanceMark perf={QualitativePerformance.Ok} />{' '}
            {t({ id: 'evoker.devastation.performancePercentage.ok', message: 'OK usage' })}{' '}
            &lt;= {formatPercentage(okPercentage, 0)}%
          </div>
        </>
      }
    >
      {formatNumber(flatAmount)} ({formatPercentage(percentage)}%)
    </PerformanceStrongWithTooltip>
  );
};

export default PerformancePercentage;
