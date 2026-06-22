import type { JSX } from 'react';
import { SpellLink, TooltipElement } from 'interface';
import { GoodColor, Section, SubSection, useAnalyzers } from 'interface/guide';
import Explanation from 'interface/guide/components/Explanation';
import AllCooldownUsagesList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import { Highlight } from 'interface/Highlight';
import { MAJOR_ANALYZERS } from './config';
import SPELLS from '../../../spell-list_Monk_Brewmaster.retail';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function MajorDefensivesSection(): JSX.Element | null {
  const analyzers = useAnalyzers(MAJOR_ANALYZERS);
  return (
    <Section title={<SpellLink spell={SPELLS.FORTIFYING_BREW} />}>
      <Explanation>
        <p>
          <>
            {t({
              id: 'monk.brewmaster.major_defensives.explain1.p1',
              message:
                'Effectively using your major defensive cooldowns is a core part of playing tank well. While Brewmaster has fewer cooldowns than in previous expansions, proper use of ',
            })}
            <SpellLink spell={SPELLS.FORTIFYING_BREW} />
            {t({
              id: 'monk.brewmaster.major_defensives.explain1.p2',
              message: ' is still important.',
            })}
          </>
        </p>
        <p>
          <Trans id="monk.brewmaster.major_defensives.explain2">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <>
              {t({
                id: 'monk.brewmaster.major_defensives.spike_desc.p1',
                message: 'You should cover as many ',
              })}
              <TooltipElement
                content={
                  <>
                    {t({
                      id: 'monk.brewmaster.major_defensives.spike_tooltip.p1',
                      message: 'A ',
                    })}
                    <strong>{t({ id: 'monk.brewmaster.major_defensives.spike_tooltip.bold', message: 'damage spike' })}</strong>
                    {t({
                      id: 'monk.brewmaster.major_defensives.spike_tooltip.p2',
                      message:
                        ' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.',
                    })}
                  </>
                }
              >
                {t({ id: 'monk.brewmaster.major_defensives.spike_desc.p2', message: 'damage spikes' })}
              </TooltipElement>{' '}
              {t({
                id: 'monk.brewmaster.major_defensives.spike_desc.p3',
                message:
                  'as possible, and use any left over to cover periods of heavy, consistent damage.',
              })}
            </>
            <p>
              <small>
                <>{t({ id: 'monk.brewmaster.major_defensives.spike_chart_legend.p1', message: 'In the damage chart below, a spike highlighted in' })}
                  {' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>
                  {' '}
                  {t({ id: 'monk.brewmaster.major_defensives.spike_chart_legend.p2', message: 'was covered by a defensive.' })}
                </>
              </small>
            </p>
          </li>
          <li>
            <>{t({ id: 'monk.brewmaster.major_defensives.use_cooldowns.p1', message: 'You should ' })}
              <em>{t({ id: 'monk.brewmaster.major_defensives.use_cooldowns.em', message: 'use' })}</em>
              {t({ id: 'monk.brewmaster.major_defensives.use_cooldowns.p2', message: 'your cooldowns. This may seem silly&mdash;but not using major defensives is a common problem! For Brewmasters, it is also likely to be fatal.' })}
            </>
            <p>
              <small>
                <Trans id="monk.brewmaster.major_defensives.cooldowns_gap">
                  Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                  could get more uses&mdash;but remember that covering spikes is more important than
                  maximizing total casts!
                </Trans>
              </small>
            </p>
          </li>
        </ol>
      </Explanation>
      <SubSection title={t({ id: 'monk.brewmaster.major_defensives.timeline_title', message: 'Timeline' })}>
        <Timeline analyzers={analyzers} />
      </SubSection>
      <AllCooldownUsagesList analyzers={analyzers} />
    </Section>
  );
}
