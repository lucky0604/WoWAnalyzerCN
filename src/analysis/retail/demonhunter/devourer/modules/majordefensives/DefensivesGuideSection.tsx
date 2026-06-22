import { GoodColor, Section, SubSection, useAnalyzers } from 'interface/guide';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import BlurAnalyzer from './BlurAnalyzer';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Explanation from 'interface/guide/components/Explanation';
import SpellLink from 'interface/SpellLink';
import SPELLS from 'common/SPELLS';
import { TooltipElement } from 'interface/Tooltip';
import { Highlight } from 'interface/Highlight';

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
function DefensivesSection() {
  const defensiveAnalyzers = useAnalyzers([BlurAnalyzer]);
  return (
    <Section title={t({ id: 'dh.defensives.title', message: 'Defensives' })}>
      <HideExplanationsToggle id="hide-explanations-major-defensives" />
      <Explanation>
        <p>
          <Trans id="dh.defensives.intro">
            Effectively using your major defensive cooldowns is an important aspect of your
            performance, as it will not only increase your own survivability, but also your entire
            raid by allowing healers to focus on keeping others alive.
          </Trans>
          <div>
            {t({ id: 'dh.defensives.shortCD.p1', message: 'As a ' })}
            <span className="DemonHunter">{t({ id: 'dh.defensives.shortCD.span', message: 'Demon Hunter' })}</span>
            {t({ id: 'dh.defensives.shortCD.p2', message: ' you have access to a frequent defensive CD in ' })}
            <SpellLink spell={SPELLS.BLUR} />
            {t({ id: 'dh.defensives.shortCD.p3', message: '.' })}
          </div>
        </p>
        <p>
          <Trans id="dh.defensives.twoThings">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <>{t({ id: 'dh.defensives.coverSpikes.p1', message: 'You should cover as many' })}
              {' '}
              <TooltipElement
                content={
                  <>
                    A <strong>damage spike</strong> is when you take much more damage than normal in
                    a small amount of time. These are visible on the Timeline below as tall spikes.
                  </>
                }
              >
                damage spikes
              </TooltipElement>
              {' '}
              {t({ id: 'dh.defensives.coverSpikes.p2', message: 'as possible, and use any left over to cover periods of heavy, consistent damage.' })}
            </>
            <div>
              <small>
                <>{t({ id: 'dh.defensives.coverSpikesNote.p1', message: 'In the damage chart below, a spike highlighted in' })}
                  {' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>
                  {' '}
                  {t({ id: 'dh.defensives.coverSpikesNote.p2', message: 'was covered by a defensive.' })}
                </>
              </small>
            </div>
          </li>
          <li>
            <>{t({ id: 'dh.defensives.useThem.p1', message: 'You should ' })}
              <em>{t({ id: 'dh.defensives.useThem.em', message: 'use' })}</em>
              {t({ id: 'dh.defensives.useThem.p2', message: 'your cooldowns. This may seem silly&mdash;but not using defensives is a common problem!' })}
            </>
            <div>
              <small>
                <Trans id="dh.defensives.useThemNote">
                  Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                  could get more uses&mdash;but remember that covering spikes is more important than
                  maximizing total casts!
                </Trans>
              </small>
            </div>
          </li>
        </ol>
      </Explanation>
      <SubSection title={t({ id: 'dh.defensives.damageTaken', message: 'Damage Taken' })}>
        <Timeline analyzers={defensiveAnalyzers} />
      </SubSection>
      <AllCooldownUsageList analyzers={defensiveAnalyzers} />
    </Section>
  );
}

export default DefensivesSection;
