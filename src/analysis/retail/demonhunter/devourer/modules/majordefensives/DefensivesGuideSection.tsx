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
            <Trans id="dh.defensives.shortCD">
              As a <span className="DemonHunter">Demon Hunter</span> you have access to a frequent
              defensive CD in <SpellLink spell={SPELLS.BLUR} />.
            </Trans>
          </div>
        </p>
        <p>
          <Trans id="dh.defensives.twoThings">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <Trans id="dh.defensives.coverSpikes">
              You should cover as many{' '}
              <TooltipElement
                content={
                  <>
                    A <strong>damage spike</strong> is when you take much more damage than normal in
                    a small amount of time. These are visible on the Timeline below as tall spikes.
                  </>
                }
              >
                damage spikes
              </TooltipElement>{' '}
              as possible, and use any left over to cover periods of heavy, consistent damage.
            </Trans>
            <div>
              <small>
                <Trans id="dh.defensives.coverSpikesNote">
                  In the damage chart below, a spike highlighted in{' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>{' '}
                  was covered by a defensive.
                </Trans>
              </small>
            </div>
          </li>
          <li>
            <Trans id="dh.defensives.useThem">
              You should <em>use</em> your cooldowns. This may seem silly&mdash;but not using
              defensives is a common problem!
            </Trans>
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
