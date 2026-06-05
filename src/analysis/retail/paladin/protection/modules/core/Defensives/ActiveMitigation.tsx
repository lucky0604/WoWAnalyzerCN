import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SubSection, useAnalyzers } from 'interface/guide';
import Explanation from 'interface/guide/components/Explanation';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import { TIMELINE_ANALYZERS } from './config';

const ActiveMitigation = () => {
  const timelineAnalyzers = useAnalyzers(TIMELINE_ANALYZERS);
  return (
    <>
      <HideExplanationsToggle id="hide-explanations-active-defensives" />
      <SubSection>
        <Explanation>
          <p>
            <Trans id="paladin.protection.activeMitigation.wip">WIP!</Trans>
          </p>
          <p>
            <Trans id="paladin.protection.activeMitigation.sotrDescription">
              Shield of the Righteous increase your armour by a significant amout and it's important
              to have it active while taking physical damage.
            </Trans>
          </p>
          <p>
            <Trans id="paladin.protection.activeMitigation.consecrationDescription">
              Consecration, through your mastery, reduces the damage you take and it's benefitial to
              have it active while taking any type of damage.
            </Trans>
          </p>
          <p>
            <Trans id="paladin.protection.activeMitigation.chartDescription">
              In the chart below, you can see your Consecration and Shield of the Righteous(wip)
              uptimes and compare them to your damage intake.
            </Trans>
          </p>
        </Explanation>
      </SubSection>
      <SubSection
        title={t({ id: 'paladin.protection.activeMitigation.timeline', message: 'Timeline' })}
      >
        <Timeline analyzers={timelineAnalyzers} />
      </SubSection>
    </>
  );
};

export default ActiveMitigation;
