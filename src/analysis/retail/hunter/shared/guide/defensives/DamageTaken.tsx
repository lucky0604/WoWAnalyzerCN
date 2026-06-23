import { GoodColor, Section, SubSection, useAnalyzers, useInfo } from 'interface/guide';
import { HideExplanationsToggle } from 'interface/guide/components/HideExplanationsToggle';
import Explanation from 'interface/guide/components/Explanation';
import Timeline from 'interface/guide/components/MajorDefensives/Timeline';
import AllCooldownUsageList from 'interface/guide/components/MajorDefensives/AllCooldownUsagesList';
import { SpellLink, TooltipElement } from 'interface';
import { Highlight } from 'interface/Highlight';
import TALENTS from 'common/TALENTS/hunter';
import SPELLS from 'common/SPELLS';
import SurvivalOfTheFittest from 'analysis/retail/hunter/shared/talents/SurvivalOfTheFittest';
import { useCombatLogParser } from 'interface/report/CombatLogParserContext';
import { t } from '@lingui/core/macro';

const MajorDefensives = () => {
  const info = useInfo();
  const combatParser = useCombatLogParser();
  const activeAnalyzers = combatParser.combatLogParser.activeModules.map((mod) => mod.constructor);
  const defensiveAnalyzers = [SurvivalOfTheFittest].filter((analyzer) =>
    activeAnalyzers.includes(analyzer),
  );
  return (
    <Section
      title={t({
        id: 'guide.hunter.shared.defensives.title',
        message: 'Defensives',
      })}
    >
      <HideExplanationsToggle id="hide-explanations-major-defensives" />
      <Explanation>
        <p>
          {t({
            id: 'guide.hunter.shared.defensives.intro',
            message:
              'Effectively using your major defensive cooldowns is an important aspect of your performance, as it will not only increase your own survivability, but also your entire raid by allowing healers to focus on keeping others alive.',
          })}
        </p>
        <p>
          <>
            {t({
              id: 'guide.hunter.shared.defensives.access.p1',
              message: 'As a ',
            })}
            <span className="Hunter">{info?.combatant?.spec?.wclSpecName ?? ''}</span>
            {t({
              id: 'guide.hunter.shared.defensives.access.p2',
              message: ' Hunter you have access to one relatively short CD defensive in ',
            })}
            <SpellLink spell={TALENTS.SURVIVAL_OF_THE_FITTEST_TALENT} />
            {t({
              id: 'guide.hunter.shared.defensives.access.p3',
              message: ', one heal in ',
            })}
            <SpellLink spell={SPELLS.EXHILARATION} />
            {t({
              id: 'guide.hunter.shared.defensives.access.p4',
              message: ', and a Pseudo-Immunity in ',
            })}
            <SpellLink spell={SPELLS.ASPECT_OF_THE_TURTLE} />
            {t({
              id: 'guide.hunter.shared.defensives.access.p5',
              message:
                '. Turtle will deflect nearly every attack cast ',
            })}
            <strong>
              {t({
                id: 'guide.hunter.shared.defensives.access.after',
                message: ' after',
              })}
            </strong>
            {t({
              id: 'guide.hunter.shared.defensives.access.p6',
              message:
                ' the ability is used. It will not deflect projectiles that are already traveling to you and care should be taken to not cancel it at inopportune times.',
            })}
          </>
        </p>
        <p>
          {t({
            id: 'guide.hunter.shared.defensives.lookFor',
            message: 'There are two things you should look for in your cooldown usage:',
          })}
        </p>
        <ol>
          <li>
            <>
              {t({
                id: 'guide.hunter.shared.defensives.coverage.p1',
                message: 'You should cover as many ',
              })}
              <TooltipElement
                content={
                  <>
                    {t({
                      id: 'guide.hunter.shared.defensives.damageSpike.tooltip.p1',
                      message: 'A ',
                    })}
                    <strong>
                      {t({
                        id: 'guide.hunter.shared.defensives.damageSpike.tooltip.strong',
                        message: 'damage spike',
                      })}
                    </strong>
                    {t({
                      id: 'guide.hunter.shared.defensives.damageSpike.tooltip.p2',
                      message: ' is when you take much more damage than normal in a small amount of time. These are visible on the Timeline below as tall spikes.',
                    })}
                  </>
                }
              >
                {t({
                  id: 'guide.hunter.shared.defensives.damageSpike',
                  message: 'damage spikes',
                })}
              </TooltipElement>
              {t({
                id: 'guide.hunter.shared.defensives.coverage.p2',
                message: ' as possible, and use any left over to cover periods of heavy, consistent damage.',
              })}
            </>
            <p>
              <small>
                <>
                  {t({
                    id: 'guide.hunter.shared.defensives.spikeHighlight.p1',
                    message: 'In the damage chart below, a spike highlighted in ',
                  })}
                  <Highlight color={GoodColor} textColor="black">
                    {t({
                      id: 'guide.hunter.shared.defensives.spikeHighlight.green',
                      message: 'green',
                    })}
                  </Highlight>
                  {t({
                    id: 'guide.hunter.shared.defensives.spikeHighlight.p2',
                    message: ' was covered by a defensive.',
                  })}
                </>
              </small>
            </p>
          </li>
          <li>
            <>
              {t({
                id: 'guide.hunter.shared.defensives.useThem.p1',
                message:
                  'You should ',
              })}
              <em>
                {t({
                  id: 'guide.hunter.shared.defensives.useThem.em',
                  message: 'use',
                })}
              </em>
              {t({
                id: 'guide.hunter.shared.defensives.useThem.p1b',
                message:
                  ' your cooldowns. This may seem silly—but not using defensives is a common problem! For ',
              })}
              <span className="Hunter">
                {t({
                  id: 'guide.hunter.shared.defensives.useThem.hunters',
                  message: 'Hunters',
                })}
              </span>
              {t({
                id: 'guide.hunter.shared.defensives.useThem.p2',
                message:
                  ', it is also likely to be fatal, since most of your mitigation lies in your active cooldowns.',
              })}
            </>
            <p>
              <small>
                {t({
                  id: 'guide.hunter.shared.defensives.useThem.gaps',
                  message:
                    'Below the damage chart, your cooldowns are shown. Large gaps may indicate that you could get more uses—but remember that covering spikes is more important than maximizing total casts!',
                })}
              </small>
            </p>
          </li>
        </ol>
      </Explanation>
      <SubSection
        title={t({
          id: 'guide.hunter.shared.defensives.damageTaken',
          message: 'Damage Taken',
        })}
      >
        <Timeline analyzers={useAnalyzers(defensiveAnalyzers)} />
      </SubSection>
      <AllCooldownUsageList analyzers={useAnalyzers(defensiveAnalyzers)} />
    </Section>
  );
};

export default MajorDefensives;
