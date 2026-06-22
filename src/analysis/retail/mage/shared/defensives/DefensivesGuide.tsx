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
          <>
            {t({
              id: 'mage.shared.defensives.explanation2.p1',
              message: 'As an ',
            })}
            <span className="Mage">Mage</span>
            {t({
              id: 'mage.shared.defensives.explanation2.p2',
              message: ' you have access to many defensives CDs such as ',
            })}
            <SpellLink spell={TALENTS.ICE_BLOCK_TALENT} />
            {t({
              id: 'mage.shared.defensives.explanation2.p3',
              message: ' / ',
            })}
            <SpellLink spell={TALENTS.ICE_COLD_TALENT} />
            {t({
              id: 'mage.shared.defensives.explanation2.p4',
              message: '.',
            })}
          </>
        </p>
        <p>
          <Trans id="mage.shared.defensives.explanation3">
            There are two things you should look for in your cooldown usage:
          </Trans>
        </p>
        <ol>
          <li>
            <>
              {t({
                id: 'mage.shared.defensives.point1.p1',
                message: 'You should cover as many ',
              })}
              <TooltipElement
                content={
                  <>
                    {t({
                      id: 'mage.shared.defensives.damageSpikeTooltip.p1',
                      message: 'A ',
                    })}
                    <strong>
                      {t({
                        id: 'mage.shared.defensives.damageSpikeTooltip.bold',
                        message: 'damage spike',
                      })}
                    </strong>
                    {t({
                      id: 'mage.shared.defensives.damageSpikeTooltip.p2',
                      message: ' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.',
                    })}
                  </>
                }
              >
                {t({
                  id: 'mage.shared.defensives.point1.tooltipLabel',
                  message: 'damage spikes',
                })}
              </TooltipElement>
              {t({
                id: 'mage.shared.defensives.point1.p2',
                message: ' as possible, and use any left over to cover periods of heavy, consistent damage.',
              })}
            </>
            <p>
              <small>
                <>{t({ id: 'mage.shared.defensives.point1Note.p1', message: 'In the damage chart below, a spike highlighted in' })}
                  {' '}
                  <Highlight color={GoodColor} textColor="black">
                    green
                  </Highlight>
                  {' '}
                  {t({ id: 'mage.shared.defensives.point1Note.p2', message: 'was covered by a defensive.' })}
                </>
              </small>
            </p>
          </li>
          <li>
            <>{t({ id: 'mage.shared.defensives.point2.p1', message: 'You should ' })}
              <em>{t({ id: 'mage.shared.defensives.point2.em', message: 'use' })}</em>
              {t({ id: 'mage.shared.defensives.point2.p2', message: 'your cooldowns. This may seem silly&mdash;but not using defensives is a common problem! For ' })}
              <span className="Mage">{t({ id: 'mage.shared.defensives.point2.span', message: 'Mages' })}</span>
              {t({ id: 'mage.shared.defensives.point2.p3', message: ', it is also likely to be fatal, since most of your mitigation lies in your active cooldowns.' })}
            </>
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
