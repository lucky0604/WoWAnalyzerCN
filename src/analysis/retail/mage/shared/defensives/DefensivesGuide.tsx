import { GoodColor, Section, SubSection, useAnalyzers } from 'interface/guide';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Explanation from 'interface/guide/components/Explanation';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { SpellLink, TooltipElement } from 'interface';
import { Highlight } from 'interface/Highlight';
import TALENTS from 'common/TALENTS/mage';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import IceBlock from './IceBlock';
import IceCold from './IceCold';

const MajorDefensives = () => {
  const defensiveAnalyzers = useAnalyzers([IceBlock, IceCold]);

  return (
    <Section title={t({ id: 'mage.shared.defensives.title', message: 'Defensives' })}>
      <HideExplanationsToggle id="hide-explanations-major-defensives" />
      <Explanation>
        <p>
          <Trans id="mage.shared.defensives.explanation1">
            Effectively using your major defensive cooldowns is an important aspect of your
            performance, as it will not only increase your own survivability, but also your entire
            raid by allowing healers to focus on keeping others alive.
          </Trans>
        </p>
        <p>
          <Trans id="mage.shared.defensives.explanation2">
            As an <span className="Mage">Mage</span> you have access to many defensives CDs such
            as <SpellLink spell={TALENTS.ICE_BLOCK_TALENT} /> /{' '}
            <SpellLink spell={TALENTS.ICE_COLD_TALENT} />.
          </Trans>
        </p>
        <p>
          <Trans id="mage.shared.defensives.explanation3">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <Trans id="mage.shared.defensives.point1">
              You should cover as many{' '}
              <TooltipElement
                content={
                  <Trans id="mage.shared.defensives.damageSpikeTooltip">
                    A <strong>damage spike</strong> is when you take much more damage than normal in
                    a small amount of time. These are visible on the Timeline below as tall spikes.
                  </Trans>
                }
              >
                damage spikes
              </TooltipElement>{' '}
              as possible, and use any left over to cover periods of heavy, consistent damage.
            </Trans>
            <p>
              <small>
                <Trans id="mage.shared.defensives.point1Note">
                  In the damage chart below, a spike highlighted in{' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>{' '}
                  was covered by a defensive.
                </Trans>
              </small>
            </p>
          </li>
          <li>
            <Trans id="mage.shared.defensives.point2">
              You should <em>use</em> your cooldowns. This may seem silly&mdash;but not using
              defensives is a common problem! For <span className="Mage">Mages</span>, it is also
              likely to be fatal, since most of your mitigation lies in your active cooldowns.
            </Trans>
            <p>
              <small>
                <Trans id="mage.shared.defensives.point2Note">
                  Below the damage chart, your cooldowns are shown. Large gaps may indicate that you
                  could get more uses&mdash;but remember that covering spikes is more important than
                  maximizing total casts!
                </Trans>
              </small>
            </p>
          </li>
        </ol>
      </Explanation>
      <SubSection title={t({ id: 'mage.shared.defensives.damageTaken', message: 'Damage Taken' })}>
        <Timeline analyzers={defensiveAnalyzers} />
      </SubSection>
      <AllCooldownUsageList analyzers={defensiveAnalyzers} />
    </Section>
  );
};

export default MajorDefensives;
