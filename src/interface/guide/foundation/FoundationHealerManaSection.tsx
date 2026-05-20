import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import ResourceLink from 'interface/ResourceLink';
import Explanation from '../components/Explanation';
import { SubSection, useAnalyzer } from '../index';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { FoundationHighlight as HL } from './shared';
import AlertInfo from 'interface/AlertInfo';
import ManaLevelChartComponent from 'parser/shared/modules/resources/mana/ManaLevelChartComponent';
import { useReport } from 'interface/report/context/ReportContext';
import Combatants from 'parser/shared/modules/Combatants';
import { useCombatLogParser } from 'interface/report/CombatLogParserContext';
import ManaValues from 'parser/shared/modules/ManaValues';
import HealingEfficiencyTracker from 'parser/core/healingEfficiency/HealingEfficiencyTracker';
import HealingEfficiencyBreakdown from 'parser/core/healingEfficiency/HealingEfficiencyBreakdown';
import Para from '../Para';

export default function FoundationHealerManaSection(): JSX.Element | null {
  const { report } = useReport();
  const {
    combatLogParser: {
      fight: { offset_time, start_time, end_time },
    },
  } = useCombatLogParser();
  const combatants = useAnalyzer(Combatants);
  const manaValues = useAnalyzer(ManaValues);
  const healingEfficiencyTracker = useAnalyzer(HealingEfficiencyTracker);

  return (
    <SubSection
      title={t({
        id: 'guide.foundation.healerMana.spendMana',
        message: 'Spend Your Mana',
      })}
    >
      <Explanation>
        <Para>
          作为<strong>治疗者</strong>，<ResourceLink id={RESOURCE_TYPES.MANA.id} />
          是你最重要的资源。你有两个目标：
          <ol>
            <li>在战斗结束前用完所有法力值。</li>
            <li>不要在战斗结束前耗尽法力值。</li>
          </ol>
        </Para>
        <Para>
          作为一般参考，{' '}
          <HL>你剩余的法力值百分比应该与战斗剩余时间的百分比相匹配。</HL>
          战斗进行到一半时，你应该剩余50%的法力值；战斗剩余25%时，你应该剩余25%的法力值。
        </Para>
        <AlertInfo className="alert-subtle">
          请记住这只是一个参考指南！许多首领战会在战斗早期造成大量团队伤害，需要提前消耗更多法力值。
        </AlertInfo>
      </Explanation>
      <SubSection
        title={t({
          id: 'guide.foundation.healerMana.checkLevel',
          message: 'Check Your Mana Level',
        })}
      >
        <Explanation>
          <Para>
            此图表显示你的法力值随时间的变化，以及首领的生命值。以下是一些需要留意的常见问题：
            <ul>
              <li>
                如果你在战斗中长时间（或战斗中期）处于<em>接近0法力值</em>
                的状态，那么你可能需要提高<strong>法力效率。</strong>
              </li>
              <li>
                如果你在战斗结束时仍有<em>大量法力值</em>，那么你可能需要使用效率较低的技能来
                <strong>更快地消耗法力值</strong>。
              </li>
            </ul>
          </Para>
        </Explanation>
        <ManaLevelChartComponent
          reportCode={report.code}
          start={start_time}
          end={end_time}
          offset={offset_time}
          combatants={combatants}
          manaUpdates={manaValues?.manaUpdates ?? []}
          height={250}
        />
      </SubSection>
      {healingEfficiencyTracker && (
        <SubSection
          title={t({
            id: 'guide.foundation.healerMana.efficientSpells',
            message: 'Use Efficient Spells',
          })}
        >
          <Explanation>
            此表格显示你各技能的法力效率和时间效率。{' '}
            <HL>如果你法力值不足，请尝试改用更省法力的技能。</HL>
            如果你在战斗结束时法力值过多，请尝试改用时间效率更高但法力效率较低的技能。
          </Explanation>
          <HealingEfficiencyBreakdown tracker={healingEfficiencyTracker} disableDamageToggle />
        </SubSection>
      )}
    </SubSection>
  );
}
