import { GoodColor, Section, SubSection, useAnalyzers } from 'interface/guide';
import ObsidianScales from './ObsidianScales';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Explanation from 'interface/guide/components/Explanation';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { SpellLink, TooltipElement } from 'interface';
import { Highlight } from 'interface/Highlight';
import TALENTS from 'common/TALENTS/evoker';

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
const MajorDefensives = () => {
  const defensiveAnalyzers = [ObsidianScales];

  return (
    <Section title={t({ id: 'evoker.defensives.title', message: 'Defensives' })}>
      <HideExplanationsToggle id="hide-explanations-major-defensives" />
      <Explanation>
        <p>
          <Trans id="evoker.defensives.intro">
            Effectively using your major defensive cooldowns is an important aspect of your
            performance, as it will not only increase your own survivability, but also your entire
            raid by allowing healers to focus on keeping others alive.
          </Trans>
        </p>
        <p>
          <>{t({id:'evoker.defensives.shortCD.p1',message:'As an '})}<span className="Evoker">{t({id:'evoker.defensives.shortCD.span',message:'Evoker'})}</span>{t({id:'evoker.defensives.shortCD.p2',message:' you have access to short CD defensives such as '})}<SpellLink spell={TALENTS.OBSIDIAN_SCALES_TALENT} />{t({id:'evoker.defensives.shortCD.p3',message:' and '})}<SpellLink spell={TALENTS.ZEPHYR_TALENT} />{t({id:'evoker.defensives.shortCD.p4',message:'.'})}</>
        </p>
        <p>
          <Trans id="evoker.defensives.twoThings">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <>{t({id:'evoker.defensives.coverSpikes.p1',message:'You should cover as many '})}
              <TooltipElement
                content={
                  <>
                    {t({id:'evoker.defensives.coverSpikes.tooltip.p1',message:'A '})}<strong>{t({id:'evoker.defensives.coverSpikes.tooltip.bold',message:'damage spike'})}</strong>{t({id:'evoker.defensives.coverSpikes.tooltip.p2',message:' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.'})}
                  </>
                }
              >
                {t({id:'evoker.defensives.coverSpikes.damageSpikes',message:'damage spikes'})}
              </TooltipElement>
              {t({id:'evoker.defensives.coverSpikes.p2',message:' as possible, and use any left over to cover periods of heavy, consistent damage.'})}
            </>
            <p>
              <small>
                <>{t({ id: 'evoker.defensives.coverSpikesNote.p1', message: 'In the damage chart below, a spike highlighted in' })}
                  {' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>
                  {' '}
                  {t({ id: 'evoker.defensives.coverSpikesNote.p2', message: 'was covered by a defensive.' })}
                </>
              </small>
            </p>
          </li>
          <li>
            <>{t({ id: 'evoker.defensives.useThem.p1', message: 'You should ' })}
              <em>{t({ id: 'evoker.defensives.useThem.em', message: 'use' })}</em>
              {t({ id: 'evoker.defensives.useThem.p2', message: 'your cooldowns. This may seem silly&mdash;but not using defensives is a common problem! For ' })}
              <span className="Evoker">{t({ id: 'evoker.defensives.useThem.span', message: 'Evokers' })}</span>
              {t({ id: 'evoker.defensives.useThem.p3', message: ', it is also likely to be fatal, since most of your mitigation lies in your active cooldowns.' })}
            </>
            <p>
              <small>
                <Trans id="evoker.defensives.useThemNote">
                  Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                  could get more uses&mdash;but remember that covering spikes is more important than
                  maximizing total casts!
                </Trans>
              </small>
            </p>
          </li>
        </ol>
      </Explanation>
      <SubSection title={t({ id: 'evoker.defensives.damageTaken', message: 'Damage Taken' })}>
        <Timeline analyzers={useAnalyzers(defensiveAnalyzers)} />
      </SubSection>
      <AllCooldownUsageList analyzers={useAnalyzers(defensiveAnalyzers)} />
    </Section>
  );
};

export default MajorDefensives;
