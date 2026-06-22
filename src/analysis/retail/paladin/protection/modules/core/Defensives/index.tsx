import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GoodColor, SubSection, useAnalyzers, useInfo } from 'interface/guide';
import Explanation from 'interface/guide/components/Explanation';
import { TooltipElement } from 'interface';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import { Highlight } from 'interface/Highlight';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsagesList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { MAJOR_ANALYZERS } from './config';
import MajorDefensive from 'interface/guide/components/MajorDefensives/MajorDefensiveAnalyzer';

const MajorDefensives = () => {
  const info = useInfo();
  const analyzers = info?.combatant ? MAJOR_ANALYZERS(info.combatant) : [];
  // we do the cast here because writing "constructor of a subclass of T" is hard
  const analyzerInstances = useAnalyzers(analyzers) as MajorDefensive<any, any>[];
  return (
    <>
      <HideExplanationsToggle id="hide-explanations-major-defensives" />
      <SubSection>
        <Explanation>
          <p>
            <Trans id="paladin.protection.defensives.effectiveUse">
              Effectively using your major defensive cooldowns is a core part of playing tank well.
              This is especially true for Protection Paladins, as we rely on our cooldowns to deal
              with incoming damage.
            </Trans>
          </p>
          <p>
            <Trans id="paladin.protection.defensives.twoThings">
              There are two things you should look for in your cooldown usage:
            </Trans>
          </p>
          <ol>
            <li>
              <>
                {t({ id: 'paladin.protection.defensives.coverSpikes.p1', message: 'You should cover as many ' })}
                <TooltipElement
                  content={
                    <>
                      {t({ id: 'paladin.protection.defensives.damageSpikeTooltip.p1', message: 'A ' })}
                      <strong>{t({ id: 'paladin.protection.defensives.damageSpikeTooltip.damageSpike', message: 'damage spike' })}</strong>
                      {t({ id: 'paladin.protection.defensives.damageSpikeTooltip.p2', message: ' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.' })}
                    </>
                  }
                >
                  {t({ id: 'paladin.protection.defensives.coverSpikes.damageSpikes', message: 'damage spikes' })}
                </TooltipElement>
                {t({ id: 'paladin.protection.defensives.coverSpikes.p2', message: ' as possible, and use any left over to cover periods of heavy, consistent damage.' })}
              </>
              <br />
              <small>
                <>{t({ id: 'paladin.protection.defensives.spikeHighlight.p1', message: 'In the damage chart below, a spike highlighted in' })}
                  {' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>
                  {' '}
                  {t({ id: 'paladin.protection.defensives.spikeHighlight.p2', message: 'was covered by a defensive.' })}
                </>
              </small>
            </li>
            <li>
              <>{t({ id: 'paladin.protection.defensives.useCooldowns.p1', message: 'You should ' })}
                <em>{t({ id: 'paladin.protection.defensives.useCooldowns.em', message: 'use' })}</em>
                {t({ id: 'paladin.protection.defensives.useCooldowns.p2', message: 'your cooldowns. This may seem silly&mdash;but not using major defensives is a common problem! For Protection Paladins, it is also likely to be fatal.' })}
              </>
              <br />
              <small>
                <Trans id="paladin.protection.defensives.cooldownsShown">
                  Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                  could get more uses&mdash;but remember that covering spikes is more important than
                  maximizing total casts!
                </Trans>
              </small>
            </li>
          </ol>
        </Explanation>
      </SubSection>
      <SubSection
        title={t({ id: 'paladin.protection.defensives.timeline', message: 'Timeline' })}
      >
        <Timeline analyzers={analyzerInstances} />
      </SubSection>
      <AllCooldownUsagesList analyzers={analyzerInstances} />
    </>
  );
};

export default MajorDefensives;
